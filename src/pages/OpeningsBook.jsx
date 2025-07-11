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
import { userOpening } from '@/api/openingEntities';
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
import OpeningDetailsDialog from '@/components/opening-moves/OpeningDetailsDialog';


export default function OpeningsBook() {
  const navigate = useNavigate();
  const { isSyncing, syncProgress, syncStatus } = useAuth(); // Get syncing state, progress, and status from auth context
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColor, setFilterColor] = useState('all'); // 'all', 'white', 'black'
  const [deleteOpening, setDeleteOpening] = useState(null);

  // Load user's openings
  useEffect(() => {
    loadOpenings();
  }, []);

  const loadOpenings = async () => {
    try {
      setLoading(true);
      const username = localStorage.getItem('chesscope_username');
      
      if (!username) {
        console.warn('No username found');
        setLoading(false);
        return;
      }

      const userOpenings = await userOpening.getByUsername(username);
      setOpenings(userOpenings);
    } catch (error) {
      console.error('Error loading openings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter openings based on search and color
  const filteredOpenings = openings.filter(opening => {
    const matchesSearch = opening.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesColor = filterColor === 'all' || opening.color === filterColor;
    
    return matchesSearch && matchesColor;
  });

  // Handle creating a new opening - now handled by the dialog
  const handleCreateOpening = (openingDetails) => {
    const params = new URLSearchParams({
      name: openingDetails.name,
      color: openingDetails.color
    });
    navigate(`/openings-book/editor/new?${params.toString()}`);
  };

  // Handle opening click - go to analysis view
  const handleOpeningClick = (openingId) => {
    navigate(`/openings-book/opening/${openingId}`);
  };

  // Handle edit opening
  const handleEditOpening = (e, openingId) => {
    e.stopPropagation();
    navigate(`/openings-book/editor/${openingId}`);
  };

  // Handle delete opening
  const handleDeleteOpening = async () => {
    if (!deleteOpening) return;
    
    try {
      await userOpening.delete(deleteOpening.id);
      await loadOpenings();
      setDeleteOpening(null);
    } catch (error) {
      console.error('Error deleting opening:', error);
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
              Loading Openings Book
            </h2>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              Loading your saved openings and analysis
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
        title="Openings Book"
        icon={BookOpen}
        centerControls={
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search openings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>
        }
        rightControls={
          <>
            <OpeningDetailsDialog onConfirm={handleCreateOpening}>
              <Button 
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Opening
              </Button>
            </OpeningDetailsDialog>
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

        {/* Empty State */}
        {filteredOpenings.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {searchTerm || filterColor !== 'all' 
                ? 'No openings found' 
                : 'No openings yet'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm || filterColor !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first opening to get started'}
            </p>
            {!searchTerm && filterColor === 'all' && (
              <OpeningDetailsDialog 
                onConfirm={handleCreateOpening}
                title="Create Your First Opening"
                confirmText="Create Opening"
              >
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Opening
                </Button>
              </OpeningDetailsDialog>
            )}
          </div>
        )}

        {/* Openings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
          {filteredOpenings.map((opening) => (
            <Card 
              key={opening.id}
              className="bg-slate-800 border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer group"
              onClick={() => handleOpeningClick(opening.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg text-slate-100 truncate">
                      {opening.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={opening.color === 'white' ? 'border-amber-500/50 text-amber-400' : 'border-slate-500 text-slate-400'}>
                        {opening.color === 'white' ? (
                          <Crown className="w-3 h-3 mr-1" />
                        ) : (
                          <Shield className="w-3 h-3 mr-1" />
                        )}
                        {opening.color}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleEditOpening(e, opening.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteOpening(opening);
                      }}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                {/* Mini Chessboard Preview */}
                <div className="aspect-square mb-3 rounded-lg overflow-hidden bg-slate-900">
                  <Chessground
                    fen={opening.initial_fen}
                    orientation={opening.color}
                    viewOnly={true}
                    coordinates={false}
                    style={{
                      width: '100%',
                      height: '100%'
                    }}
                  />
                </div>
                

                
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{opening.initial_moves?.length || 0} moves</span>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOpening} onOpenChange={() => setDeleteOpening(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete Opening</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete "{deleteOpening?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOpening}
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