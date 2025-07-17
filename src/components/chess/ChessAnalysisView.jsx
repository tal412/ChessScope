import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  FlexibleLayout, 
  LayoutSection
} from '@/components/ui/flexible-layout';
import { NavigationButtons, NavigationPresets } from '@/components/ui/navigation-buttons';
import { Button } from '@/components/ui/button';
import { Menu, Grid3x3, Network, FileText } from 'lucide-react';
import InteractiveChessboard from './InteractiveChessboard';
import ChunkVisualization from '../opening-moves/ChunkVisualization';
import CanvasPerformanceGraph from './CanvasPerformanceGraph';
import { useCanvasState } from '../../hooks/useCanvasState';
import { useChessboardSync } from '../../hooks/useChessboardSync';
import { loadOpeningGraph } from '../../api/graphStorage';
import { createPositionClusters } from '../../utils/clusteringAnalysis';

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
  
  // Handle auto-fit completion
  const handleAutoFitComplete = useCallback(() => {
    // This will be called when auto-fit operations complete
    // We need to call the CanvasPerformanceGraph's completion callback
    console.log('✅ AUTO-FIT COMPLETED in ChessAnalysisView');
    
    // Call the CanvasPerformanceGraph's completion callback
    if (canvasAutoFitCompletionRef.current) {
      canvasAutoFitCompletionRef.current();
    }
  }, []);
  
  // Ref to store the CanvasPerformanceGraph's completion callback
  const canvasAutoFitCompletionRef = useRef(null);
  
  // Canvas state management
  const performanceState = useCanvasState({
    openingGraph: effectiveOpeningGraph,
    selectedPlayer,
    enableClustering: mode === 'performance',
    enablePositionClusters: true,
    enableAutoZoom: true,
    enableClickAutoZoom: autoZoomOnClick,
    enableAutoFit: true,
    autoFitOnResize: true,
    autoFitOnGraphChange: true,
    autoFitDelay: 200,
    onAutoFitComplete: handleAutoFitComplete
  });
  
  // Chessboard sync
  const chessboardSync = useChessboardSync({
    nodes: graphData.nodes,
    onNodeSelect: (node) => {
      if (onNodeSelect) onNodeSelect(node);
      if (node) {
        performanceState.updateCurrentPosition(node.id, node.data.fen, 'click');
      }
    },
    setNodes: () => {} // Not needed for this abstraction
  });

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
      
      // Update performance state for the new position
      if (newPath.length > 0) {
        // Try to find best match for the new path
        const targetNode = graphData.nodes.find(node => {
          const nodeMoves = node.data.moveSequence || [];
          return nodeMoves.length === newPath.length && 
                 nodeMoves.every((move, index) => move === newPath[index]);
        });
        
        if (targetNode) {
          performanceState.updateCurrentPosition(targetNode.id, targetNode.data.fen, 'nav-previous');
        } else {
          performanceState.updateCurrentPosition(null, null, 'nav-previous-no-node');
        }
      } else {
        // Going back to root
        const rootNode = graphData.nodes.find(node => node.data.isRoot);
        if (rootNode) {
          performanceState.updateCurrentPosition(rootNode.id, rootNode.data.fen, 'nav-previous-root');
        } else {
          performanceState.updateCurrentPosition(null, null, 'nav-previous-root-no-node');
        }
      }
      
      // Then update moves list scroll
      if (movesDirectScrollFn) {
        movesDirectScrollFn(newPath);
      }
    }
  }, [movesCurrentPath, chessboardSync, movesDirectScrollFn, onCurrentMovesChange, graphData.nodes, performanceState, mode]);
  
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
    if (rootNode) {
      performanceState.updateCurrentPosition(rootNode.id, rootNode.data.fen, 'reset');
    } else {
      // Even if no root node found, still reset performance state
      performanceState.updateCurrentPosition(null, null, 'reset-no-root');
    }
    
    // Clear position clusters and reset graph view
    performanceState.setPositionClusters([]);
    
    // Fit all nodes in view after reset
    setTimeout(() => {
      performanceState.scheduleAutoFit('reset', 100);
    }, 50);
  }, [chessboardSync, movesDirectScrollFn, onCurrentMovesChange, graphData.nodes, performanceState, mode]);
  
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
        
        if (targetNode && targetNode.data.fen) {
          console.log('🎯 Found exact graph node for sequence:', targetNode.data.san);
          const positionClusters = createPositionClusters(graphData.nodes, targetNode.data.fen);
          performanceState.setPositionClusters(positionClusters);
          performanceState.updateCurrentPosition(targetNode.id, targetNode.data.fen, 'click');
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
          
          if (bestMatch && bestMatchLength > 0) {
            console.log(`🎯 Found partial match for ${bestMatchLength}/${moves.length} moves:`, bestMatch.data.san);
            // Use the best partial match for position clusters
            const positionClusters = createPositionClusters(graphData.nodes, bestMatch.data.fen);
            performanceState.setPositionClusters(positionClusters);
            performanceState.updateCurrentPosition(bestMatch.id, bestMatch.data.fen, 'click');
          } else {
            console.log('🎯 No graph node found for any part of sequence, clearing clusters');
            performanceState.setPositionClusters([]);
            performanceState.updateCurrentPosition(null, null, 'click');
          }
        }
      } else {
        // Clear position clusters when returning to root
        performanceState.setPositionClusters([]);
        performanceState.updateCurrentPosition(null, null, 'reset');
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
  }, [chessboardSync, onCurrentMovesChange, mode, onCurrentNodeChange, moveTree, graphData.nodes, performanceState]);
  
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
      
      if (hoveredNode) {
        performanceState.setHoveredNextMoveNodeId(hoveredNode.id);
      } else {
        performanceState.setHoveredNextMoveNodeId(null);
      }
    } else {
      performanceState.setHoveredNextMoveNodeId(null);
    }
    
    if (onHoveredMoveChange) {
      onHoveredMoveChange(moveData);
    }
  }, [chessboardSync, graphData.nodes, performanceState, onHoveredMoveChange]);
  
  const handleMovesMoveHoverEnd = useCallback(() => {
    setMovesHoveredMove(null);
    performanceState.setHoveredNextMoveNodeId(null);
    
    if (onHoveredMoveChange) {
      onHoveredMoveChange(null);
    }
  }, [performanceState, onHoveredMoveChange]);
  
  // Canvas handlers
  const handleCanvasNodeClick = useCallback((e, node) => {
    console.log('🎯 handleCanvasNodeClick called with node:', node?.data?.san || 'null', 'mode:', mode);
    
    if (onNodeClick) {
      onNodeClick(e, node);
    } else {
      // Default behavior - always select the node (no deselection on double-click)
      
      // Generate position clusters for performance mode or opening modes
      if (node.data.fen && (mode === 'performance' || mode === 'opening-editor' || mode === 'opening-viewer')) {
        const positionClusters = createPositionClusters(graphData.nodes, node.data.fen);
        performanceState.setPositionClusters(positionClusters);
      }
      
      const moveSequence = node.data.moveSequence || [];
      chessboardSync.syncMovesToChessboard(moveSequence);
      performanceState.updateCurrentPosition(node.id, node.data.fen, 'click');
    }
    
    // Always notify about node selection for opening editor/viewer modes
    if ((mode === 'opening-editor' || mode === 'opening-viewer') && onNodeSelect) {
      // For opening modes, we need to find the corresponding tree node
      // The graph node has the tree node ID, so we can call onNodeSelect
      console.log('🔍 Calling onNodeSelect for opening mode with node ID:', node.id);
      onNodeSelect(node);
    }
  }, [onNodeClick, performanceState, chessboardSync, mode, graphData.nodes, onNodeSelect]);
  
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
      
      if (targetNode && targetNode.data.fen) {
        console.log('🎯 Found graph node for board selection:', targetNode.data.san, 'FEN:', targetNode.data.fen);
        
        // Generate position clusters for performance mode
        if (mode === 'performance') {
          const positionClusters = createPositionClusters(graphData.nodes, targetNode.data.fen);
          performanceState.setPositionClusters(positionClusters);
        }
        
        // Update the current node position in performance state
        performanceState.updateCurrentPosition(targetNode.id, targetNode.data.fen, 'click');
      } else {
        console.log('🎯 No graph node found for moves, but navigation still works');
        // Clear position clusters but don't break navigation
        performanceState.setPositionClusters([]);
        performanceState.updateCurrentPosition(null, null, 'click');
      }
    } else {
      // Clear position clusters when returning to root
      performanceState.setPositionClusters([]);
      performanceState.updateCurrentPosition(null, null, 'reset');
    }
  }, [chessboardSync, onCurrentMovesChange, graphData.nodes, mode, performanceState]);

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
  
  // Sync external currentNode prop with performance state (for opening modes)
  useEffect(() => {
    if ((mode === 'opening-editor' || mode === 'opening-viewer') && currentNode) {
      console.log('🔄 Syncing external currentNode to performance state:', currentNode?.san || currentNode?.id);
      
      // Find the corresponding graph node
      const graphNode = graphData.nodes.find(node => node.id === currentNode.id);
      if (graphNode) {
        console.log('✅ Found graph node for currentNode:', graphNode.data.san);
        performanceState.updateCurrentPosition(graphNode.id, graphNode.data.fen, 'external-sync');
      } else {
        console.log('❌ No graph node found for currentNode:', currentNode?.san || currentNode?.id);
      }
    }
  }, [currentNode, mode, graphData.nodes, performanceState]);
  
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
                    maxDepth={mode === 'performance' ? performanceState.maxDepth : 50}
                    minGameCount={mode === 'performance' ? performanceState.minGameCount : 0}
                    winRateFilter={mode === 'performance' ? performanceState.winRateFilter : [0, 100]}
                    displayMode={mode === 'performance' ? 'performance' : 'opening'}
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
                showOpeningSelector={mode === 'opening-editor' || mode === 'opening-viewer'}
                openingGraph={effectiveOpeningGraph}
                graphNodes={graphData.nodes}
                readOnly={readOnly}
                moveTree={moveTree}
                mode={mode}
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
                
                <CanvasPerformanceGraph
                  graphData={(mode === 'opening-editor' || mode === 'opening-viewer') && canvasMode === 'performance' ? performanceGraphData : graphData}
                  mode={(mode === 'opening-editor' || mode === 'opening-viewer') ? canvasMode : 'performance'}
                  onNodeClick={handleCanvasNodeClick}
                  onNodeHover={handleCanvasNodeHover}
                  onNodeHoverEnd={handleCanvasNodeHoverEnd}
                  onNodeRightClick={onNodeRightClick}
                  contextMenuActions={contextMenuActions}
                  currentNodeId={performanceState.currentNodeId}
                  hoveredNextMoveNodeId={performanceState.hoveredNextMoveNodeId}
                  isGenerating={isGenerating}
                  
                  // Performance controls
                  showPerformanceControls={performanceState.showPerformanceControls}
                  onShowPerformanceControls={performanceState.setShowPerformanceControls}
                  openingClusters={performanceState.openingClusters}
                  positionClusters={performanceState.positionClusters}
                  showOpeningClusters={performanceState.openingClusteringEnabled}
                  showPositionClusters={performanceState.showPositionClusters}
                  onToggleOpeningClusters={performanceState.toggleOpeningClustering}
                  onTogglePositionClusters={performanceState.togglePositionClusters}
                  onClusterHover={performanceState.handleClusterHover}
                  onClusterHoverEnd={performanceState.handleClusterHoverEnd}
                  hoveredOpeningName={performanceState.hoveredOpeningName}
                  hoveredClusterColor={performanceState.hoveredClusterColor}
                  onFitView={performanceState.onFitView}
                  onZoomToClusters={performanceState.onZoomToClusters}
                  onZoomTo={performanceState.onZoomTo}
                  onResizeStateChange={performanceState.onResizeStateChange}
                  onInitializingStateChange={performanceState.onInitializingStateChange}
                  
                  // Performance control props
                  maxDepth={performanceState.maxDepth}
                  minGameCount={performanceState.minGameCount}
                  tempMinGameCount={performanceState.tempMinGameCount}
                  winRateFilter={performanceState.winRateFilter}
                  tempWinRateFilter={performanceState.tempWinRateFilter}
                  onMaxDepthChange={performanceState.handleMaxDepthChange}
                  onMinGameCountChange={performanceState.handleMinGameCountChange}
                  onTempMinGameCountChange={performanceState.handleTempMinGameCountChange}
                  onWinRateFilterChange={performanceState.handleWinRateFilterChange}
                  onTempWinRateFilterChange={performanceState.handleTempWinRateFilterChange}
                  onApplyWinRateFilter={performanceState.applyWinRateFilter}
                  selectedPlayer={selectedPlayer}
                  onPlayerChange={onSelectedPlayerChange}
                  isClusteringLoading={false}
                  enableOpeningClusters={mode === 'performance'}
                  autoZoomOnClick={autoZoomOnClick}
                  onAutoZoomOnClickChange={onAutoZoomOnClickChange}
                  onAutoFitComplete={handleAutoFitComplete}
                  onAutoFitCompletionRef={canvasAutoFitCompletionRef}
                  isAutoFitPending={performanceState.isAutoFitPending}
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