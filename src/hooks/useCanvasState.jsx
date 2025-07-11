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
  
  // Ref to store current position clusters for immediate access in auto-zoom
  const positionClustersRef = useRef([]);
  
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
  
  // Update position clusters ref when position clusters change
  useEffect(() => {
    positionClustersRef.current = positionClusters;
  }, [positionClusters]);
  
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
    
    // scheduleAutoFit is for programmatic graph changes (new moves, deletions, mode changes, resize)
    // It should work regardless of click auto-zoom setting since these are not user clicks
    // Click-based auto-zoom is handled separately by the auto-zoom effect
    
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
    
    // Graph changes are programmatic, not user clicks, so should work regardless of click auto-zoom setting
    
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
    
    // DIRECT AUTO-ZOOM ON CLICK OR RESET - No effect dependencies to interfere!
    if (enableAutoZoom && fen && (
      (source === 'click' && enableClickAutoZoom) || 
      (source === 'reset')
    )) {
      console.log('🎯 DIRECT AUTO-ZOOM ON', source.toUpperCase());
      
      // Clear any existing auto-zoom timeout
      if (autoZoomTimeoutRef.current) {
        console.log('🗑️ CLEARING EXISTING AUTO-ZOOM TIMEOUT (DIRECT)');
        clearTimeout(autoZoomTimeoutRef.current);
        autoZoomTimeoutRef.current = null;
      }
      
      // Schedule auto-zoom directly
      autoZoomTimeoutRef.current = setTimeout(() => {
        try {
          // Get current position clusters length at execution time using ref
          const currentPositionClusters = positionClustersRef.current;
          const shouldZoomToClusters = enablePositionClusters && currentPositionClusters.length > 0;
          const shouldFitToAll = !shouldZoomToClusters;
          
          console.log('🎯 EXECUTING DIRECT AUTO-ZOOM:', shouldZoomToClusters ? 'ZOOM TO CLUSTERS' : 'FIT TO ALL');
          console.log('🔍 DIRECT ZOOM REFS:', {
            canvasZoomToClustersRef: !!canvasZoomToClustersRef.current,
            canvasFitViewRef: !!canvasFitViewRef.current,
            shouldZoomToClusters,
            shouldFitToAll,
            positionClustersLength: currentPositionClusters.length
          });
          
          if (shouldZoomToClusters && canvasZoomToClustersRef.current) {
            console.log('📞 CALLING canvasZoomToClustersRef.current() (DIRECT)');
            canvasZoomToClustersRef.current();
            console.log('✅ ZOOM TO CLUSTERS CALLED (DIRECT)');
          } else if (shouldFitToAll && canvasFitViewRef.current) {
            console.log('📞 CALLING canvasFitViewRef.current() (DIRECT)');
            canvasFitViewRef.current();
            console.log('✅ FIT TO ALL CALLED (DIRECT)');
          } else {
            console.log('❌ NO ZOOM FUNCTION AVAILABLE (DIRECT)', {
              shouldZoomToClusters,
              shouldFitToAll,
              hasZoomToClusters: !!canvasZoomToClustersRef.current,
              hasFitView: !!canvasFitViewRef.current
            });
          }
        } catch (error) {
          console.error('❌ Error executing direct auto-zoom:', error);
        }
        autoZoomTimeoutRef.current = null;
      }, 150);
    }
  }, [enableAutoZoom, enableClickAutoZoom, enablePositionClusters]);
  
  // Auto-zoom functionality with debouncing - ONLY for programmatic position changes
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
    // EXCEPT for reset actions which should always trigger fit-to-view
    const timeSinceLastPositionChange = Date.now() - lastPositionChangeTimeRef.current;
    const wasRecentReset = lastPositionChangeSourceRef.current === 'reset' && timeSinceLastPositionChange < 1000;
    
    if (!enableClickAutoZoom && !wasRecentReset) {
      // Clear any existing auto-zoom timeout when disabled
      if (autoZoomTimeoutRef.current) {
        clearTimeout(autoZoomTimeoutRef.current);
        autoZoomTimeoutRef.current = null;
      }
      return;
    }
    
    if (!canvasZoomToClustersRef.current && !canvasFitViewRef.current) return;
    
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
    
    // SKIP effect-based auto-zoom if this was a recent click or reset (handled by direct auto-zoom)
    const timeSinceLastChange = Date.now() - lastPositionChangeTimeRef.current;
    const wasRecentClick = lastPositionChangeSourceRef.current === 'click' && timeSinceLastChange < 1000;
    const wasRecentResetAction = lastPositionChangeSourceRef.current === 'reset' && timeSinceLastChange < 1000;
    
    if (wasRecentClick || wasRecentResetAction) {
      console.log('⏭️ SKIPPING EFFECT-BASED AUTO-ZOOM - RECENT', lastPositionChangeSourceRef.current.toUpperCase(), '(handled by direct auto-zoom)');
      return;
    }
    
    // Auto-zoom logic: 
    // - If we have position clusters enabled and a current position, zoom to clusters
    // - If we have a current position but no position clusters enabled, fit to all nodes
    const currentPositionClusters = positionClustersRef.current;
    const shouldZoomToClusters = enablePositionClusters && currentPositionClusters.length > 0 && !!currentPositionFen;
    const shouldFitToAll = (!enablePositionClusters || currentPositionClusters.length === 0) && !!currentPositionFen;
    
    console.log('🔍 EFFECT-BASED AUTO-ZOOM (PROGRAMMATIC):', {
      positionChanged,
      canvasIsReady,
      shouldZoomToClusters,
      shouldFitToAll,
      enablePositionClusters,
      positionClustersLength: currentPositionClusters.length,
      currentPositionFen,
      isGenerating,
      isCanvasResizing,
      enableAutoZoom,
      enableClickAutoZoom,
      wasRecentClick
    });
    
    if (shouldZoomToClusters || shouldFitToAll) {
      console.log('📝 SCHEDULING EFFECT-BASED AUTO-ZOOM:', shouldZoomToClusters ? 'ZOOM TO CLUSTERS' : 'FIT TO ALL');
      
      // Clear any existing auto-zoom timeout
      if (autoZoomTimeoutRef.current) {
        console.log('🗑️ CLEARING EXISTING AUTO-ZOOM TIMEOUT (EFFECT)');
        clearTimeout(autoZoomTimeoutRef.current);
        autoZoomTimeoutRef.current = null;
      }
      
      // Capture values at scheduling time to avoid closure issues
      const zoomAction = shouldZoomToClusters ? 'ZOOM TO CLUSTERS' : 'FIT TO ALL';
      const useZoomToClusters = shouldZoomToClusters;
      const useFitToAll = shouldFitToAll;
      
      // Debounce auto-zoom calls to prevent conflicts
      autoZoomTimeoutRef.current = setTimeout(() => {
        try {
          console.log('🎯 EXECUTING EFFECT-BASED AUTO-ZOOM:', zoomAction);
          console.log('🔍 EFFECT ZOOM REFS:', {
            canvasZoomToClustersRef: !!canvasZoomToClustersRef.current,
            canvasFitViewRef: !!canvasFitViewRef.current,
            useZoomToClusters,
            useFitToAll
          });
          
          if (useZoomToClusters && canvasZoomToClustersRef.current) {
            console.log('📞 CALLING canvasZoomToClustersRef.current() (EFFECT)');
            canvasZoomToClustersRef.current();
            console.log('✅ ZOOM TO CLUSTERS CALLED (EFFECT)');
          } else if (useFitToAll && canvasFitViewRef.current) {
            console.log('📞 CALLING canvasFitViewRef.current() (EFFECT)');
            canvasFitViewRef.current();
            console.log('✅ FIT TO ALL CALLED (EFFECT)');
          } else {
            console.log('❌ NO ZOOM FUNCTION AVAILABLE (EFFECT)', {
              useZoomToClusters,
              useFitToAll,
              hasZoomToClusters: !!canvasZoomToClustersRef.current,
              hasFitView: !!canvasFitViewRef.current
            });
          }
        } catch (error) {
          console.error('❌ Error executing effect-based auto-zoom:', error);
        }
        autoZoomTimeoutRef.current = null;
      }, 150);
    } else {
      console.log('❌ NOT SCHEDULING EFFECT-BASED AUTO-ZOOM - CONDITIONS NOT MET');
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
      // Use scheduleAutoFit with 'resize' reason to ensure it works regardless of click auto-zoom setting
      scheduleAutoFit('resize', 300);
    }
  }, [autoFitOnResize, scheduleAutoFit]);
  
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