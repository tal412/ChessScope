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
  
  // Auto-zoom functionality
  useEffect(() => {
    if (!enableAutoZoom || !canvasState.zoomToClusters) return;
    
    const positionChanged = currentPositionFen !== lastPositionFenRef.current;
    
    if (positionChanged) {
      lastPositionFenRef.current = currentPositionFen;
    }
    
    // Check if canvas is ready and not resizing
    const canvasIsReady = canvasState.zoomToClusters && !isGenerating && !canvasState.isCanvasResizing;
    
    // Auto-zoom when we have position clusters and a current position
    // This will trigger both when position changes AND when clusters are generated
    const shouldAutoZoom = positionClusters.length > 0 && canvasIsReady && currentPositionFen;
    
    if (shouldAutoZoom) {
      // Use a longer delay to ensure position clusters are fully rendered
      setTimeout(() => {
        try {
          canvasState.zoomToClusters();
        } catch (error) {
          console.error('❌ Error executing auto-zoom:', error);
        }
      }, 100);
    }
    
    setShowZoomDebounceOverlay(false);
  }, [positionClusters, canvasState.zoomToClusters, currentPositionFen, isGenerating, canvasState.isCanvasResizing, enableAutoZoom]);
  
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