import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { CANVAS_CONFIG } from './constants.js';
import { createConvexHull, isPointInPath } from './utils.js';
import { useCanvasRenderState } from './hooks/useCanvasRenderState.js';
import { useCanvasTransform } from './hooks/useCanvasTransform.js';
import { useCanvasEvents } from './hooks/useCanvasEvents.js';
import { useCanvasRendering } from './hooks/useCanvasRendering.js';
import CanvasControls from './CanvasControls.jsx';
import ContextMenu from './ContextMenu.jsx';

/**
 * Canvas-based graph component with context menu support
 * 
 * @param {Object} props - Component props
 * @param {Array} props.contextMenuActions - Array of context menu action objects
 * @param {Function} props.onNodeRightClick - Optional callback for right-click events
 */
const CanvasGraph = ({ 
  graphData, 
  onNodeClick, 
  onNodeHover, 
  onNodeHoverEnd,
  currentNodeId,
  hoveredNextMoveNodeId,
  openingClusters = [],
  positionClusters = [],
  showOpeningClusters = false,
  showPositionClusters = false,
  onFitView,
  onZoomToClusters,
  onZoomTo,
  onToggleOpeningClusters,
  onTogglePositionClusters,
  onClusterHover,
  onClusterHoverEnd,
  hoveredOpeningName = null,
  hoveredClusterColor = null,
  onResizeStateChange,
  onInitializingStateChange,
  
  // Control props
  maxDepth = 20,
  minGameCount = 1,
  tempMinGameCount = 1,
  winRateFilter = [0, 100],
  tempWinRateFilter = [0, 100],
  onMaxDepthChange,
  onMinGameCountChange,
  onTempMinGameCountChange,
  onWinRateFilterChange,
  onTempWinRateFilterChange,
  onApplyWinRateFilter,
  selectedPlayer = 'white',
  onPlayerChange,
  isGenerating = false,
  
  // UI state props
  showPerformanceControls = false,
  onShowPerformanceControls,
  isClusteringLoading = false,
  className = "",
  mode = 'performance',
  enableOpeningClusters = true,
  
  // Context menu props
  contextMenuActions = null,
  onNodeRightClick = null,
  
  // Auto zoom on click props
  autoZoomOnClick = false,
  onAutoZoomOnClickChange = null,
  
  // Auto-fit completion callback
  onAutoFitComplete = null,
  
  // Auto-fit pending state
  isAutoFitPending = false,
}) => {
  const canvasRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
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
      }
    }
    
    // Fallback
    const dimensionFallbackTimeout = setTimeout(() => {
      setDimensions(current => {
        if (current.width === 0 || current.height === 0) {
          console.warn('Canvas dimensions fallback - using default size');
          return CANVAS_CONFIG.FALLBACK_DIMENSIONS;
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
    let lastDPR = window.devicePixelRatio;
    
    const updateSize = (reason = 'resize') => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDimensions = { 
          width: Math.floor(rect.width), 
          height: Math.floor(rect.height) 
        };
        const newDPR = window.devicePixelRatio;
        
        const widthChanged = Math.abs(newDimensions.width - lastDimensions.width) > 10;
        const heightChanged = Math.abs(newDimensions.height - lastDimensions.height) > 10;
        const dprChanged = Math.abs(newDPR - lastDPR) > 0.01;
        
        if (widthChanged || heightChanged || dprChanged) {
          setDimensions(newDimensions);
          lastDimensions = newDimensions;
          lastDPR = newDPR;
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
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(() => updateSize('visibility-change'), 50);
      }
    };
    
    window.addEventListener('resize', handleWindowResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const periodicCheck = setInterval(() => {
      if (!document.hidden) {
        updateSize('periodic-check');
      }
    }, CANVAS_CONFIG.PERIODIC_CHECK_INTERVAL);
    
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(periodicCheck);
    };
  }, []);

  // Use canvas render state hook
  const canvasState = useCanvasRenderState(graphData, dimensions, mode);
  
  // Notify parent of state changes
  useEffect(() => {
    if (onResizeStateChange) {
      onResizeStateChange(canvasState.isResizing);
    }
  }, [canvasState.isResizing, onResizeStateChange]);
  
  useEffect(() => {
    if (onInitializingStateChange) {
      onInitializingStateChange(canvasState.isInitializing);
    }
  }, [canvasState.isInitializing, onInitializingStateChange]);

  // Use canvas transform hook
  const {
    zoomTo,
    fitView,
    zoomToClusters,
    updateTransform,
    applyZoom,
    cleanup: cleanupTransform
  } = useCanvasTransform(
    dimensions,
    positionClusters,
    canvasState.isCanvasInteractionBlocked,
    canvasState.isResizing,
    canvasState.isInitializing,
    canvasState.setTransform,
    canvasState.currentTransformRef,
    canvasState.positionedNodesRef
  );

  // Calculate cluster paths for hit testing
  const clusterPathsData = useMemo(() => {
    if (!enableOpeningClusters || !showOpeningClusters || !openingClusters.length || canvasState.positionedNodes.length === 0) {
      return [];
    }

    const newClusterPaths = [];
    
    openingClusters.forEach((cluster) => {
      if (!cluster.nodes || cluster.nodes.length === 0) return;

      const clusterNodes = cluster.nodes.map(n => 
        canvasState.positionedNodes.find(pn => pn.id === n.id)
      ).filter(Boolean);

      if (clusterNodes.length === 0) return;

      const nodePoints = clusterNodes.map(node => ({ x: node.x, y: node.y }));
      let hitTestPath = [];

      if (nodePoints.length === 1) {
        const node = nodePoints[0];
        const basePadding = CANVAS_CONFIG.CLUSTER_PADDING;
        const extraPadding = basePadding * CANVAS_CONFIG.SINGLE_NODE_CLUSTER_PADDING_MULTIPLIER;
        hitTestPath = [
          { x: node.x - extraPadding, y: node.y - extraPadding },
          { x: node.x + extraPadding, y: node.y - extraPadding },
          { x: node.x + extraPadding, y: node.y + extraPadding },
          { x: node.x - extraPadding, y: node.y + extraPadding }
        ];
      } else if (nodePoints.length === 2) {
        const [node1, node2] = nodePoints;
        const padding = CANVAS_CONFIG.POSITION_CLUSTER_PADDING;
        const minX = Math.min(node1.x, node2.x) - padding;
        const maxX = Math.max(node1.x, node2.x) + padding;
        const minY = Math.min(node1.y, node2.y) - padding;
        const maxY = Math.max(node1.y, node2.y) + padding;
        
        hitTestPath = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY }
        ];
      } else {
        const hull = createConvexHull(nodePoints);
        const centroid = {
          x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
          y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length
        };
        
        const padding = 60;
        hitTestPath = hull.map(point => {
          const dx = point.x - centroid.x;
          const dy = point.y - centroid.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist === 0) {
            return { x: point.x + padding, y: point.y + padding };
          }
          
          const factor = (dist + padding) / dist;
          return {
            x: centroid.x + dx * factor,
            y: centroid.y + dy * factor
          };
        });
      }
      
      newClusterPaths.push({ cluster, path: hitTestPath });
    });

    return newClusterPaths;
  }, [enableOpeningClusters, showOpeningClusters, openingClusters, canvasState.positionedNodes]);

  // Use canvas events hook
  const canvasEvents = useCanvasEvents({
    canvasRef,
    dimensions,
    transform: canvasState.transform,
    positionedNodes: canvasState.positionedNodes,
    isInitialPositioningComplete: canvasState.isInitialPositioningComplete,
    optimalTransformRef: canvasState.optimalTransformRef,
    currentPositionedNodesRef: canvasState.currentPositionedNodesRef,
    clusterPathsData,
    enableOpeningClusters,
    showOpeningClusters,
    contextMenuActions,
    isDraggingRef: canvasState.isDraggingRef,
    
    // State setters
    setMousePressed: canvasState.setMousePressed,
    setLastMouse: canvasState.setLastMouse,
    setHoveredNode: canvasState.setHoveredNode,
    setHoveredCluster: canvasState.setHoveredCluster,
    setContextMenu: canvasState.setContextMenu,
    
    // Callbacks
    onNodeClick,
    onNodeHover,
    onNodeHoverEnd,
    onClusterHover,
    onClusterHoverEnd,
    onNodeRightClick,
    isCanvasInteractionBlocked: canvasState.isCanvasInteractionBlocked,
    updateTransform,
    applyZoom,
    zoomTo,
    lastMouse: canvasState.lastMouse,
  });

  // Use canvas rendering hook
  const { cleanup: cleanupRendering } = useCanvasRendering({
    canvasRef,
    dimensions,
    transform: canvasState.transform,
    hasValidTransform: canvasState.hasValidTransform,
    positionedNodes: canvasState.positionedNodes,
    isInitialPositioningComplete: canvasState.isInitialPositioningComplete,
    optimalTransformRef: canvasState.optimalTransformRef,
    currentPositionedNodesRef: canvasState.currentPositionedNodesRef,
    graphData,
    mode,
    currentNodeId,
    hoveredNextMoveNodeId,
    hoveredNode: canvasState.hoveredNode,
    hoveredCluster: canvasState.hoveredCluster,
    openingClusters,
    positionClusters,
    showOpeningClusters,
    showPositionClusters,
    enableOpeningClusters,
  });

  // Control change handlers
  const handleMaxDepthChangeAsync = useCallback(async (newDepth) => {
    if (onMaxDepthChange) {
      canvasState.setIsInitializing(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      onMaxDepthChange(newDepth);
    }
  }, [onMaxDepthChange, canvasState.setIsInitializing]);

  const handleMinGameCountChangeAsync = useCallback(async (newCount) => {
    if (onMinGameCountChange) {
      canvasState.setIsInitializing(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      onMinGameCountChange(newCount);
    }
  }, [onMinGameCountChange, canvasState.setIsInitializing]);

  const handleMinGameCountSliderRelease = useCallback(() => {
    if (tempMinGameCount !== minGameCount) {
      handleMinGameCountChangeAsync(tempMinGameCount);
    }
  }, [tempMinGameCount, minGameCount, handleMinGameCountChangeAsync]);

  const handleApplyWinRateFilterAsync = useCallback(async () => {
    if (onApplyWinRateFilter) {
      canvasState.setIsInitializing(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      onApplyWinRateFilter();
    }
  }, [onApplyWinRateFilter, canvasState.setIsInitializing]);

  const handleToggleOpeningClusters = useCallback(() => {
    if (onToggleOpeningClusters) {
      onToggleOpeningClusters();
    }
  }, [onToggleOpeningClusters]);

  const handleTogglePositionClusters = useCallback(() => {
    if (onTogglePositionClusters) {
      onTogglePositionClusters();
    }
  }, [onTogglePositionClusters]);

  const handleToggleAutoZoomOnClick = useCallback(() => {
    if (onAutoZoomOnClickChange) {
      onAutoZoomOnClickChange(!autoZoomOnClick);
    }
  }, [autoZoomOnClick, onAutoZoomOnClickChange]);

  // Context menu action handler
  const handleContextMenuAction = useCallback((action, node) => {
    if (action.onClick) {
      action.onClick(node);
    }
    canvasState.setContextMenu(null);
  }, [canvasState.setContextMenu]);

  // Expose functions to parent
  useEffect(() => {
    if (onFitView) {
      onFitView(fitView);
    }
  }, [onFitView, fitView]);

  useEffect(() => {
    if (onZoomToClusters) {
      onZoomToClusters(zoomToClusters);
    }
  }, [onZoomToClusters, zoomToClusters]);
  
  useEffect(() => {
    if (onZoomTo) {
      onZoomTo(zoomTo);
    }
  }, [onZoomTo, zoomTo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupTransform();
      cleanupRendering();
    };
  }, [cleanupTransform, cleanupRendering]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full min-h-64 max-h-full relative overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ 
          cursor: canvasState.isCanvasCursorBlocked() ? 'not-allowed' : (canvasState.mousePressed ? 'grabbing' : canvasState.cursorStyle),
          opacity: (canvasState.isInitializing || canvasState.positionedNodes.length === 0 || (!canvasState.isInitialPositioningComplete && canvasState.positionedNodes.length > 0) || dimensions.width === 0 || dimensions.height === 0 || !canvasState.transform || !canvasState.hasValidTransform) ? 0 : 1,
          transition: 'opacity 200ms ease-in-out'
        }}
      />
      
      {/* Context Menu */}
      <ContextMenu
        contextMenu={canvasState.contextMenu}
        contextMenuActions={contextMenuActions}
        dimensions={dimensions}
        onActionClick={handleContextMenuAction}
        onClose={() => canvasState.setContextMenu(null)}
      />

      {/* Canvas Controls */}
      <CanvasControls
        mode={mode}
        isInitializing={canvasState.isInitializing}
        positionedNodes={canvasState.positionedNodes}
        hasValidTransform={canvasState.hasValidTransform}
        transform={canvasState.transform}
        enableOpeningClusters={enableOpeningClusters}
        showOpeningClusters={showOpeningClusters}
        showPositionClusters={showPositionClusters}
        onToggleOpeningClusters={handleToggleOpeningClusters}
        onTogglePositionClusters={handleTogglePositionClusters}
        autoZoomOnClick={autoZoomOnClick}
        onToggleAutoZoomOnClick={handleToggleAutoZoomOnClick}
        onZoomToAll={() => zoomTo('all', { isAutoFit: false })}
        showPerformanceControls={showPerformanceControls}
        onShowPerformanceControls={onShowPerformanceControls}
        maxDepth={maxDepth}
        minGameCount={minGameCount}
        tempMinGameCount={tempMinGameCount}
        winRateFilter={winRateFilter}
        tempWinRateFilter={tempWinRateFilter}
        onMaxDepthChange={handleMaxDepthChangeAsync}
        onMinGameCountChange={handleMinGameCountChangeAsync}
        onTempMinGameCountChange={onTempMinGameCountChange}
        onTempWinRateFilterChange={onTempWinRateFilterChange}
        onApplyWinRateFilter={handleApplyWinRateFilterAsync}
        onMinGameCountSliderRelease={handleMinGameCountSliderRelease}
        isGenerating={isGenerating}
        isCanvasInteractionBlocked={canvasState.isCanvasInteractionBlocked}
        contextMenuActions={contextMenuActions}
      />

      {/* Opening Cluster Name Tooltip */}
      {hoveredOpeningName && hoveredClusterColor && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 pointer-events-none z-30">
          <div 
            className="px-4 py-2 rounded-lg shadow-lg border backdrop-blur-sm max-w-md text-center"
            style={{
              backgroundColor: `${hoveredClusterColor.bg}20`,
              borderColor: hoveredClusterColor.border,
              color: hoveredClusterColor.text
            }}
          >
            <div className="font-medium text-sm">
              {hoveredOpeningName}
            </div>
          </div>
        </div>
      )}

      {/* Initialization Loading Overlay */}
      {(canvasState.isInitializing || canvasState.positionedNodes.length === 0 || (!canvasState.isInitialPositioningComplete && canvasState.positionedNodes.length > 0) || dimensions.width === 0 || dimensions.height === 0 || !canvasState.transform || !canvasState.hasValidTransform) && !isGenerating && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4 mx-auto"></div>
            <div className="text-slate-200 text-base font-medium">
              Positioning Graph
            </div>
            <div className="text-slate-400 text-sm">
              Setting up optimal view...
            </div>
          </div>
        </div>
      )}

      {/* Autofit Loading Overlay */}
      {isAutoFitPending && !canvasState.isInitializing && canvasState.positionedNodes.length > 0 && (
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-15 transition-opacity duration-200">
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-6 py-4 shadow-xl border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600"></div>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-400 absolute inset-0"></div>
              </div>
              <div className="text-slate-200 text-sm font-medium">
                Adjusting view...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasGraph; 