import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Filter
} from 'lucide-react';
import { userStudy, studyTag, studyTagsMapping } from '@/api/studyEntities';
import Chessground from 'react-chessground';
import 'react-chessground/dist/styles/chessground.css';
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
import { cn } from '@/lib/utils';


export default function StudiesBook() {
  const navigate = useNavigate();
  const { isSyncing, syncProgress, syncStatus } = useAuth();
  const [studies, setStudies] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColor, setFilterColor] = useState('all'); // 'all', 'white', 'black'
  const [deleteStudy, setDeleteStudy] = useState(null);

  // Load user's studies and tags
  useEffect(() => {
    loadStudies();
    loadTags();
  }, []);

  const loadStudies = async () => {
    try {
      setLoading(true);
      const username = localStorage.getItem('chesscope_username');
      
      if (!username) {
        console.warn('No username found');
        setLoading(false);
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
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      console.log('📋 StudiesBook: Loading tags from server...');
      const tags = await studyTag.getAll();
      console.log('📋 StudiesBook: Loaded tags from server:', tags.length, 'tags:', tags.map(t => ({id: t.id, name: t.name})));
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
      setAvailableTags([]);
    }
  };

  const handleTagsChanged = () => {
    console.log('🔄 StudiesBook: handleTagsChanged called - reloading tags and studies...');
    loadTags();
    loadStudies(); // Reload studies to get updated tag information
  };

  // Filter studies based on search, color, and tags
  const filteredStudies = studies.filter(study => {
    const matchesSearch = study.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesColor = filterColor === 'all' || study.color === filterColor;
    const matchesTags = selectedTagIds.length === 0 || 
      (study.tags && study.tags.some(tag => selectedTagIds.includes(tag.id)));
    
    return matchesSearch && matchesColor && matchesTags;
  });

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
      startingPgn: studyDetails.startingPgn || '',
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
    e.stopPropagation();
    navigate(`/studies-book/editor/${studyId}`);
  };

  // Handle delete study
  const handleDeleteStudy = async () => {
    if (!deleteStudy) return;
    
    try {
      await userStudy.delete(deleteStudy.id);
      await loadStudies();
      setDeleteStudy(null);
    } catch (error) {
      console.error('Error deleting study:', error);
    }
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
      {/* Header using AppBar */}
      <AppBar
        title="Studies Book"
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
        {filteredStudies.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {searchTerm || filterColor !== 'all' || selectedTagIds.length > 0
                ? 'No studies found' 
                : 'No studies yet'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm || filterColor !== 'all' || selectedTagIds.length > 0
                ? 'Try adjusting your search or filters'
                : 'Create your first study to get started'}
            </p>
            {!searchTerm && filterColor === 'all' && selectedTagIds.length === 0 && (
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
            )}
          </div>
        )}

        {/* Studies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start">
          {filteredStudies.map((study) => {
            return (
            <Card 
              key={study.id}
              className="bg-slate-800 border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer group"
              onClick={() => handleStudyClick(study.id)}
            >
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm text-slate-100 truncate leading-tight">
                      {study.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${study.color === 'white' ? 'border-amber-500/50 text-amber-400' : 'border-slate-500 text-slate-400'}`}>
                        {study.color === 'white' ? (
                          <Crown className="w-2.5 h-2.5 mr-1" />
                        ) : (
                          <Shield className="w-2.5 h-2.5 mr-1" />
                        )}
                        {study.color.charAt(0).toUpperCase() + study.color.slice(1)}
                      </Badge>
                    </div>
                    {/* Tags */}
                    {(() => {
                      console.log('📋 StudiesBook UI: Checking tags for study', study.name, ':', study.tags, 'length:', study.tags?.length);
                      return study.tags && study.tags.length > 0;
                    })() && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {study.tags.slice(0, 3).map(tag => (
                          <Badge 
                            key={tag.id}
                            variant="outline"
                            className="text-xs px-1 py-0"
                            style={{
                              borderColor: tag.color,
                              color: tag.color,
                              fontSize: '10px'
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {study.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs px-1 py-0 border-slate-500 text-slate-400" style={{ fontSize: '10px' }}>
                            +{study.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleEditStudy(e, study.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteStudy(study);
                      }}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {/* Mini Chessboard Preview */}
                <div className="aspect-square mb-2 rounded-md overflow-hidden bg-slate-900">
                  <Chessground
                    fen={study.initial_view_fen || study.initial_fen}
                    orientation={study.color}
                    viewOnly={true}
                    coordinates={false}
                    style={{
                      width: '100%',
                      height: '100%'
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{study.initial_moves?.length || 0} moves</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
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