import React, { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle, useLayoutEffect } from 'react';
import { Canvas } from './components/Canvas';
import { ContextMenu } from './components/ContextMenu';
import { CanvasControls } from './components/CanvasControls';
import { useZoom } from './hooks/useZoom';
import { usePosition } from './hooks/usePosition';
import { useClusters } from './hooks/useClusters';
import { useInteractionBlocking } from './hooks/useInteractionBlocking';
import { useStateCallbacks } from './hooks/useStateCallbacks';
import { useLoadingStates } from './hooks/useLoadingStates';
import { KEYBOARD_SHORTCUTS, MOUSE_BUTTONS, ZOOM_CONFIG, CANVAS_CONFIG } from './constants';
import { createPositionClusters } from '../../utils/clusteringAnalysis';
import { calculateOptimalTransform } from './utils/geometry';

/**
 * ChessCanvas - A complete, self-contained chess graph visualization component
 * 
 * This component handles all canvas-related state internally and provides a clean API
 * for parent components without exposing internal state management complexity.
 */
export const ChessCanvas = forwardRef(function ChessCanvas({
  // Core data
  graphData = { nodes: [], edges: [] },
  mode = 'performance', // 'opening' | 'performance'
  
  // External state integration (optional)
  currentNodeId = null,
  onNodeClick = null,
  onNodeHover = null,
  onNodeHoverEnd = null,
  onNodeRightClick = null,
  
  // Cluster data (optional - will be generated internally if not provided)
  openingClusters = [],
  positionClusters = [],
  
  // Performance controls (with defaults)
  selectedPlayer = 'white',
  onPlayerChange = null,
  maxDepth = 20,
  minGameCount = 1,
  winRateFilter = [0, 100],
  onMaxDepthChange = null,
  onMinGameCountChange = null,
  onWinRateFilterChange = null,
  
  // UI state
  isGenerating = false,
  showPerformanceControls = false,
  onShowPerformanceControls = null,
  showPerformanceLegend = false,
  onShowPerformanceLegend = null,
  
  // Context menu
  contextMenuActions = null,
  
  // Canvas configuration options
  enableAutoFit = true,
  autoFitOnResize = true,
  autoFitOnGraphChange = true,
  autoFitDelay = 200,
  enableClustering = true,
  enablePositionClusters = true,
  enableAutoZoom = true,
  enableClickAutoZoom = true,
  
  // Callbacks
  onAutoFitComplete = null,
  onAutoFitCompletionRef = null,
  
  // Styling
  className = "",
  ...props
}, ref) {
  // Container ref for measuring dimensions
  const containerRef = useRef();
  const canvasRef = useRef();
  
  // Canvas dimensions state
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isResizeProcessActive, setIsResizeProcessActive] = useState(false);
  
  // Track graph and dimension signatures to prevent unnecessary re-fits
  const lastFittedGraphRef = useRef(null);
  const lastFittedDimensionsRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const hasCompletedInitialFit = useRef(false);
  
  // Measure dimensions immediately on mount
  useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newDimensions = { 
        width: Math.floor(rect.width), 
        height: Math.floor(rect.height) 
      };
      if (newDimensions.width > 0 && newDimensions.height > 0) {
        setDimensions(newDimensions);
        console.log('🔄 Initial dimensions set:', newDimensions);
      }
    }
    
    // Fallback
    const dimensionFallbackTimeout = setTimeout(() => {
      setDimensions(current => {
        if (current.width === 0 || current.height === 0) {
          console.warn('Canvas dimensions fallback - using default size');
          return { width: 800, height: 600 };
        }
        return current;
      });
    }, 1000);
    
    return () => clearTimeout(dimensionFallbackTimeout);
  }, []);

  // Enhanced resize detection
  useEffect(() => {
    let resizeObserver = null;
    let lastDimensions = { width: 0, height: 0 };
    
    const updateSize = (reason = 'resize') => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDimensions = { 
          width: Math.floor(rect.width), 
          height: Math.floor(rect.height) 
        };
        
        const widthChanged = Math.abs(newDimensions.width - lastDimensions.width) > 10;
        const heightChanged = Math.abs(newDimensions.height - lastDimensions.height) > 10;
        
        if (widthChanged || heightChanged) {
          console.log('🔄 Dimensions changed:', { from: lastDimensions, to: newDimensions, reason });
          setDimensions(newDimensions);
          lastDimensions = newDimensions;
        }
      }
    };

    // ResizeObserver for container size detection
    if (window.ResizeObserver && containerRef.current) {
      resizeObserver = new ResizeObserver(() => updateSize('ResizeObserver'));
      resizeObserver.observe(containerRef.current);
    }

    updateSize('mount');
    
    const handleWindowResize = () => updateSize('window-resize');
    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  // Internal state for full self-containment
  const [internalCurrentNodeId, setInternalCurrentNodeId] = useState(currentNodeId);
  const [internalCurrentPositionFen, setInternalCurrentPositionFen] = useState(null);
  const [internalPositionClusters, setInternalPositionClusters] = useState([]);
  const [internalOpeningClusters, setInternalOpeningClusters] = useState(openingClusters);
  const [internalShowPerformanceControls, setInternalShowPerformanceControls] = useState(showPerformanceControls);
  const [internalShowPerformanceLegend, setInternalShowPerformanceLegend] = useState(showPerformanceLegend);
  const [internalMaxDepth, setInternalMaxDepth] = useState(maxDepth);
  const [internalMinGameCount, setInternalMinGameCount] = useState(minGameCount);
  const [internalTempMinGameCount, setInternalTempMinGameCount] = useState(minGameCount);
  const [internalWinRateFilter, setInternalWinRateFilter] = useState(winRateFilter);
  const [internalTempWinRateFilter, setInternalTempWinRateFilter] = useState(winRateFilter);
  const [internalIsClusteringLoading, setInternalIsClusteringLoading] = useState(false);
  const [internalShowZoomDebounceOverlay, setInternalShowZoomDebounceOverlay] = useState(false);
  // Initialize auto-zoom from localStorage - with localStorage persistence
  const [internalAutoZoomOnClick, setInternalAutoZoomOnClick] = useState(() => {
    const savedState = localStorage.getItem('canvas-auto-zoom-on-click-enabled');
    return savedState ? JSON.parse(savedState) : enableClickAutoZoom;
  });
  
  // Process raw graph data into positioned nodes FIRST
  const processedGraphData = React.useMemo(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) {
      return { nodes: [], edges: graphData.edges || [] };
    }
    
    // Convert nodes with position.x/position.y to nodes with x/y/radius
    const positionedNodes = graphData.nodes
      .filter(node => node.type !== 'clusterBackground') // Filter out background nodes
      .map(node => {
        // Check if node already has x, y, radius (processed) or needs conversion from position
        if (node.x !== undefined && node.y !== undefined && node.radius !== undefined) {
          return node; // Already processed
        }
        
        // Convert from position-based to direct coordinates
        if (node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') {
          return {
            ...node,
            x: node.position.x + CANVAS_CONFIG.NODE_HALF_SIZE,
            y: node.position.y + CANVAS_CONFIG.NODE_HALF_SIZE,
            radius: CANVAS_CONFIG.NODE_HALF_SIZE,
            width: CANVAS_CONFIG.NODE_SIZE,
            height: CANVAS_CONFIG.NODE_SIZE
          };
        }
        
        // Fallback: node without proper position data
        console.warn('Node missing position data:', node);
        return {
          ...node,
          x: 0,
          y: 0,
          radius: CANVAS_CONFIG.NODE_HALF_SIZE,
          width: CANVAS_CONFIG.NODE_SIZE,
          height: CANVAS_CONFIG.NODE_SIZE
        };
      });
    
    return {
      nodes: positionedNodes,
      edges: graphData.edges || []
    };
  }, [graphData]);

  // Calculate initial transform to avoid visual jump AFTER processing graph data
  const initialTransform = React.useMemo(() => {
    if (processedGraphData.nodes.length > 0 && dimensions.width > 0 && dimensions.height > 0) {
      const optimalTransform = calculateOptimalTransform(processedGraphData.nodes, dimensions, ZOOM_CONFIG.AUTO_FIT_PADDING);
      // console.log('🎯 Calculated initial transform:', optimalTransform, {
      //   nodeCount: processedGraphData.nodes.length,
      //   dimensions
      // });
      return optimalTransform;
    }
    // console.log('🎯 Using default transform (no nodes or dimensions)');
    return { scale: 1, translateX: 0, translateY: 0 };
  }, [processedGraphData.nodes, dimensions.width, dimensions.height]);

  // Initialize hooks with proper dimensions and initial transform
  const zoom = useZoom(dimensions, initialTransform);
  const position = usePosition({
    initialCurrentNodeId: internalCurrentNodeId,
    graphData: graphData // Keep using raw graphData for position tracking
  });
  const clusters = useClusters({
    openingClusters: internalOpeningClusters,
    positionClusters: internalPositionClusters
  });
  const loadingStates = useLoadingStates({
    enableAutoFit,
    autoFitDelay,
  });
  const interactionBlocking = useInteractionBlocking({
    isInitializing: loadingStates.isInitializing,
    isResizing: loadingStates.isResizing,
    isAutoFitPending: loadingStates.isAutoFitPending,
    isResizeProcessActive,
    isGenerating,
  });
  const stateCallbacks = useStateCallbacks({
    onResize: () => {
      console.log('🔄 Canvas resize detected');
    },
    onInitializing: (isInitializing) => {
      console.log('🔄 Canvas initializing state:', isInitializing);
    },
    onAutoFitComplete: () => {
      if (onAutoFitComplete) onAutoFitComplete();
      console.log('✅ Auto-fit completed');
    }
  });

  // Update loading states when processed graph data changes
  useEffect(() => {
    if (processedGraphData.nodes.length > 0) {
      loadingStates.updatePositionedNodes(processedGraphData.nodes);
      loadingStates.setInitialPositioningComplete(true);
      
      // Only set valid transform and finish initializing when we have the optimal transform
      const hasOptimalTransform = initialTransform.scale !== 1 || initialTransform.translateX !== 0 || initialTransform.translateY !== 0;
      if (hasOptimalTransform) {
        loadingStates.setValidTransform(true);
        loadingStates.setInitializingState(false);
        // console.log('✅ Canvas ready with optimal transform');
      } else {
        // console.log('⏳ Waiting for optimal transform calculation');
      }
    } else {
      loadingStates.updatePositionedNodes([]);
      loadingStates.setInitialPositioningComplete(false);
      loadingStates.setValidTransform(false);
      loadingStates.setInitializingState(true);
    }
  }, [processedGraphData.nodes.length, initialTransform, loadingStates]);

  // Sync external props with internal state
  useEffect(() => {
    setInternalCurrentNodeId(currentNodeId);
    position.updateCurrentPosition(currentNodeId, null);
  }, [currentNodeId]);

  // Sync external opening clusters
  useEffect(() => {
    if (openingClusters.length > 0) {
      setInternalOpeningClusters(openingClusters);
      clusters.updateOpeningClusters(openingClusters);
    }
  }, [openingClusters, clusters]);

  // Handle graph changes for auto-fit
  useEffect(() => {
    if (!autoFitOnGraphChange || !dimensions.width || !dimensions.height) return;

    if (processedGraphData.nodes.length > 0) {
      const graphSignature = JSON.stringify({
        nodeCount: processedGraphData.nodes.length,
        firstNodeId: processedGraphData.nodes[0]?.id,
        lastNodeId: processedGraphData.nodes[processedGraphData.nodes.length - 1]?.id,
      });

      if (lastFittedGraphRef.current !== graphSignature) {
        const previousNodeCount = lastFittedGraphRef.current
          ? JSON.parse(lastFittedGraphRef.current).nodeCount
          : 0;

        // Animate only if the graph was already substantially loaded, not on the initial placeholder -> data transition.
        const shouldAnimate = previousNodeCount > 1;

        console.log(`🔄 Auto-fitting due to graph change (animate: ${shouldAnimate})`, {
          nodeCount: processedGraphData.nodes.length,
          dimensions,
          autoFitDelay,
          oldSignature: lastFittedGraphRef.current,
          newSignature: graphSignature,
        });

        const timeoutId = setTimeout(() => {
          // We rely on the initialTransform to set the correct initial view.
          // This effect handles subsequent changes or the second step of the initial load.
          // In the latter case, we don't want to animate.
          zoom.fitToNodes(processedGraphData.nodes, { animate: shouldAnimate });
        }, autoFitDelay);

        lastFittedGraphRef.current = graphSignature;
        return () => clearTimeout(timeoutId);
      }
    }
  }, [processedGraphData.nodes, autoFitOnGraphChange, autoFitDelay, dimensions.width, dimensions.height, zoom.fitToNodes]);

  // Handle resize auto-fit
  useEffect(() => {
    if (!autoFitOnResize || !dimensions.width || !dimensions.height || !processedGraphData.nodes.length) return;

    const dimensionsSignature = `${dimensions.width}x${dimensions.height}`;
    if (lastFittedDimensionsRef.current && lastFittedDimensionsRef.current !== dimensionsSignature) {
      console.log('🔄 Auto-fitting due to resize', {
        dimensions,
        oldDimensions: lastFittedDimensionsRef.current,
        newDimensions: dimensionsSignature,
      });

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      setIsResizeProcessActive(true);

      resizeTimeoutRef.current = setTimeout(() => {
        zoom.fitToNodes(processedGraphData.nodes, {
          animate: true,
          onComplete: () => {
            setIsResizeProcessActive(false);
          },
        });
        resizeTimeoutRef.current = null;
      }, 300);
    }

    lastFittedDimensionsRef.current = dimensionsSignature;

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
        setIsResizeProcessActive(false);
      }
    };
  }, [dimensions, autoFitOnResize, processedGraphData.nodes, zoom.fitToNodes]);

  // Handle onAutoFitCompletionRef - store the completion callback in the ref
  useEffect(() => {
    if (onAutoFitCompletionRef && onAutoFitCompletionRef.current !== stateCallbacks.handleAutoFitComplete) {
      onAutoFitCompletionRef.current = stateCallbacks.handleAutoFitComplete;
    }
  }, [onAutoFitCompletionRef]);

  // Internal position update handler
  const updateCurrentPosition = useCallback((nodeId, fen, source = 'unknown', options = {}) => {
    setInternalCurrentNodeId(nodeId);
    setInternalCurrentPositionFen(fen);
    position.updateCurrentPosition(nodeId, fen);
    
    // Generate position clusters if we have a FEN
    console.log('🔍 Position cluster generation check:', {
      fen: fen,
      enablePositionClusters: enablePositionClusters,
      nodeCount: graphData.nodes.length,
      shouldGenerate: fen && enablePositionClusters && graphData.nodes.length > 0
    });
    
    // Generate position clusters and use them for auto-zoom
    let newPositionClusters = [];
    if (fen && enablePositionClusters && graphData.nodes.length > 0) {
      console.log('🔍 Generating position clusters for FEN:', fen);
      newPositionClusters = createPositionClusters(graphData.nodes, fen);
      console.log('🔍 Generated position clusters:', newPositionClusters.length, newPositionClusters);
      setInternalPositionClusters(newPositionClusters);
      clusters.updatePositionClusters(newPositionClusters);
    }
    
    // Handle auto-zoom
    if (enableAutoZoom && fen && (
      (source === 'click' && internalAutoZoomOnClick) || 
      (source === 'reset')
    )) {
      setTimeout(() => {
        if (source === 'click' && internalAutoZoomOnClick) {
          // Find the clicked node
          const clickedNode = processedGraphData.nodes.find(node => node.id === nodeId);
          if (clickedNode) {
            // Use the newly generated position clusters instead of stale state
            const currentPositionClusters = newPositionClusters.length > 0 ? newPositionClusters : internalPositionClusters;
            
            // Check if the clicked node is in any position cluster
            console.log('🔍 Auto-zoom: Checking position clusters for node:', nodeId);
            console.log('🔍 Auto-zoom: Available position clusters:', currentPositionClusters.length);
            currentPositionClusters.forEach((cluster, i) => {
              console.log(`🔍 Auto-zoom: Cluster ${i}:`, cluster.name, 'has', cluster.allNodes?.length || 0, 'nodes');
              if (cluster.allNodes) {
                const hasNode = cluster.allNodes.some(clusterNode => clusterNode.id === nodeId);
                console.log(`🔍 Auto-zoom: Cluster ${i} contains clicked node:`, hasNode);
              }
            });
            
            const nodeCluster = currentPositionClusters.find(cluster => 
              cluster.allNodes && cluster.allNodes.some(clusterNode => clusterNode.id === nodeId)
            );
            
            if (nodeCluster && nodeCluster.allNodes.length > 0) {
              // Pre-calculate optimal zoom area for ALL position clusters (like v1)
              console.log('🔍 Auto-zoom: Pre-calculating ALL position cluster bounds for optimal zoom');
              
              // Collect all positioned nodes from ALL position clusters (matching v1 behavior)
              const allClusterNodes = [];
              currentPositionClusters.forEach(cluster => {
                if (cluster.allNodes) {
                  cluster.allNodes.forEach(clusterNode => {
                    // Find the corresponding positioned node with x, y, radius properties
                    const positionedNode = processedGraphData.nodes.find(pn => pn.id === clusterNode.id);
                    if (positionedNode && !allClusterNodes.some(existing => existing.id === positionedNode.id)) {
                      allClusterNodes.push(positionedNode);
                    }
                  });
                }
              });
              
              console.log(`🔍 Auto-zoom: All position clusters contain ${allClusterNodes.length} nodes total`);
              
              // Calculate optimal transform with generous padding for all clusters visibility
              const clusterPadding = Math.min(dimensions.width, dimensions.height) * 0.15; // 15% of viewport as padding
              const optimalTransform = calculateOptimalTransform(allClusterNodes, dimensions, clusterPadding);
              console.log('🔍 Auto-zoom: Calculated optimal transform for all clusters:', optimalTransform);
              
              // Zoom to ALL position clusters with pre-calculated bounds (like v1)
              zoom.fitToNodes(allClusterNodes, { 
                animate: true,
                padding: clusterPadding
              });
            } else {
              // No cluster contains this node, zoom to the node and its immediate neighbors
              const nodeNeighborhood = [clickedNode];
              
              // Find nodes connected to this one (children and parent)
              const connectedNodes = processedGraphData.nodes.filter(node => {
                if (node.id === nodeId) return false;
                
                // Check if it's a parent or child by looking at move sequences
                const clickedMoves = clickedNode.data?.moveSequence || [];
                const nodeMoves = node.data?.moveSequence || [];
                
                // Parent: node has one less move and all moves match
                const isParent = nodeMoves.length === clickedMoves.length - 1 &&
                                nodeMoves.every((move, i) => move === clickedMoves[i]);
                
                // Child: node has one more move and all clicked moves match
                const isChild = nodeMoves.length === clickedMoves.length + 1 &&
                               clickedMoves.every((move, i) => move === nodeMoves[i]);
                
                return isParent || isChild;
              });
              
              nodeNeighborhood.push(...connectedNodes);
              
              // Pre-calculate optimal zoom area for node neighborhood
              console.log(`🔍 Auto-zoom: Pre-calculating bounds for node ${clickedNode.data?.san || 'root'} and ${connectedNodes.length} neighbors`);
              
              // Calculate optimal transform with reasonable padding for node neighborhood
              const neighborhoodPadding = Math.min(dimensions.width, dimensions.height) * 0.1; // 10% padding for smaller groups
              const optimalTransform = calculateOptimalTransform(nodeNeighborhood, dimensions, neighborhoodPadding);
              console.log('🔍 Auto-zoom: Calculated optimal transform for neighborhood:', optimalTransform);
              
              zoom.fitToNodes(nodeNeighborhood, { 
                animate: true,
                padding: neighborhoodPadding
              });
            }
          }
        } else if (source === 'reset') {
          // Reset view - fit all nodes
          zoom.fitToNodes(processedGraphData.nodes, { animate: true });
        }
      }, 150);
    }
  }, [position, enablePositionClusters, processedGraphData.nodes, clusters, enableAutoZoom, internalAutoZoomOnClick, internalPositionClusters, zoom, dimensions]);

  // Canvas event handlers
  const handleNodeClick = useCallback((e, node) => {
    if (node) {
      updateCurrentPosition(node.id, node.data.fen, 'click');
    }
    
    if (onNodeClick) {
      onNodeClick(e, node);
    }
  }, [updateCurrentPosition, onNodeClick]);

  const handleNodeHover = useCallback((e, node) => {
    if (onNodeHover) {
      onNodeHover(e, node);
    }
  }, [onNodeHover]);

  const handleNodeHoverEnd = useCallback((e, node) => {
    if (onNodeHoverEnd) {
      onNodeHoverEnd(e, node);
    }
  }, [onNodeHoverEnd]);

  // Performance control handlers with loading states
  const handleMaxDepthChangeAsync = useCallback(async (newDepth) => {
    setInternalIsClusteringLoading(true);
    setInternalMaxDepth(newDepth);
    
    if (onMaxDepthChange) {
      await onMaxDepthChange(newDepth);
    }
    
    setTimeout(() => {
      setInternalIsClusteringLoading(false);
    }, 500);
  }, [onMaxDepthChange]);

  const handleMinGameCountChangeAsync = useCallback(async (newMinCount) => {
    setInternalIsClusteringLoading(true);
    setInternalMinGameCount(newMinCount);
    setInternalTempMinGameCount(newMinCount);
    
    if (onMinGameCountChange) {
      await onMinGameCountChange(newMinCount);
    }
    
    setTimeout(() => {
      setInternalIsClusteringLoading(false);
    }, 500);
  }, [onMinGameCountChange]);

  const handleTempMinGameCountChange = useCallback((newTempMinCount) => {
    setInternalTempMinGameCount(newTempMinCount);
  }, []);

  const handleApplyWinRateFilterAsync = useCallback(async () => {
    setInternalIsClusteringLoading(true);
    setInternalWinRateFilter([...internalTempWinRateFilter]);
    
    if (onWinRateFilterChange) {
      await onWinRateFilterChange([...internalTempWinRateFilter]);
    }
    
    setTimeout(() => {
      setInternalIsClusteringLoading(false);
    }, 500);
  }, [internalTempWinRateFilter, onWinRateFilterChange]);

  const handleTempWinRateFilterChange = useCallback((newTempFilter) => {
    setInternalTempWinRateFilter(newTempFilter);
  }, []);

  const handleToggleAutoZoomOnClick = useCallback(() => {
    setInternalAutoZoomOnClick(prev => {
      const newState = !prev;
      localStorage.setItem('canvas-auto-zoom-on-click-enabled', JSON.stringify(newState));
      console.log('Toggle auto zoom on click:', newState);
      return newState;
    });
  }, []);

  const handleMinGameCountSliderRelease = useCallback(() => {
    if (internalTempMinGameCount !== internalMinGameCount) {
      handleMinGameCountChangeAsync(internalTempMinGameCount);
    }
  }, [internalTempMinGameCount, internalMinGameCount, handleMinGameCountChangeAsync]);

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuNode, setContextMenuNode] = useState(null);

  const showContextMenu = useCallback((x, y, node) => {
    if (!contextMenuActions) return;
    
    setContextMenuPosition({ x, y });
    setContextMenuNode(node);
    setContextMenuVisible(true);
  }, [contextMenuActions]);

  const hideContextMenu = useCallback(() => {
    setContextMenuVisible(false);
    setContextMenuNode(null);
  }, []);

  const handleContextMenuAction = useCallback((action, node) => {
    if (action.onClick) {
      action.onClick(node);
    }
    hideContextMenu();
  }, [hideContextMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle keyboard events if focused on input elements
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Block keyboard shortcuts during initialization
      if (interactionBlocking.isCanvasInteractionBlocked()) {
        return;
      }
      
      switch (e.key) {
        case KEYBOARD_SHORTCUTS.FIT_VIEW:
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            loadingStates.setUserInteracted(true);
            zoom.fitToNodes(processedGraphData.nodes, { animate: true });
          }
          break;
        case 'z':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            loadingStates.setUserInteracted(true);
            if (internalPositionClusters.length > 0) {
              // Use allNodes instead of nodes and map to positioned nodes  
              const clusterNodes = [];
              internalPositionClusters.forEach(cluster => {
                if (cluster.allNodes) {
                  cluster.allNodes.forEach(clusterNode => {
                    const positionedNode = processedGraphData.nodes.find(pn => pn.id === clusterNode.id);
                    if (positionedNode && !clusterNodes.some(existing => existing.id === positionedNode.id)) {
                      clusterNodes.push(positionedNode);
                    }
                  });
                }
              });
              if (clusterNodes.length > 0) {
                zoom.fitToNodes(clusterNodes, { animate: true });
              }
            }
          }
          break;
        case KEYBOARD_SHORTCUTS.RESET_ZOOM:
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            loadingStates.setUserInteracted(true);
            // Fit view - same as MMB
            zoom.fitToNodes(processedGraphData.nodes, { animate: true });
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoom, processedGraphData.nodes, internalPositionClusters, interactionBlocking.isCanvasInteractionBlocked, loadingStates]);

  // Mouse interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mousePressed, setMousePressed] = useState(false);
  const [localHoveredNode, setLocalHoveredNode] = useState(null);
  const [cursorStyle, setCursorStyle] = useState('grab');

  // Update cursor style when hovered node changes or interaction state changes
  useEffect(() => {
    const isCursorBlocked = interactionBlocking.isCanvasInteractionBlocked();
    const newCursor = isCursorBlocked ? 'not-allowed' : (localHoveredNode ? 'pointer' : 'grab');
    setCursorStyle(newCursor);
  }, [localHoveredNode, interactionBlocking.isCanvasInteractionBlocked]);

  const handleMouseDown = useCallback((e) => {
    // Block all mouse interactions during initialization
    if (interactionBlocking.isCanvasInteractionBlocked()) {
      e.preventDefault();
      return;
    }
    
    // Handle middle mouse button click for reset
    if (e.button === MOUSE_BUTTONS.MIDDLE) {
      e.preventDefault();
      loadingStates.setUserInteracted(true);
      zoom.fitToNodes(processedGraphData.nodes, { animate: true });
      return;
    }
    
    // Only handle left mouse button for dragging
    if (e.button === MOUSE_BUTTONS.LEFT) {
      setMousePressed(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      loadingStates.setUserInteracted(true);
    }
  }, [interactionBlocking.isCanvasInteractionBlocked, loadingStates, zoom, processedGraphData.nodes]);

  const handleMouseMove = useCallback((e) => {
    if (mousePressed && (e.buttons & 1)) {
      if (interactionBlocking.isCanvasInteractionBlocked()) {
        return;
      }
      
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      // Mark as dragging if movement exceeds threshold
      if (!isDragging && (Math.abs(deltaX) + Math.abs(deltaY) > 5)) {
        setIsDragging(true);
      }
      
      zoom.setPan(
        zoom.translateX + deltaX,
        zoom.translateY + deltaY
      );
      
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      setMousePressed(false);
      
      // Handle node hover detection when not dragging
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Find node at position
        const nodeAtPosition = processedGraphData.nodes.find(node => {
          // Transform world coordinates to screen coordinates
          // Canvas applies: translate then scale, so screen coords are:
          const screenX = node.x * zoom.scale + zoom.translateX;
          const screenY = node.y * zoom.scale + zoom.translateY;
          const distance = Math.sqrt(
            Math.pow(screenX - x, 2) + Math.pow(screenY - y, 2)
          );
          return distance < (CANVAS_CONFIG.NODE_HALF_SIZE * zoom.scale); // Scale node radius with zoom
        });
        
        // Update local hovered node state for cursor only
        setLocalHoveredNode(nodeAtPosition);
        
        // Call external hover handlers
        if (nodeAtPosition) {
          handleNodeHover(e, nodeAtPosition);
        } else {
          handleNodeHoverEnd(e, null);
        }
      }
    }
  }, [mousePressed, dragStart, zoom, interactionBlocking.isCanvasInteractionBlocked, isDragging, processedGraphData.nodes, handleNodeHover, handleNodeHoverEnd]);

  const handleMouseUp = useCallback(() => {
    setMousePressed(false);
    // Reset dragging after a brief delay to prevent accidental clicks
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePressed(false);
    setLocalHoveredNode(null);
    
    handleNodeHoverEnd();
  }, [handleNodeHoverEnd]);

  const handleWheel = useCallback((e) => {
    if (!interactionBlocking.isCanvasInteractionBlocked()) {
      e.preventDefault();
      const scaleFactor = e.deltaY > 0 ? ZOOM_CONFIG.SCALE_FACTOR : ZOOM_CONFIG.SCALE_FACTOR_IN;
      
      // Mark that user has interacted with canvas
      loadingStates.setUserInteracted(true);
      
      // Calculate normalized point (0-1 coordinates)
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const normalizedPoint = {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height
        };
        zoom.zoomAtPoint(normalizedPoint, scaleFactor);
      }
    }
  }, [zoom, interactionBlocking.isCanvasInteractionBlocked, loadingStates]);

  // Add wheel event listener manually to avoid passive listener warning
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const wheelListener = (e) => {
      handleWheel(e);
    };

    canvasElement.addEventListener('wheel', wheelListener, { passive: false });
    
    return () => {
      canvasElement.removeEventListener('wheel', wheelListener);
    };
  }, [handleWheel]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    
    if (!contextMenuActions) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find node at position 
    const clickedNode = processedGraphData.nodes.find(node => {
      // Transform world coordinates to screen coordinates
      const screenX = node.x * zoom.scale + zoom.translateX;
      const screenY = node.y * zoom.scale + zoom.translateY;
      const distance = Math.sqrt(
        Math.pow(screenX - x, 2) + Math.pow(screenY - y, 2)
      );
      return distance < (CANVAS_CONFIG.NODE_HALF_SIZE * zoom.scale); // Scale node radius with zoom
    });
    
    showContextMenu(e.clientX, e.clientY, clickedNode);
      }, [contextMenuActions, processedGraphData.nodes, showContextMenu, zoom]);

      // Click handler with drag suppression
  const handleClick = useCallback((e) => {
    if (isDragging || interactionBlocking.isCanvasInteractionBlocked()) {
      return;
    }
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find node at position
    const clickedNode = processedGraphData.nodes.find(node => {
      // Transform world coordinates to screen coordinates  
      const screenX = node.x * zoom.scale + zoom.translateX;
      const screenY = node.y * zoom.scale + zoom.translateY;
      const distance = Math.sqrt(
        Math.pow(screenX - x, 2) + Math.pow(screenY - y, 2)
      );
      return distance < (CANVAS_CONFIG.NODE_HALF_SIZE * zoom.scale); // Scale node radius with zoom
    });
    
    if (clickedNode) {
      handleNodeClick(e, clickedNode);
    }
  }, [isDragging, interactionBlocking.isCanvasInteractionBlocked, processedGraphData.nodes, zoom, handleNodeClick]);

      // Public API
    const api = {
      // Zoom controls
      fitToNodes: (options = {}) => {
        const { animate = true } = options;
        loadingStates.setUserInteracted(true);
        zoom.fitToNodes(processedGraphData.nodes, { animate });
      },
    zoomToClusters: () => {
      loadingStates.setUserInteracted(true);
      // Use allNodes instead of nodes and map to positioned nodes
      const clusterNodes = [];
      internalPositionClusters.forEach(cluster => {
        if (cluster.allNodes) {
          cluster.allNodes.forEach(clusterNode => {
            const positionedNode = processedGraphData.nodes.find(pn => pn.id === clusterNode.id);
            if (positionedNode && !clusterNodes.some(existing => existing.id === positionedNode.id)) {
              clusterNodes.push(positionedNode);
            }
          });
        }
      });
      if (clusterNodes.length > 0) {
        zoom.fitToNodes(clusterNodes, { animate: true });
      }
    },
    zoomAtPoint: (point, factor) => {
      loadingStates.setUserInteracted(true);
      zoom.zoomAtPoint(point, factor);
    },
    
    // Position controls
    setCurrentNode: updateCurrentPosition,
    getCurrentNode: () => internalCurrentNodeId,
    
    // Cluster controls
    updateOpeningClusters: (clusters) => {
      setInternalOpeningClusters(clusters);
    },
    updatePositionClusters: (clusters) => {
      setInternalPositionClusters(clusters);
    },
    
    // Cleanup function for compatibility
    cleanup: () => {
      loadingStates.cancelAutoFit();
    },
  };

  useImperativeHandle(ref, () => api, [api]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      {...props}
    >
      {/* Initialization Loading Overlay */}
      {loadingStates.shouldShowInitializationOverlay(dimensions, zoom.transform, isGenerating, initialTransform) && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-30">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
            <p className="text-slate-300 text-sm">Initializing canvas...</p>
          </div>
        </div>
      )}

      {/* Autofit Loading Overlay */}
      {loadingStates.shouldShowAutoFitOverlay() && (
        <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="animate-pulse rounded-lg bg-slate-700/80 px-4 py-2">
              <p className="text-slate-200 text-sm">Adjusting view...</p>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Level Indicator */}
      <div className="absolute top-4 left-4 z-40 bg-slate-800/90 text-slate-200 px-3 py-1.5 rounded-md text-sm font-medium border border-slate-600/50 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Zoom:</span>
          <span className="text-white font-mono">
            {Math.round(zoom.scale * 100)}%
          </span>
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          MMB / R: Fit View
        </div>
      </div>

      {/* Canvas Controls */}
      <CanvasControls
        // Zoom controls
        onZoomIn={() => {
          loadingStates.setUserInteracted(true);
          zoom.zoomAtPoint({ x: 0.5, y: 0.5 }, 1.2);
        }}
        onZoomOut={() => {
          loadingStates.setUserInteracted(true);
          zoom.zoomAtPoint({ x: 0.5, y: 0.5 }, 0.8);
        }}
        onFitView={() => {
          loadingStates.setUserInteracted(true);
          zoom.fitToNodes(processedGraphData.nodes, { animate: true });
        }}
        onZoomToClusters={() => {
          loadingStates.setUserInteracted(true);
          // Use allNodes instead of nodes and map to positioned nodes
          const clusterNodes = [];
          internalPositionClusters.forEach(cluster => {
            if (cluster.allNodes) {
              cluster.allNodes.forEach(clusterNode => {
                const positionedNode = processedGraphData.nodes.find(pn => pn.id === clusterNode.id);
                if (positionedNode && !clusterNodes.some(existing => existing.id === positionedNode.id)) {
                  clusterNodes.push(positionedNode);
                }
              });
            }
          });
          if (clusterNodes.length > 0) {
            zoom.fitToNodes(clusterNodes, { animate: true });
          }
        }}
        
        // Cluster controls
        showOpeningClusters={clusters.showOpeningClusters}
        onToggleOpeningClusters={clusters.toggleOpeningClusters}
        
        // Performance controls
        maxDepth={internalMaxDepth}
        minGameCount={internalMinGameCount}
        tempMinGameCount={internalTempMinGameCount}
        winRateFilter={internalWinRateFilter}
        tempWinRateFilter={internalTempWinRateFilter}
        onMaxDepthChange={handleMaxDepthChangeAsync}
        onMinGameCountChange={handleMinGameCountChangeAsync}
        onTempMinGameCountChange={handleTempMinGameCountChange}
        onWinRateFilterChange={handleTempWinRateFilterChange}
        onApplyWinRateFilter={handleApplyWinRateFilterAsync}
        onMinGameCountSliderRelease={handleMinGameCountSliderRelease}
        
        selectedPlayer={selectedPlayer}
        onPlayerChange={onPlayerChange}
        isClusteringLoading={internalIsClusteringLoading}
        showPerformanceLegend={internalShowPerformanceLegend}
        onShowPerformanceLegend={(show) => {
          setInternalShowPerformanceLegend(show);
          if (onShowPerformanceLegend) onShowPerformanceLegend(show);
        }}
        showZoomDebounceOverlay={internalShowZoomDebounceOverlay}
        
        // Position cluster controls
        showPositionClusters={clusters.showPositionClusters}
        onTogglePositionClusters={clusters.togglePositionClusters}
        
        // Auto zoom controls
        autoZoomOnClick={internalAutoZoomOnClick}
        onToggleAutoZoomOnClick={handleToggleAutoZoomOnClick}
      />

      {/* Main Canvas */}
      <div 
        ref={canvasRef}
        className="w-full h-full"
        style={{ 
          opacity: loadingStates.shouldShowCanvas(dimensions, zoom.transform, initialTransform) ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
          cursor: interactionBlocking.isCanvasInteractionBlocked() ? 'not-allowed' : (mousePressed ? 'grabbing' : cursorStyle)
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
      >
        <Canvas
          graphData={processedGraphData}
          mode={mode}
          transform={zoom.transform}
          width={dimensions.width}
          height={dimensions.height}
          currentNodeId={internalCurrentNodeId}
          hoveredNodeId={position.hoveredNodeId}
          hoveredNextMoveNodeId={position.hoveredNextMoveNodeId}
          selectedNodeId={position.selectedNodeId}
          openingClusters={internalOpeningClusters}
          positionClusters={internalPositionClusters}
          showOpeningClusters={clusters.showOpeningClusters}
          showPositionClusters={clusters.showPositionClusters}
          hoveredOpeningName={clusters.hoveredOpeningName}
          hoveredClusterColor={clusters.hoveredClusterColor}
        />
      </div>

      {/* Context Menu */}
      {contextMenuVisible && contextMenuActions && (
        <ContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          actions={contextMenuActions}
          node={contextMenuNode}
          onAction={handleContextMenuAction}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
});

export default ChessCanvas; 