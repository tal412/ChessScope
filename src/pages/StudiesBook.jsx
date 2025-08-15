import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AppBar } from '@/components/ui/flexible-layout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Crown, 
  Shield,
  Edit,
  Trash2,
  Eye,
  ChevronRight,
  Loader2,
  Filter,
  FolderPlus
} from 'lucide-react';
import { userStudy, studyTag, studyTagsMapping, studyFolder } from '@/api/studyEntities';
import { waitForDatabase } from '@/api/database';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '../contexts/AuthContext';
import StudyDetailsDialog from '@/components/studies/StudyDetailsDialog';
import TagManagementDialog from '@/components/studies/TagManagementDialog';
import FolderCard from '@/components/studies/FolderCard';
import FolderCreateDialog from '@/components/studies/FolderCreateDialog';
import StudyCard from '@/components/studies/StudyCard';
import { cn } from '@/lib/utils';
import { autoDriveSync } from '../services/AutoDriveSync.js';


// Sortable wrapper components
function SortableStudyCard({ study, folderInfo, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `study-${study.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StudyCard study={study} isDragging={isDragging} folderInfo={folderInfo} {...props} />
    </div>
  );
}

function DroppableFolderCard({ folder, ...props }) {
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `folder-drop-${folder.id}`,
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `folder-${folder.id}`,
    data: {
      type: 'folder',
      folder: folder
    }
  });

  // Only apply transform when the folder itself is being dragged
  const sortableStyle = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? transition : undefined,
  };

  // Combine refs
  const combinedRef = (node) => {
    setDroppableRef(node);
    setSortableRef(node);
  };

  return (
    <div ref={combinedRef} style={sortableStyle} {...attributes} {...listeners}>
      <FolderCard 
        folder={folder} 
        isDragging={isDragging}
        isDragOver={isOver}
        {...props} 
      />
    </div>
  );
}

export default function StudiesBook() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSyncing, syncProgress, syncStatus } = useAuth();
  const [studies, setStudies] = useState([]);
  const [folders, setFolders] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColor, setFilterColor] = useState('all'); // 'all', 'white', 'black'
  const [deleteStudy, setDeleteStudy] = useState(null);
  const [activeId, setActiveId] = useState(null);
  
  // Conflict state
  const [hasConflicts, setHasConflicts] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  
  // Get folder from URL params
  const folderIdFromUrl = searchParams.get('folder');
  const [selectedFolder, setSelectedFolder] = useState(folderIdFromUrl ? parseInt(folderIdFromUrl) : null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize auto sync and load data
  useEffect(() => {
    const initializeAndLoadData = async () => {
      try {
        // Initialize auto sync service
        await autoDriveSync.initialize();
        
        // Check for conflicts
        const conflictsExist = await autoDriveSync.checkForConflicts();
        setHasConflicts(conflictsExist);
        
        if (conflictsExist) {
          setConflictError('You have sync conflicts. Some operations may be disabled until resolved.');
        }
        
        // Wait for database to be ready before loading data
        await waitForDatabase();
        
        // Load all data once database is ready
        await Promise.all([
          loadStudies(),
          loadFolders(),
          loadTags()
        ]);
      } catch (error) {
        console.error('Error waiting for database or loading data:', error);
        setLoading(false);
      }
    };
    
    initializeAndLoadData();

    // Listen for conflict changes
    const handleConflictChange = (conflicts) => {
      setHasConflicts(!!conflicts);
      if (conflicts) {
        setConflictError('Sync conflicts detected. Some operations may be disabled until resolved.');
      } else {
        setConflictError(null);
      }
    };

    autoDriveSync.addConflictListener(handleConflictChange);

    return () => {
      autoDriveSync.removeConflictListener(handleConflictChange);
    };
  }, []);

  // Update selectedFolder when URL changes
  useEffect(() => {
    const folderId = searchParams.get('folder');
    setSelectedFolder(folderId ? parseInt(folderId) : null);
  }, [searchParams]);

  const loadStudies = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      
      // Wait for database to be ready
      await waitForDatabase();
      
      const username = localStorage.getItem('chesscope_username');
      
      if (!username) {
        console.warn('No username found');
        if (showLoader) {
          setLoading(false);
        }
        return;
      }

      const userStudies = await userStudy.getByUsername(username);
      
      // Load tags for each study
      const studiesWithTags = await Promise.all(
        userStudies.map(async (study) => {
          try {
            const tags = await studyTagsMapping.getTagsByStudyId(study.id);
            console.log('📋 StudiesBook: Loaded tags for study', study.name, '(id:', study.id, '):', tags);
            return { ...study, tags: tags || [] };
          } catch (error) {
            console.warn('Error loading tags for study:', study.id, error);
            return { ...study, tags: [] };
          }
        })
      );
      
      setStudies(studiesWithTags);
    } catch (error) {
      console.error('Error loading studies:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const loadTags = async () => {
    try {
      // Wait for database to be ready
      await waitForDatabase();
      
      console.log('📋 StudiesBook: Loading tags from server...');
      const tags = await studyTag.getAll();
      console.log('📋 StudiesBook: Loaded tags from server:', tags.length, 'tags:', tags.map(t => ({id: t.id, name: t.name})));
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
      setAvailableTags([]);
    }
  };

  const loadFolders = async () => {
    try {
      // Wait for database to be ready
      await waitForDatabase();
      
      const username = localStorage.getItem('chesscope_username');
      
      if (!username) {
        console.warn('No username found for folders');
        return;
      }

      const userFolders = await studyFolder.getByUsername(username);
      setFolders(userFolders);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleTagsChanged = () => {
    console.log('🔄 StudiesBook: handleTagsChanged called - reloading tags and studies...');
    loadTags();
    loadStudies(); // Reload studies to get updated tag information
  };

  // Filter studies based on search, color, tags, and selected folder
  const filteredStudies = studies.filter(study => {
    const matchesSearch = study.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesColor = filterColor === 'all' || study.color === filterColor;
    const matchesTags = selectedTagIds.length === 0 || 
      (study.tags && study.tags.some(tag => selectedTagIds.includes(tag.id)));
    
    // Filter by selected folder
    let matchesFolder = true;
    if (selectedFolder === 'root') {
      matchesFolder = !study.folder_id || study.folder_id === null;
    } else if (selectedFolder !== null) {
      matchesFolder = study.folder_id === selectedFolder;
    }
    
    return matchesSearch && matchesColor && matchesTags && matchesFolder;
  });

  // Get displayed items (folders + studies)
  const getDisplayedItems = () => {
    if (selectedFolder !== null) {
      // Show only studies in selected folder or root
      return filteredStudies;
    }
    
    // If filtering by tags OR searching, show all matching studies (no folders)
    if (selectedTagIds.length > 0 || searchTerm.trim()) {
      return filteredStudies;
    }
    
    // Show both folders and unfoldered studies
    const unfolderedStudies = filteredStudies.filter(study => !study.folder_id || study.folder_id === null);
    return [...folders, ...unfolderedStudies];
  };

  const displayedItems = getDisplayedItems();

  // Get folder info for a study
  const getFolderInfoForStudy = (study) => {
    if (!study.folder_id) return null;
    const folder = folders.find(f => f.id === study.folder_id);
    return folder ? { name: folder.name, color: folder.color, icon: folder.icon } : null;
  };

  // Handle creating a new study - now handled by the dialog
  const handleCreateStudy = async (studyDetails) => {
    const tagIds = studyDetails.selectedTags?.map(tag => tag.id).join(',') || '';
    console.log('📋 StudiesBook: Creating study with details:', studyDetails);
    console.log('📋 StudiesBook: Selected tags:', studyDetails.selectedTags);
    console.log('📋 StudiesBook: Tag IDs string:', tagIds);
    
    const params = new URLSearchParams({
      name: studyDetails.name,
      color: studyDetails.color,
      initialFen: studyDetails.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      tags: tagIds
    });
    
    const url = `/studies-book/editor/new?${params.toString()}`;
    console.log('📋 StudiesBook: Navigating to URL:', url);
    navigate(url);
  };

  // Handle study click - go to analysis view
  const handleStudyClick = (studyId) => {
    navigate(`/studies-book/study/${studyId}`);
  };

  // Handle edit study
  const handleEditStudy = (e, studyId) => {
    if (e) {
      e.stopPropagation();
    }
    navigate(`/studies-book/editor/${studyId}`);
  };

  // Handle delete study
  const handleDeleteStudy = async () => {
    if (!deleteStudy) return;
    
    // Check if user can edit (no conflicts)
    if (!autoDriveSync.canEditStudies()) {
      console.warn('Delete blocked due to sync conflicts');
      setConflictError('Cannot delete studies due to sync conflicts. Please resolve them first.');
      setDeleteStudy(null);
      return;
    }
    
    try {
      await userStudy.delete(deleteStudy.id);
      await loadStudies(false); // Don't show loader for deletion
      
      // Trigger automatic sync after successful deletion
      await autoDriveSync.autoSync('study_delete', {
        studyId: deleteStudy.id,
        name: deleteStudy.name
      });
      
      setDeleteStudy(null);
    } catch (error) {
      console.error('Error deleting study:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        await autoDriveSync.checkForConflicts();
      }
    }
  };

  // Folder management functions
  const handleCreateFolder = async (folderData) => {
    // Check if user can edit (no conflicts)
    if (!autoDriveSync.canEditStudies()) {
      console.warn('Folder creation blocked due to sync conflicts');
      setConflictError('Cannot create folders due to sync conflicts. Please resolve them first.');
      return;
    }

    try {
      const username = localStorage.getItem('chesscope_username');
      if (!username) return;

      const newFolder = await studyFolder.create({
        ...folderData,
        username,
        position: folders.length
      });
      
      await loadFolders();
      
      // Trigger automatic sync after successful folder creation
      await autoDriveSync.autoSync('folder_create', {
        folderId: newFolder.id,
        name: folderData.name
      });
      
    } catch (error) {
      console.error('Error creating folder:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        await autoDriveSync.checkForConflicts();
      }
    }
  };

  const handleEditFolder = async (updatedFolder) => {
    // Check if user can edit (no conflicts)
    if (!autoDriveSync.canEditStudies()) {
      console.warn('Folder edit blocked due to sync conflicts');
      setConflictError('Cannot edit folders due to sync conflicts. Please resolve them first.');
      return;
    }

    try {
      await studyFolder.update(updatedFolder.id, updatedFolder);
      await loadFolders();
      
      // Trigger automatic sync after successful folder update
      await autoDriveSync.autoSync('folder_update', {
        folderId: updatedFolder.id,
        name: updatedFolder.name
      });
      
      // Keep legacy event for compatibility
      window.dispatchEvent(new CustomEvent('databaseChange', { 
        detail: { type: 'folder_update', folderId: updatedFolder.id } 
      }));
    } catch (error) {
      console.error('Error editing folder:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        await autoDriveSync.checkForConflicts();
      }
    }
  };

  const handleDeleteFolder = async (folder) => {
    // Check if user can edit (no conflicts)
    if (!autoDriveSync.canEditStudies()) {
      console.warn('Folder deletion blocked due to sync conflicts');
      setConflictError('Cannot delete folders due to sync conflicts. Please resolve them first.');
      return;
    }

    try {
      // Move studies out of folder first
      const folderStudies = studies.filter(study => study.folder_id === folder.id);
      for (const study of folderStudies) {
        await userStudy.update(study.id, { folder_id: null });
      }
      
      await studyFolder.delete(folder.id);
      await loadFolders();
      await loadStudies(false); // Don't show loader for folder deletion
      
      // Trigger automatic sync after successful folder deletion
      await autoDriveSync.autoSync('folder_delete', {
        folderId: folder.id,
        name: folder.name,
        movedStudies: folderStudies.length
      });
      
    } catch (error) {
      console.error('Error deleting folder:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        await autoDriveSync.checkForConflicts();
      }
    }
  };

  const handleFolderClick = (folder) => {
    // When clicking a folder, update the URL
    setSearchParams({ folder: folder.id.toString() });
  };

  const handleBackClick = () => {
    // Remove folder param to go back to root
    setSearchParams({});
  };

  const getCurrentFolderName = () => {
    if (selectedFolder === null) return null;
    const folder = folders.find(f => f.id === selectedFolder);
    return folder ? folder.name : 'Unknown Folder';
  };

  const handleMoveStudyToFolder = async (study, targetFolder) => {
    // Check if user can edit (no conflicts)
    if (!autoDriveSync.canEditStudies()) {
      console.warn('Study move blocked due to sync conflicts');
      setConflictError('Cannot move studies due to sync conflicts. Please resolve them first.');
      return;
    }

    try {
      const folderId = targetFolder ? targetFolder.id : null;
      await userStudy.update(study.id, { folder_id: folderId });
      await loadStudies(false); // Don't show loader for quick updates
      
      // Trigger automatic sync after successful study move
      await autoDriveSync.autoSync('study_move', {
        studyId: study.id,
        studyName: study.name,
        targetFolderId: folderId,
        targetFolderName: targetFolder?.name || 'Root'
      });
      
      // Keep legacy event for compatibility
      window.dispatchEvent(new CustomEvent('databaseChange', { 
        detail: { type: 'study_move', studyId: study.id, folderId } 
      }));
    } catch (error) {
      console.error('Error moving study to folder:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        await autoDriveSync.checkForConflicts();
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // Parse item types and IDs
    const getItemInfo = (id) => {
      const strId = String(id);
      if (strId.startsWith('study-')) {
        return { type: 'study', id: parseInt(strId.replace('study-', '')) };
      } else if (strId.startsWith('folder-drop-')) {
        return { type: 'folder-drop', id: parseInt(strId.replace('folder-drop-', '')) };
      } else if (strId.startsWith('folder-')) {
        return { type: 'folder', id: parseInt(strId.replace('folder-', '')) };
      }
      return null;
    };

    const activeInfo = getItemInfo(activeId);
    const overInfo = getItemInfo(overId);

    if (!activeInfo) {
      setActiveId(null);
      return;
    }

    try {
      // Handle study being dropped on folder (priority handling)
      if (activeInfo.type === 'study' && (overInfo?.type === 'folder' || overInfo?.type === 'folder-drop')) {
        const study = studies.find(s => s.id === activeInfo.id);
        const folder = folders.find(f => f.id === overInfo.id);
        
        if (study && folder && study.folder_id !== folder.id) {
          // Immediately update local state to prevent animation back
          setStudies(prevStudies => 
            prevStudies.map(s => 
              s.id === study.id 
                ? { ...s, folder_id: folder.id }
                : s
            )
          );
          
          // Then update database in background
          userStudy.update(study.id, { folder_id: folder.id })
            .then(() => {
              // Reload to ensure consistency (without loader)
              loadStudies(false);
            })
            .catch(error => {
              console.error('Error moving study to folder:', error);
              // Revert local state on error
              loadStudies(false);
            });
        }
        setActiveId(null);
        return;
      }

      // Only proceed with reordering if we're not dropping on a folder
      if (!overInfo || activeId === overId) {
        setActiveId(null);
        return;
      }
      
      // Handle reordering within the same type and context
      if (activeInfo.type === overInfo.type) {
        if (activeInfo.type === 'folder' && selectedFolder === null) {
          // Reorder folders (only in root view)
          const oldIndex = folders.findIndex(f => f.id === activeInfo.id);
          const newIndex = folders.findIndex(f => f.id === overInfo.id);
          
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const newFolders = arrayMove(folders, oldIndex, newIndex);
            const folderPositions = newFolders.map((folder, index) => ({
              id: folder.id,
              position: index
            }));
            
            await studyFolder.updatePositions(folderPositions);
            await loadFolders();
          }
        } else if (activeInfo.type === 'study') {
          // Reorder studies within same folder context
          const activeStudy = studies.find(s => s.id === activeInfo.id);
          const overStudy = studies.find(s => s.id === overInfo.id);
          
          if (activeStudy && overStudy && activeStudy.folder_id === overStudy.folder_id) {
            const contextStudies = filteredStudies.filter(s => s.folder_id === activeStudy.folder_id);
            const oldIndex = contextStudies.findIndex(s => s.id === activeInfo.id);
            const newIndex = contextStudies.findIndex(s => s.id === overInfo.id);
            
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              const newStudies = arrayMove(contextStudies, oldIndex, newIndex);
              const studyPositions = newStudies.map((study, index) => ({
                id: study.id,
                position: index,
                folderId: study.folder_id
              }));
              
              await userStudy.updatePositions(studyPositions);
              await loadStudies(false); // Don't show loader for reordering
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling drag end:', error);
    }
    
    setActiveId(null);
  };

  const getStudiesInFolder = (folderId) => {
    return studies.filter(study => study.folder_id === folderId).length;
  };

  if (loading && !isSyncing) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-purple-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-lg"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-slate-200">
              Loading Studies Book
            </h2>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              Loading your saved studies and analysis
            </p>
            <div className="flex items-center justify-center gap-2 mt-6">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Conflict Error Alert */}
      {conflictError && (
        <div className="bg-slate-800 border-b border-slate-700 p-4">
          <Alert className="bg-red-900/20 border-red-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-400">
              {conflictError}
              <div className="mt-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate('/google-drive-sync')}
                  className="text-xs bg-red-800/30 border-red-600 text-red-300 hover:bg-red-700/40"
                >
                  Resolve Conflicts
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Header using AppBar */}
      <AppBar
        title={
          selectedFolder !== null 
            ? `Studies Book / ${getCurrentFolderName()}`
            : "Studies Book"
        }
        icon={BookOpen}
        centerControls={
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search studies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>
        }
        rightControls={
          <>
            {selectedFolder !== null && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBackClick}
                className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white"
              >
                ← Back
              </Button>
            )}
            {selectedFolder === null && (
              <FolderCreateDialog onCreateFolder={handleCreateFolder}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New Folder
                </Button>
              </FolderCreateDialog>
            )}
            <TagManagementDialog onTagsChanged={handleTagsChanged}>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white"
              >
                <Edit className="w-4 h-4 mr-2" />
                Manage Tags
              </Button>
            </TagManagementDialog>
            <StudyDetailsDialog onConfirm={handleCreateStudy}>
              <Button 
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Study
              </Button>
            </StudyDetailsDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white">
                  <div className="flex items-center gap-2">
                    {filterColor === 'all' ? (
                      <Filter className="w-4 h-4 text-slate-400" />
                    ) : filterColor === 'white' ? (
                      <Crown className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Shield className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="hidden sm:inline">
                      {filterColor === 'all' ? 'All' : filterColor === 'white' ? 'White' : 'Black'}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                <DropdownMenuItem 
                  onClick={() => setFilterColor('all')}
                  className="text-slate-200 hover:text-white hover:bg-slate-700"
                >
                  <Filter className="w-4 h-4 mr-2 text-slate-400" />
                  All
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterColor('white')}
                  className="text-slate-200 hover:text-white hover:bg-slate-700"
                >
                  <Crown className="w-4 h-4 mr-2 text-amber-400" />
                  White
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterColor('black')}
                  className="text-slate-200 hover:text-white hover:bg-slate-700"
                >
                  <Shield className="w-4 h-4 mr-2 text-slate-400" />
                  Black
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="flex-1 p-6 pl-6 pr-12">
        <div className="w-full">

        {/* Tag Filter */}
        {availableTags.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all duration-200 border-2",
                  selectedTagIds.length === 0
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                )}
                onClick={() => setSelectedTagIds([])}
              >
                All
              </Badge>
              {availableTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className={cn(
                      "cursor-pointer transition-all duration-200 border-2",
                      isSelected 
                        ? 'border-current text-white' 
                        : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                    )}
                    style={{
                      backgroundColor: isSelected ? tag.color : 'transparent',
                      borderColor: isSelected ? tag.color : undefined
                    }}
                    onClick={() => {
                      setSelectedTagIds(prev => 
                        prev.includes(tag.id) 
                          ? prev.filter(id => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {displayedItems.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {searchTerm || filterColor !== 'all' || selectedTagIds.length > 0
                ? 'No items found' 
                : selectedFolder !== null 
                  ? 'This folder is empty'
                  : 'No studies yet'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm || filterColor !== 'all' || selectedTagIds.length > 0
                ? 'Try adjusting your search or filters'
                : selectedFolder !== null
                  ? 'Drag studies here or create new ones'
                  : 'Create your first study or folder to get started'}
            </p>
            {!searchTerm && filterColor === 'all' && selectedTagIds.length === 0 && selectedFolder === null && (
              <div className="flex gap-4 justify-center">
                <StudyDetailsDialog 
                  onConfirm={handleCreateStudy}
                  title="Create Your First Study"
                  confirmText="Create Study"
                >
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Study
                  </Button>
                </StudyDetailsDialog>
                <FolderCreateDialog onCreateFolder={handleCreateFolder}>
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Create Your First Folder
                  </Button>
                </FolderCreateDialog>
              </div>
            )}
          </div>
        )}

        {/* Drag and Drop Context */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={displayedItems.map(item => 
              item.hasOwnProperty('initial_fen') ? `study-${item.id}` : `folder-${item.id}`
            )}
            strategy={rectSortingStrategy}
          >
            {selectedFolder === null ? (
              (selectedTagIds.length > 0 || searchTerm.trim()) ? (
                // Filtering view: Show all matching studies with folder names
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-slate-400">
                      {selectedTagIds.length > 0 && searchTerm.trim() ? (
                        `Studies matching "${searchTerm}" with selected tags (${filteredStudies.length} found)`
                      ) : selectedTagIds.length > 0 ? (
                        `Studies with selected tags (${filteredStudies.length} found)`
                      ) : (
                        `Studies matching "${searchTerm}" (${filteredStudies.length} found)`
                      )}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start">
                    {filteredStudies.map((study) => (
                      <SortableStudyCard
                        key={`study-${study.id}`}
                        study={study}
                        onClick={() => handleStudyClick(study.id)}
                        onEdit={() => handleEditStudy(null, study.id)}
                        onDelete={() => setDeleteStudy(study)}
                        onMoveToFolder={handleMoveStudyToFolder}
                        folders={folders}
                        folderInfo={getFolderInfoForStudy(study)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Root view: Show folders first, then unfoldered studies in separate sections
                <div className="space-y-6">
                  {/* Folders Section */}
                  {folders.length > 0 && (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start">
                        {folders.map((folder) => (
                          <DroppableFolderCard
                            key={`folder-${folder.id}`}
                            folder={folder}
                            studiesCount={getStudiesInFolder(folder.id)}
                            onClick={() => handleFolderClick(folder)}
                            onEdit={handleEditFolder}
                            onDelete={handleDeleteFolder}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unfoldered Studies Section */}
                  {filteredStudies.filter(study => !study.folder_id || study.folder_id === null).length > 0 && (
                    <div>
                      {folders.length > 0 && (
                        <div className="border-t border-slate-700 pt-6">
                          <h3 className="text-sm font-medium text-slate-400 mb-4">Other Studies</h3>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start">
                        {filteredStudies
                          .filter(study => !study.folder_id || study.folder_id === null)
                          .map((study) => (
                            <SortableStudyCard
                              key={`study-${study.id}`}
                              study={study}
                              onClick={() => handleStudyClick(study.id)}
                              onEdit={() => handleEditStudy(null, study.id)}
                              onDelete={() => setDeleteStudy(study)}
                              onMoveToFolder={handleMoveStudyToFolder}
                              folders={folders}
                            />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              // Folder view: Show only studies in the selected folder
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start">
                {filteredStudies.map((study) => (
                  <SortableStudyCard
                    key={`study-${study.id}`}
                    study={study}
                    onClick={() => handleStudyClick(study.id)}
                    onEdit={() => handleEditStudy(null, study.id)}
                    onDelete={() => setDeleteStudy(study)}
                    onMoveToFolder={handleMoveStudyToFolder}
                    folders={folders}
                  />
                ))}
              </div>
            )}
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeId ? (
              (() => {
                const activeIdStr = String(activeId);
                if (activeIdStr.startsWith('study-')) {
                  const studyId = parseInt(activeIdStr.replace('study-', ''));
                  const study = studies.find(s => s.id === studyId);
                  return study ? <StudyCard study={study} isDragging /> : null;
                } else if (activeIdStr.startsWith('folder-')) {
                  const folderId = parseInt(activeIdStr.replace('folder-', ''));
                  const folder = folders.find(f => f.id === folderId);
                  return folder ? <FolderCard folder={folder} isDragging /> : null;
                }
                return null;
              })()
            ) : null}
          </DragOverlay>
        </DndContext>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteStudy} onOpenChange={() => setDeleteStudy(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete Study</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete "{deleteStudy?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudy}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}