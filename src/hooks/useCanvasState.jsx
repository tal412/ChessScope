import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Unified canvas state management hook
 * Handles all canvas functionality: zoom, clustering, performance controls, position tracking, context menus
 * Can be used by both PerformanceGraph and OpeningEditor for consistent experience
 */
export const useCanvasState = ({
  // Canvas options
  enableAutoFit = true,
  autoFitOnResize = true,
  autoFitOnGraphChange = true,
  autoFitDelay = 200,
  
  // Performance graph options
  openingGraph = null,
  selectedPlayer = 'white',
  enableClustering = true,
  enablePositionClusters = true,
  enableAutoZoom = false,
  
  // Context menu options
  enableContextMenu = false,
  contextMenuActions = null,
  
  // Default control values
  defaultMaxDepth = 20,
  defaultMinGameCount = 20,
  defaultWinRateFilter = [0, 100]
} = {}) => {
  // Canvas function references - use refs for stable access
  const canvasFitViewRef = useRef(null);
  const canvasZoomToClustersRef = useRef(null);
  const canvasZoomToRef = useRef(null);
  
  // Canvas state tracking
  const [isCanvasResizing, setIsCanvasResizing] = useState(false);
  const [isCanvasInitializing, setIsCanvasInitializing] = useState(false);
  
  // Performance controls state
  const [maxDepth, setMaxDepth] = useState(defaultMaxDepth);
  const [minGameCount, setMinGameCount] = useState(defaultMinGameCount);
  const [winRateFilter, setWinRateFilter] = useState(defaultWinRateFilter);
  const [tempWinRateFilter, setTempWinRateFilter] = useState(defaultWinRateFilter);
  
  // Clustering state
  const [openingClusteringEnabled, setOpeningClusteringEnabled] = useState(enableClustering);
  const [openingClusters, setOpeningClusters] = useState([]);
  const [positionClusters, setPositionClusters] = useState([]);
  const [showPositionClusters, setShowPositionClusters] = useState(true);
  
  // Hover state
  const [hoveredOpeningName, setHoveredOpeningName] = useState(null);
  const [hoveredClusterColor, setHoveredClusterColor] = useState(null);
  const [hoveredNextMoveNodeId, setHoveredNextMoveNodeId] = useState(null);
  
  // UI state
  const [showPerformanceControls, setShowPerformanceControls] = useState(false);
  const [showPerformanceLegend, setShowPerformanceLegend] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Position tracking
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [currentPositionFen, setCurrentPositionFen] = useState(null);
  
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuNode, setContextMenuNode] = useState(null);
  
  // Auto-fit state
  const autoFitTimeoutRef = useRef(null);
  const lastGraphChangeRef = useRef(null);
  
  // Auto-zoom state
  const [showZoomDebounceOverlay, setShowZoomDebounceOverlay] = useState(false);
  const autoZoomTimeoutRef = useRef(null);
  const lastPositionFenRef = useRef(null);
  
  // Refs for stable state access
  const isCanvasResizingRef = useRef(false);
  const isCanvasInitializingRef = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    isCanvasResizingRef.current = isCanvasResizing;
  }, [isCanvasResizing]);
  
  useEffect(() => {
    isCanvasInitializingRef.current = isCanvasInitializing;
  }, [isCanvasInitializing]);
  
  // Canvas control functions
  const fitView = useCallback(() => {
    if (canvasFitViewRef.current) {
      canvasFitViewRef.current();
    }
  }, []);
  
  const zoomToClusters = useCallback(() => {
    if (canvasZoomToClustersRef.current) {
      canvasZoomToClustersRef.current();
    }
  }, []);
  
  const zoomTo = useCallback((target) => {
    if (canvasZoomToRef.current) {
      canvasZoomToRef.current(target);
    }
  }, []);
  
  // Auto-fit with debouncing
  const scheduleAutoFit = useCallback((reason = 'unknown', delay = autoFitDelay) => {
    if (!enableAutoFit) return;
    
    // Clear existing timeout
    if (autoFitTimeoutRef.current) {
      clearTimeout(autoFitTimeoutRef.current);
    }
    
    // Schedule auto-fit (check state at execution time using refs)
    autoFitTimeoutRef.current = setTimeout(() => {
      // Check state at execution time using refs to avoid stale closures
      if (canvasFitViewRef.current && !isCanvasResizingRef.current && !isCanvasInitializingRef.current) {
        canvasFitViewRef.current();
      }
      autoFitTimeoutRef.current = null;
    }, delay);
  }, [enableAutoFit, autoFitDelay]);
  
  // Handle graph changes
  const handleGraphChange = useCallback((graphData) => {
    if (!autoFitOnGraphChange) return;
    
    const currentGraphSignature = JSON.stringify({
      nodeCount: graphData?.nodes?.length || 0,
      edgeCount: graphData?.edges?.length || 0
    });
    
    // Check if this is a significant change
    if (currentGraphSignature !== lastGraphChangeRef.current) {
      lastGraphChangeRef.current = currentGraphSignature;
      scheduleAutoFit('graph-change');
    }
  }, [autoFitOnGraphChange, scheduleAutoFit]);
  
  // Performance control handlers
  const handleMaxDepthChange = useCallback((newDepth) => {
    setMaxDepth(newDepth);
  }, []);
  
  const handleMinGameCountChange = useCallback((newMinCount) => {
    setMinGameCount(newMinCount);
  }, []);
  
  const handleWinRateFilterChange = useCallback((newFilter) => {
    setWinRateFilter(newFilter);
  }, []);
  
  const handleTempWinRateFilterChange = useCallback((newTempFilter) => {
    setTempWinRateFilter(newTempFilter);
  }, []);
  
  const applyWinRateFilter = useCallback(() => {
    setWinRateFilter([...tempWinRateFilter]);
  }, [tempWinRateFilter]);
  
  // Clustering handlers
  const toggleOpeningClustering = useCallback(() => {
    setOpeningClusteringEnabled(!openingClusteringEnabled);
  }, [openingClusteringEnabled]);
  
  const togglePositionClusters = useCallback(() => {
    setShowPositionClusters(!showPositionClusters);
  }, [showPositionClusters]);
  
  // Cluster hover handlers
  const handleClusterHover = useCallback((clusterName, clusterColor) => {
    requestAnimationFrame(() => {
      setHoveredOpeningName(clusterName);
      setHoveredClusterColor(clusterColor);
    });
  }, []);
  
  const handleClusterHoverEnd = useCallback(() => {
    requestAnimationFrame(() => {
      setHoveredOpeningName(null);
      setHoveredClusterColor(null);
    });
  }, []);
  
  // Position tracking
  const updateCurrentPosition = useCallback((nodeId, fen) => {
    setCurrentNodeId(nodeId);
    setCurrentPositionFen(fen);
  }, []);
  
  // Auto-zoom functionality with debouncing
  useEffect(() => {
    // COMPLETELY DISABLE auto-zoom if not enabled
    if (!enableAutoZoom) {
      // Clear any existing auto-zoom timeout when disabled
      if (autoZoomTimeoutRef.current) {
        clearTimeout(autoZoomTimeoutRef.current);
        autoZoomTimeoutRef.current = null;
      }
      return;
    }
    
    if (!canvasZoomToClustersRef.current && !canvasFitViewRef.current) return;
    
    // Clear any existing auto-zoom timeout
    if (autoZoomTimeoutRef.current) {
      clearTimeout(autoZoomTimeoutRef.current);
      autoZoomTimeoutRef.current = null;
    }
    
    const positionChanged = currentPositionFen !== lastPositionFenRef.current;
    
    if (positionChanged) {
      lastPositionFenRef.current = currentPositionFen;
    }
    
    // Check if canvas is ready and not resizing
    const canvasIsReady = (canvasZoomToClustersRef.current || canvasFitViewRef.current) && !isGenerating && !isCanvasResizing;
    
    // Only auto-zoom on actual position changes, not on cluster updates during resize
    // This prevents conflicts with resize handling
    if (!positionChanged || !canvasIsReady) return;
    
    // Auto-zoom logic: 
    // - If we have position clusters enabled and a current position, zoom to clusters
    // - If we have a current position but no position clusters enabled, fit to all nodes
    const shouldZoomToClusters = enablePositionClusters && positionClusters.length > 0 && currentPositionFen;
    const shouldFitToAll = (!enablePositionClusters || positionClusters.length === 0) && currentPositionFen;
    
    if (shouldZoomToClusters || shouldFitToAll) {
      // Debounce auto-zoom calls to prevent conflicts
      autoZoomTimeoutRef.current = setTimeout(() => {
        try {
          if (shouldZoomToClusters && canvasZoomToClustersRef.current) {
            canvasZoomToClustersRef.current();
          } else if (shouldFitToAll && canvasFitViewRef.current) {
            canvasFitViewRef.current();
          }
        } catch (error) {
          console.error('❌ Error executing auto-zoom:', error);
        }
        autoZoomTimeoutRef.current = null;
      }, 150);
    }
    
    setShowZoomDebounceOverlay(false);
  }, [positionClusters, currentPositionFen, isGenerating, isCanvasResizing, enableAutoZoom, enablePositionClusters]);
  
  // Canvas callback handlers
  const handleCanvasFitView = useCallback((fitViewFn) => {
    canvasFitViewRef.current = fitViewFn;
  }, []);
  
  const handleCanvasZoomToClusters = useCallback((zoomToClustersFn) => {
    canvasZoomToClustersRef.current = zoomToClustersFn;
  }, []);
  
  const handleCanvasZoomTo = useCallback((zoomToFn) => {
    canvasZoomToRef.current = zoomToFn;
  }, []);
  
  const handleCanvasResizeStateChange = useCallback((isResizing) => {
    setIsCanvasResizing(isResizing);
    isCanvasResizingRef.current = isResizing;
    
    // Schedule appropriate zoom when resize completes - but respect enableAutoZoom setting
    if (!isResizing && autoFitOnResize) {
      setTimeout(() => {
        // Only auto-zoom if enableAutoZoom is true
        if (enableAutoZoom) {
          // If we have position clusters enabled and a current position, zoom to clusters
          // Otherwise, fit to all nodes
          if (enablePositionClusters && positionClusters.length > 0 && currentPositionFen && canvasZoomToClustersRef.current) {
            canvasZoomToClustersRef.current();
          } else if (canvasFitViewRef.current) {
            canvasFitViewRef.current();
          }
        } else {
          // If auto-zoom is disabled, just fit to all nodes on resize
          if (canvasFitViewRef.current) {
            canvasFitViewRef.current();
          }
        }
      }, 300); // Use longer delay for resize to ensure canvas is stable
    }
  }, [autoFitOnResize, enableAutoZoom, enablePositionClusters, positionClusters.length, currentPositionFen]);
  
  const handleCanvasInitializingStateChange = useCallback((isInitializing) => {
    setIsCanvasInitializing(isInitializing);
    isCanvasInitializingRef.current = isInitializing;
  }, []);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (autoFitTimeoutRef.current) {
      clearTimeout(autoFitTimeoutRef.current);
      autoFitTimeoutRef.current = null;
    }
    if (autoZoomTimeoutRef.current) {
      clearTimeout(autoZoomTimeoutRef.current);
      autoZoomTimeoutRef.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // Context menu handlers
  const showContextMenu = useCallback((x, y, node) => {
    if (!enableContextMenu) return;
    
    setContextMenuPosition({ x, y });
    setContextMenuNode(node);
    setContextMenuVisible(true);
  }, [enableContextMenu]);
  
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
  
  return {
    // Canvas state
    isCanvasResizing,
    isCanvasInitializing,
    
    // Canvas functions
    fitView,
    zoomToClusters,
    zoomTo,
    scheduleAutoFit,
    handleGraphChange,
    cleanup,
    
    // Performance controls
    maxDepth,
    minGameCount,
    winRateFilter,
    tempWinRateFilter,
    handleMaxDepthChange,
    handleMinGameCountChange,
    handleWinRateFilterChange,
    handleTempWinRateFilterChange,
    applyWinRateFilter,
    
    // Clustering
    openingClusteringEnabled,
    openingClusters,
    positionClusters,
    showPositionClusters,
    setOpeningClusters,
    setPositionClusters,
    toggleOpeningClustering,
    togglePositionClusters,
    
    // Hover state
    hoveredOpeningName,
    hoveredClusterColor,
    hoveredNextMoveNodeId,
    setHoveredNextMoveNodeId,
    handleClusterHover,
    handleClusterHoverEnd,
    
    // UI state
    showPerformanceControls,
    showPerformanceLegend,
    isGenerating,
    setShowPerformanceControls,
    setShowPerformanceLegend,
    setIsGenerating,
    
    // Position tracking
    currentNodeId,
    currentPositionFen,
    updateCurrentPosition,
    
    // Context menu state
    contextMenuVisible,
    contextMenuPosition,
    contextMenuNode,
    showContextMenu,
    hideContextMenu,
    handleContextMenuAction,
    
    // Auto-zoom
    showZoomDebounceOverlay,
    
    // Canvas callback handlers (pass these to CanvasPerformanceGraph)
    onFitView: handleCanvasFitView,
    onZoomToClusters: handleCanvasZoomToClusters,
    onZoomTo: handleCanvasZoomTo,
    onResizeStateChange: handleCanvasResizeStateChange,
    onInitializingStateChange: handleCanvasInitializingStateChange,
  };
};

// Export the unified hook as both names for backward compatibility during transition
export const usePerformanceGraphState = useCanvasState; 