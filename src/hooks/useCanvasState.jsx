import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Unified canvas state management hook
 * Handles all canvas functionality: zoom, clustering, performance controls, position tracking, context menus
 * Can be used by both PerformanceGraph and OpeningEditor for consistent experience
 */
export const useCanvasState = ({
  // Canvas options
  enableAutoFit = true,
  autoFitOnResize = true, // Controls resize-based auto-fit (separate from click-based auto-zoom)
  autoFitOnGraphChange = true,
  autoFitDelay = 200,
  
  // Performance graph options
  openingGraph = null,
  selectedPlayer = 'white',
  enableClustering = true,
  enablePositionClusters = true,
  enableAutoZoom = true, // General auto-zoom (for programmatic position changes)
  enableClickAutoZoom = true, // Specific auto-zoom on user clicks
  
  // Context menu options
  enableContextMenu = false,
  contextMenuActions = null,
  
  // Default control values
  defaultMaxDepth = 20,
  defaultMinGameCount = 1,
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
  const [tempMinGameCount, setTempMinGameCount] = useState(defaultMinGameCount); // NEW: Temporary value for slider
  const [winRateFilter, setWinRateFilter] = useState(defaultWinRateFilter);
  const [tempWinRateFilter, setTempWinRateFilter] = useState(defaultWinRateFilter);
  
  // Clustering state - with localStorage persistence
  const [openingClusteringEnabled, setOpeningClusteringEnabled] = useState(() => {
    const savedState = localStorage.getItem('canvas-opening-clusters-enabled');
    return savedState ? JSON.parse(savedState) : enableClustering;
  });
  const [openingClusters, setOpeningClusters] = useState([]);
  const [positionClusters, setPositionClusters] = useState([]);
  const [showPositionClusters, setShowPositionClusters] = useState(() => {
    const savedState = localStorage.getItem('canvas-position-clusters-enabled');
    return savedState ? JSON.parse(savedState) : true;
  });
  
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
  const hasInitialPositionRef = useRef(false); // Track if we've set an initial position
  
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
    
    // Skip auto-fit when click auto-zoom is disabled (user wants no auto-zoom at all)
    if (!enableClickAutoZoom) return;
    
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
  }, [enableAutoFit, autoFitDelay, enableClickAutoZoom]);
  
  // Handle graph changes
  const handleGraphChange = useCallback((graphData) => {
    if (!autoFitOnGraphChange) return;
    
    // Skip auto-fit when click auto-zoom is disabled (user wants no auto-zoom at all)
    if (!enableClickAutoZoom) return;
    
    const currentGraphSignature = JSON.stringify({
      nodeCount: graphData?.nodes?.length || 0,
      edgeCount: graphData?.edges?.length || 0
    });
    
    // Check if this is a significant change
    if (currentGraphSignature !== lastGraphChangeRef.current) {
      lastGraphChangeRef.current = currentGraphSignature;
      scheduleAutoFit('graph-change');
    }
  }, [autoFitOnGraphChange, scheduleAutoFit, enableClickAutoZoom]);
  
  // Performance control handlers
  const handleMaxDepthChange = useCallback((newDepth) => {
    setMaxDepth(newDepth);
  }, []);
  
  const handleMinGameCountChange = useCallback((newMinCount) => {
    setMinGameCount(newMinCount);
    setTempMinGameCount(newMinCount); // Sync temp value when actual value changes
  }, []);

  const handleTempMinGameCountChange = useCallback((newTempMinCount) => {
    setTempMinGameCount(newTempMinCount);
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
  
  // Clustering handlers - with localStorage persistence
  const toggleOpeningClustering = useCallback(() => {
    const newState = !openingClusteringEnabled;
    setOpeningClusteringEnabled(newState);
    localStorage.setItem('canvas-opening-clusters-enabled', JSON.stringify(newState));
  }, [openingClusteringEnabled]);
  
  const togglePositionClusters = useCallback(() => {
    const newState = !showPositionClusters;
    setShowPositionClusters(newState);
    localStorage.setItem('canvas-position-clusters-enabled', JSON.stringify(newState));
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
  const lastPositionChangeSourceRef = useRef(null); // Track the source of position changes
  const lastPositionChangeTimeRef = useRef(0); // Track when the last position change happened
  
  const updateCurrentPosition = useCallback((nodeId, fen, source = 'unknown') => {
    const now = Date.now();
    const timeSinceLastChange = now - lastPositionChangeTimeRef.current;
    
    // Preserve recent user clicks - don't overwrite 'click' source with programmatic sources
    // within 1 second of a user click
    const shouldPreserveClickSource = lastPositionChangeSourceRef.current === 'click' && 
                                     timeSinceLastChange < 1000 && 
                                     (source === 'programmatic' || source === 'sync');
    
    if (!shouldPreserveClickSource) {
      lastPositionChangeSourceRef.current = source;
    }
    
    lastPositionChangeTimeRef.current = now;
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
    
    // DISABLE auto-zoom when click auto-zoom is disabled (user wants no auto-zoom at all)
    if (!enableClickAutoZoom) {
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
      
      // Mark that we've had an initial position if this is the first one
      if (!hasInitialPositionRef.current && currentPositionFen) {
        hasInitialPositionRef.current = true;
        // Skip auto-zoom on the very first position update (initial load)
        return;
      }
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
  }, [positionClusters, currentPositionFen, isGenerating, isCanvasResizing, enableAutoZoom, enablePositionClusters, enableClickAutoZoom]);
  
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
  
  const handleCanvasResizeStateChange = useCallback((isResizing, resizeSource = 'unknown') => {
    setIsCanvasResizing(isResizing);
    isCanvasResizingRef.current = isResizing;
    
    // Schedule appropriate zoom when resize completes - controlled by autoFitOnResize only
    if (!isResizing && autoFitOnResize) {
      setTimeout(() => {
        // Skip auto-zoom when click auto-zoom is disabled (user wants no auto-zoom at all)
        if (!enableClickAutoZoom) {
          return;
        }
        
        // Always auto-fit on actual window resize, but be smart about zoom target:
        // - If auto-zoom is enabled: zoom to clusters when available, otherwise fit all
        // - If auto-zoom is disabled: always fit to all (don't zoom to clusters)
        if (enableAutoZoom && enablePositionClusters && positionClusters.length > 0 && currentPositionFen && canvasZoomToClustersRef.current) {
          canvasZoomToClustersRef.current();
        } else if (canvasFitViewRef.current) {
          canvasFitViewRef.current();
        }
      }, 300); // Use longer delay for resize to ensure canvas is stable
    }
  }, [autoFitOnResize, enableAutoZoom, enablePositionClusters, positionClusters.length, currentPositionFen, enableClickAutoZoom]);
  
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
    tempMinGameCount,
    winRateFilter,
    tempWinRateFilter,
    handleMaxDepthChange,
    handleMinGameCountChange,
    handleTempMinGameCountChange,
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