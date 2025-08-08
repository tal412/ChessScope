import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  FlexibleLayout, 
  LayoutSection
} from '@/components/ui/flexible-layout';
import { NavigationButtons, NavigationPresets } from '@/components/ui/navigation-buttons';
import { Button } from '@/components/ui/button';
import { Menu, Grid3x3, Network, FileText } from 'lucide-react';
import InteractiveChessboard from '../board/InteractiveChessboard';
import ChunkVisualization from './ChunkVisualization';
import ChessCanvas from '../canvas-v2/ChessCanvas';
import { useChessboardSync } from '../board/hooks/useChessboardSync';
import { loadOpeningGraph } from '../../api/graphStorage';


/**
 * ChessAnalysisView - A shared component that provides chess analysis functionality
 * Used by both PerformanceGraph and OpeningEditor to eliminate code duplication
 */
const ChessAnalysisView = ({
  // Core configuration
  mode = 'performance', // 'performance' | 'opening-editor' | 'opening-viewer'
  title = 'Chess Analysis',
  icon = null,
  
  // Data props
  graphData = { nodes: [], edges: [], maxGameCount: 0 },
  openingGraph = null,
  moveTree = null, // For opening editor mode
  nodeOpeningsMap = new Map(), // Pre-loaded FEN to openings mapping
  
  // State management
  selectedPlayer = 'white',
  onSelectedPlayerChange = null,
  
  // Component visibility
  showMoves = true,
  showBoard = true,
  showGraph = true,
  showDetails = false, // For opening editor
  onShowMovesChange = null,
  onShowBoardChange = null,
  onShowGraphChange = null,
  onShowDetailsChange = null,
  
  // Move handling
  currentMoves = [],
  onCurrentMovesChange = null,
  onNewMove = null,
  
  // Canvas configuration
  canvasMode = 'performance', // 'opening' | 'performance'
  onCanvasModeChange = null,
  
  // Performance graph specific
  performanceGraphData = { nodes: [], edges: [], maxGameCount: 0 },
  onPerformanceGraphDataChange = null,
  
  // Opening editor specific
  currentNode = null,
  onCurrentNodeChange = null,
  hoveredMove = null,
  onHoveredMoveChange = null,
  
  // Editing capabilities
  allowEditing = false,
  readOnly = false,
  
  // Custom arrows (for opening editor)
  customArrows = [],
  onArrowDraw = null,
  drawingMode = false,
  onDrawingModeChange = null,
  
  // Layout configuration
  leftControls = null,
  rightControls = null,
  additionalSections = {}, // For extra sections like details panel
  
  // Callbacks
  onLayoutChange = null,
  onNodeSelect = null,
  onNodeClick = null,
  onNodeHover = null,
  onNodeHoverEnd = null,
  onNodeRightClick = null,
  
  // Context menu
  contextMenuActions = null,
  
  // Auto zoom
  autoZoomOnClick = false,
  onAutoZoomOnClickChange = null,
  
  // Component configuration
  componentConfig = null,
  
  // Loading states
  loading = false,
  isGenerating = false,
  
  // Additional props
  className = "",
  ...additionalProps
}) => {
  // Initialize shared state
  const [layoutInfo, setLayoutInfo] = useState({});
  const [movesStats, setMovesStats] = useState(null);
  const [movesDirectScrollFn, setMovesDirectScrollFn] = useState(null);
  const [movesCurrentPath, setMovesCurrentPath] = useState([]);
  const [movesHoveredMove, setMovesHoveredMove] = useState(null);
  
  // Load opening graph if not provided
  const [internalOpeningGraph, setInternalOpeningGraph] = useState(null);
  const effectiveOpeningGraph = openingGraph || internalOpeningGraph;
  
  // Canvas ref for API access
  const canvasRef = useRef(null);
  
  // Chessboard sync
  const chessboardSync = useChessboardSync({
    nodes: graphData.nodes,
    onNodeSelect: (node) => {
      if (onNodeSelect) onNodeSelect(node);
      if (node && canvasRef.current) {
        canvasRef.current.setCurrentNode(node.id, node.data.fen, 'click');
      }
    },
    setNodes: () => {} // Not needed for this abstraction
  });

  // Store refs for stable access to avoid dependency loops
  const chessboardSyncRef = useRef(chessboardSync);
  const movesDirectScrollFnRef = useRef(movesDirectScrollFn);
  const onCurrentMovesChangeRef = useRef(onCurrentMovesChange);
  const graphDataNodesRef = useRef(graphData.nodes);
  
  // Update refs when values change
  useEffect(() => {
    chessboardSyncRef.current = chessboardSync;
  }, [chessboardSync]);
  
  useEffect(() => {
    movesDirectScrollFnRef.current = movesDirectScrollFn;
  }, [movesDirectScrollFn]);
  
  useEffect(() => {
    onCurrentMovesChangeRef.current = onCurrentMovesChange;
  }, [onCurrentMovesChange]);
  
  useEffect(() => {
    graphDataNodesRef.current = graphData.nodes;
  }, [graphData.nodes]);

  // Reset view when color changes (clear selected node and position clusters)
  // Only depend on selectedPlayer to avoid infinite loops
  useEffect(() => {
    console.log('🎨 Color changed, resetting view to root position');
    
    // Reset to root position
    const rootNode = graphDataNodesRef.current.find(node => node.data.isRoot);
    if (rootNode && canvasRef.current) {
      canvasRef.current.setCurrentNode(rootNode.id, rootNode.data.fen, 'color-change');
    }
    
    // Reset chessboard to starting position
    chessboardSyncRef.current.syncMovesToChessboard([]);
    setMovesCurrentPath([]);
    
    // Reset moves list scroll to root
    if (movesDirectScrollFnRef.current) {
      movesDirectScrollFnRef.current([]);
    }
    
    // Call onCurrentMovesChange to notify parent components
    if (onCurrentMovesChangeRef.current) {
      onCurrentMovesChangeRef.current([]);
    }
    
    // Schedule auto-fit to show the new tree
    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.fitToNodes({ animate: false });
      }
    }, 50);
  }, [selectedPlayer]); // Only depend on selectedPlayer

  // Function to determine if we're in "extended into specific game" territory
  const getPositionStatus = useCallback((moves) => {
    if (mode !== 'performance' || !effectiveOpeningGraph || moves.length === 0) {
      return 'normal';
    }
    
    // Check if current position exists in the tree visualization
    const currentPositionInTree = graphData.nodes.some(node => {
      const nodeMoves = node.data.moveSequence || [];
      return nodeMoves.length === moves.length && 
             nodeMoves.every((move, index) => move === moves[index]);
    });
    
    if (currentPositionInTree) {
      return 'normal'; // Position is in the tree visualization
    }
    
    // Current position is not in tree - check if it exists in the full opening graph
    try {
      // Get the FEN for the current position
      const fen = effectiveOpeningGraph.whiteGraph.getPositionAfterMoves(moves) || 
                  effectiveOpeningGraph.blackGraph.getPositionAfterMoves(moves);
      
      if (fen && effectiveOpeningGraph.hasFen(fen)) {
        return 'extended_game'; // Position exists in opening graph but was trimmed from tree
      }
    } catch (error) {
      console.warn('Error checking FEN in opening graph:', error);
    }
    
    return 'not_in_repertoire'; // Position doesn't exist in opening graph at all
  }, [mode, effectiveOpeningGraph, graphData.nodes]);
  
  // Load opening graph effect
  useEffect(() => {
    if (!openingGraph && mode === 'performance') {
      const loadData = async () => {
        const username = localStorage.getItem('chesscope_username');
        if (username) {
          const graph = await loadOpeningGraph(username);
          setInternalOpeningGraph(graph);
          if (graph) {
            const overallStats = graph.getOverallStats();
            setMovesStats(overallStats);
          }
        }
      };
      loadData();
    }
  }, [openingGraph, mode]);
  
  // Component visibility state
  const componentVisibility = {
    moves: showMoves,
    board: showBoard,
    graph: showGraph,
    ...(showDetails !== undefined && { details: showDetails })
  };
  
  // Component toggle configuration
  const componentToggleConfig = {
    moves: { icon: Menu, label: 'Moves' },
    board: { icon: Grid3x3, label: 'Board' },
    graph: { icon: Network, label: 'Graph' },
    ...(showDetails !== undefined && { details: { icon: FileText, label: 'Details' } })
  };
  
  // Handle component toggles
  const handleComponentToggle = useCallback((componentKey) => {
    switch (componentKey) {
      case 'moves':
        if (onShowMovesChange) onShowMovesChange(!showMoves);
        break;
      case 'board':
        if (onShowBoardChange) onShowBoardChange(!showBoard);
        break;
      case 'graph':
        if (onShowGraphChange) onShowGraphChange(!showGraph);
        break;
      case 'details':
        if (onShowDetailsChange) onShowDetailsChange(!showDetails);
        break;
    }
  }, [showMoves, showBoard, showGraph, showDetails, onShowMovesChange, onShowBoardChange, onShowGraphChange, onShowDetailsChange]);
  
  // Handle layout changes
  const handleLayoutChange = useCallback((layoutData) => {
    setLayoutInfo(layoutData);
    if (onLayoutChange) onLayoutChange(layoutData);
  }, [onLayoutChange]);
  
  // Moves navigation handlers
  const handleMovesPrevious = useCallback(() => {
    if (movesCurrentPath.length > 0) {
      const newPath = movesCurrentPath.slice(0, -1);
      console.log('🔙 handleMovesPrevious: going from', movesCurrentPath, 'to', newPath, 'mode:', mode);
      
      // Always update the path and sync to chessboard first
      setMovesCurrentPath(newPath);
      chessboardSync.syncMovesToChessboard(newPath);
      
      // Always call onCurrentMovesChange to ensure parent components update
      if (onCurrentMovesChange) {
        console.log('🔙 Calling onCurrentMovesChange with newPath:', newPath);
        onCurrentMovesChange(newPath);
      }
      
      // Update canvas position for the new position
      if (newPath.length > 0) {
        // Try to find best match for the new path
        const targetNode = graphData.nodes.find(node => {
          const nodeMoves = node.data.moveSequence || [];
          return nodeMoves.length === newPath.length && 
                 nodeMoves.every((move, index) => move === newPath[index]);
        });
        
        if (targetNode && canvasRef.current) {
          canvasRef.current.setCurrentNode(targetNode.id, targetNode.data.fen, 'nav-previous');
        }
      } else {
        // Going back to root
        const rootNode = graphData.nodes.find(node => node.data.isRoot);
        if (rootNode && canvasRef.current) {
          canvasRef.current.setCurrentNode(rootNode.id, rootNode.data.fen, 'nav-previous-root');
        }
      }
      
      // Then update moves list scroll
      if (movesDirectScrollFn) {
        movesDirectScrollFn(newPath);
      }
    }
  }, [movesCurrentPath, chessboardSync, movesDirectScrollFn, onCurrentMovesChange, graphData.nodes, mode]);
  
  const handleMovesNext = useCallback(() => {
    // Implementation depends on mode
    // For performance graph, this might select next popular move
    // For opening editor, this might navigate to next move in tree
  }, []);
  
  const handleMovesReset = useCallback(() => {
    const newPath = [];
    console.log('🔄 handleMovesReset: resetting to empty path, mode:', mode);
    
    // Always update the path and sync to chessboard first
    setMovesCurrentPath(newPath);
    chessboardSync.syncMovesToChessboard(newPath);
    
    // Always call onCurrentMovesChange to ensure parent components update
    if (onCurrentMovesChange) {
      console.log('🔄 Calling onCurrentMovesChange with empty path');
      onCurrentMovesChange(newPath);
    }
    
    // Then update moves list scroll
    if (movesDirectScrollFn) {
      movesDirectScrollFn(newPath);
    }
    
    // Reset to root position and graph view (works in all modes)
    const rootNode = graphData.nodes.find(node => node.data.isRoot);
    if (rootNode && canvasRef.current) {
      canvasRef.current.setCurrentNode(rootNode.id, rootNode.data.fen, 'reset');
    }
  }, [chessboardSync, movesDirectScrollFn, onCurrentMovesChange, graphData.nodes, mode]);
  
  // Universal flip handler
  const handleUniversalFlip = useCallback(() => {
    const newPlayer = selectedPlayer === 'white' ? 'black' : 'white';
    if (onSelectedPlayerChange) {
      onSelectedPlayerChange(newPlayer);
    }
  }, [selectedPlayer, onSelectedPlayerChange]);
  
  // Moves integration handlers
  const handleMovesCurrentMovesChange = useCallback((moves) => {
    console.log('🎯 handleMovesCurrentMovesChange called with moves:', moves, 'mode:', mode);
    setMovesCurrentPath(moves);
    
    // Check if moves are different from current chessboard state
    const currentMoves = chessboardSync.currentMoves || [];
    const movesChanged = moves.length !== currentMoves.length ||
                        moves.some((move, index) => move !== currentMoves[index]);
    
    if (movesChanged) {
      console.log('🎯 Syncing moves to chessboard:', moves, 'from current:', currentMoves);
      chessboardSync.syncMovesToChessboard(moves);
      
      // Handle performance state updates
      if (moves.length > 0) {
        // Try to find the node corresponding to these EXACT moves
        const targetNode = graphData.nodes.find(node => {
          const nodeMoves = node.data.moveSequence || [];
          return nodeMoves.length === moves.length && 
                 nodeMoves.every((move, index) => move === moves[index]);
        });
        
        if (targetNode && targetNode.data.fen && canvasRef.current) {
          console.log('🎯 Found exact graph node for sequence:', targetNode.data.san);
          canvasRef.current.setCurrentNode(targetNode.id, targetNode.data.fen, 'click');
        } else {
          // Try to find the longest matching prefix in the graph
          let bestMatch = null;
          let bestMatchLength = 0;
          
          for (const node of graphData.nodes) {
            const nodeMoves = node.data.moveSequence || [];
            if (nodeMoves.length <= moves.length && nodeMoves.length > bestMatchLength) {
              if (nodeMoves.every((move, index) => move === moves[index])) {
                bestMatch = node;
                bestMatchLength = nodeMoves.length;
              }
            }
          }
          
          if (bestMatch && bestMatchLength > 0 && canvasRef.current) {
            console.log(`🎯 Found partial match for ${bestMatchLength}/${moves.length} moves:`, bestMatch.data.san);
            canvasRef.current.setCurrentNode(bestMatch.id, bestMatch.data.fen, 'click');
          } else {
            console.log('🎯 No graph node found for any part of sequence');
          }
        }
      }
    }
    
    // Always call onCurrentMovesChange to ensure move tracking works regardless of graph state
    if (onCurrentMovesChange) {
      onCurrentMovesChange(moves);
    }
    
    // For opening editor/viewer modes, also update the currentNode
    if ((mode === 'opening-editor' || mode === 'opening-viewer') && onCurrentNodeChange && moveTree) {
      console.log('🔍 Finding tree node for move sequence:', moves);
      
      // Find the tree node that corresponds to this move sequence
      const findNodeByMoveSequence = (node, targetMoves, currentMoves = []) => {
        // If we've matched all target moves, this is our node
        if (currentMoves.length === targetMoves.length) {
          return node;
        }
        
        // If we have more target moves to match, look in children
        if (currentMoves.length < targetMoves.length) {
          const nextMove = targetMoves[currentMoves.length];
          
          for (const child of node.children) {
            if (child.san === nextMove) {
              const result = findNodeByMoveSequence(child, targetMoves, [...currentMoves, nextMove]);
              if (result) return result;
            }
          }
        }
        
        return null;
      };
      
      const targetNode = findNodeByMoveSequence(moveTree, moves);
      if (targetNode) {
        console.log('✅ Found target node for moves:', targetNode.san);
        onCurrentNodeChange(targetNode);
      } else {
        console.log('❌ Could not find node for move sequence:', moves);
        // If we can't find the exact node, set to root
        onCurrentNodeChange(moveTree);
      }
    }
  }, [chessboardSync, onCurrentMovesChange, mode, onCurrentNodeChange, moveTree, graphData.nodes]);
  
  const handleMovesDirectScroll = useCallback((scrollFn) => {
    setMovesDirectScrollFn(() => scrollFn);
  }, []);
  
  const handleMovesMoveHover = useCallback((moveData) => {
    setMovesHoveredMove(moveData);
    
    // Find corresponding node in graph for highlighting
    if (moveData && moveData.san) {
      const currentPath = chessboardSync.currentMoves || [];
      const nextMovePath = [...currentPath, moveData.san];
      
      const hoveredNode = graphData.nodes.find(node => {
        const nodeMoves = node.data.moveSequence || [];
        return nodeMoves.length === nextMovePath.length && 
               nodeMoves.every((move, index) => move === nextMovePath[index]);
      });
      
      if (hoveredNode && canvasRef.current) {
        canvasRef.current.setHoveredNextMoveNode(hoveredNode.id);
      }
    }
    
    if (onHoveredMoveChange) {
      onHoveredMoveChange(moveData);
    }
  }, [chessboardSync, graphData.nodes, onHoveredMoveChange]);
  
  const handleMovesMoveHoverEnd = useCallback(() => {
    setMovesHoveredMove(null);
    
    if (canvasRef.current) {
      canvasRef.current.clearHoveredNextMoveNode();
    }
    
    if (onHoveredMoveChange) {
      onHoveredMoveChange(null);
    }
  }, [onHoveredMoveChange]);
  
  // Canvas handlers
  const handleCanvasNodeClick = useCallback((e, node) => {
    console.log('🎯 handleCanvasNodeClick called with node:', node?.data?.san || 'null', 'mode:', mode);
    
    if (onNodeClick) {
      onNodeClick(e, node);
    } else {
      // Default behavior - sync to chessboard (ChessCanvas handles position clusters internally)
      const moveSequence = node.data.moveSequence || [];
      chessboardSync.syncMovesToChessboard(moveSequence);
    }
    
    // Always notify about node selection for opening editor/viewer modes
    if ((mode === 'opening-editor' || mode === 'opening-viewer') && onNodeSelect) {
      console.log('🔍 Calling onNodeSelect for opening mode with node ID:', node.id);
      onNodeSelect(node);
    }
  }, [onNodeClick, chessboardSync, mode, onNodeSelect]);
  
  const handleCanvasNodeHover = useCallback((e, node) => {
    if (onNodeHover) {
      onNodeHover(e, node);
    }
  }, [onNodeHover]);
  
  const handleCanvasNodeHoverEnd = useCallback(() => {
    if (onNodeHoverEnd) {
      onNodeHoverEnd();
    }
  }, [onNodeHoverEnd]);
  
  // Chessboard handlers
  const handleChessboardMoveSelect = useCallback((moves) => {
    console.log('🎯 handleChessboardMoveSelect called with moves:', moves);
    
    // Always sync moves to chessboard and update current path - this should never fail
    chessboardSync.syncMovesToChessboard(moves);
    setMovesCurrentPath([...moves]);
    
    // Always call onCurrentMovesChange first to ensure move counter updates
    if (onCurrentMovesChange) {
      onCurrentMovesChange(moves);
    }
    
    // Then update performance state (graph-related state)
    if (moves.length > 0) {
      const targetNode = graphData.nodes.find(node => {
        const nodeMoves = node.data.moveSequence || [];
        return nodeMoves.length === moves.length && 
               nodeMoves.every((move, index) => move === moves[index]);
      });
      
      if (targetNode && targetNode.data.fen && canvasRef.current) {
        console.log('🎯 Found graph node for board selection:', targetNode.data.san, 'FEN:', targetNode.data.fen);
        canvasRef.current.setCurrentNode(targetNode.id, targetNode.data.fen, 'click');
      } else {
        console.log('🎯 No graph node found for moves, but navigation still works');
      }
    }
  }, [chessboardSync, onCurrentMovesChange, graphData.nodes, mode]);

  const handleChessboardMove = useCallback((moves) => {
    console.log('🏁 handleChessboardMove called with moves:', moves, 'mode:', mode);
    
    // Always update the current path first to ensure navigation works for any sequence
    setMovesCurrentPath([...moves]);
    
    if (onNewMove) {
      console.log('🏁 Calling onNewMove with moves:', moves);
      onNewMove(moves);
      
      // For opening modes, also call onCurrentMovesChange to ensure consistency
      if ((mode === 'opening-editor' || mode === 'opening-viewer') && onCurrentMovesChange) {
        console.log('🏁 Calling onCurrentMovesChange for opening mode with moves:', moves);
        onCurrentMovesChange(moves);
      }
    } else {
      console.log('🏁 No onNewMove provided, treating as move selection');
      // If no onNewMove handler, treat this as a move selection
      handleChessboardMoveSelect(moves);
    }
  }, [onNewMove, handleChessboardMoveSelect, onCurrentMovesChange, mode]);
  
  // Sync moves with chessboard
  const prevChessboardMovesRef = useRef([]);
  useEffect(() => {
    if (movesDirectScrollFn && chessboardSync.currentMoves && showMoves) {
      const prevMoves = prevChessboardMovesRef.current;
      const movesChanged = chessboardSync.currentMoves.length !== prevMoves.length ||
                          chessboardSync.currentMoves.some((move, index) => move !== prevMoves[index]);
      
      if (movesChanged) {
        prevChessboardMovesRef.current = [...chessboardSync.currentMoves];
        setTimeout(() => {
          movesDirectScrollFn(chessboardSync.currentMoves);
        }, 100);
      }
    }
  }, [chessboardSync.currentMoves, movesDirectScrollFn, showMoves]);
  
  // Sync movesCurrentPath with chessboard
  useEffect(() => {
    if (chessboardSync.currentMoves.length !== movesCurrentPath.length ||
        !chessboardSync.currentMoves.every((move, index) => move === movesCurrentPath[index])) {
      console.log('🔄 Syncing movesCurrentPath with chessboard:', chessboardSync.currentMoves);
      setMovesCurrentPath([...chessboardSync.currentMoves]);
    }
  }, [chessboardSync.currentMoves, movesCurrentPath]);

  // Sync external currentMoves prop with chessboard when it changes
  const lastSyncedMovesRef = useRef([]);
  useEffect(() => {
    if (currentMoves.length !== chessboardSync.currentMoves.length ||
        !currentMoves.every((move, index) => move === chessboardSync.currentMoves[index])) {
      console.log('🔄 Syncing external currentMoves to chessboard:', currentMoves);
      
      // Check if this is a meaningful change or just noise
      const lastSynced = lastSyncedMovesRef.current;
      const isRelevantChange = currentMoves.length !== lastSynced.length ||
                               !currentMoves.every((move, index) => move === lastSynced[index]);
      
      if (isRelevantChange) {
        // For opening modes: Always sync (external state is authoritative)
        // For performance mode: Only sync if not creating a loop
        const shouldSync = mode !== 'performance' || 
                          currentMoves.length > 0 || 
                          chessboardSync.currentMoves.length === 0;
        
        if (shouldSync) {
          chessboardSync.syncMovesToChessboard(currentMoves);
          setMovesCurrentPath([...currentMoves]);
          lastSyncedMovesRef.current = [...currentMoves];
        }
      }
    }
  }, [currentMoves, chessboardSync, mode]);
  
  // Sync external currentNode prop with canvas (for opening modes)
  useEffect(() => {
    if ((mode === 'opening-editor' || mode === 'opening-viewer') && currentNode && canvasRef.current) {
      console.log('🔄 Syncing external currentNode to canvas:', currentNode?.san || currentNode?.id);
      
      // Find the corresponding graph node
      const graphNode = graphData.nodes.find(node => node.id === currentNode.id);
      if (graphNode) {
        console.log('✅ Found graph node for currentNode:', graphNode.data.san);
        canvasRef.current.setCurrentNode(graphNode.id, graphNode.data.fen, 'external-sync');
      } else {
        console.log('❌ No graph node found for currentNode:', currentNode?.san || currentNode?.id);
      }
    }
  }, [currentNode, mode, graphData.nodes]);
  
  // Default component config
  const defaultComponentConfig = {
    moves: {
      desktopWidth: mode === 'opening-editor' ? '1fr' : '1.5fr',
      oneActive: '1fr'
    },
    board: {
      desktopWidth: '2fr',
      oneActive: '1fr'
    },
    graph: {
      desktopWidth: '1.5fr',
      oneActive: '1fr'
    },
    details: {
      desktopWidth: '1fr',
      oneActive: '1fr'
    }
  };
  
  const effectiveComponentConfig = componentConfig || defaultComponentConfig;
  
  // Render the shared layout
  return (
    <div className={`h-full w-full bg-slate-900 ${className}`}>
      <FlexibleLayout
        title={title}
        icon={icon}
        leftControls={leftControls}
        rightControls={rightControls}
        components={componentVisibility}
        componentConfig={effectiveComponentConfig}
        componentToggleConfig={componentToggleConfig}
        onComponentToggle={handleComponentToggle}
        onLayoutChange={handleLayoutChange}
        headerClassName={additionalProps.headerClassName}
      >
        {{
          moves: (
            <LayoutSection
              key="moves"
              headerControls={
                <div className="w-full">
                  <NavigationButtons
                    currentIndex={movesCurrentPath.length}
                    totalCount={movesCurrentPath.length}
                    onPrevious={handleMovesPrevious}
                    onNext={handleMovesNext}
                    onReset={handleMovesReset}
                    onFlip={handleUniversalFlip}
                    features={NavigationPresets.chessboard.features}
                    labels={{
                      ...NavigationPresets.chessboard.labels,
                      previous: "Back one move",
                      next: "Forward one move", 
                      reset: "Reset to root position",
                      flip: "Flip moves view"
                    }}
                    disabled={!effectiveOpeningGraph && mode === 'performance'}
                    styling={{
                      size: "sm",
                      className: "w-full justify-between"
                    }}
                  />
                </div>
              }
            >
              {(effectiveOpeningGraph || mode === 'opening-editor') ? (
                <div className="h-full w-full">
                  <ChunkVisualization
                    openingGraph={effectiveOpeningGraph}
                    customMoveTree={moveTree}
                    isWhiteTree={selectedPlayer === 'white'}
                    onCurrentMovesChange={handleMovesCurrentMovesChange}
                    externalMoves={chessboardSync.currentMoves}
                    onMoveHover={handleMovesMoveHover}
                    onMoveHoverEnd={handleMovesMoveHoverEnd}
                    onDirectScroll={handleMovesDirectScroll}
                    initialPath={movesCurrentPath}
                    maxDepth={mode === 'performance' ? 20 : 50}
                    minGameCount={mode === 'performance' ? 1 : 0}
                    winRateFilter={mode === 'performance' ? [0, 100] : [0, 100]}
                    displayMode={(mode === 'opening-editor' || mode === 'opening-viewer') && canvasMode === 'performance' ? 'performance' : (mode === 'performance' ? 'performance' : 'opening')}
                    readOnly={readOnly}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-4">
                    <Menu className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs">
                      {mode === 'opening-editor' ? "Opening moves" : "Loading moves..."}
                    </p>
                    {mode === 'performance' && !effectiveOpeningGraph && (
                      <p className="text-slate-500 text-xs">Import games for stats</p>
                    )}
                  </div>
                </div>
              )}
            </LayoutSection>
          ),

          board: (
            <LayoutSection
              key="board"
              noPadding={true}
            >
              <div className="h-full w-full flex items-center justify-center p-4">
                              <InteractiveChessboard
                currentMoves={chessboardSync.currentMoves}
                onNewMove={handleChessboardMove}
                onMoveSelect={handleChessboardMoveSelect}
                isWhiteTree={selectedPlayer === 'white'}
                onFlip={handleUniversalFlip}
                hoveredMove={movesHoveredMove || hoveredMove}
                customArrows={customArrows}
                onArrowDraw={allowEditing ? onArrowDraw : null}
                drawingMode={allowEditing ? drawingMode : false}
                onDrawingModeChange={allowEditing ? onDrawingModeChange : null}
                className="w-full max-w-none"
                showPositionMessage={mode === 'performance' && graphData.nodes.length > 0}
                showOpeningGraphMessage={mode !== 'performance' && !!effectiveOpeningGraph}
                performanceGraphMessage="Position not in opening graph"
                showOpeningSelector={mode === 'performance'}
                openingGraph={effectiveOpeningGraph}
                graphNodes={graphData.nodes}
                readOnly={readOnly}
                moveTree={moveTree}
                mode={mode}
                nodeOpeningsMap={nodeOpeningsMap}
                positionStatus={getPositionStatus(chessboardSync.currentMoves)}
              />
              </div>
            </LayoutSection>
          ),

          graph: (
            <LayoutSection
              key="graph"
              noPadding={true}
              className="bg-slate-900 border-r-0"
            >
              <div className="relative h-full w-full">
                {/* Canvas Mode Toggle - Show in both opening editor and viewer */}
                {(mode === 'opening-editor' || mode === 'opening-viewer') && onCanvasModeChange && (
                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newMode = canvasMode === 'opening' ? 'performance' : 'opening';
                        console.log('🎯 Canvas mode toggle clicked: switching from', canvasMode, 'to', newMode);
                        onCanvasModeChange(newMode);
                      }}
                      className={`${canvasMode === 'performance' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'} group transition-all duration-100`}
                      title={`Switch to ${canvasMode === 'opening' ? 'Performance' : 'Opening'} view`}
                    >
                      <Network className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
                      <span className="hidden group-hover:inline transition-opacity duration-100">
                        {canvasMode === 'opening' ? 'Performance' : 'Opening'}
                      </span>
                    </Button>
                  </div>
                )}
                
                <ChessCanvas
                  ref={canvasRef}
                  graphData={(mode === 'opening-editor' || mode === 'opening-viewer') && canvasMode === 'performance' ? performanceGraphData : graphData}
                  mode={(mode === 'opening-editor' || mode === 'opening-viewer') ? canvasMode : 'performance'}
                  onNodeClick={handleCanvasNodeClick}
                  onNodeHover={handleCanvasNodeHover}
                  onNodeHoverEnd={handleCanvasNodeHoverEnd}
                  onNextMoveHover={(node) => {
                    if (onHoveredMoveChange) {
                      // Respect the canvas's current mode for styling, which can be different from the page's mode.
                      const isCanvasInOpeningMode = canvasMode === 'opening';
                      const moveData = { ...node.data, maxGameCount: graphData.maxGameCount };

                      if (isCanvasInOpeningMode) {
                        moveData.arrowColor = '#ec4899'; // Pink for opening mode
                        moveData.fixedThickness = 14;
                      } else if (node.data?.isMissing) {
                        // Pink arrow for nodes with no data in performance mode
                        moveData.arrowColor = '#ec4899'; // Pink for no data
                        moveData.fixedThickness = 14;
                      }
                      
                      onHoveredMoveChange(moveData);
                    }
                  }}
                  onNextMoveHoverEnd={() => {
                    if (onHoveredMoveChange) {
                      onHoveredMoveChange(null);
                    }
                  }}
                  onNodeRightClick={onNodeRightClick}
                  contextMenuActions={contextMenuActions}
                  isGenerating={isGenerating}
                  selectedPlayer={selectedPlayer}
                  onPlayerChange={onSelectedPlayerChange}
                  enableClustering={mode === 'performance' || mode === 'opening-editor' || mode === 'opening-viewer'}
                  enablePositionClusters={true}
                  enableAutoZoom={true}
                  enableClickAutoZoom={autoZoomOnClick}
                  enableAutoFit={true}
                  autoFitOnResize={true}
                  autoFitOnGraphChange={true}
                  autoFitDelay={200}
                  openingClusters={graphData.openingClusters || []}
                  className="w-full h-full"
                />
              </div>
            </LayoutSection>
          ),

          // Additional sections (like details panel)
          ...Object.entries(additionalSections).reduce((acc, [key, component]) => {
            acc[key] = component;
            return acc;
          }, {})
        }}
      </FlexibleLayout>
    </div>
  );
};

export default ChessAnalysisView; 