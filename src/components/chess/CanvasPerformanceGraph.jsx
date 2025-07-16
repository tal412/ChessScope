import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Target, 
  Info, 
  Layers,
  EyeOff,
  Crown,
  Shield,
  MessageSquare,
  Link as LinkIcon,
  BookOpen,
  Trash2,
  Edit3,
  Copy,
  MoreHorizontal,
  Search,
  Settings,
  ZoomIn
} from 'lucide-react';

// Performance color constants
const PERFORMANCE_COLORS = {
  excellent: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  good: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  solid: { bg: '#f59e0b', border: '#d97706', text: '#000000' },
  challenging: { bg: '#f97316', border: '#ea580c', text: '#ffffff' },
  difficult: { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' },
  missing: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' }, // Gray for missing moves
};

// Opening tree node colors
const OPENING_NODE_COLORS = {
  // New color scheme based on move color
  whiteMove: { bg: '#ffffff', border: '#d1d5db', text: '#000000' }, // White background for white moves
  blackMove: { bg: '#1f2937', border: '#374151', text: '#ffffff' }, // Black background for black moves
  selected: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' }, // Blue for selected
  withComment: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' }, // Cyan for annotated
  withLinks: { bg: '#10b981', border: '#059669', text: '#ffffff' }, // Green for links
  missing: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' }, // Gray for missing moves
  startNode: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' }, // Gray for start node
};

const getPerformanceData = (winRate, gameCount, isMissing = false) => {
  if (isMissing || winRate === null || winRate === undefined) return PERFORMANCE_COLORS.missing;
  // Special case: if gameCount is 0 or null, use orange color instead of red
  if ((gameCount === 0 || gameCount === null) && winRate !== null && winRate !== undefined) {
    return PERFORMANCE_COLORS.solid; // Orange color for no games
  }
  if (winRate >= 70) return PERFORMANCE_COLORS.excellent;
  if (winRate >= 60) return PERFORMANCE_COLORS.good;
  if (winRate >= 50) return PERFORMANCE_COLORS.solid;
  if (winRate >= 40) return PERFORMANCE_COLORS.challenging;
  return PERFORMANCE_COLORS.difficult;
};

const getOpeningNodeColor = (node, isSelected) => {
  if (node.data.isMissing) return OPENING_NODE_COLORS.missing;
  // Remove selected node color change - we'll handle selection with glow only
  // if (isSelected) return OPENING_NODE_COLORS.selected;
  
  // For root node, use gray start node styling
  if (node.data.isRoot) {
    return OPENING_NODE_COLORS.startNode;
  }
  
  // Get move sequence to determine if this is a white or black move
  const moveSequence = node.data.moveSequence || [];
  const isWhiteMove = moveSequence.length % 2 === 1; // Odd move number = white move
  
  return isWhiteMove ? OPENING_NODE_COLORS.whiteMove : OPENING_NODE_COLORS.blackMove;
};

// Function to create convex hull for organic cluster shapes
const createConvexHull = (points) => {
  if (points.length < 3) return points;
  
  // Graham scan algorithm for convex hull
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  
  // Find the bottom-most point (and left-most in case of tie)
  let bottom = points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < bottom.y || (points[i].y === bottom.y && points[i].x < bottom.x)) {
      bottom = points[i];
    }
  }
  
  // Sort points by polar angle with respect to bottom point
  const sorted = points.filter(p => p !== bottom).sort((a, b) => {
    const angleA = Math.atan2(a.y - bottom.y, a.x - bottom.x);
    const angleB = Math.atan2(b.y - bottom.y, b.x - bottom.x);
    return angleA - angleB;
  });
  
  const hull = [bottom];
  
  for (const point of sorted) {
    while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
};

// Function to create smooth path through hull points
const createSmoothPath = (ctx, hull, padding = 50) => {
  if (hull.length < 3) {
    // Fallback to rounded rectangle for small clusters
    // For single nodes, use extra generous padding (150% more)
    const singleNodePadding = hull.length === 1 ? padding * 1.5 : padding;
    const minX = Math.min(...hull.map(p => p.x)) - singleNodePadding;
    const maxX = Math.max(...hull.map(p => p.x)) + singleNodePadding;
    const minY = Math.min(...hull.map(p => p.y)) - singleNodePadding;
    const maxY = Math.max(...hull.map(p => p.y)) + singleNodePadding;
    
    ctx.beginPath();
    ctx.roundRect(minX, minY, maxX - minX, maxY - minY, 20);
    return;
  }
  
  // Add CONSERVATIVE padding to hull points for accurate positioning
  const centroid = {
    x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
    y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length
  };
  
  const paddedHull = hull.map(point => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: point.x + padding * 0.3, y: point.y + padding * 0.3 };
    
    // Much more conservative padding - just 30% of the specified padding
    const factor = (dist + padding * 0.3) / dist;
    return {
      x: centroid.x + dx * factor,
      y: centroid.y + dy * factor
    };
  });
  
  // MATCH ReactFlow EXACTLY: Use quadratic curves (Q commands equivalent)
  ctx.beginPath();
  ctx.moveTo(paddedHull[0].x, paddedHull[0].y);
  
  // Replicate ReactFlow's exact path creation logic
  for (let i = 1; i < paddedHull.length; i++) {
    const curr = paddedHull[i];
    const next = paddedHull[(i + 1) % paddedHull.length];
    const prev = paddedHull[i - 1];
    
    // EXACT ReactFlow control point calculation
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    const cp1x = curr.x - dx1 * 0.2;
    const cp1y = curr.y - dy1 * 0.2;
    
    // Use quadratic curves (matches ReactFlow Q commands)
    ctx.quadraticCurveTo(cp1x, cp1y, curr.x, curr.y);
  }
  
  // Close path smoothly like ReactFlow
  const first = paddedHull[0];
  const last = paddedHull[paddedHull.length - 1];
  const cp2x = first.x - (first.x - last.x) * 0.2;
  const cp2y = first.y - (first.y - last.y) * 0.2;
  ctx.quadraticCurveTo(cp2x, cp2y, first.x, first.y);
  
  ctx.closePath();
};

// Convert hex color to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Opening cluster colors - EXACT match with ReactFlow
const OPENING_CLUSTER_COLORS = [{ bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }];

/**
 * Canvas-based performance graph component with context menu support
 * 
 * @param {Object} props - Component props
 * @param {Array} props.contextMenuActions - Array of context menu action objects
 *   Each action object should have:
 *   - label: string - Display text for the action
 *   - icon: React component - Icon to display (optional)
 *   - onClick: function(node) - Callback when action is clicked
 *   - disabled: function(node) - Function to determine if action is disabled (optional)
 * @param {Function} props.onNodeRightClick - Optional callback for right-click events
 * 
 * @example
 * // Basic usage with context menu
 * const contextActions = [
 *   {
 *     label: 'Delete',
 *     icon: Trash2,
 *     onClick: (node) => handleDelete(node),
 *     disabled: (node) => node.data.isRoot
 *   },
 *   {
 *     label: 'Edit',
 *     icon: Edit,
 *     onClick: (node) => handleEdit(node)
 *   }
 * ];
 * 
 * <CanvasPerformanceGraph
 *   contextMenuActions={contextActions}
 *   onNodeRightClick={(e, node) => console.log('Right-clicked:', node)}
 *   // ... other props
 * />
 */
