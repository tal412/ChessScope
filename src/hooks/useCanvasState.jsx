import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Shared canvas state management hook
 * Manages zoom, fit view, and auto-fit functionality for canvas components
 */
export const useCanvasState = ({
  enableAutoFit = false,
  autoFitOnResize = false,
  autoFitOnGraphChange = false,
  autoFitDelay = 100
} = {}) => {
  // Canvas function references - use refs for stable access
  const canvasFitViewRef = useRef(null);
  const canvasZoomToClustersRef = useRef(null);
  const canvasZoomToRef = useRef(null);
  
  // Canvas state tracking
  const [isCanvasResizing, setIsCanvasResizing] = useState(false);
  const [isCanvasInitializing, setIsCanvasInitializing] = useState(false);
  
  // Auto-fit state
  const autoFitTimeoutRef = useRef(null);
  const lastGraphChangeRef = useRef(null);
  
  // Refs for stable state access
  const isCanvasResizingRef = useRef(false);
  const isCanvasInitializingRef = useRef(false);
  
  // Fit view function
  const fitView = useCallback(() => {
    if (canvasFitViewRef.current) {
      canvasFitViewRef.current();
    }
  }, []);
  
  // Zoom to clusters function
  const zoomToClusters = useCallback(() => {
    if (canvasZoomToClustersRef.current) {
      canvasZoomToClustersRef.current();
    }
  }, []);
  
  // Generic zoom function
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
  }, [enableAutoFit, autoFitDelay]); // Remove canvasFitView dependency to prevent infinite loops
  
  // Handle graph changes
  const handleGraphChange = useCallback((graphData) => {
    if (!autoFitOnGraphChange) return;
    
    const currentGraphSignature = JSON.stringify({
      nodeCount: graphData?.nodes?.length || 0,
      edgeCount: graphData?.edges?.length || 0
    });
    
    // Check if this is a significant change (don't include timestamp to prevent infinite loops)
    if (currentGraphSignature !== lastGraphChangeRef.current) {
      lastGraphChangeRef.current = currentGraphSignature;
      scheduleAutoFit('graph-change');
    }
  }, [autoFitOnGraphChange, scheduleAutoFit]);
  

  
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
    isCanvasResizingRef.current = isResizing; // Update ref for stable access
    
    // Schedule auto-fit when resize completes
    if (!isResizing && autoFitOnResize) {
      setTimeout(() => {
        scheduleAutoFit('resize-complete', 300);
      }, 200);
    }
  }, [autoFitOnResize, scheduleAutoFit]);
  
  const handleCanvasInitializingStateChange = useCallback((isInitializing) => {
    setIsCanvasInitializing(isInitializing);
    isCanvasInitializingRef.current = isInitializing; // Update ref for stable access
  }, []);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (autoFitTimeoutRef.current) {
      clearTimeout(autoFitTimeoutRef.current);
      autoFitTimeoutRef.current = null;
    }
  }, []);
  
  return {
    // State
    isCanvasResizing,
    isCanvasInitializing,
    
    // Functions
    fitView,
    zoomToClusters,
    zoomTo,
    scheduleAutoFit,
    handleGraphChange,
    cleanup,
    
    // Canvas callback handlers (pass these to CanvasPerformanceGraph)
    onFitView: handleCanvasFitView,
    onZoomToClusters: handleCanvasZoomToClusters,
    onZoomTo: handleCanvasZoomTo,
    onResizeStateChange: handleCanvasResizeStateChange,
    onInitializingStateChange: handleCanvasInitializingStateChange,
  };
};

/**
 * Shared performance graph state management hook
 * Handles all performance graph functionality including clustering, controls, position tracking
 * Can be used by both PerformanceGraph and OpeningEditor
 */
