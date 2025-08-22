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
  FolderPlus,
  AlertTriangle
} from 'lucide-react';
import { userStudy, studyTag, studyTagsMapping, studyFolder } from '@/api/hybridEntities';
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
import { useAuth } from '../contexts/FirebaseAuthContext';
import StudyDetailsDialog from '@/components/studies/StudyDetailsDialog';
import TagManagementDialog from '@/components/studies/TagManagementDialog';
import FolderCard from '@/components/studies/FolderCard';
import FolderCreateDialog from '@/components/studies/FolderCreateDialog';
import StudyCard from '@/components/studies/StudyCard';
import { cn } from '@/lib/utils';
// Firebase sync is handled automatically by hybrid entities


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
  const { isGoogleSignedIn, signInWithGoogle, isLoading: isAuthLoading } = useAuth();
  const [studies, setStudies] = useState([]);
  const [folders, setFolders] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColor, setFilterColor] = useState('all'); // 'all', 'white', 'black'
  const [deleteStudy, setDeleteStudy] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingStudies, setIsLoadingStudies] = useState(true);
  
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

  // Initialize data loading
  useEffect(() => {
    const initializeAndLoadData = async () => {
      try {
        // Only load data if Google is signed in
        if (isGoogleSignedIn) {
          setIsLoadingStudies(true);
          // Load all data in parallel
          await Promise.all([
            loadStudies(),
            loadFolders(),
            loadTags()
          ]);
          setIsLoadingStudies(false);
        } else {
          // If not signed in, stop loading immediately
          setIsLoadingStudies(false);
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoadingStudies(false);
      }
    };
    
    // Don't run if auth is still loading
    if (!isAuthLoading) {
      initializeAndLoadData();
    }
  }, [isGoogleSignedIn, isAuthLoading]);

  // Update selectedFolder when URL changes
  useEffect(() => {
    const folderId = searchParams.get('folder');
    setSelectedFolder(folderId ? parseInt(folderId) : null);
  }, [searchParams]);

  const loadStudies = async () => {
    try {
      const username = localStorage.getItem('chesscope_username');
      
      if (!username) {
        console.warn('No username found');
        return;
      }

      const userStudies = await userStudy.getByUsername(username);
      
      // Load tags for each study - optimized to reduce database calls
      const studiesWithTags = await Promise.all(
        userStudies.map(async (study) => {
          try {
            const tags = await studyTagsMapping.getTagsByStudyId(study.id);
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
    }
  };

  const loadTags = async () => {
    try {
      const tags = await studyTag.getAll();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
      setAvailableTags([]);
    }
  };

  const loadFolders = async () => {
    try {
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

  // Handle delete study - optimistic deletion for immediate UX
  const handleDeleteStudy = async () => {
    if (!deleteStudy) return;
    
    const studyToDelete = deleteStudy;
    
    // Immediate UI update - remove from local state
    setStudies(prevStudies => prevStudies.filter(study => study.id !== studyToDelete.id));
    setDeleteStudy(null);
    
    // Background deletion - fire and forget
    userStudy.delete(studyToDelete.id).catch(error => {
      console.error('Background study deletion failed:', error);
      // Could add toast notification here if needed, but don't revert UI
      // The sync manager will handle conflicts if needed
    });
  };

  // Folder management functions
  const handleCreateFolder = async (folderData) => {
    // Folders can be created - Firebase handles sync automatically

    try {
      const username = localStorage.getItem('chesscope_username');
      if (!username) return;

      const newFolder = await studyFolder.create({
        ...folderData,
        username,
        position: folders.length
      });
      
      await loadFolders();
      
      // Firebase sync handled automatically by hybrid entities
      
    } catch (error) {
      console.error('Error creating folder:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        // Conflicts will be detected automatically by sync manager
      }
    }
  };

  const handleEditFolder = async (updatedFolder) => {
    // Check if user can edit (no conflicts)
    // Folders can be edited - Firebase handles sync automatically

    try {
      await studyFolder.update(updatedFolder.id, updatedFolder);
      await loadFolders();
      
      // Firebase sync handled automatically by hybrid entities
      
      // Keep legacy event for compatibility
      window.dispatchEvent(new CustomEvent('databaseChange', { 
        detail: { type: 'folder_update', folderId: updatedFolder.id } 
      }));
    } catch (error) {
      console.error('Error editing folder:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        // Conflicts will be detected automatically by sync manager
      }
    }
  };

  const handleDeleteFolder = async (folder) => {
    // Optimistic folder deletion for immediate UX
    
    // Immediate UI updates
    const folderStudies = studies.filter(study => study.folder_id === folder.id);
    
    // Move studies out of folder in UI immediately
    setStudies(prevStudies => 
      prevStudies.map(study => 
        study.folder_id === folder.id 
          ? { ...study, folder_id: null }
          : study
      )
    );
    
    // Remove folder from UI immediately
    setFolders(prevFolders => prevFolders.filter(f => f.id !== folder.id));
    
    // Background operations - fire and forget
    Promise.all([
      // Move studies out of folder in database
      ...folderStudies.map(study => 
        userStudy.update(study.id, { folder_id: null })
      ),
      // Delete folder from database
      studyFolder.delete(folder.id)
    ]).catch(error => {
      console.error('Background folder deletion failed:', error);
      // Could add toast notification here if needed, but don't revert UI
    });
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
    // Studies can be moved - Firebase handles sync automatically

    try {
      const folderId = targetFolder ? targetFolder.id : null;
      await userStudy.update(study.id, { folder_id: folderId });
      await loadStudies(); // Don't show loader for quick updates
      
      // Firebase sync handled automatically by hybrid entities
      
      // Keep legacy event for compatibility
      window.dispatchEvent(new CustomEvent('databaseChange', { 
        detail: { type: 'study_move', studyId: study.id, folderId } 
      }));
    } catch (error) {
      console.error('Error moving study to folder:', error);
      
      // Check if error is due to conflicts
      if (error.message.includes('conflict')) {
        // Conflicts will be detected automatically by sync manager
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
              loadStudies();
            })
            .catch(error => {
              console.error('Error moving study to folder:', error);
              // Revert local state on error
              loadStudies();
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
              await loadStudies(); // Don't show loader for reordering
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

  // Show loading screen when loading auth or studies data
  if (isAuthLoading || (isLoadingStudies && isGoogleSignedIn)) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-purple-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-lg"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-slate-200">
              Loading your studies
            </h2>
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

  // Firebase Auth Prompt for Studies
  if (!isGoogleSignedIn && !isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <AppBar
          title="Studies Book"
          icon={BookOpen}
        />
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 space-y-6">
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto">
                  <BookOpen className="w-10 h-10 text-slate-900" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Studies require cloud sync
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  To use the Studies feature and keep your analysis safe, you need to sign in with Google. 
                  This enables cloud storage so your studies are synchronized and never lost.
                </p>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={async () => {
                    setIsSigningIn(true);
                    const result = await signInWithGoogle();
                    if (!result.success) {
                      // Only reset if sign-in failed
                      setIsSigningIn(false);
                    }
                    // If successful, the auth state change will trigger data loading
                  }}
                  disabled={isSigningIn}
                  size="lg"
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

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