const CanvasPerformanceGraph = ({ 
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
  onFitView, // Callback to expose fitView function
  onZoomToClusters, // Callback to expose zoomToClusters function
  onZoomTo, // Callback to expose generic zoomTo function
  onToggleOpeningClusters, // Callback for opening cluster toggle
  onTogglePositionClusters, // Callback for position cluster toggle
  onClusterHover, // Callback for cluster hover
  onClusterHoverEnd, // Callback for cluster hover end
  hoveredOpeningName = null, // Current hovered opening name
  hoveredClusterColor = null, // Current hovered cluster color
  onResizeStateChange, // Callback to notify parent of resize state
  onInitializingStateChange, // Callback to notify parent of initialization state
  // Control props to match ReactFlow version
  maxDepth = 20,
  minGameCount = 1,
  tempMinGameCount = 1, // NEW: Temporary value for slider
  winRateFilter = [0, 100],
  tempWinRateFilter = [0, 100],
  onMaxDepthChange,
  onMinGameCountChange,
  onTempMinGameCountChange, // NEW: For slider changes
  onWinRateFilterChange,
  onTempWinRateFilterChange,
  onApplyWinRateFilter,
  selectedPlayer = 'white',
  onPlayerChange,
  isGenerating = false,
  // UI state props to match ReactFlow version
  showPerformanceControls = false,
  onShowPerformanceControls,
  isClusteringLoading = false,
  className = "",
  mode = 'performance', // Added mode prop
  enableOpeningClusters = true, // Added prop to control opening cluster visibility
  
  // Context menu props
  contextMenuActions = null, // Array of action objects: { label, icon, onClick: (node) => void, disabled?: (node) => boolean }
  onNodeRightClick = null, // Optional callback for right-click events
  
  // Auto zoom on click props
  autoZoomOnClick = false, // Whether auto zoom on click is enabled
  onAutoZoomOnClickChange = null, // Callback to change auto zoom on click state
  
  // Auto-fit completion callback
  onAutoFitComplete = null, // Callback when auto-fit completes
  
  // Auto-fit pending state
  isAutoFitPending = false, // Whether auto-fit is scheduled/pending
}) => {
  const canvasRef = useRef();
  const containerRef = useRef();
  const animationRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 }); // Start with 0 to prevent rendering with wrong dimensions
  const [transform, setTransform] = useState(null); // Start with null to prevent initial render
  const [hasValidTransform, setHasValidTransform] = useState(false); // Track if we have a valid calculated transform
  const [mousePressed, setMousePressed] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  // Track whether the current mouse interaction involved dragging
  const isDraggingRef = useRef(false);
  const [positionedNodes, setPositionedNodes] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null); // Track hovered cluster
  // Note: Opening name tooltip state is managed by parent component through callbacks
  const [hasAutoFitted, setHasAutoFitted] = useState(false); // Track if we've done initial auto-fit
  const [isInitializing, setIsInitializing] = useState(true); // Track initial setup
  
  // Add new state to track if initial positioning is complete
  const [isInitialPositioningComplete, setIsInitialPositioningComplete] = useState(false);
  
  // Ref to store the optimal transform before it's applied - prevents zoom flash
  const optimalTransformRef = useRef(null);
  // Refs to store current state for immediate access
  const currentPositionedNodesRef = useRef([]);
  const currentTransformRef2 = useRef(null);
  
  // Track resize transitions to prevent zoom conflicts
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef(null);
  
  // Use ref to store positioned nodes for stable access in effects
  const positionedNodesRef = useRef([]);
  
  // NEW: Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, node }
  const contextMenuRef = useRef(null);
  
  // Update ref when positioned nodes change
  useEffect(() => {
    positionedNodesRef.current = positionedNodes;
  }, [positionedNodes]);
  
  // Measure dimensions immediately on mount using layout effect
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
    
    // Fallback: if dimensions aren't set after a delay, use defaults
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
  }, []); // Only run on mount
  
  // Notify parent of resize state changes
  useEffect(() => {
    if (onResizeStateChange) {
      onResizeStateChange(isResizing);
    }
  }, [isResizing, onResizeStateChange]);
  
  // Notify parent of initialization state changes
  useEffect(() => {
    if (onInitializingStateChange) {
      onInitializingStateChange(isInitializing);
    }
  }, [isInitializing, onInitializingStateChange]);
  
  // Animation state for smooth fit view - like ReactFlow
  const animationStateRef = useRef(null);
  
  // Use ref to track current transform to avoid stale closures
  const currentTransformRef = useRef(transform);
  useEffect(() => {
    currentTransformRef.current = transform;
  }, [transform]);

  // Removed complex loading system - using simple initialization overlay only

  // Simple control change handlers - use initialization-style overlay
  const handleMaxDepthChangeAsync = useCallback(async (newDepth) => {
    if (onMaxDepthChange) {
      // Use simple initialization-style loading
      setIsInitializing(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      onMaxDepthChange(newDepth);
    }
  }, [onMaxDepthChange]);

  const handleMinGameCountChangeAsync = useCallback(async (newCount) => {
    if (onMinGameCountChange) {
      // Use simple initialization-style loading
      setIsInitializing(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      onMinGameCountChange(newCount);
    }
  }, [onMinGameCountChange]);

  // NEW: Handle slider release to apply min game count
  const handleMinGameCountSliderRelease = useCallback(() => {
    if (tempMinGameCount !== minGameCount) {
      handleMinGameCountChangeAsync(tempMinGameCount);
    }
  }, [tempMinGameCount, minGameCount, handleMinGameCountChangeAsync]);

  const handleApplyWinRateFilterAsync = useCallback(async () => {
    if (onApplyWinRateFilter) {
      // Use simple initialization-style loading
      setIsInitializing(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      onApplyWinRateFilter();
    }
  }, [onApplyWinRateFilter]);

  const handleToggleOpeningClusters = useCallback(() => {
    if (onToggleOpeningClusters) {
      onToggleOpeningClusters(); // Instant toggle - no loading needed
    }
  }, [onToggleOpeningClusters]);

  const handleTogglePositionClusters = useCallback(() => {
    if (onTogglePositionClusters) {
      onTogglePositionClusters(); // Instant toggle - no loading needed
    }
  }, [onTogglePositionClusters]);

  const handleToggleAutoZoomOnClick = useCallback(() => {
    if (onAutoZoomOnClickChange) {
      onAutoZoomOnClickChange(!autoZoomOnClick);
    }
  }, [autoZoomOnClick, onAutoZoomOnClickChange]);

  // Enhanced resize detection with screen change support - handles window moves between screens
  useEffect(() => {
    let resizeTimeout = null;
    let lastDimensions = { width: 0, height: 0 };
    let lastDPR = window.devicePixelRatio;
    let resizeObserver = null;
    
    // Auto-fit is now handled by the parent component through onResizeStateChange callback
    // Remove the local scheduleAutoFit function that was disabling auto-fit
    
    const updateSize = (reason = 'resize') => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDimensions = { 
          width: Math.floor(rect.width), 
          height: Math.floor(rect.height) 
        };
        const newDPR = window.devicePixelRatio;
        
        // Check if dimensions actually changed significantly (less sensitive to prevent zoom conflicts)
        const widthChanged = Math.abs(newDimensions.width - lastDimensions.width) > 10; // Less sensitive to prevent zoom conflicts
        const heightChanged = Math.abs(newDimensions.height - lastDimensions.height) > 10; // Less sensitive to prevent zoom conflicts
        const dprChanged = Math.abs(newDPR - lastDPR) > 0.01; // DPI change detection
        
        console.log('🔄 UPDATE SIZE:', { 
          reason, 
          newDimensions, 
          lastDimensions, 
          widthChanged, 
          heightChanged, 
          dprChanged 
        });
        
        if (widthChanged || heightChanged || dprChanged) {
          // Mark as resizing
          setIsResizing(true);
          
          // Mark this as a resize-only change (not new graph data)
          if (isInitialPositioningComplete) {
            resizeOnlyRef.current = true;
          }
          
          // Clear existing timeout
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
          }
          
          // Set dimensions
          setDimensions(newDimensions);
          lastDimensions = newDimensions;
          lastDPR = newDPR;
          
          // Mark resize as complete after a delay
          resizeTimeoutRef.current = setTimeout(() => {
            setIsResizing(false);
          }, 300); // 300ms after resize stops
          
          // Auto-fit is handled by the parent component through onResizeStateChange callback
        }
      }
    };

    // Create ResizeObserver for more reliable container size detection
    if (window.ResizeObserver && containerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        if (entries.length > 0) {
          updateSize('ResizeObserver');
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    // Update on mount
    updateSize('mount');
    
    // Multiple event listeners for comprehensive detection
    const handleWindowResize = () => updateSize('window-resize');
    const handleVisibilityChange = () => {
      console.log('🔄 VISIBILITY CHANGE:', { hidden: document.hidden });
      if (!document.hidden) {
        // Page became visible - check if dimensions changed while hidden
        setTimeout(() => {
          console.log('🔄 CHECKING SIZE AFTER VISIBILITY CHANGE');
          updateSize('visibility-change');
        }, 50);
      }
    };
    const handleScreenChange = () => updateSize('screen-change');
    const handleDPRChange = () => updateSize('dpr-change');
    
    // Event listeners
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Monitor DPI changes with a media query
    let dprMediaQuery = null;
    if (window.matchMedia) {
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      if (dprMediaQuery.addEventListener) {
        dprMediaQuery.addEventListener('change', handleDPRChange);
      } else if (dprMediaQuery.addListener) {
        // Fallback for older browsers
        dprMediaQuery.addListener(handleDPRChange);
      }
    }
    
    // Fallback periodic check for screen moves (every 2 seconds when visible)
    const periodicCheck = setInterval(() => {
      if (!document.hidden) {
        updateSize('periodic-check');
      }
    }, 2000);
    
    return () => {
      // Cleanup all event listeners and observers
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (dprMediaQuery) {
        if (dprMediaQuery.removeEventListener) {
          dprMediaQuery.removeEventListener('change', handleDPRChange);
        } else if (dprMediaQuery.removeListener) {
          dprMediaQuery.removeListener(handleDPRChange);
        }
      }
      
      clearInterval(periodicCheck);
      
      // Clean up pending timeout on unmount
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Clean up resize transition timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [hasAutoFitted]); // Removed positionedNodes.length dependency

  // Auto-fit is handled directly in the graph processing effect below

  // Calculate optimal transform for given nodes and dimensions
  const calculateOptimalTransform = useCallback((nodes, canvasDimensions, customPadding = 50) => {
    if (nodes.length === 0 || canvasDimensions.width <= 0 || canvasDimensions.height <= 0) {
      return { x: 0, y: 0, scale: 1 };
    }

    const bounds = nodes.reduce((acc, node) => ({
      minX: Math.min(acc.minX, node.x - node.width/2),
      maxX: Math.max(acc.maxX, node.x + node.width/2),
      minY: Math.min(acc.minY, node.y - node.height/2),
      maxY: Math.max(acc.maxY, node.y + node.height/2)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    if (contentWidth <= 0 || contentHeight <= 0) {
      return { x: 0, y: 0, scale: 1 };
    }

    const padding = customPadding;
    const rawScale = Math.min(
      (canvasDimensions.width - padding * 2) / contentWidth,
      (canvasDimensions.height - padding * 2) / contentHeight
    );
    
    // For auto-fit, allow unlimited zoom-out to ensure content always fits
    // Don't clamp to max 2.0 - let it use whatever scale fits the content
    const scale = Math.max(rawScale, 0.001);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    let optimalTransform = {
      x: canvasDimensions.width / 2 - centerX * scale,
      y: canvasDimensions.height / 2 - centerY * scale,
      scale
    };
    
    // Safety check: ensure ALL nodes are visible on screen
    const topNodeY = bounds.minY * scale + optimalTransform.y;
    const bottomNodeY = bounds.maxY * scale + optimalTransform.y;
    const leftNodeX = bounds.minX * scale + optimalTransform.x;
    const rightNodeX = bounds.maxX * scale + optimalTransform.x;
    
    // Fix Y positioning
    if (topNodeY < padding) {
      optimalTransform.y = padding - bounds.minY * scale;
    } else if (bottomNodeY > canvasDimensions.height - padding) {
      optimalTransform.y = canvasDimensions.height - padding - bounds.maxY * scale;
    }
    
    // Fix X positioning
    if (leftNodeX < padding) {
      optimalTransform.x = padding - bounds.minX * scale;
    } else if (rightNodeX > canvasDimensions.width - padding) {
      optimalTransform.x = canvasDimensions.width - padding - bounds.maxX * scale;
    }

    return optimalTransform;
  }, []); // Empty dependency array - this function is pure and doesn't depend on external state

  // Track whether this is a resize (not a new graph) to prevent auto-fit on resize
  const resizeOnlyRef = useRef(false);

  // Track core graph data (excluding cluster background nodes) to detect real changes
  const coreGraphDataRef = useRef(null);
  
    // Helper function to check if canvas interactions should be blocked
  const isCanvasInteractionBlocked = useCallback(() => {
    // Block interactions when:
    // 1. We're initializing
    // 2. We don't have positioned nodes yet (even if positioning is "complete")
    // 3. We have nodes but positioning isn't complete yet
    // 4. Canvas dimensions aren't ready
    // 5. Transform isn't calculated yet
    // 6. Auto-fit is pending (to lock user interactions during autofit)
    const blocked = isInitializing || 
           positionedNodes.length === 0 ||  // Block when no nodes yet
           (!isInitialPositioningComplete && positionedNodes.length > 0) ||  // Block when nodes exist but positioning incomplete
           dimensions.width === 0 || 
           dimensions.height === 0 || 
           !transform || 
           !hasValidTransform ||
           isAutoFitPending;  // Block user interactions while auto-fit is scheduled/pending
    
    // Debug logging for blocking state (throttled to reduce spam)
    if (blocked) {
      const now = Date.now();
      const lastLogTime = window.lastCanvasBlockedLog || 0;
      if (now - lastLogTime > 1000) { // Only log once per second
        console.log('🚫 CANVAS BLOCKED:', { 
          isInitializing, 
          isInitialPositioningComplete, 
          positionedNodesLength: positionedNodes.length,
          dimensionsWidth: dimensions.width,
          dimensionsHeight: dimensions.height,
          hasTransform: !!transform,
          hasValidTransform,
          isAutoFitPending
        });
        window.lastCanvasBlockedLog = now;
      }
      // Reset unblocked flag when blocked again
      window.canvasUnblockedLogged = false;
    } else {
      // Log when canvas becomes unblocked
      if (window.lastCanvasBlockedLog && !window.canvasUnblockedLogged) {
        console.log('✅ CANVAS UNBLOCKED - INTERACTIONS ALLOWED:', { 
          isInitializing, 
          isInitialPositioningComplete, 
          positionedNodesLength: positionedNodes.length,
          dimensionsWidth: dimensions.width,
          dimensionsHeight: dimensions.height,
          hasTransform: !!transform,
          hasValidTransform,
          isAutoFitPending
        });
        window.canvasUnblockedLogged = true;
      }
    }
    
    return blocked;
  }, [isInitializing, isInitialPositioningComplete, positionedNodes.length, dimensions.width, dimensions.height, transform, hasValidTransform, isAutoFitPending]);

  // Helper function to check if canvas cursor should show "not-allowed" (excludes auto-fit)
  const isCanvasCursorBlocked = useCallback(() => {
    // Block cursor when truly initializing, but not during auto-fit
    const blocked = isInitializing || 
           positionedNodes.length === 0 ||  // Block when no nodes yet
           (!isInitialPositioningComplete && positionedNodes.length > 0) ||  // Block when nodes exist but positioning incomplete
           dimensions.width === 0 || 
           dimensions.height === 0 || 
           !transform || 
           !hasValidTransform;
           // NOTE: isAutoFitPending is intentionally excluded here
    
    return blocked;
  }, [isInitializing, isInitialPositioningComplete, positionedNodes.length, dimensions.width, dimensions.height, transform, hasValidTransform]);
  
  // Process graph data and calculate positions with immediate optimal transform
  useEffect(() => {
    // console.log('📊 GRAPH PROCESSING EFFECT:', { dimensions, graphDataNodes: graphData.nodes?.length || 0 });
    
    // Don't process anything until we have valid dimensions from the DOM
    if (dimensions.width === 0 || dimensions.height === 0) {
      // console.log('⏳ WAITING FOR DIMENSIONS');
      return;
    }
    
    if (!graphData.nodes || graphData.nodes.length === 0) {
      // console.log('📭 NO GRAPH DATA - COMPLETE INITIALIZATION WITH EMPTY STATE');
      // Complete initialization with empty state - don't wait forever for data that might not come
      requestAnimationFrame(() => {
        setPositionedNodes([]);
        setHasAutoFitted(true); // Mark as fitted even with no data
        // Complete initialization for empty state
        setIsInitializing(false);
        setIsInitialPositioningComplete(true);
        setHasValidTransform(true); // Mark as having valid transform (empty state is valid)
        // Set a default transform for empty state
        const defaultTransform = { x: 0, y: 0, scale: 1 };
        setTransform(defaultTransform);
        optimalTransformRef.current = defaultTransform;
        currentTransformRef2.current = defaultTransform;
        currentPositionedNodesRef.current = [];
        coreGraphDataRef.current = JSON.stringify({ nodeCount: 0, edgeCount: 0, nodeIds: [], edgeIds: [] });
      });
      return;
    }
    
    // CRITICAL: Keep initialization true until we've calculated AND applied the transform
    if (!isInitializing && !isInitialPositioningComplete) {
      setIsInitializing(true);
    }

    // Calculate positioned nodes
    const nodes = graphData.nodes.filter(n => n.type !== 'clusterBackground');
    const positioned = nodes.map(node => ({
      ...node,
      x: node.position.x + 90, // Center the node (180/2 = 90)
      y: node.position.y + 90, // Center the node (180/2 = 90)
      width: 180,
      height: 180
    }));

    // Check if this is a real graph change (not just cluster background changes)
    const currentCoreData = JSON.stringify({
      nodeCount: nodes.length,
      edgeCount: graphData.edges?.length || 0,
      nodeIds: nodes.map(n => n.id).sort(),
      edgeIds: graphData.edges?.map(e => e.id).sort() || []
    });
    
    const isRealGraphChange = currentCoreData !== coreGraphDataRef.current;
    
    // Special case: if we previously had empty data and now have nodes, always recalculate
    const wasEmpty = coreGraphDataRef.current === JSON.stringify({ nodeCount: 0, edgeCount: 0, nodeIds: [], edgeIds: [] });
    const hasNodesNow = nodes.length > 0;
    const isEmptyToNodesTransition = wasEmpty && hasNodesNow;
    
    coreGraphDataRef.current = currentCoreData;

    // console.log('🔍 TRANSFORM CALCULATION CHECK:', { shouldCalculateTransform: dimensions.width > 0 && dimensions.height > 0 && (!isInitialPositioningComplete || (isRealGraphChange && !resizeOnlyRef.current)) });

    // Only calculate and apply optimal transform if:
    // 1. We have valid dimensions
    // 2. We haven't completed initial positioning yet OR this is a real graph change OR transitioning from empty to nodes
    // 3. This is NOT just a resize (no new graph data) - unless it's initial positioning
    const shouldCalculateTransform = dimensions.width > 0 && dimensions.height > 0 && 
      (!isInitialPositioningComplete || (isRealGraphChange && !resizeOnlyRef.current) || isEmptyToNodesTransition);
    
    if (shouldCalculateTransform) {
      const optimalTransform = calculateOptimalTransform(positioned, dimensions);
      
      // Store EVERYTHING in refs first for immediate access
      optimalTransformRef.current = optimalTransform;
      currentTransformRef2.current = optimalTransform;
      currentPositionedNodesRef.current = positioned;
      
      // Set both nodes and transform atomically
      setTransform(optimalTransform);
      setPositionedNodes(positioned);
      setHasAutoFitted(true);
      setHasValidTransform(true); // Mark that we now have a valid transform
      setIsInitializing(false);
      setIsInitialPositioningComplete(true);
      
      // Call completion callback after initial positioning is complete
      // Use setTimeout to ensure state updates are processed first
      setTimeout(() => {
        if (onAutoFitComplete) {
          onAutoFitComplete();
        }
      }, 0);
    } else {
      // console.log('⚠️ SKIPPING TRANSFORM CALCULATION - UPDATING NODES ONLY');
      // Just update positioned nodes without changing transform (for resize or cluster updates)
      currentPositionedNodesRef.current = positioned;
      setPositionedNodes(positioned);
    }
    
    // Reset resize flag after processing
    resizeOnlyRef.current = false;
    
  }, [graphData, dimensions, isGenerating, isInitialPositioningComplete]);

  // Fallback timeout to prevent initialization from getting stuck
  useEffect(() => {
    if (isInitializing) {
      const fallbackTimeout = setTimeout(() => {
        console.warn('Canvas initialization timeout - forcing completion');
        setIsInitializing(false);
        setIsInitialPositioningComplete(true);
        setHasValidTransform(true);
        // Set basic transform if none exists
        if (!transform) {
          const defaultTransform = { x: 0, y: 0, scale: 1 };
          setTransform(defaultTransform);
        }
      }, 3000); // Increased to 3 seconds to allow for slower initialization

      return () => clearTimeout(fallbackTimeout);
    }
  }, [isInitializing, transform]);

  // Hide initialization overlay when parent is generating to prevent conflicts
  useEffect(() => {
    if (isGenerating && isInitializing) {
      setIsInitializing(false);
    }
  }, [isGenerating, isInitializing]);

  // Reset initialization state when parent stops generating and we need to show positioning
  useEffect(() => {
    const currentPositionedNodes = positionedNodesRef.current;
    if (!isGenerating && !isInitialPositioningComplete && currentPositionedNodes.length > 0 && dimensions.width > 0 && dimensions.height > 0) {
      // Only show initialization if we actually need to do positioning work
      const needsPositioning = !hasAutoFitted || currentPositionedNodes.some(node => !node.position || isNaN(node.position.x) || isNaN(node.position.y));
      if (needsPositioning) {
        setIsInitializing(true);
      }
    }
  }, [isGenerating, isInitialPositioningComplete, dimensions, hasAutoFitted]); // Removed positionedNodes dependency

  // Calculate cluster paths when clusters change - use useMemo to prevent infinite loops
  const clusterPathsData = useMemo(() => {
    const currentPositionedNodes = positionedNodesRef.current;
    if (!enableOpeningClusters || !showOpeningClusters || !openingClusters.length || currentPositionedNodes.length === 0) {
      return [];
    }

    const newClusterPaths = [];
    
    openingClusters.forEach((cluster) => {
      if (!cluster.nodes || cluster.nodes.length === 0) return;

      const clusterNodes = cluster.nodes.map(n => 
        currentPositionedNodes.find(pn => pn.id === n.id)
      ).filter(Boolean);

      if (clusterNodes.length === 0) return;

      // Create node center points for convex hull
      const nodePoints = clusterNodes.map(node => ({
        x: node.x,
        y: node.y
      }));

      let hitTestPath = [];

      if (nodePoints.length === 1) {
        // Single node cluster - create a square around the node for hit testing
        const node = nodePoints[0];
        const basePadding = 100; // Base padding for single nodes
        const extraPadding = basePadding * 1.5; // Match the visual padding (150% more)
        hitTestPath = [
          { x: node.x - extraPadding, y: node.y - extraPadding },
          { x: node.x + extraPadding, y: node.y - extraPadding },
          { x: node.x + extraPadding, y: node.y + extraPadding },
          { x: node.x - extraPadding, y: node.y + extraPadding }
        ];
      } else if (nodePoints.length === 2) {
        // Two node cluster - create a rectangle encompassing both nodes
        const [node1, node2] = nodePoints;
        const padding = 80;
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
        // Three or more nodes - use convex hull with proper padding
        const hull = createConvexHull(nodePoints);
        
        // Calculate centroid for proper padding
        const centroid = {
          x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
          y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length
        };
        
        // Apply padding by expanding each point away from centroid
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
  }, [enableOpeningClusters, showOpeningClusters, openingClusters]); // Removed positionedNodes dependency

  // Use refs for frequently changing values to avoid render function recreation
  const currentNodeIdRef = useRef(currentNodeId);
  const hoveredNextMoveNodeIdRef = useRef(hoveredNextMoveNodeId);
  const hoveredNodeRef = useRef(hoveredNode);
  const hoveredClusterRef = useRef(hoveredCluster);
  const showOpeningClustersRef = useRef(showOpeningClusters);
  const showPositionClustersRef = useRef(showPositionClusters);
  
  // Separate cursor state for proper cursor display
  const [cursorStyle, setCursorStyle] = useState('grab');
  
  // Update refs when values change
  useEffect(() => {
    currentNodeIdRef.current = currentNodeId;
  }, [currentNodeId]);
  
  useEffect(() => {
    hoveredNextMoveNodeIdRef.current = hoveredNextMoveNodeId;
  }, [hoveredNextMoveNodeId]);
  
  useEffect(() => {
    hoveredNodeRef.current = hoveredNode;
    // Update cursor when hover state changes
    const isCursorBlocked = isCanvasCursorBlocked();
    setCursorStyle(isCursorBlocked ? 'not-allowed' : (hoveredNode || hoveredCluster ? 'pointer' : 'grab'));
  }, [hoveredNode, hoveredCluster, isCanvasCursorBlocked]);
  
  useEffect(() => {
    hoveredClusterRef.current = hoveredCluster;
    // Update cursor when hover state changes
    const isCursorBlocked = isCanvasCursorBlocked();
    setCursorStyle(isCursorBlocked ? 'not-allowed' : (hoveredNode || hoveredCluster ? 'pointer' : 'grab'));
  }, [hoveredCluster, hoveredNode, isCanvasCursorBlocked]);
  
  useEffect(() => {
    showOpeningClustersRef.current = showOpeningClusters;
  }, [showOpeningClusters]);
  
  useEffect(() => {
    showPositionClustersRef.current = showPositionClusters;
  }, [showPositionClusters]);
  
  // Update cursor style when initialization state changes
  useEffect(() => {
    const isCursorBlocked = isCanvasCursorBlocked();
    setCursorStyle(isCursorBlocked ? 'not-allowed' : (hoveredNode || hoveredCluster ? 'pointer' : 'grab'));
  }, [isCanvasCursorBlocked, hoveredNode, hoveredCluster]);

  // Canvas rendering function - HIGH DPI SUPPORT - Optimized dependencies
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = dimensions;
    
    // Don't render if we don't have valid dimensions yet
    if (width <= 0 || height <= 0) {
      return;
    }
    
    // CRITICAL: Don't render until we have a valid transform from initial calculation
    if (!hasValidTransform) {
      return;
    }
    
    // Use refs ONLY during initial positioning to prevent flash, then use state for interactions
    const activeTransform = (!isInitialPositioningComplete && optimalTransformRef.current) 
      ? optimalTransformRef.current 
      : transform;
    const activeNodes = (!isInitialPositioningComplete && currentPositionedNodesRef.current.length > 0) 
      ? currentPositionedNodesRef.current 
      : positionedNodes;
    
    // Don't render anything if we don't have a proper transform yet
    if (!activeTransform) {
      return;
    }
    
    const { x: offsetX, y: offsetY, scale } = activeTransform;

    // Validate dimensions
    if (width <= 0 || height <= 0) return;

    // HIGH DPI SUPPORT - Properly handle device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;

    // Canvas sizing with proper DPI scaling
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
      // Scale the context to match device pixel ratio
      ctx.scale(dpr, dpr);
    }
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Apply transform
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

               // Render position clusters - MATCH ReactFlow brightness levels
      if (showPositionClustersRef.current && positionClusters.length > 0) {
        positionClusters.forEach((cluster, index) => {
          if (!cluster.allNodes || cluster.allNodes.length === 0) return;

          const clusterNodes = cluster.allNodes.map(n => 
            positionedNodes.find(pn => pn.id === n.id)
          ).filter(Boolean);

          if (clusterNodes.length === 0) return;

          // Create node center points for convex hull
          const nodePoints = clusterNodes.map(node => ({
            x: node.x,
            y: node.y
          }));

          // EXACT ReactFlow position cluster colors
          const positionColors = [
            { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Bright Orange
            { bg: '#f59e0b', border: '#d97706', text: '#000000' }, // Amber  
            { bg: '#eab308', border: '#ca8a04', text: '#000000' }, // Yellow
          ];
          const clusterColor = positionColors[index % positionColors.length];
          
          // Create convex hull and render organic shape
          const hull = createConvexHull(nodePoints);
          
          // MAKE CANVAS VIBRANT: Use much higher opacity for position clusters too
          const rgb = hexToRgb(clusterColor.bg);
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`; // Much higher opacity for vibrant appearance
          ctx.strokeStyle = clusterColor.border;
          ctx.lineWidth = 3;
          ctx.setLineDash([]); // Ensure solid stroke
          // SHARP borders like ReactFlow
          ctx.lineCap = 'butt';
          ctx.lineJoin = 'miter';
          ctx.miterLimit = 10;
          
          createSmoothPath(ctx, hull, 80);
          ctx.fill();
          ctx.stroke();
        });
      }

                   // Render opening clusters - MATCH ReactFlow brightness levels
     if (enableOpeningClusters && showOpeningClustersRef.current && openingClusters.length > 0) {
       openingClusters.forEach((cluster, index) => {
         if (!cluster.nodes || cluster.nodes.length === 0) return;

         const clusterNodes = cluster.nodes.map(n => 
           positionedNodes.find(pn => pn.id === n.id)
         ).filter(Boolean);

         if (clusterNodes.length === 0) return;

         // Create node center points for convex hull
         const nodePoints = clusterNodes.map(node => ({
           x: node.x,
           y: node.y
         }));

         // Create convex hull and render organic shape
         const hull = createConvexHull(nodePoints);
         
         const isHovered = hoveredClusterRef.current && hoveredClusterRef.current.id === cluster.id;
         
         // EXACT ReactFlow opening cluster colors
         const OPENING_CLUSTER_COLORS = [{ bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }];
         const clusterColor = OPENING_CLUSTER_COLORS[cluster.colorIndex % OPENING_CLUSTER_COLORS.length];
         
         // MAKE CANVAS VIBRANT: Use much higher opacity for better visual match
         const rgb = hexToRgb(clusterColor.bg);
         const fillOpacity = isHovered ? 0.7 : 0.45; // Much higher opacity for vibrant appearance
         ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillOpacity})`;
         ctx.strokeStyle = clusterColor.border;
         ctx.lineWidth = isHovered ? 4 : 3;
         ctx.setLineDash([]); // Ensure solid stroke
         // SHARP borders like ReactFlow
         ctx.lineCap = 'butt';
         ctx.lineJoin = 'miter';
         ctx.miterLimit = 10;
         
         createSmoothPath(ctx, hull, 100);
         ctx.fill();
         ctx.stroke();
       });
     }

    // Render edges
    if (graphData.edges) {
      graphData.edges.forEach(edge => {
        const source = positionedNodes.find(n => n.id === edge.source);
        const target = positionedNodes.find(n => n.id === edge.target);
        
        if (!source || !target) return;

        if (mode === 'opening') {
          // Opening mode edge rendering - simpler style
          const isMainLine = source.data.isMainLine && target.data.isMainLine;
          
          ctx.strokeStyle = isMainLine ? '#8b5cf6' : '#64748b'; // Purple for main line, gray for variations
          ctx.lineWidth = isMainLine ? 3 : 2;
          ctx.lineCap = 'round';
          ctx.globalAlpha = isMainLine ? 1 : 0.7;
          ctx.setLineDash(isMainLine ? [] : [5, 5]); // Dashed for variations
          
          ctx.beginPath();
          ctx.moveTo(source.x, source.y + source.height/2);
          ctx.lineTo(target.x, target.y - target.height/2);
          ctx.stroke();
          
          ctx.setLineDash([]); // Reset
          ctx.globalAlpha = 1;
        } else {
          // Performance mode edge rendering (existing)
          const perfData = getPerformanceData(edge.data?.winRate || 0, edge.data?.gameCount || 0, edge.data?.isMissing);
          const thickness = Math.max(4, Math.min(12, 4 + ((edge.data?.gameCount || 0) / 25)));

          ctx.strokeStyle = perfData.border;
          ctx.lineWidth = thickness;
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.8;
          
          ctx.beginPath();
          ctx.moveTo(source.x, source.y + source.height/2);
          ctx.lineTo(target.x, target.y - target.height/2);
          ctx.stroke();
          
          ctx.globalAlpha = 1;
        }
      });
    }

    // Render nodes using active nodes (from refs or state)
    if (activeNodes.length > 0) {
      // Debug render check - check if any nodes are visible
      const visibleNodes = activeNodes.filter(node => {
        const screenX = (node.x * activeTransform.scale) + activeTransform.x;
        const screenY = (node.y * activeTransform.scale) + activeTransform.y;
        const nodeSize = 140 * activeTransform.scale;
        
        return screenX >= -nodeSize && screenX <= width + nodeSize &&
               screenY >= -nodeSize && screenY <= height + nodeSize;
      });
      
      // Reduced debug logging - just once per second


      let renderedNodeCount = 0;
      activeNodes.forEach(node => {
      // Mode-specific rendering
      if (mode === 'opening') {
        // Opening tree mode rendering
        const isCurrentNode = node.id === currentNodeIdRef.current;
        const isHoveredNextMove = node.id === hoveredNextMoveNodeIdRef.current;
        const isHovered = hoveredNodeRef.current?.id === node.id;
        const nodeColor = getOpeningNodeColor(node, isCurrentNode);
        
        const x = node.x - node.width/2;
        const y = node.y - node.height/2;
        
        // Check if node is potentially visible before expensive rendering
        const screenX = (node.x * activeTransform.scale) + activeTransform.x;
        const screenY = (node.y * activeTransform.scale) + activeTransform.y;
        const nodeSize = 140 * activeTransform.scale;
        
        // Skip rendering nodes that are completely off-screen for performance
        if (screenX < -nodeSize*2 || screenX > width + nodeSize*2 ||
            screenY < -nodeSize*2 || screenY > height + nodeSize*2) {
          return; // Skip this node
        }
        
        renderedNodeCount++;

        // Node background with proper styling
        ctx.fillStyle = nodeColor.bg;
        ctx.strokeStyle = nodeColor.border;
        ctx.lineWidth = isCurrentNode || isHoveredNextMove ? 8 : (isHovered ? 6 : 4);
        
        if (isCurrentNode) {
          if (node.data.isInitialMove) {
            // ORANGE GLOW for selected initial position nodes
            ctx.shadowColor = 'rgba(249, 115, 22, 1.0)'; // Orange glow
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw 8 layers for very intense orange glow
            for (let i = 0; i < 8; i++) {
              ctx.beginPath();
              ctx.roundRect(x, y, node.width, node.height, 12);
              ctx.fill();
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow
          } else {
            // PINK GLOW for regular selected nodes
            ctx.shadowColor = 'rgba(236, 72, 153, 1.0)'; // Pink glow
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw 8 layers for very intense glow
            for (let i = 0; i < 8; i++) {
              ctx.beginPath();
              ctx.roundRect(x, y, node.width, node.height, 12);
              ctx.fill();
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow
          }
        } else if (isHoveredNextMove) {
          // INTENSE GLOW for hovered next moves only
          ctx.shadowColor = 'rgba(59, 130, 246, 1.0)'; // Blue glow
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw 8 layers for very intense glow
          for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.roundRect(x, y, node.width, node.height, 12);
            ctx.fill();
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset shadow
        } else if (node.data.isInitialMove) {
          // ORANGE STROKE for unselected initial position nodes
          ctx.beginPath();
          ctx.roundRect(x, y, node.width, node.height, 12);
          ctx.fill();
          
          // Add beautiful orange stroke
          ctx.strokeStyle = '#f97316'; // Orange-500
          ctx.lineWidth = 6;
          ctx.stroke();
          
          // Reset stroke style for other elements
          ctx.strokeStyle = nodeColor.border;
          ctx.lineWidth = 4;
        } else {
          // Normal node - no glow
          ctx.beginPath();
          ctx.roundRect(x, y, node.width, node.height, 12);
          ctx.fill();
          ctx.stroke();
        }
        
        // Text rendering for opening mode
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textColor = nodeColor.text;
        
        // Add text stroke for better readability
        const isBlackText = textColor === '#000000' || textColor === '#000';
        ctx.strokeStyle = isBlackText ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = isBlackText ? 2 : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const centerX = node.x;
        const centerY = node.y;
        
        if (node.data.isRoot) {
          // Root node for opening tree
          ctx.font = `bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = textColor;
          ctx.strokeText('START', centerX, centerY);
          ctx.fillText('START', centerX, centerY);
        } else {
          // Move node
          ctx.font = `bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = textColor;
          ctx.strokeText(node.data.label || node.data.san || '?', centerX, centerY);
          ctx.fillText(node.data.label || node.data.san || '?', centerX, centerY);
          
          // Show arrow color circles at top of node
          const arrows = node.data.arrows || [];
          if (arrows.length > 0) {
            // Get unique arrow colors
            const uniqueColors = [...new Set(arrows.map(arrow => arrow.color))];
            
            // Calculate circle positioning
            const circleSize = 16;
            const circleSpacing = 22;
            const totalWidth = (uniqueColors.length - 1) * circleSpacing;
            let circleX = centerX - totalWidth / 2;
            const circleY = centerY - 65; // Above the node
            
            uniqueColors.forEach((color, index) => {
              // Draw circle
              ctx.save();
              ctx.fillStyle = color;
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(circleX, circleY, circleSize / 2, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
              
              circleX += circleSpacing;
            });
          }
          
          // Show annotation indicators at bottom of node using reversed colors
          const hasComment = node.data.hasComment;
          const hasLinks = node.data.hasLinks && node.data.linkCount > 0;
          
          // Show annotation indicators at bottom of node using reversed colors
          if (hasComment || hasLinks) {
            // Save the current context state
            ctx.save();
            
            // Calculate icon positioning
            const iconSize = 20;
            const iconSpacing = 32;
            const totalWidth = (hasComment && hasLinks) ? iconSpacing : 0;
            let iconX = centerX - totalWidth / 2;
            const iconY = centerY + 65;
            
            // Use reversed colors for icons (opposite of node background color)
            // White nodes get black icons, black nodes get white icons
            const nodeBackgroundColor = nodeColor.bg;
            const iconColor = nodeBackgroundColor === '#ffffff' ? '#000000' : '#ffffff';
            
            // Reset any previous shadows or effects
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.globalAlpha = 1;
            
            // Helper function to draw SVG icon paths on canvas
            const drawIcon = (iconPath, x, y, size, color) => {
              ctx.save();
              ctx.translate(x - size/2, y - size/2);
              ctx.scale(size/24, size/24); // Scale from 24x24 to desired size
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.lineWidth = 1.5;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              
              // Parse and draw the path
              const path = new Path2D(iconPath);
              ctx.fill(path);
              ctx.stroke(path);
              
              ctx.restore();
            };
            
            if (hasComment) {
              // MessageSquare icon path (from Lucide)
              const messageSquarePath = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
              drawIcon(messageSquarePath, iconX, iconY, iconSize, iconColor);
              iconX += iconSpacing;
            }
            
            if (hasLinks) {
              // Draw a simple, bold chain link icon for small size
              ctx.save();
              ctx.strokeStyle = iconColor;
              ctx.lineWidth = 2.7;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              // Draw left circle
              ctx.beginPath();
              ctx.arc(iconX - 5, iconY - 2, 5, 0, 2 * Math.PI);
              ctx.stroke();
              // Draw right circle
              ctx.beginPath();
              ctx.arc(iconX + 5, iconY - 2, 5, 0, 2 * Math.PI);
              ctx.stroke();
              // Draw connecting bar
              ctx.beginPath();
              ctx.moveTo(iconX - 2, iconY - 2);
              ctx.lineTo(iconX + 2, iconY - 2);
              ctx.stroke();
              ctx.restore();
            }
            
            // Restore the context state
            ctx.restore();
          }
        }
      } else {
        // Performance mode rendering (existing code)
        const perfData = getPerformanceData(node.data.winRate || 0, node.data.gameCount || 0, node.data.isMissing);
        const isCurrentNode = node.id === currentNodeIdRef.current;
        const isHoveredNextMove = node.id === hoveredNextMoveNodeIdRef.current;
        const isHovered = hoveredNodeRef.current?.id === node.id;
        
        const x = node.x - node.width/2;
        const y = node.y - node.height/2;
        
        // Check if node is potentially visible before expensive rendering
        const screenX = (node.x * activeTransform.scale) + activeTransform.x;
        const screenY = (node.y * activeTransform.scale) + activeTransform.y;
        const nodeSize = 140 * activeTransform.scale;
        
        // Skip rendering nodes that are completely off-screen for performance
        if (screenX < -nodeSize*2 || screenX > width + nodeSize*2 ||
            screenY < -nodeSize*2 || screenY > height + nodeSize*2) {
          return; // Skip this node
        }
        
        renderedNodeCount++;

        // Use proper performance-based colors
        const isDebugNode = false; // Disable debug coloring
        const nodeColor = perfData.bg;
        const nodeBorder = perfData.border;
        
        // Node background with proper styling
        ctx.fillStyle = nodeColor;
        ctx.strokeStyle = nodeBorder;
        ctx.lineWidth = isCurrentNode || isHoveredNextMove ? 8 : (isHovered ? 6 : 4);
        
        if (isCurrentNode) {
          // INTENSE GLOW: Draw multiple layers with shadow for selected node
          ctx.shadowColor = 'rgba(236, 72, 153, 1.0)'; // Pink glow
          ctx.shadowBlur = 25;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw 8 layers for very intense glow
          for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.roundRect(x, y, node.width, node.height, 12);
            ctx.fill();
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset shadow
        } else if (isHoveredNextMove) {
          // INTENSE GLOW for hovered next moves - match selected node intensity
          ctx.shadowColor = 'rgba(59, 130, 246, 1.0)'; // Blue glow
          ctx.shadowBlur = 20; // Match selected node blur
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw 8 layers for very intense glow - match selected node intensity
          for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.roundRect(x, y, node.width, node.height, 12);
            ctx.fill();
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset shadow
        } else {
          // Normal node - no glow
          ctx.beginPath();
          ctx.roundRect(x, y, node.width, node.height, 12);
          ctx.fill();
          ctx.stroke();
        }
        
        // Clean rendering without debug clutter

        // HIGH-QUALITY TEXT RENDERING with proper positioning
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        
        // Text color with better contrast
        const textColor = isDebugNode ? '#ffffff' : perfData.text;
        
        // Add text stroke for better readability - conditional based on text color
        const isBlackText = textColor === '#000000' || textColor === '#000';
        ctx.strokeStyle = isBlackText ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = isBlackText ? 2 : 3; // Thinner stroke for white on black text
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (node.data.isRoot) {
          // ROOT NODE: Centered text layout
          const centerX = node.x;
          const centerY = node.y;
          
          // Main label - EXTRA LARGE (more space in 180px node)
          ctx.font = `bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = textColor;
          ctx.strokeText('START', centerX, centerY - 30);
          ctx.fillText('START', centerX, centerY - 30);
          
          // Game count - MUCH LARGER (better spacing)
          ctx.font = `600 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const gameCountText = node.data.gameCount === null || node.data.gameCount === undefined 
            ? '0 games' 
            : `${node.data.gameCount} games`;
          ctx.strokeText(gameCountText, centerX, centerY + 25);
          ctx.fillText(gameCountText, centerX, centerY + 25);
          
        } else {
          // MOVE NODE: Three-line layout with proper spacing - ALL LARGER
          const centerX = node.x;
          const centerY = node.y;
          
          // Move notation (top line) - EXTRA LARGE (more space in 180px node)
          ctx.font = `bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = textColor;
          ctx.strokeText(node.data.san || '?', centerX, centerY - 35);
          ctx.fillText(node.data.san || '?', centerX, centerY - 35);
          
          if (node.data.isMissing) {
            // Missing node - show "No Data" instead of win rate and game count
            ctx.font = `600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.strokeText('No Data', centerX, centerY + 10);
            ctx.fillText('No Data', centerX, centerY + 10);
          } else {
            // Win rate (middle line) - MUCH LARGER (centered)
            const winRate = Math.round(node.data.winRate || 0);
            ctx.font = `600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.strokeText(`${winRate}%`, centerX, centerY);
            ctx.fillText(`${winRate}%`, centerX, centerY);
            
            // Game count (bottom line) - MUCH LARGER (better spacing)
            ctx.font = `500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            const gameCountShort = node.data.gameCount === null || node.data.gameCount === undefined 
              ? '0g' 
              : `${node.data.gameCount}g`;
            ctx.strokeText(gameCountShort, centerX, centerY + 35);
            ctx.fillText(gameCountShort, centerX, centerY + 35);
          }
        }
      }
      
      // Text rendering complete
    });
    
    // Only track render stats if we have issues (no logging)
    } // End of nodes rendering if statement

    ctx.restore();
  }, [positionedNodes, dimensions, transform, graphData.edges, openingClusters, positionClusters, mode]); // Removed refs from dependencies

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // Hit testing for mouse events
  const getNodeAtPosition = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Use the same active transform as the render function
    const activeTransform = (!isInitialPositioningComplete && optimalTransformRef.current) 
      ? optimalTransformRef.current 
      : transform;

    // Don't process clicks if we don't have a proper transform yet
    if (!activeTransform) {
      return null;
    }

    // Transform to world coordinates
    const worldX = (canvasX - activeTransform.x) / activeTransform.scale;
    const worldY = (canvasY - activeTransform.y) / activeTransform.scale;

    // Use active nodes (refs during initial positioning, state during interactions)
    const activeNodes = (!isInitialPositioningComplete && currentPositionedNodesRef.current.length > 0) 
      ? currentPositionedNodesRef.current 
      : positionedNodes;
    
    return activeNodes.find(node => {
      const nodeLeft = node.x - node.width/2;
      const nodeRight = node.x + node.width/2;
      const nodeTop = node.y - node.height/2;
      const nodeBottom = node.y + node.height/2;

      return worldX >= nodeLeft && worldX <= nodeRight && worldY >= nodeTop && worldY <= nodeBottom;
    });
  }, [positionedNodes, transform]);

  // Hit testing for clusters
  const getClusterAtPosition = useCallback((clientX, clientY) => {
    if (!enableOpeningClusters || !showOpeningClusters || clusterPathsData.length === 0) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Use the same active transform as the render function
    const activeTransform = (!isInitialPositioningComplete && optimalTransformRef.current) 
      ? optimalTransformRef.current 
      : transform;

    // Don't process clicks if we don't have a proper transform yet
    if (!activeTransform) {
      return null;
    }

    // Transform to world coordinates
    const worldX = (canvasX - activeTransform.x) / activeTransform.scale;
    const worldY = (canvasY - activeTransform.y) / activeTransform.scale;

    // Check clusters in reverse order (top to bottom in rendering)
    for (let i = clusterPathsData.length - 1; i >= 0; i--) {
      const { cluster, path } = clusterPathsData[i];
      
      // Use point-in-polygon test for the cluster path
      if (isPointInPath(worldX, worldY, path)) {
        return cluster;
      }
    }

    return null;
  }, [showOpeningClusters, clusterPathsData, transform]);

  // Point-in-polygon test using ray casting algorithm
  const isPointInPath = (x, y, path) => {
    if (!path || path.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      if (((path[i].y > y) !== (path[j].y > y)) &&
          (x < (path[j].x - path[i].x) * (y - path[i].y) / (path[j].y - path[i].y) + path[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Use a ref to store the zoom function to avoid recreating it on every render
  const zoomToRef = useRef();

  // Unified zoom function that can handle different targets
  const zoomTo = useCallback((target = 'all', options = {}) => {
    // Block zoom during initialization, but allow autofit to bypass interaction blocking
    if (isCanvasInteractionBlocked() && !options.bypassInteractionBlocking) {
      return;
    }
    
    // Prevent zoom during resize transitions or initialization, but allow autofit to bypass
    if ((isResizing || isInitializing) && !options.bypassInteractionBlocking) {
      return;
    }
    
    // Cancel any existing animation
    if (animationStateRef.current) {
      cancelAnimationFrame(animationStateRef.current);
      animationStateRef.current = null;
    }

    let targetNodes = [];
    let logMessage = '';

    // Use refs to access current state without causing dependency issues
    const currentPositionedNodes = positionedNodesRef.current;
    const currentPositionClusters = positionClusters; // This is passed as prop, safe to use directly

    switch (target) {
      case 'all':
        targetNodes = currentPositionedNodes;
        logMessage = 'ZOOM TO ALL NODES';
        break;
      
      case 'clusters':
        // Get all nodes that are part of position clusters
        if (currentPositionClusters && currentPositionClusters.length > 0) {
          currentPositionClusters.forEach(cluster => {
            if (cluster.allNodes) {
              cluster.allNodes.forEach(node => {
                const positionedNode = currentPositionedNodes.find(pn => pn.id === node.id);
                if (positionedNode) {
                  targetNodes.push(positionedNode);
                }
              });
            }
          });
        }
        
        // If no cluster nodes, fall back to all nodes
        if (targetNodes.length === 0) {
          targetNodes = currentPositionedNodes;
          logMessage = 'ZOOM TO ALL NODES (FALLBACK)';
        } else {
          logMessage = 'ZOOM TO POSITION CLUSTERS';
        }
        break;
      
      case 'reset':
        // Reset to default position with animation
        targetNodes = currentPositionedNodes;
        logMessage = 'ZOOM RESET TO DEFAULT';
        // Use a special transform for reset
        const resetOptimalTransform = { x: 0, y: 0, scale: 1 };
        
        // Apply reset transform with smooth animation
        const resetStartTransform = { ...(currentTransformRef.current || transform || { x: 0, y: 0, scale: 1 }) };
        const resetStartTime = Date.now();
        const resetDuration = 300;
        
        const resetAnimate = () => {
          const elapsed = Date.now() - resetStartTime;
          const progress = Math.min(elapsed / resetDuration, 1);
          
          // Use easing function for smoother animation
          const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          
          const newTransform = {
            x: resetStartTransform.x + (resetOptimalTransform.x - resetStartTransform.x) * easeProgress,
            y: resetStartTransform.y + (resetOptimalTransform.y - resetStartTransform.y) * easeProgress,
            scale: resetStartTransform.scale + (resetOptimalTransform.scale - resetStartTransform.scale) * easeProgress
          };
          
          setTransform(newTransform);
          // Update refs too for consistency
          currentTransformRef2.current = newTransform;
          
          if (progress < 1) {
            animationStateRef.current = requestAnimationFrame(resetAnimate);
          } else {
            animationStateRef.current = null;
            setIsInitializing(false);
          }
        };
        
        // Start reset animation immediately
        animationStateRef.current = requestAnimationFrame(resetAnimate);
        return;
      
      default:
        // If target is an array of nodes, use it directly
        if (Array.isArray(target)) {
          targetNodes = target;
          logMessage = `ZOOM TO ${target.length} CUSTOM NODES`;
        } else {
          targetNodes = currentPositionedNodes;
          logMessage = 'ZOOM TO ALL NODES (DEFAULT)';
        }
    }

    // Handle empty target nodes
    if (targetNodes.length === 0) {
      // Defer state updates to prevent setState during render
      requestAnimationFrame(() => {
        setTransform({ x: 0, y: 0, scale: 1 });
        setIsInitializing(false);
      });
      return;
    }

    // Calculate optimal transform for target nodes - use more padding only for position cluster zoom
    // Use standard padding (50px) for both initial 'all' view and normal fit view
    // Only use larger padding (120px) when specifically zooming to position clusters
    const clusterPadding = (target === 'clusters' && currentPositionClusters.length > 0) ? 120 : 50;
    const optimalTransform = calculateOptimalTransform(targetNodes, dimensions, clusterPadding);

          // Apply transform with smooth animation - simplified to prevent conflicts
      const startTransform = { ...(currentTransformRef.current || transform || { x: 0, y: 0, scale: 1 }) };
      const startTime = Date.now();
      const duration = 300;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smoother animation
        const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        
        const newTransform = {
          x: startTransform.x + (optimalTransform.x - startTransform.x) * easeProgress,
          y: startTransform.y + (optimalTransform.y - startTransform.y) * easeProgress,
          scale: startTransform.scale + (optimalTransform.scale - startTransform.scale) * easeProgress
        };
        
        setTransform(newTransform);
        // Update refs too for consistency
        currentTransformRef2.current = newTransform;
        
        if (progress < 1) {
          animationStateRef.current = requestAnimationFrame(animate);
        } else {
          animationStateRef.current = null;
        }
      };
      
      // Start animation immediately
      animationStateRef.current = requestAnimationFrame(animate);
  }, [dimensions, isResizing, isInitializing, positionClusters, isCanvasInteractionBlocked]); // Added isCanvasInteractionBlocked dependency

  // Convenience functions for backward compatibility and cleaner API
  const fitView = useCallback((options = {}) => zoomTo('all', options), [zoomTo]);
  const zoomToClusters = useCallback((options = {}) => zoomTo('clusters', options), [zoomTo]);

  // Store the functions in refs to avoid recreating them
  useEffect(() => {
    zoomToRef.current = zoomTo;
  }, [zoomTo]);

  // Simplified mouse event handlers
  const handleMouseDown = useCallback((e) => {
    // Block all mouse interactions during initialization
    if (isCanvasInteractionBlocked()) {
      e.preventDefault();
      return;
    }
    
    // Handle middle mouse button click for reset
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      zoomTo('all');
      return;
    }
    
    // Only handle left mouse button for dragging
    if (e.button !== 0) return;
    
    setMousePressed(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
    // Reset drag flag at the beginning of a new interaction
    isDraggingRef.current = false;
  }, [zoomTo, isCanvasInteractionBlocked]);

  const handleMouseMove = useCallback((e) => {
          if (mousePressed && (e.buttons & 1)) { // Check if left mouse button is pressed
        // Block panning during initialization
        if (isCanvasInteractionBlocked()) {
          return;
        }
      
      const deltaX = e.clientX - lastMouse.x;
      const deltaY = e.clientY - lastMouse.y;
      
      // Mark as dragging if movement exceeds a small threshold (3px total)
      if (!isDraggingRef.current && (Math.abs(deltaX) + Math.abs(deltaY) > 3)) {
        isDraggingRef.current = true;
        
        // Manual zoom tracking removed - now handled by grace period
      }

      setTransform(prev => {
        const newTransform = {
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY
        };
        // Update refs too for consistency
        currentTransformRef2.current = newTransform;
        return newTransform;
      });
      
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else {
      // Clear mouse pressed state if button isn't pressed
      if (mousePressed) setMousePressed(false);
      
      // Allow hover detection even during initialization (for better UX)
      // Handle node hover first (nodes take priority over clusters)
      const node = getNodeAtPosition(e.clientX, e.clientY);
      if (node !== hoveredNodeRef.current) {
        setHoveredNode(node);
        if (node && onNodeHover) {
          onNodeHover(e, node);
        } else if (!node && onNodeHoverEnd) {
          onNodeHoverEnd(e, hoveredNodeRef.current);
        }
      }

      // Handle cluster hover only if no node is hovered - EXACT ReactFlow logic
      if (!node) {
        const cluster = getClusterAtPosition(e.clientX, e.clientY);
        if (cluster !== hoveredClusterRef.current) {
          setHoveredCluster(cluster);
          if (cluster && onClusterHover) {
            // EXACT ReactFlow cluster hover handling
            const clusterColor = { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' };
            // Tooltip state is managed by parent component through callback
            onClusterHover(cluster.name, clusterColor);
          } else if (!cluster && onClusterHoverEnd) {
            // Tooltip state is managed by parent component through callback
            onClusterHoverEnd();
          }
        }
      } else if (hoveredClusterRef.current) {
        // Clear cluster hover when hovering over a node
        setHoveredCluster(null);
        // Tooltip state is managed by parent component through callback
        if (onClusterHoverEnd) {
          onClusterHoverEnd();
        }
      }
    }
  }, [mousePressed, lastMouse, getNodeAtPosition, getClusterAtPosition, onNodeHover, onNodeHoverEnd, onClusterHover, onClusterHoverEnd, isCanvasInteractionBlocked]); // Added isCanvasInteractionBlocked dependency

  const handleMouseUp = useCallback(() => {
    setMousePressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Always stop dragging when mouse leaves canvas
    setMousePressed(false);
    setHoveredNode(null);
    setHoveredCluster(null);
    // Don't close context menu when mouse leaves canvas - let outside click handle it
    // Tooltip state is managed by parent component through callback
    // Clear any hover callbacks
    if (onNodeHoverEnd) onNodeHoverEnd(null, null);
    if (onClusterHoverEnd) onClusterHoverEnd();
  }, [onNodeHoverEnd, onClusterHoverEnd]);

  const handleClick = useCallback((e) => {
    // Block clicks during initialization
    if (isCanvasInteractionBlocked()) {
      e.preventDefault();
      return;
    }
    
    // Suppress clicks that immediately follow a drag.
    if (isDraggingRef.current) {
      isDraggingRef.current = false; // reset for next interaction
      return;
    }

    const node = getNodeAtPosition(e.clientX, e.clientY);
    if (node && onNodeClick) {
      onNodeClick(e, node);
    }
    
    // Auto-zoom is now handled entirely by the useCanvasState hook
    // when updateCurrentPosition is called from onNodeClick
    
    // Close context menu when clicking on canvas (but not on nodes)
    if (contextMenu && !node) {
      setContextMenu(null);
    }
  }, [getNodeAtPosition, onNodeClick, contextMenu, autoZoomOnClick, positionClusters, zoomTo, isCanvasInteractionBlocked]);

  // NEW: Handle right-click events
  const handleRightClick = useCallback((e) => {
    e.preventDefault(); // Prevent default context menu
    
    // Block right-clicks during initialization
    if (isCanvasInteractionBlocked()) {
      return;
    }
    
    // Only show context menu if we have actions defined
    if (!contextMenuActions || contextMenuActions.length === 0) {
      return;
    }
    
    const node = getNodeAtPosition(e.clientX, e.clientY);
    
    if (node) {
      // Get canvas position for context menu
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const menuX = e.clientX - rect.left;
      const menuY = e.clientY - rect.top;
      
      setContextMenu({
        x: menuX,
        y: menuY,
        node: node
      });
      
      // Call optional callback
      if (onNodeRightClick) {
        onNodeRightClick(e, node);
      }
    } else {
      // Close context menu if right-clicking on empty space
      setContextMenu(null);
    }
  }, [contextMenuActions, onNodeRightClick, getNodeAtPosition, isCanvasInteractionBlocked]);

  // NEW: Handle context menu action clicks
  const handleContextMenuAction = useCallback((action, node) => {
    if (action.onClick) {
      action.onClick(node);
    }
    setContextMenu(null); // Close menu after action
  }, []);

  // NEW: Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (contextMenu && contextMenuRef.current) {
        // Don't close if clicking on the context menu itself
        if (contextMenuRef.current.contains(e.target)) {
          return;
        }
        
        // Close the context menu for any other click
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e) => {
      if (contextMenu) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            setContextMenu(null);
            break;
          case 'Enter':
            e.preventDefault();
            // Execute first non-disabled action
            if (contextMenuActions && contextMenuActions.length > 0) {
              const firstEnabledAction = contextMenuActions.find(action => 
                !action.disabled || !action.disabled(contextMenu.node)
              );
              if (firstEnabledAction) {
                handleContextMenuAction(firstEnabledAction, contextMenu.node);
              }
            }
            break;
          // Note: Arrow key navigation could be added here for more complex menus
        }
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu, contextMenuActions, handleContextMenuAction]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    // Block wheel zoom during initialization
    if (isCanvasInteractionBlocked()) {
      return;
    }
    
    // Don't process wheel events if we don't have a proper transform yet
    if (!transform) return;
    
    // Manual zoom tracking removed - now handled by grace period
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    // Allow manual zoom out to 1% minimum, but limit zoom in to reasonable level
    const newScale = Math.min(Math.max(transform.scale * scaleFactor, 0.01), 5.0);
    
    setTransform(prev => {
      const newTransform = {
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
        scale: newScale
      };
      // Update refs too for consistency
      currentTransformRef2.current = newTransform;
      return newTransform;
    });
  }, [transform, isCanvasInteractionBlocked]); // Added isCanvasInteractionBlocked dependency

  // Manually attach wheel event listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e) => {
      handleWheel(e);
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler);
    };
  }, [handleWheel]);

  // Add keyboard shortcut for fit view
  useEffect(() => {
      const handleKeyPress = (event) => {
    // Block keyboard shortcuts during initialization
    if (isCanvasInteractionBlocked()) {
      return;
    }
    
    if ((event.key === 'R' || event.key === 'r') && 
        !event.target.matches('input, textarea, select')) {
      event.preventDefault();
      zoomTo('all');
    } else if ((event.key === 'Escape') && 
        !event.target.matches('input, textarea, select')) {
      // Emergency reset - force a basic centered view
      event.preventDefault();
      setTransform({ x: 0, y: 0, scale: 0.5 });
    }
  };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [zoomTo, isCanvasInteractionBlocked]);

  // Expose fitView function to parent
  useEffect(() => {
    if (onFitView) {
      onFitView(fitView);
    }
  }, [onFitView, fitView]); // Expose the actual fitView function that accepts options

  // Expose zoomToClusters function to parent
  useEffect(() => {
    if (onZoomToClusters) {
      onZoomToClusters(zoomToClusters);
    }
  }, [onZoomToClusters, zoomToClusters]); // Expose the actual zoomToClusters function that accepts options
  
  // Expose generic zoomTo function to parent
  useEffect(() => {
    if (onZoomTo) {
      onZoomTo(zoomTo);
    }
  }, [onZoomTo, zoomTo]); // Expose the actual zoomTo function that accepts options

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationStateRef.current) {
        cancelAnimationFrame(animationStateRef.current);
      }
    };
  }, []);
 
  // Auto-fit completion is now handled entirely by useCanvasState hook

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full min-h-64 max-h-full relative overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ 
          cursor: isCanvasCursorBlocked() ? 'not-allowed' : (mousePressed ? 'grabbing' : cursorStyle),
          opacity: (isInitializing || positionedNodes.length === 0 || (!isInitialPositioningComplete && positionedNodes.length > 0) || dimensions.width === 0 || dimensions.height === 0 || !transform || !hasValidTransform) ? 0 : 1,
          transition: 'opacity 200ms ease-in-out'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleRightClick} // NEW: Handle right-click
      />
      
      {/* NEW: Context Menu */}
      {contextMenu && contextMenuActions && contextMenuActions.length > 0 && (
        <div
          ref={contextMenuRef}
          className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
          style={{
            left: Math.min(contextMenu.x, dimensions.width - 200), // Prevent menu from going off-screen
            top: Math.min(contextMenu.y, dimensions.height - (contextMenuActions.length * 40 + 20)), // Prevent menu from going off-screen
          }}

        >
          {contextMenuActions.map((action, index) => {
            const isDisabled = action.disabled ? action.disabled(contextMenu.node) : false;
            
            return (
              <button
                key={index}
                onClick={() => !isDisabled && handleContextMenuAction(action, contextMenu.node)}
                disabled={isDisabled}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                  isDisabled 
                    ? 'text-slate-500 cursor-not-allowed' 
                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {action.icon && <action.icon className="w-4 h-4" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
      

      
      {/* Graph Controls - Top Left - SHARED between modes */}
      {!isInitializing && positionedNodes.length > 0 && hasValidTransform && (
        <div className="absolute top-4 left-4 space-y-2 pointer-events-auto">
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => zoomTo('all')}
              className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
              title="Fit graph to view"
              disabled={isGenerating || isCanvasInteractionBlocked()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </Button>

            {/* Show opening cluster controls only when clustering is enabled */}
            {enableOpeningClusters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleToggleOpeningClusters}
                className={`${showOpeningClustersRef.current ? 'bg-purple-600 border-purple-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
                title="Toggle Opening Clusters"
                disabled={isCanvasInteractionBlocked()}
              >
                <Layers className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
                <span className="hidden group-hover:inline transition-opacity duration-100">Opening Clusters</span>
              </Button>
            )}

            {/* Show position cluster controls in both modes */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleTogglePositionClusters}
              className={`${showPositionClustersRef.current ? 'bg-orange-600 border-orange-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
              title="Toggle Position Clusters (Current Move)"
              disabled={isCanvasInteractionBlocked()}
            >
              <Target className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
              <span className="hidden group-hover:inline transition-opacity duration-100">Position Clusters</span>
            </Button>

            {/* Auto zoom on click toggle */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToggleAutoZoomOnClick}
              className={`${autoZoomOnClick ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
              title="Auto Zoom on Click"
              disabled={isCanvasInteractionBlocked()}
            >
              <Search className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
              <span className="hidden group-hover:inline transition-opacity duration-100">Auto Zoom on Click</span>
            </Button>
          </div>
        </div>
      )}

      {/* Controls Show Button - Bottom Right */}
      {mode === 'performance' && !isInitializing && positionedNodes.length > 0 && hasValidTransform && (
        <div className="absolute bottom-4 right-4 space-y-4 max-w-sm pointer-events-auto z-[150]">
          {/* Controls Card - positioned above the button */}
          {showPerformanceControls && onShowPerformanceControls && (
          <Card className="bg-slate-800/95 border-slate-700 backdrop-blur-lg shadow-xl pointer-events-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-200 text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Controls
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onShowPerformanceControls(false)}
                  className="ml-auto text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 p-1"
                  title="Hide controls"
                  disabled={isCanvasInteractionBlocked()}
                >
                  <EyeOff className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pointer-events-auto">
              {/* Controls Row 1 */}
              <div className="space-y-4">
                {/* Max Depth */}
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Max Depth</label>
                  <select 
                    value={maxDepth} 
                    onChange={(e) => handleMaxDepthChangeAsync(Number(e.target.value))}
                    className={`w-full px-2 py-1 rounded ${(isGenerating || isCanvasInteractionBlocked()) ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-200'}`}
                    disabled={isGenerating || isCanvasInteractionBlocked() || !onMaxDepthChange}
                  >
                  {[5, 10, 15, 20, 25, 30].map(d => (
                    <option key={d} value={d}>{d} moves</option>
                  ))}
                  </select>
                </div>
                
                {/* Min Games Slider */}
                <div className="space-y-3 bg-slate-700/30 p-3 rounded-lg border border-slate-600/50">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-200 text-xs font-medium">
                      Min Games Filter
                    </label>
                    <span className="text-green-300 text-xs font-mono bg-slate-600/50 px-2 py-1 rounded">
                      {tempMinGameCount}+ games
                    </span>
                  </div>
                  
                  <div className="space-y-2 pointer-events-auto">
                    <Slider
                      value={[tempMinGameCount]}
                      onValueChange={(value) => onTempMinGameCountChange && onTempMinGameCountChange(value[0])}
                      onValueCommit={handleMinGameCountSliderRelease}
                      min={1}
                      max={25}
                      step={1}
                      className="w-full pointer-events-auto [&_[role=slider]]:bg-green-500 [&_[role=slider]]:border-green-400 [&_[role=slider]]:shadow-lg [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-green-500 [&_.bg-primary]:to-green-600 [&_.bg-slate-200]:bg-slate-600/80"
                      disabled={isGenerating || isCanvasInteractionBlocked() || !onTempMinGameCountChange}
                    />
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">1 game</span>
                      <span className="text-slate-400">8 games</span>
                      <span className="text-slate-400">17 games</span>
                      <span className="text-slate-400">25 games</span>
                    </div>
                  </div>
                  

                  
                  {/* Explanation */}
                  <div className="text-xs text-slate-400 leading-relaxed">
                    Only shows moves with at least this many games.
                  </div>
                </div>
              </div>

              {/* Controls Row 2 - Win Rate Range Filter */}
              <div className="space-y-3 bg-slate-700/30 p-3 rounded-lg border border-slate-600/50">
                <div className="flex justify-between items-center">
                  <label className="text-slate-200 text-xs font-medium">
                    Win Rate Range Filter
                  </label>
                  <span className="text-blue-300 text-xs font-mono bg-slate-600/50 px-2 py-1 rounded">
                    {tempWinRateFilter[0]}% - {tempWinRateFilter[1]}%
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="relative">
                  <Slider
                    value={tempWinRateFilter}
                    onValueChange={onTempWinRateFilterChange}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-400 [&_[role=slider]]:shadow-lg [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-blue-500 [&_.bg-primary]:to-blue-600 [&_.bg-slate-200]:bg-slate-600/80"
                    disabled={isGenerating || isCanvasInteractionBlocked() || !onTempWinRateFilterChange}
                  />
                    {/* Performance zone indicators on the slider track */}
                    <div className="absolute top-2 left-0 right-0 flex justify-between pointer-events-none">
                      <div className="w-px h-2 bg-red-400/60"></div>
                      <div className="w-px h-2 bg-orange-400/60"></div>
                      <div className="w-px h-2 bg-amber-400/60"></div>
                      <div className="w-px h-2 bg-cyan-400/60"></div>
                      <div className="w-px h-2 bg-green-400/60"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-red-300 font-medium">0%</span>
                    <span className="text-orange-300 font-medium">25%</span>
                    <span className="text-amber-300 font-medium">50%</span>
                    <span className="text-cyan-300 font-medium">75%</span>
                    <span className="text-green-300 font-medium">100%</span>
                  </div>
                </div>
                
                <Button 
                  size="sm" 
                  onClick={handleApplyWinRateFilterAsync}
                  disabled={isGenerating || isCanvasInteractionBlocked() || !onApplyWinRateFilter || (tempWinRateFilter[0] === winRateFilter[0] && tempWinRateFilter[1] === winRateFilter[1])}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium shadow-lg transition-all duration-200"
                >
                Apply Filter ({tempWinRateFilter[0]}% - {tempWinRateFilter[1]}%)
              </Button>
              
              {(winRateFilter[0] !== 0 || winRateFilter[1] !== 100) && (
                <div className="text-xs text-center bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                  Active Filter: {winRateFilter[0]}% - {winRateFilter[1]}%
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

          {/* Show Button for Controls */}
          <div className="flex gap-2 flex-wrap justify-end pointer-events-auto">
            {!showPerformanceControls && onShowPerformanceControls && (
              <Button
                onClick={() => onShowPerformanceControls(true)}
                className="bg-slate-800/95 border border-slate-700 text-slate-200 hover:bg-slate-700/95 pointer-events-auto relative z-10 group transition-all duration-100"
                size="sm"
                style={{ pointerEvents: 'auto' }}
                title="Show Controls"
                disabled={isCanvasInteractionBlocked()}
              >
                <Settings className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
                <span className="hidden group-hover:inline transition-opacity duration-100">Controls ({maxDepth} moves, {minGameCount}+ games)</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Zoom indicator with keyboard shortcut */}
      {!isInitializing && positionedNodes.length > 0 && hasValidTransform && transform && (
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-slate-800/90 border border-slate-700 text-slate-200 px-3 py-2 rounded text-xs backdrop-blur-sm shadow-lg group transition-all duration-100">
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
              <span>{Math.round(transform.scale * 100)}%</span>
              <span className="text-slate-500 hidden group-hover:inline transition-opacity duration-100">
                <kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-slate-300 font-mono text-xs">R</kbd>
                <span className="mx-1">or</span>
                <span className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-slate-300 text-xs">MMB</span>
                <span className="mx-1">–</span>
                Fit
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Context menu indicator - only show when context menu actions are available and not in performance mode */}
      {!isInitializing && positionedNodes.length > 0 && hasValidTransform && contextMenuActions && contextMenuActions.length > 0 && mode !== 'performance' && (
        <div className="absolute bottom-4 right-4 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/50 text-amber-200 px-3 py-2 rounded text-xs pointer-events-none backdrop-blur-sm shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-amber-300">
              <span className="px-1 py-0.5 bg-amber-700/50 border border-amber-500/50 rounded text-amber-100 text-xs">Right&nbsp;Click</span>
              <span className="mx-1">–</span>
              Delete Move
            </span>
          </div>
        </div>
      )}



      {/* Opening Cluster Name Tooltip - Bottom Center */}
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

      {/* Initialization Loading Overlay - Covers initial positioning flash */}
      {(isInitializing || positionedNodes.length === 0 || (!isInitialPositioningComplete && positionedNodes.length > 0) || dimensions.width === 0 || dimensions.height === 0 || !transform || !hasValidTransform) && !isGenerating && (
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

      {/* Autofit Loading Overlay - Subtle overlay during autofit */}
      {isAutoFitPending && !isInitializing && positionedNodes.length > 0 && (
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

export default CanvasPerformanceGraph; 