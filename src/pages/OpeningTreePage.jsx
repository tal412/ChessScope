import React, { useState, useEffect } from "react";
import ChunkVisualization from "../components/opening-tree/ChunkVisualization";
import InteractiveChessboard from "../components/chess/InteractiveChessboard";
import PositionInfoDialog from "../components/opening-tree/PositionInfoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Crown, Shield, Loader2, Info } from "lucide-react";
import { loadOpeningGraph, hasOpeningGraph } from "@/api/graphStorage";
import { useChessboardSync } from "@/hooks/useChessboardSync";

export default function OpeningTreePage({ playerColor = "white" }) {
  const [openingGraph, setOpeningGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [hoveredMove, setHoveredMove] = useState(null);
  const [directScrollFn, setDirectScrollFn] = useState(null);

  // Use shared chessboard sync hook (OpeningTreePage doesn't have nodes in the same way as PerformanceGraph)
  const chessboardSync = useChessboardSync({
    nodes: [], // No nodes for the opening tree
    onNodeSelect: null,
    setNodes: null
  });

  const isWhiteTree = playerColor === "white";

  // Dynamic configuration based on color
  const config = {
    white: {
      icon: Crown,
      iconColor: "text-amber-400",
      title: "White Opening Tree",
      description: "Analyze your performance as White",
      gradientFrom: "from-amber-500",
      gradientTo: "to-orange-500"
    },
    black: {
      icon: Shield,
      iconColor: "text-slate-400", 
      title: "Black Opening Tree",
      description: "Analyze your performance as Black",
      gradientFrom: "from-slate-500",
      gradientTo: "to-slate-600"
    }
  };

  const currentConfig = config[playerColor];
  const IconComponent = currentConfig.icon;

  useEffect(() => {
    loadGraph();
  }, [playerColor]);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const username = localStorage.getItem('chesscope_username');
      
      if (!username) {
        console.log('No username found - skipping graph load');
        setOpeningGraph(null);
        setLoading(false);
        return;
      }
      
      const graph = await loadOpeningGraph(username);
      console.log('Loaded graph:', graph);
      
      if (graph) {
        setOpeningGraph(graph);
        const overallStats = graph.getOverallStats();
        console.log('Overall stats:', overallStats);
        setStats(overallStats);
        
        // Test root moves
        const rootMoves = graph.getRootMoves(isWhiteTree);
        console.log(`Root moves for ${playerColor}:`, rootMoves);
      } else {
        console.log('No opening graph found for user:', username);
      }
    } catch (error) {
      console.error(`Error loading ${playerColor} tree graph:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrentMovesChange = (moves) => {
    chessboardSync.setCurrentMoves(moves);
  };

  const handleNewMove = (moves) => {
    chessboardSync.setExternalMoves(moves);
    
    setTimeout(() => {
      if (directScrollFn) {
        console.log('🚀 Scrolling to new position after chessboard move:', moves);
        directScrollFn(moves);
      }
    }, 100);
  };

  const handleMoveSelect = (moves) => {
    if (directScrollFn) {
      directScrollFn(moves);
    }
    
    setTimeout(() => {
      chessboardSync.setExternalMoves(moves);
    }, 25);
  };

  const handleDirectScroll = (scrollFn) => {
    setDirectScrollFn(() => scrollFn);
  };

  const handleMoveHover = (moveData) => {
    setHoveredMove(moveData);
  };

  const handleMoveHoverEnd = () => {
    setHoveredMove(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className={`animate-spin h-12 w-12 ${currentConfig.iconColor} mx-auto mb-4`} />
          <p className="text-slate-400">Loading your {currentConfig.title}...</p>
        </div>
      </div>
    );
  }

  if (!openingGraph && !loading) {
    return (
      <div className="text-center py-12">
        <IconComponent className="w-16 h-16 text-slate-500 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-slate-200 mb-2">No Opening Data Found</h3>
        <p className="text-slate-400 mb-6">
          Import your Chess.com games to build your {currentConfig.title} and see move statistics
        </p>
        <Button asChild className={`bg-gradient-to-r ${currentConfig.gradientFrom} ${currentConfig.gradientTo} text-slate-900`}>
          <a href="/Import">Import Games</a>
        </Button>
      </div>
    );
  }

  const colorStats = stats?.[playerColor];

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Mobile/Small screens: Stack vertically */}
      <div className="flex flex-col lg:hidden h-full gap-4 overflow-hidden">
        {/* Tree View - Mobile: Full width, constrained height */}
        <div className="h-1/2 min-h-0 overflow-hidden">
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl h-full flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-200 flex items-center gap-2">
                  <IconComponent className={`w-5 h-5 ${currentConfig.iconColor}`} />
                  {currentConfig.title}
                </CardTitle>
              </div>
              {colorStats && (
                <div className="flex gap-4 text-xs text-slate-400 mt-2">
                  <span>{colorStats.totalGames} games</span>
                  <span>{colorStats.totalPositions} positions</span>
                  <span>{colorStats.winRate.toFixed(1)}% win rate</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
              <ChunkVisualization
                openingGraph={openingGraph}
                isWhiteTree={isWhiteTree}
                onCurrentMovesChange={handleCurrentMovesChange}
                externalMoves={chessboardSync.externalMoves}
                onMoveHover={handleMoveHover}
                onMoveHoverEnd={handleMoveHoverEnd}
                onDirectScroll={handleDirectScroll}
              />
            </CardContent>
          </Card>
        </div>

        {/* Chessboard Area - Mobile: Full width, constrained height */}
        <div className="h-1/2 min-h-0 overflow-hidden">
          <InteractiveChessboard
            currentMoves={chessboardSync.currentMoves}
            onMoveSelect={handleMoveSelect}
            onNewMove={handleNewMove}
            isWhiteTree={isWhiteTree}
            hoveredMove={hoveredMove}
            openingGraph={openingGraph}
            graphNodes={[]} // No performance graph nodes in opening tree page
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Desktop/Large screens: Side by side grid */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(350px,1fr)_2fr] xl:grid-cols-[minmax(380px,1fr)_2.5fr] gap-4 h-full overflow-hidden">
        {/* Tree View - Desktop: Responsive left column */}
        <div className="h-full overflow-hidden">
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl h-full flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-200 flex items-center gap-2">
                  <IconComponent className={`w-5 h-5 ${currentConfig.iconColor}`} />
                  {currentConfig.title}
                </CardTitle>
              </div>
              {colorStats && (
                <div className="flex gap-4 text-xs text-slate-400 mt-2">
                  <span>{colorStats.totalGames} games</span>
                  <span>{colorStats.totalPositions} positions</span>
                  <span>{colorStats.winRate.toFixed(1)}% win rate</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
              <ChunkVisualization
                openingGraph={openingGraph}
                isWhiteTree={isWhiteTree}
                onCurrentMovesChange={handleCurrentMovesChange}
                externalMoves={chessboardSync.externalMoves}
                onMoveHover={handleMoveHover}
                onMoveHoverEnd={handleMoveHoverEnd}
                onDirectScroll={handleDirectScroll}
              />
            </CardContent>
          </Card>
        </div>

        {/* Chessboard Area - Desktop: Responsive right column */}
        <div className="h-full overflow-hidden">
          <InteractiveChessboard
            currentMoves={chessboardSync.currentMoves}
            onMoveSelect={handleMoveSelect}
            onNewMove={handleNewMove}
            isWhiteTree={isWhiteTree}
            hoveredMove={hoveredMove}
            openingGraph={openingGraph}
            graphNodes={[]} // No performance graph nodes in opening tree page
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
} 