export const usePerformanceGraphState = ({
  openingGraph = null,
  selectedPlayer = 'white',
  enableClustering = true,
  enablePositionClusters = true,
  enableAutoZoom = true
} = {}) => {
  // Performance controls state
  const [maxDepth, setMaxDepth] = useState(20);
  const [minGameCount, setMinGameCount] = useState(20);
  const [winRateFilter, setWinRateFilter] = useState([0, 100]);
  const [tempWinRateFilter, setTempWinRateFilter] = useState([0, 100]);
  
  // Clustering state
  const [openingClusteringEnabled, setOpeningClusteringEnabled] = useState(false);
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
  
  // Auto-zoom state
  const [showZoomDebounceOverlay, setShowZoomDebounceOverlay] = useState(false);
  const autoZoomTimeoutRef = useRef(null);
  const lastPositionFenRef = useRef(null);
  
  // Canvas state hook - disable auto-fit on resize when auto-zoom is enabled to prevent conflicts
  const canvasState = useCanvasState({
    enableAutoFit: true,
    autoFitOnResize: !enableAutoZoom, // Disable auto-fit on resize when auto-zoom is enabled
    autoFitOnGraphChange: false, // We'll handle this manually for performance mode
    autoFitDelay: 200
  });
  
  // Handle resize-specific auto-fit when auto-zoom is enabled
  useEffect(() => {
    if (!enableAutoZoom) return; // Only handle this when auto-zoom is enabled
    
    // When canvas finishes resizing and auto-zoom is enabled, we need to handle fit ourselves
    if (!canvasState.isCanvasResizing && canvasState.fitView && !isGenerating) {
      // Clear any existing auto-zoom timeout to prevent conflicts
      if (autoZoomTimeoutRef.current) {
        clearTimeout(autoZoomTimeoutRef.current);
        autoZoomTimeoutRef.current = null;
      }
      
      // After resize, fit appropriately based on whether we have position clusters
      autoZoomTimeoutRef.current = setTimeout(() => {
        try {
          if (positionClusters.length > 0 && canvasState.zoomToClusters) {
            // If we have position clusters, zoom to them
            canvasState.zoomToClusters();
          } else if (canvasState.fitView) {
            // Otherwise, fit to all nodes
            canvasState.fitView();
          }
        } catch (error) {
          console.error('❌ Error executing post-resize auto-fit:', error);
        }
        autoZoomTimeoutRef.current = null;
      }, 300); // Use a longer delay for resize to ensure canvas is stable
    }
  }, [canvasState.isCanvasResizing, canvasState.fitView, canvasState.zoomToClusters, positionClusters.length, isGenerating, enableAutoZoom]);
  
  // Control handlers
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
    if (!enableAutoZoom || (!canvasState.zoomToClusters && !canvasState.fitView)) return;
    
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
    const canvasIsReady = (canvasState.zoomToClusters || canvasState.fitView) && !isGenerating && !canvasState.isCanvasResizing;
    
    // Auto-zoom logic: 
    // - If we have position clusters and a current position, zoom to clusters
    // - If we have a current position but no position clusters, fit to all nodes
    // This will trigger both when position changes AND when clusters are generated/cleared
    const shouldZoomToClusters = positionClusters.length > 0 && canvasIsReady && currentPositionFen;
    const shouldFitToAll = positionClusters.length === 0 && canvasIsReady && currentPositionFen;
    
    if (shouldZoomToClusters || shouldFitToAll) {
      // Debounce auto-zoom calls to prevent conflicts
      autoZoomTimeoutRef.current = setTimeout(() => {
        try {
          if (shouldZoomToClusters) {
            canvasState.zoomToClusters();
          } else if (shouldFitToAll) {
            canvasState.fitView();
          }
        } catch (error) {
          console.error('❌ Error executing auto-zoom:', error);
        }
        autoZoomTimeoutRef.current = null;
      }, 150); // Slightly longer delay to prevent conflicts
    }
    
    setShowZoomDebounceOverlay(false);
  }, [positionClusters, canvasState.zoomToClusters, canvasState.fitView, currentPositionFen, isGenerating, canvasState.isCanvasResizing, enableAutoZoom]);
  
  // Cleanup function
  useEffect(() => {
    return () => {
      if (autoZoomTimeoutRef.current) {
        clearTimeout(autoZoomTimeoutRef.current);
      }
    };
  }, []);

  return {
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
    
    // Auto-zoom
    showZoomDebounceOverlay,
    
    // Canvas state
    canvasState,
  };
}; 