import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Target, 
  Info, 
  Layers,
  EyeOff,
  Crown,
  Shield
} from 'lucide-react';

// Performance color constants
const PERFORMANCE_COLORS = {
  excellent: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  good: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  solid: { bg: '#f59e0b', border: '#d97706', text: '#000000' },
  challenging: { bg: '#f97316', border: '#ea580c', text: '#ffffff' },
  difficult: { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' },
};

const getPerformanceData = (winRate, gameCount) => {
  if (winRate >= 70) return PERFORMANCE_COLORS.excellent;
  if (winRate >= 60) return PERFORMANCE_COLORS.good;
  if (winRate >= 50) return PERFORMANCE_COLORS.solid;
  if (winRate >= 40) return PERFORMANCE_COLORS.challenging;
  return PERFORMANCE_COLORS.difficult;
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
  onToggleOpeningClusters, // Callback for opening cluster toggle
  onTogglePositionClusters, // Callback for position cluster toggle
  onClusterHover, // Callback for cluster hover
  onClusterHoverEnd, // Callback for cluster hover end
  hoveredOpeningName = null, // Current hovered opening name
  hoveredClusterColor = null, // Current hovered cluster color
  onResizeStateChange, // Callback to notify parent of resize state
  // Control props to match ReactFlow version
  maxDepth = 20,
  minGameCount = 20,
  winRateFilter = [0, 100],
  tempWinRateFilter = [0, 100],
  onMaxDepthChange,
  onMinGameCountChange,
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
  className = ""
}) => {
  const canvasRef = useRef();
  const containerRef = useRef();
  const animationRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [mousePressed, setMousePressed] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  // Track whether the current mouse interaction involved dragging
  const isDraggingRef = useRef(false);
  const [positionedNodes, setPositionedNodes] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null); // Track hovered cluster
  const [clusterPaths, setClusterPaths] = useState([]); // Store cluster paths for hit testing
  // Note: Opening name tooltip state is managed by parent component through callbacks
  const [hasAutoFitted, setHasAutoFitted] = useState(false); // Track if we've done initial auto-fit
  const [isInitializing, setIsInitializing] = useState(true); // Track initial setup
  
  // Add new state to track if initial positioning is complete
  const [isInitialPositioningComplete, setIsInitialPositioningComplete] = useState(false);
  
  // Track resize transitions to prevent zoom conflicts
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef(null);
  
  // Notify parent of resize state changes
  useEffect(() => {
    if (onResizeStateChange) {
      onResizeStateChange(isResizing);
    }
  }, [isResizing, onResizeStateChange]);
  
  // Animation state for smooth fit view - like ReactFlow
  const animationStateRef = useRef(null);

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

  // Enhanced resize detection with screen change support - handles window moves between screens
  useEffect(() => {
    let resizeTimeout = null;
    let lastDimensions = { width: 0, height: 0 };
    let lastDPR = window.devicePixelRatio;
    let resizeObserver = null;
    
    const scheduleAutoFit = (reason) => {
      // COMPLETELY DISABLE auto-fit to prevent all zoom conflicts
      
      // Clear any existing timeout just in case
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }
    };
    
    const updateSize = (reason = 'resize') => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDimensions = { 
          width: Math.floor(rect.width), 
          height: Math.floor(rect.height) 
        };
        const newDPR = window.devicePixelRatio;
        
        // Check if dimensions actually changed significantly (more sensitive for screen changes)
        const widthChanged = Math.abs(newDimensions.width - lastDimensions.width) > 3; // More sensitive
        const heightChanged = Math.abs(newDimensions.height - lastDimensions.height) > 3; // More sensitive
        const dprChanged = Math.abs(newDPR - lastDPR) > 0.01; // DPI change detection
        
        if (widthChanged || heightChanged || dprChanged) {
          // Mark as resizing
          setIsResizing(true);
          
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
          
          scheduleAutoFit(reason);
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
      if (!document.hidden) {
        // Page became visible - check if dimensions changed while hidden
        setTimeout(() => updateSize('visibility-change'), 50);
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
  }, [positionedNodes.length, hasAutoFitted]); // Dependencies for auto-fit decision

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
    const scale = Math.min(Math.max(rawScale, 0.001), 2.0);

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
  }, []);

  // Process graph data and calculate positions with immediate optimal transform
  useEffect(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) {
      // Defer state updates to prevent setState during render
      requestAnimationFrame(() => {
        setPositionedNodes([]);
        setHasAutoFitted(true); // Mark as fitted since there's nothing to fit
        setIsInitializing(false); // Not initializing if no nodes
        setIsInitialPositioningComplete(true); // Mark as complete
        setTransform({ x: 0, y: 0, scale: 1 }); // Reset to default
      });
      return;
    }

    // Check if this is a significant graph change (different nodes)
    const prevNodeCount = positionedNodes.length;
    const newNodeCount = graphData.nodes.filter(n => n.type !== 'clusterBackground').length;
    const isSignificantChange = prevNodeCount === 0 || Math.abs(prevNodeCount - newNodeCount) > 5;
    
    // Reset positioning state on significant changes
    if (isSignificantChange && isInitialPositioningComplete) {
      setIsInitialPositioningComplete(false);
      setIsInitializing(true);
    }

    // Use the existing positions from the graph data instead of recalculating
    const nodes = graphData.nodes.filter(n => n.type !== 'clusterBackground');
    const positioned = nodes.map(node => ({
      ...node,
      x: node.position.x + 90, // Center the node (180/2 = 90)
      y: node.position.y + 90, // Center the node (180/2 = 90)
      width: 180,
      height: 180
    }));

    // Debug: Check positioned nodes bounds
    if (positioned.length > 0) {
      const bounds = positioned.reduce((acc, node) => ({
        minX: Math.min(acc.minX, node.x),
        maxX: Math.max(acc.maxX, node.x),
        minY: Math.min(acc.minY, node.y),
        maxY: Math.max(acc.maxY, node.y)
      }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
      

    }

    // Only auto-fit if this is initial positioning (not a resize after setup)
    if (!isInitialPositioningComplete && dimensions.width > 0 && dimensions.height > 0) {
      // Calculate optimal transform for initial setup
      const optimalTransform = calculateOptimalTransform(positioned, dimensions);
      
      // Apply transform before injecting nodes to avoid one-frame zoom flash
      setTransform(optimalTransform);
      setHasAutoFitted(true);
    }
    
    // Always update positioned nodes
    setPositionedNodes(positioned);

    // Mark initialization as complete after a short delay
    if (!isInitialPositioningComplete) {
      setTimeout(() => {
        setIsInitializing(false);
        setIsInitialPositioningComplete(true);
      }, 100);
    }
  }, [graphData, calculateOptimalTransform, dimensions, isInitialPositioningComplete, positionedNodes.length]);

  // Fallback timeout to prevent initialization from getting stuck
  useEffect(() => {
    if (isInitializing) {
      const fallbackTimeout = setTimeout(() => {
        setIsInitializing(false);
      }, 1000); // 1 second fallback (more reasonable since we use 100ms delays)

      return () => clearTimeout(fallbackTimeout);
    }
  }, [isInitializing]);

  // Calculate cluster paths when clusters change
  useEffect(() => {
    if (!showOpeningClusters || !openingClusters.length || !positionedNodes.length) {
      setClusterPaths([]);
      return;
    }

    const newClusterPaths = [];
    
    openingClusters.forEach((cluster) => {
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

    setClusterPaths(newClusterPaths);
  }, [showOpeningClusters, openingClusters, positionedNodes]);

  // Canvas rendering function - HIGH DPI SUPPORT
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = dimensions;
    const { x: offsetX, y: offsetY, scale } = transform;

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
      if (showPositionClusters && positionClusters.length > 0) {
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
     if (showOpeningClusters && openingClusters.length > 0) {
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
         
         const isHovered = hoveredCluster && hoveredCluster.id === cluster.id;
         
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

        const perfData = getPerformanceData(edge.data?.winRate || 0, edge.data?.gameCount || 0);
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
      });
    }

    // Render nodes (skip if no nodes)
    if (positionedNodes.length > 0) {
      // Debug render check - check if any nodes are visible
      const visibleNodes = positionedNodes.filter(node => {
        const screenX = (node.x * transform.scale) + transform.x;
        const screenY = (node.y * transform.scale) + transform.y;
        const nodeSize = 140 * transform.scale;
        
        return screenX >= -nodeSize && screenX <= width + nodeSize &&
               screenY >= -nodeSize && screenY <= height + nodeSize;
      });
      
      // Reduced debug logging - just once per second


      let renderedNodeCount = 0;
      positionedNodes.forEach(node => {
      const perfData = getPerformanceData(node.data.winRate || 0, node.data.gameCount || 0);
      const isCurrentNode = node.id === currentNodeId;
      const isHoveredNextMove = node.id === hoveredNextMoveNodeId;
      const isHovered = hoveredNode?.id === node.id;
      
      const x = node.x - node.width/2;
      const y = node.y - node.height/2;
      
      // Check if node is potentially visible before expensive rendering
      const screenX = (node.x * transform.scale) + transform.x;
      const screenY = (node.y * transform.scale) + transform.y;
      const nodeSize = 140 * transform.scale;
      
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
      
      // Glow effect for special states
      if (isCurrentNode || isHoveredNextMove) {
        const glowColor = isCurrentNode ? '#22c55e' : '#fb923c';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isCurrentNode ? 20 : 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowBlur = 0;
      }

      // Node background with proper styling
      ctx.fillStyle = nodeColor;
      ctx.strokeStyle = nodeBorder;
      ctx.lineWidth = isCurrentNode || isHoveredNextMove ? 8 : (isHovered ? 6 : 4);
      
      ctx.beginPath();
      ctx.roundRect(x, y, node.width, node.height, 12);
      ctx.fill();
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;
      
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
        ctx.strokeText(`${node.data.gameCount} games`, centerX, centerY + 25);
        ctx.fillText(`${node.data.gameCount} games`, centerX, centerY + 25);
        
      } else {
        // MOVE NODE: Three-line layout with proper spacing - ALL LARGER
        const centerX = node.x;
        const centerY = node.y;
        
        // Move notation (top line) - EXTRA LARGE (more space in 180px node)
        ctx.font = `bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.strokeText(node.data.san || '?', centerX, centerY - 35);
        ctx.fillText(node.data.san || '?', centerX, centerY - 35);
        
        // Win rate (middle line) - MUCH LARGER (centered)
        const winRate = Math.round(node.data.winRate || 0);
        ctx.font = `600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.strokeText(`${winRate}%`, centerX, centerY);
        ctx.fillText(`${winRate}%`, centerX, centerY);
        
        // Game count (bottom line) - MUCH LARGER (better spacing)
        ctx.font = `500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.strokeText(`${node.data.gameCount || 0}g`, centerX, centerY + 35);
        ctx.fillText(`${node.data.gameCount || 0}g`, centerX, centerY + 35);
      }
      
      // Text rendering complete
    });
    
    // Only track render stats if we have issues (no logging)
    } // End of nodes rendering if statement

    ctx.restore();
     }, [positionedNodes, dimensions, transform, currentNodeId, hoveredNextMoveNodeId, hoveredNode, hoveredCluster, graphData.edges, openingClusters, positionClusters, showOpeningClusters, showPositionClusters]);

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

    // Transform to world coordinates
    const worldX = (canvasX - transform.x) / transform.scale;
    const worldY = (canvasY - transform.y) / transform.scale;

    return positionedNodes.find(node => {
      const nodeLeft = node.x - node.width/2;
      const nodeRight = node.x + node.width/2;
      const nodeTop = node.y - node.height/2;
      const nodeBottom = node.y + node.height/2;

      return worldX >= nodeLeft && worldX <= nodeRight && worldY >= nodeTop && worldY <= nodeBottom;
    });
  }, [positionedNodes, transform]);

  // Hit testing for clusters
  const getClusterAtPosition = useCallback((clientX, clientY) => {
    if (!showOpeningClusters || clusterPaths.length === 0) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Transform to world coordinates
    const worldX = (canvasX - transform.x) / transform.scale;
    const worldY = (canvasY - transform.y) / transform.scale;

    // Check clusters in reverse order (top to bottom in rendering)
    for (let i = clusterPaths.length - 1; i >= 0; i--) {
      const { cluster, path } = clusterPaths[i];
      
      // Use point-in-polygon test for the cluster path
      if (isPointInPath(worldX, worldY, path)) {
        return cluster;
      }
    }

    return null;
  }, [showOpeningClusters, clusterPaths, transform]);

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
  const zoomTo = useCallback((target = 'all') => {
    // Prevent zoom during resize transitions
    if (isResizing) {
      console.log('⏸️ Zoom prevented during resize transition');
      return;
    }
    
    // Cancel any existing animation
    if (animationStateRef.current) {
      cancelAnimationFrame(animationStateRef.current);
      animationStateRef.current = null;
    }

    let targetNodes = [];
    let logMessage = '';

    switch (target) {
      case 'all':
        targetNodes = positionedNodes;
        logMessage = 'ZOOM TO ALL NODES';
        break;
      
      case 'clusters':
        // Get all nodes that are part of position clusters
        if (positionClusters && positionClusters.length > 0) {
          positionClusters.forEach(cluster => {
            if (cluster.allNodes) {
              cluster.allNodes.forEach(node => {
                const positionedNode = positionedNodes.find(pn => pn.id === node.id);
                if (positionedNode) {
                  targetNodes.push(positionedNode);
                }
              });
            }
          });
        }
        
        // If no cluster nodes, fall back to all nodes
        if (targetNodes.length === 0) {
          targetNodes = positionedNodes;
          logMessage = 'ZOOM TO ALL NODES (FALLBACK)';
        } else {
          logMessage = 'ZOOM TO POSITION CLUSTERS';
        }
        break;
      
      case 'reset':
        // Reset to default position
        setTransform({ x: 0, y: 0, scale: 1 });
        setIsInitializing(false);
        return;
      
      default:
        // If target is an array of nodes, use it directly
        if (Array.isArray(target)) {
          targetNodes = target;
          logMessage = `ZOOM TO ${target.length} CUSTOM NODES`;
        } else {
          targetNodes = positionedNodes;
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
    const clusterPadding = (target === 'clusters' && positionClusters.length > 0) ? 120 : 50;
    const optimalTransform = calculateOptimalTransform(targetNodes, dimensions, clusterPadding);

    // Apply transform with smooth animation - defer to prevent setState during render
    requestAnimationFrame(() => {
      setTransform(currentTransform => {
        const startTransform = { ...currentTransform };
        const startTime = Date.now();
        const duration = 300;
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          const newTransform = {
            x: startTransform.x + (optimalTransform.x - startTransform.x) * progress,
            y: startTransform.y + (optimalTransform.y - startTransform.y) * progress,
            scale: startTransform.scale + (optimalTransform.scale - startTransform.scale) * progress
          };
          
          // Use requestAnimationFrame to update transform outside of render cycle
          requestAnimationFrame(() => {
            setTransform(newTransform);
          });
          
          if (progress < 1) {
            animationStateRef.current = requestAnimationFrame(animate);
          } else {
            animationStateRef.current = null;
          }
        };
        
        // Start animation on next frame to avoid sync updates
        requestAnimationFrame(animate);
        
        // Force stop after 400ms no matter what
        setTimeout(() => {
          if (animationStateRef.current) {
            cancelAnimationFrame(animationStateRef.current);
            animationStateRef.current = null;
          }
        }, 400);
        
        return currentTransform; // Return current transform for now, animation will update it
      });
    });
  }, [positionedNodes, positionClusters, dimensions, calculateOptimalTransform, isResizing]);

  // Convenience functions for backward compatibility and cleaner API
  const fitView = useCallback(() => zoomTo('all'), [zoomTo]);
  const zoomToClusters = useCallback(() => zoomTo('clusters'), [zoomTo]);

  // Store the functions in refs to avoid recreating them
  useEffect(() => {
    zoomToRef.current = zoomTo;
  }, [zoomTo]);

  // Simplified mouse event handlers
  const handleMouseDown = useCallback((e) => {
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
      }, [zoomTo]);

  const handleMouseMove = useCallback((e) => {
    if (mousePressed && (e.buttons & 1)) { // Check if left mouse button is pressed
      const deltaX = e.clientX - lastMouse.x;
      const deltaY = e.clientY - lastMouse.y;
      
      // Mark as dragging if movement exceeds a small threshold (3px total)
      if (!isDraggingRef.current && (Math.abs(deltaX) + Math.abs(deltaY) > 3)) {
        isDraggingRef.current = true;
      }

      setTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else {
      // Clear mouse pressed state if button isn't pressed
      if (mousePressed) setMousePressed(false);
      
      // Handle node hover first (nodes take priority over clusters)
      const node = getNodeAtPosition(e.clientX, e.clientY);
      if (node !== hoveredNode) {
        setHoveredNode(node);
        if (node && onNodeHover) {
          onNodeHover(e, node);
        } else if (!node && onNodeHoverEnd) {
          onNodeHoverEnd(e, hoveredNode);
        }
      }

      // Handle cluster hover only if no node is hovered - EXACT ReactFlow logic
      if (!node) {
        const cluster = getClusterAtPosition(e.clientX, e.clientY);
        if (cluster !== hoveredCluster) {
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
      } else if (hoveredCluster) {
        // Clear cluster hover when hovering over a node
        setHoveredCluster(null);
        // Tooltip state is managed by parent component through callback
        if (onClusterHoverEnd) {
          onClusterHoverEnd();
        }
      }
    }
  }, [mousePressed, lastMouse, getNodeAtPosition, getClusterAtPosition, hoveredNode, hoveredCluster, onNodeHover, onNodeHoverEnd, onClusterHover, onClusterHoverEnd]);

  const handleMouseUp = useCallback(() => {
    setMousePressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Always stop dragging when mouse leaves canvas
    setMousePressed(false);
    setHoveredNode(null);
    setHoveredCluster(null);
    // Tooltip state is managed by parent component through callback
    // Clear any hover callbacks
    if (onNodeHoverEnd) onNodeHoverEnd(null, null);
    if (onClusterHoverEnd) onClusterHoverEnd();
  }, [onNodeHoverEnd, onClusterHoverEnd]);

  const handleClick = useCallback((e) => {
    // Suppress clicks that immediately follow a drag.
    if (isDraggingRef.current) {
      isDraggingRef.current = false; // reset for next interaction
      return;
    }

    const node = getNodeAtPosition(e.clientX, e.clientY);
    if (node && onNodeClick) {
      onNodeClick(e, node);
    }
  }, [getNodeAtPosition, onNodeClick]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    // Allow manual zoom out to 1% minimum (much more generous than the old 5% limit)
    const newScale = Math.min(Math.max(transform.scale * scaleFactor, 0.01), 2.0);
    
    setTransform(prev => ({
      x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
      y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
      scale: newScale
    }));
  }, [transform.scale]);

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
  }, [zoomTo]);

  // TEMPORARILY DISABLED fitView exposure for debugging
  useEffect(() => {
    /*
    if (onFitView && zoomToRef.current) {
      onFitView(() => {
        if (zoomToRef.current) {
          zoomToRef.current('all');
        }
      });
    }
    */
  }, [onFitView, zoomToRef.current]); // Expose as soon as zoomTo is available

  // Expose zoomToClusters function to parent
  useEffect(() => {
    if (onZoomToClusters && zoomToRef.current) {
      // Direct call - this should work immediately
      onZoomToClusters(() => {
        if (zoomToRef.current) {
          zoomToRef.current('clusters');
        }
      });
    }
  }, [onZoomToClusters, zoomToRef.current]); // Expose as soon as zoomTo is available

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationStateRef.current) {
        cancelAnimationFrame(animationStateRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full min-h-64 max-h-full relative overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ 
          cursor: mousePressed ? 'grabbing' : (hoveredNode || hoveredCluster ? 'pointer' : 'grab'),
          opacity: isInitializing ? 0 : 1,
          transition: 'opacity 200ms ease-in-out'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()} // Prevent context menu
      />
      
      {/* Graph Controls - Top Left - EXACT match with ReactFlow version */}
      <div className="absolute top-4 left-4 space-y-2 pointer-events-auto">
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => zoomTo('all')}
            className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
            title="Fit graph to view"
            disabled={isGenerating || isInitializing}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToggleOpeningClusters}
            className={`${showOpeningClusters ? 'bg-purple-600 border-purple-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
            title="Toggle Opening Clusters"
          >
            <Layers className="w-4 h-4 mr-0 group-hover:mr-2 2xl:mr-2 transition-all duration-100" />
            <span className="hidden group-hover:inline 2xl:inline transition-opacity duration-100">Opening Clusters</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTogglePositionClusters}
            className={`${showPositionClusters ? 'bg-orange-600 border-orange-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
            title="Toggle Position Clusters (Current Move)"
          >
            <Target className="w-4 h-4 mr-0 group-hover:mr-2 2xl:mr-2 transition-all duration-100" />
            <span className="hidden group-hover:inline 2xl:inline transition-opacity duration-100">Position Clusters</span>
          </Button>
        </div>
      </div>

      {/* Controls Show Button - Right Side */}
      <div className="absolute top-4 right-4 space-y-4 max-w-sm pointer-events-auto">
        {/* Show Button for Controls only */}
        <div className="flex gap-2 flex-wrap justify-end">
          {!showPerformanceControls && onShowPerformanceControls && (
            <Button
              onClick={() => onShowPerformanceControls(true)}
              className="bg-slate-800/95 border border-slate-700 text-slate-200 hover:bg-slate-700/95"
              size="sm"
            >
              <Target className="w-4 h-4 mr-2" />
              Controls ({maxDepth} moves, {minGameCount}+ games)
            </Button>
          )}
        </div>

        {/* Controls Card - EXACT match with ReactFlow version */}
        {showPerformanceControls && onShowPerformanceControls && (
        <Card className="bg-slate-800/95 border-slate-700 backdrop-blur-lg shadow-xl">
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
              >
                <EyeOff className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Controls Row 1 */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="text-slate-400 text-xs block mb-1">Max Depth</label>
                                  <select 
                    value={maxDepth} 
                    onChange={(e) => handleMaxDepthChangeAsync(Number(e.target.value))}
                    className={`w-full px-2 py-1 rounded ${(isGenerating || isInitializing) ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-200'}`}
                    disabled={isGenerating || isInitializing || !onMaxDepthChange}
                  >
                  {[5, 10, 15, 20, 25, 30].map(d => (
                    <option key={d} value={d}>{d} moves</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">Min Games</label>
                                  <select 
                    value={minGameCount} 
                    onChange={(e) => handleMinGameCountChangeAsync(Number(e.target.value))}
                    className={`w-full px-2 py-1 rounded ${(isGenerating || isInitializing) ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-200'}`}
                    disabled={isGenerating || isInitializing || !onMinGameCountChange}
                  >
                  {[1, 2, 5, 10, 20, 50, 100].map(g => (
                    <option key={g} value={g}>{g}+ games</option>
                  ))}
                </select>
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
                  disabled={isGenerating || isInitializing || !onTempWinRateFilterChange}
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
                  disabled={isGenerating || isInitializing || !onApplyWinRateFilter || (tempWinRateFilter[0] === winRateFilter[0] && tempWinRateFilter[1] === winRateFilter[1])}
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
      </div>

      {/* Zoom indicator with keyboard shortcut */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 border border-slate-700 text-slate-200 px-3 py-2 rounded text-xs pointer-events-none backdrop-blur-sm shadow-lg">
        <div className="flex items-center gap-3">
          <span>Zoom: {Math.round(transform.scale * 100)}%</span>
          <span className="text-slate-500">
            <kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-slate-300 font-mono text-xs">R</kbd>
            <span className="mx-1">or</span>
            <span className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-slate-300 text-xs">Middle&nbsp;Mouse&nbsp;Button</span>
            <span className="mx-1">–</span>
            Fit
          </span>
        </div>
      </div>

      {/* Permanent Performance Legend - Bottom Right */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 border border-slate-700 px-3 py-2 rounded text-xs pointer-events-none backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {[
            { threshold: '70%', color: PERFORMANCE_COLORS.excellent },
            { threshold: '60%', color: PERFORMANCE_COLORS.good },
            { threshold: '50%', color: PERFORMANCE_COLORS.solid },
            { threshold: '40%', color: PERFORMANCE_COLORS.challenging },
            { threshold: '0%', color: PERFORMANCE_COLORS.difficult },
          ].map(({ threshold, color }) => (
            <div key={threshold} className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded-sm border shadow-sm"
                style={{ backgroundColor: color.bg, borderColor: color.border }}
              />
              <span className="text-slate-200 font-mono text-xs">{threshold}</span>
            </div>
          ))}
        </div>
      </div>

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
      {isInitializing && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4 mx-auto"></div>
            <div className="text-slate-200 text-base font-medium">Positioning Graph</div>
            <div className="text-slate-400 text-sm">Setting up optimal view...</div>
          </div>
        </div>
      )}


    </div>
  );
};

export default CanvasPerformanceGraph; 