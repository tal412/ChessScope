import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft,
  Edit,
  BarChart3,
  Crown,
  Shield,
  Tag,
  Calendar,
  Loader2,
  BookOpen
} from 'lucide-react';
import { userOpening, userOpeningMove } from '@/api/openingEntities';
import { loadOpeningGraph } from '@/api/graphStorage';
import PerformanceGraphContent from './PerformanceGraph';
import InteractiveChessboard from '@/components/chess/InteractiveChessboard';
import ChunkVisualization from '@/components/opening-moves/ChunkVisualization';

export default function OpeningView() {
  const { openingId } = useParams();
  const navigate = useNavigate();
  
  const [opening, setOpening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analysis');
  const [openingGraph, setOpeningGraph] = useState(null);
  const [currentMoves, setCurrentMoves] = useState([]);

  useEffect(() => {
    loadOpeningData();
  }, [openingId]);

  const loadOpeningData = async () => {
    try {
      setLoading(true);
      
      // Load opening details
      const openingData = await userOpening.filter({ id: parseInt(openingId) });
      if (openingData.length === 0) {
        navigate('/openings-book');
        return;
      }
      
      setOpening(openingData[0]);
      setCurrentMoves(openingData[0].initial_moves || []);
      
      // Load user's opening graph for analysis
      const username = localStorage.getItem('chesscope_username');
      const graph = await loadOpeningGraph(username);
      setOpeningGraph(graph);
      
    } catch (error) {
      console.error('Error loading opening:', error);
      navigate('/openings-book');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading opening...</p>
        </div>
      </div>
    );
  }

  if (!opening) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/openings-book')}
              className="text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">{opening.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className={opening.color === 'white' ? 'border-amber-500/50 text-amber-400' : 'border-slate-500 text-slate-400'}>
                  {opening.color === 'white' ? (
                    <Crown className="w-3 h-3 mr-1" />
                  ) : (
                    <Shield className="w-3 h-3 mr-1" />
                  )}
                  {opening.color}
                </Badge>
                {opening.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <Button
            onClick={() => navigate(`/openings-book/editor/${openingId}`)}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Opening
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-slate-800 mb-6">
              <TabsTrigger value="analysis" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                <BarChart3 className="w-4 h-4 mr-2" />
                Performance Analysis
              </TabsTrigger>
              <TabsTrigger value="practice" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                <BookOpen className="w-4 h-4 mr-2" />
                Practice Mode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-6">
              {/* Description Card */}
              {opening.description && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-slate-300">{opening.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Analysis View - Similar to Performance Graph but filtered */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="text-sm text-slate-400 mb-4">
                  Showing your performance data for moves within this opening
                </div>
                {/* TODO: Implement filtered performance graph view */}
                <div className="h-[600px] bg-slate-900 rounded-lg flex items-center justify-center">
                  <p className="text-slate-400">Performance analysis for {opening.name}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="practice" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Practice Board */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-slate-100">Practice Board</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InteractiveChessboard
                      currentMoves={currentMoves}
                      onMoveSelect={(moves) => setCurrentMoves(moves)}
                      isWhiteTree={opening.color === 'white'}
                      openingGraph={openingGraph}
                      className="w-full"
                      showPositionMessage={false}
                    />
                  </CardContent>
                </Card>

                {/* Move Tree */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-slate-100">Opening Moves</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {openingGraph ? (
                      <ChunkVisualization
                        openingGraph={openingGraph}
                        isWhiteTree={opening.color === 'white'}
                        externalMoves={currentMoves}
                        onCurrentMovesChange={setCurrentMoves}
                      />
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        No performance data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 