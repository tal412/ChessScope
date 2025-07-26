import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Target, 
  Loader2
} from 'lucide-react';
import { loadOpeningGraph } from '../api/graphStorage';
import { checkPositionInOpenings } from '../api/openingEntities';
import { useAuth } from '../contexts/AuthContext';
import ChessAnalysisView from '../components/analysis/ChessAnalysisView';
import { createPerformanceGraphConfig } from '../components/analysis/ChessAnalysisViewConfig.jsx';
import { createOpeningClusters } from '../utils/clusteringAnalysis';



// Main Performance Graph Component
function PerformanceGraphContent() {
  // Get auth context for syncing state
  const { isSyncing, syncProgress, syncStatus, pendingAutoSync } = useAuth();
  
  // Core state
  const [selectedPlayer, setSelectedPlayer] = useState('white');
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshInProgress, setIsRefreshInProgress] = useState(false);
  
  // Data state
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], maxGameCount: 0 });
  const [openingGraph, setOpeningGraph] = useState(null);
  const [nodeOpeningsMap, setNodeOpeningsMap] = useState(new Map());
  const [hoveredMove, setHoveredMove] = useState(null);
  
  // UI state
  const [showOpeningMoves, setShowOpeningMoves] = useState(true);
  const [showPositionAnalysis, setShowPositionAnalysis] = useState(true);
  const [showPerformanceGraph, setShowPerformanceGraph] = useState(true);
  
  // Auto-zoom toggle state
  const [autoZoomOnClick, setAutoZoomOnClick] = useState(() => {
    const savedState = localStorage.getItem('canvas-auto-zoom-on-click');
    return savedState ? JSON.parse(savedState) : true;
  });
  
  // Track if we've done initial root selection
  const [hasInitialRootSelection, setHasInitialRootSelection] = useState(false);

  // Auto-zoom toggle handler with persistence
  const handleAutoZoomOnClickChange = useCallback((newState) => {
    setAutoZoomOnClick(newState);
    localStorage.setItem('canvas-auto-zoom-on-click', JSON.stringify(newState));
  }, []);

  // Keyboard shortcut handler for view reset
  useEffect(() => {
    const handleKeyPress = (event) => {
      if ((event.key === 'R' || event.key === 'r') && 
          !event.target.matches('input, textarea, select')) {
        event.preventDefault();
        // handleReset(); // Will be handled by ChessAnalysisView
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Load opening graph data
  useEffect(() => {
    const loadData = async () => {
      try {
        if ((isSyncing || pendingAutoSync) && !isRefreshInProgress) {
          setLoading(true);
          return;
        }
        
        setLoading(true);
        
        const username = localStorage.getItem('chesscope_username');
        if (!username) {
          console.warn('No username found - user needs to import games first');
          setLoading(false);
          return;
        }
        
        const graph = await loadOpeningGraph(username);
        if (!graph) {
          console.warn('No opening graph data found for user:', username);
          setLoading(false);
          return;
        }
        
        setOpeningGraph(graph);
        setInitialLoad(false);
        
        // Always default to white's perspective
        setSelectedPlayer('white');
        
      } catch (error) {
        console.error('Error loading opening graph:', error);
      } finally {
        if (!isSyncing || isRefreshInProgress) {
          setLoading(false);
        }
        
        if (isRefreshInProgress) {
          setIsRefreshInProgress(false);
        }
      }
    };
    
    loadData();
  }, [refreshTrigger, isSyncing, pendingAutoSync, isRefreshInProgress]);

  // Listen for custom refresh event from settings
  useEffect(() => {
    const handleRefresh = (event) => {
      console.log('🔄 Refresh event received in PerformanceGraph:', event.detail);
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('refreshPerformanceGraph', handleRefresh);
    window.testPerformanceGraphRefresh = () => {
      const event = new CustomEvent('refreshPerformanceGraph', { 
        detail: { source: 'manual-test', timestamp: Date.now() } 
      });
      return window.dispatchEvent(event);
    };
    
    return () => {
      window.removeEventListener('refreshPerformanceGraph', handleRefresh);
      delete window.testPerformanceGraphRefresh;
    };
  }, []);
  
  // Immediately set loading state when parameters change
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Async graph generation
  useEffect(() => {
    const generateGraph = async () => {
      if (loading || !openingGraph) {
        if (!openingGraph && !loading) {
          // Show default node for no data
        const noDataNode = {
          id: 'no-data',
          type: 'chessPosition',
          position: { x: 0, y: 0 },
          data: {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            winRate: 50,
            gameCount: 0,
            san: null,
            openingName: 'Import games to see your opening moves',
            openingEco: '',
            ecoOpeningName: 'Import games to see your opening moves',
            isRoot: true,
            depth: 0,
            moveSequence: []
          }
        };
        setGraphData({ nodes: [noDataNode], edges: [], maxGameCount: 0 });
        }
        return;
      }
      
      try {
        setIsGenerating(true);
        
      // Get root moves
        const rootMoves = openingGraph.getRootMoves(selectedPlayer === 'white');
      
      if (!rootMoves || rootMoves.length === 0) {
        const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const defaultRootNode = {
          id: rootFen,
          type: 'chessPosition',
          position: { x: 0, y: 0 },
          data: {
            fen: rootFen,
            winRate: 50,
            gameCount: 0,
            san: null,
            openingName: 'Starting Position - No Data Available',
            openingEco: '',
            ecoOpeningName: 'Starting Position - No Data Available',
            isRoot: true,
            depth: 0,
            moveSequence: []
          }
        };
        
          setGraphData({ nodes: [defaultRootNode], edges: [], maxGameCount: 0 });
          setIsGenerating(false);
        return;
      }
      
        // Generate performance graph data (full recursive tree)
      let rawNodes = [];
      let rawEdges = [];
      let maxGameCount = 0;
      
        // Tree layout configuration
        const LEVEL_HEIGHT = 350;
        const NODE_SPACING = 240;
        const MIN_GAME_COUNT = 1; // Minimum games to include a move
        const TRIM_GAME_COUNT = 1; // Stop expanding branches with this many games or less
        
        // Add root node
      const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const totalGames = rootMoves.reduce((sum, move) => sum + (move.gameCount || 0), 0);
      
      rawNodes.push({
        id: rootFen,
        type: 'chessPosition',
        position: { x: 0, y: 0 },
        data: {
          fen: rootFen,
          winRate: 50,
          gameCount: totalGames,
          san: null,
          openingName: 'Starting Position',
          openingEco: '',
          ecoOpeningName: 'Starting Position',
          isRoot: true,
          depth: 0,
          moveSequence: []
        }
      });
      
        // Build tree structure first to calculate proper spacing
        const treeStructure = new Map();
        
        // First pass: Build tree structure
        const buildTreeStructure = (moveSequence, depth, parentId, parentData) => {
          // Stop expanding if parent has too few games (trim branches)
          if (parentData && parentData.gameCount <= TRIM_GAME_COUNT) {
          return [];
        }
        
          try {
            const moves = openingGraph.getMovesFromPosition(moveSequence, selectedPlayer === 'white');
            if (!moves || moves.length === 0) return [];
            
            const filteredMoves = moves.filter(move => {
              const gameCount = move.gameCount || 0;
              return gameCount >= MIN_GAME_COUNT;
            });
            
            const childStructures = [];
            
            filteredMoves.forEach((move, index) => {
              const gameCount = move.gameCount || 0;
              maxGameCount = Math.max(maxGameCount, gameCount);
              
              const nodeId = move.toFen || `${parentId}-${move.san}-${depth}-${index}`;
              const newMoveSequence = [...moveSequence, move.san];
              
              const nodeData = {
                id: nodeId,
                san: move.san,
                  fen: move.toFen,
                winRate: move.details?.winRate || move.winRate || 0,
                  gameCount: gameCount,
                  openingName: move.openingInfo?.name || 'Unknown Opening',
                  openingEco: move.openingInfo?.eco || '',
                  ecoOpeningName: move.openingInfo?.eco && move.openingInfo?.name 
                    ? `${move.openingInfo.eco} ${move.openingInfo.name}` 
                    : (move.openingInfo?.name || 'Unknown Opening'),
                depth: depth,
                moveSequence: newMoveSequence,
                parent: parentId
              };
              
              const structure = {
                data: nodeData,
                children: buildTreeStructure(newMoveSequence, depth + 1, nodeId, nodeData),
                width: 0 // Will be calculated
              };
              
              treeStructure.set(nodeId, structure);
              childStructures.push(structure);
            });
            
            return childStructures;
          } catch (error) {
            console.error('Error building tree structure at depth', depth, 'for sequence', moveSequence, ':', error);
            return [];
          }
        };
        
        // Build tree starting from root
        const rootChildren = buildTreeStructure([], 1, rootFen, { id: rootFen, gameCount: totalGames });
        
        // Second pass: Calculate widths (bottom-up)
        const calculateWidths = (structure) => {
          if (structure.children.length === 0) {
            structure.width = 1;
            return 1;
          }
          
          let totalWidth = 0;
          for (const child of structure.children) {
            totalWidth += calculateWidths(child);
          }
          structure.width = Math.max(1, totalWidth);
          return structure.width;
        };
        
        // Calculate total width
        let totalRootWidth = 0;
        for (const child of rootChildren) {
          totalRootWidth += calculateWidths(child);
        }
        
        // Third pass: Position nodes (top-down)
        const positionNodes = (structures, parentX, parentY, availableWidth) => {
          if (structures.length === 0) return;
          
          const currentY = parentY + LEVEL_HEIGHT;
          let currentX = parentX - (availableWidth * NODE_SPACING) / 2;
          
          structures.forEach(structure => {
            const nodeWidth = structure.width * NODE_SPACING;
            const nodeCenterX = currentX + nodeWidth / 2;
            
            // Create node
            const node = {
              id: structure.data.id,
              type: 'chessPosition',
              position: { x: nodeCenterX - 90, y: currentY }, // Offset by half node width
              data: {
                fen: structure.data.fen,
                winRate: structure.data.winRate,
                gameCount: structure.data.gameCount,
                san: structure.data.san,
                openingName: structure.data.openingName,
                openingEco: structure.data.openingEco,
                ecoOpeningName: structure.data.ecoOpeningName,
                isRoot: false,
                depth: structure.data.depth,
                moveSequence: structure.data.moveSequence
              }
            };
            
            rawNodes.push(node);
            
            // Create edge
            rawEdges.push({
              id: `${structure.data.parent}-${structure.data.id}`,
              source: structure.data.parent,
              target: structure.data.id,
              sourceHandle: 'bottom',
              targetHandle: 'top',
              type: 'chessMove',
              animated: false,
              data: {
                san: structure.data.san,
                winRate: structure.data.winRate,
                gameCount: structure.data.gameCount,
                maxGameCount: maxGameCount
              }
            });
            
            // Position children
            if (structure.children.length > 0) {
              positionNodes(structure.children, nodeCenterX, currentY, structure.width);
            }
            
            currentX += nodeWidth;
          });
        };
        
        // Position all nodes
        positionNodes(rootChildren, 0, 0, totalRootWidth);
      
            const finalGraphData = { 
        nodes: rawNodes, 
        edges: rawEdges, 
        maxGameCount 
      };
      
      // Generate opening clusters using DFS for connected openings
      const openingClusters = createOpeningClusters(rawNodes);
      finalGraphData.openingClusters = openingClusters;
      
      setGraphData(finalGraphData);
        setIsGenerating(false);
      
    } catch (error) {
      console.error('Error generating graph data:', error);
      setGraphData({ nodes: [], edges: [], maxGameCount: 0 });
        setIsGenerating(false);
    }
  };
  
  generateGraph();
  }, [selectedPlayer, loading, openingGraph]);

  // Load saved openings for all nodes
  useEffect(() => {
    const loadNodeOpenings = async () => {
      if (graphData.nodes.length === 0) return;
      
      const username = localStorage.getItem('chesscope_username');
      if (!username) return;
      
      const newMap = new Map();
      const uniqueFens = new Set(graphData.nodes.map(node => node.data.fen));
      
      for (const fen of uniqueFens) {
        const openings = await checkPositionInOpenings(fen, username);
        if (openings.length > 0) {
          newMap.set(fen, openings);
        }
      }
      
      setNodeOpeningsMap(newMap);
    };
    
    loadNodeOpenings();
  }, [graphData.nodes]);
  


  // Create configuration for ChessAnalysisView
  const analysisConfig = useMemo(() => {
    return createPerformanceGraphConfig({
      selectedPlayer,
      onSelectedPlayerChange: setSelectedPlayer,
      graphData,
      openingGraph,
      loading,
      isGenerating,
      autoZoomOnClick,
      onAutoZoomOnClickChange: handleAutoZoomOnClickChange
    });
  }, [
    selectedPlayer,
    graphData,
    openingGraph,
    loading,
    isGenerating,
    autoZoomOnClick,
    handleAutoZoomOnClickChange
  ]);
  
  // Show loading screen during initial load OR when syncing
  if ((loading && !isSyncing && !pendingAutoSync) || (initialLoad && !openingGraph)) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-purple-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-lg"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-slate-200">
              Loading Performance Graph
            </h2>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              Preparing your chess analysis and opening performance data
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

  if (!openingGraph) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">No Chess Data Found</h3>
          <p className="text-slate-400 mb-4">Import your games first to see the performance graph.</p>
          <Button onClick={() => window.location.href = '/import'} className="bg-blue-600 hover:bg-blue-700">
            Import Games
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-900">
      <ChessAnalysisView
        {...analysisConfig}
        // Component visibility
        showMoves={showOpeningMoves}
        showBoard={showPositionAnalysis}
        showGraph={showPerformanceGraph}
        onShowMovesChange={setShowOpeningMoves}
        onShowBoardChange={setShowPositionAnalysis}
        onShowGraphChange={setShowPerformanceGraph}
        // Hover move state
        hoveredMove={hoveredMove}
        onHoveredMoveChange={setHoveredMove}
      />
      
      {/* Single Consolidated Loading Overlay */}
      {(isGenerating || (loading && (isSyncing || pendingAutoSync))) && (
        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-6"></div>
            <p className="text-slate-200 text-lg font-medium">
              {(loading && (isSyncing || pendingAutoSync)) ? 'Syncing Games' : 'Generating Performance Graph'}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              {(loading && (isSyncing || pendingAutoSync)) ? (syncStatus || 'Updating analysis...') : 'Processing your opening analysis...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformanceGraph() {
  return (
    <PerformanceGraphContent />
  );
}