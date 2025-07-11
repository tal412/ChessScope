import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import InteractiveChessboard from '../components/chess/InteractiveChessboard';
import ChunkVisualization from '../components/opening-moves/ChunkVisualization';
import ClusterOverlay from '../components/opening-moves/ClusterOverlay';
import CanvasPerformanceGraph from '../components/chess/CanvasPerformanceGraph';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NavigationButtons, NavigationPresets } from '@/components/ui/navigation-buttons';
import { 
  FlexibleLayout, 
  LayoutSection,
  ComponentConfigs
} from '@/components/ui/flexible-layout';
import { 
  Target, 
  Info, 
  Home, 
  Brain, 
  ChevronLeft, 
  ChevronRight, 
  Crown, 
  Shield,
  Layers,
  Eye,
  EyeOff,
  Filter,
  BarChart3,
  Menu,
  Maximize2,
  RotateCcw,
  RefreshCw,
  Loader2,
  Grid3x3,
  Network
} from 'lucide-react';
import { useChessboardSync } from '../hooks/useChessboardSync';
import { loadOpeningGraph } from '../api/graphStorage';
import { checkPositionInOpenings } from '../api/openingEntities';
import { useAuth } from '../contexts/AuthContext';
import { useCanvasState } from '../hooks/useCanvasState';
import { createOpeningClusters, createPositionClusters, enrichNodesWithOpeningClusters } from '../utils/clusteringAnalysis';




// Performance color constants - ENHANCED VIBRANT COLORS
const PERFORMANCE_COLORS = {
  excellent: { bg: '#10b981', border: '#059669', text: '#ffffff' }, // Emerald 70%+
  good: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' }, // Cyan 60-70%
  solid: { bg: '#f59e0b', border: '#d97706', text: '#000000' }, // Amber 50-60%
  challenging: { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Orange 40-50%
  difficult: { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' }, // Red <40%
};

// Opening cluster colors - SINGLE NICE PURPLE SHADE (will never clash with performance colors)
const SINGLE_PURPLE_COLOR = { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }; // Violet 500 - nice balance of light but not too light

const OPENING_CLUSTER_COLORS = Array(15).fill(SINGLE_PURPLE_COLOR);

// Gray color for unclustered openings
const UNCLUSTERED_OPENING_COLOR = { bg: '#64748b', border: '#475569', text: '#ffffff' }; // Slate gray

// Get performance styling based on win rate
const getPerformanceData = (winRate, gameCount) => {
  if (winRate >= 70) return PERFORMANCE_COLORS.excellent;
  if (winRate >= 60) return PERFORMANCE_COLORS.good;
  if (winRate >= 50) return PERFORMANCE_COLORS.solid;
  if (winRate >= 40) return PERFORMANCE_COLORS.challenging;
  return PERFORMANCE_COLORS.difficult;
};

// Function to get distinct color for each opening (no similarity grouping)
const getOpeningColorIndex = (openingName, allOpeningNames = []) => {
  // Sort all opening names to ensure consistent ordering
  const sortedOpenings = [...allOpeningNames].sort();
  const index = sortedOpenings.indexOf(openingName);
  return index >= 0 ? index % OPENING_CLUSTER_COLORS.length : 0;
};

// Function to create convex hull for more organic shapes
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

// These components are no longer needed since we're using Canvas only

// Opening Cluster Background Node Component - More organic shapes with hover
const ClusterBackgroundNode = ({ data }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  // Use custom color if provided (for position clusters), otherwise use opening cluster colors
  const color = data.customColor || OPENING_CLUSTER_COLORS[data.colorIndex % OPENING_CLUSTER_COLORS.length];
  
  // Create SVG path for more organic shape
  const createOrganicPath = (width, height) => {
    const points = data.nodePositions || [];
    
    if (points.length < 3) {
      // Fallback to rounded rectangle for small clusters
      return `M 20 0 L ${width - 20} 0 Q ${width} 0 ${width} 20 L ${width} ${height - 20} Q ${width} ${height} ${width - 20} ${height} L 20 ${height} Q 0 ${height} 0 ${height - 20} L 0 20 Q 0 0 20 0 Z`;
    }
    
    // Create convex hull of node positions
    const hull = createConvexHull(points.map(p => ({ x: p.x - data.minX, y: p.y - data.minY })));
    
    if (hull.length < 3) {
      return `M 20 0 L ${width - 20} 0 Q ${width} 0 ${width} 20 L ${width} ${height - 20} Q ${width} ${height} ${width - 20} ${height} L 20 ${height} Q 0 ${height} 0 ${height - 20} L 0 20 Q 0 0 20 0 Z`;
    }
    
    // Create smooth path through hull points
    let path = `M ${hull[0].x} ${hull[0].y}`;
    
    for (let i = 1; i < hull.length; i++) {
      const curr = hull[i];
      const next = hull[(i + 1) % hull.length];
      const prev = hull[i - 1];
      
      // Calculate control points for smooth curves
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      
      const cp1x = curr.x - dx1 * 0.2;
      const cp1y = curr.y - dy1 * 0.2;
      const cp2x = curr.x + dx2 * 0.2;
      const cp2y = curr.y + dy2 * 0.2;
      
      path += ` Q ${cp1x} ${cp1y} ${curr.x} ${curr.y}`;
    }
    
    path += ' Z';
    return path;
  };
  
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (data.onHover) data.onHover(data.clusterName);
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    if (data.onHoverEnd) data.onHoverEnd();
  };
  
  return (
    <div
      style={{
        width: `${data.width}px`,
        height: `${data.height}px`,
        position: 'relative',
        pointerEvents: 'none', // Disable pointer events on container
      }}
    >
      <svg
        width={data.width}
        height={data.height}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          pointerEvents: data.onHover ? 'auto' : 'none' // Disable pointer events for position clusters
        }}
      >
        <defs>
          <filter id={`glow-${data.clusterIndex}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={isHovered ? "6" : "4"} result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/> 
            </feMerge>
          </filter>
          <linearGradient id={`gradient-${data.clusterIndex}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: color.bg, stopOpacity: isHovered ? 0.6 : 0.4 }} />
            <stop offset="100%" style={{ stopColor: color.bg, stopOpacity: isHovered ? 0.4 : 0.2 }} />
          </linearGradient>
        </defs>
        
        {/* Main cluster shape - hover detection only on the actual path */}
        <path
          d={createOrganicPath(data.width, data.height)}
          fill={`url(#gradient-${data.clusterIndex})`}
          stroke={color.border}
          strokeWidth={isHovered ? "4" : "3"}
          opacity={isHovered ? "1.0" : "0.8"}
          filter={`url(#glow-${data.clusterIndex})`}
          style={{
            transition: 'all 0.2s ease-in-out',
            cursor: data.onHover ? 'pointer' : 'default',
            pointerEvents: data.onHover ? 'auto' : 'none' // Also disable on path element
          }}
          onMouseEnter={data.onHover ? handleMouseEnter : undefined}
          onMouseLeave={data.onHover ? handleMouseLeave : undefined}
        />
      </svg>
    </div>
  );
};

// Function to create background nodes for position clusters
const createPositionClusterBackgroundNodes = (positionClusters) => {
  if (!positionClusters || positionClusters.length === 0) return [];

  const backgroundNodes = [];
  
  // Colors for position clusters - different from opening clusters
  const positionColors = [
    { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Bright Orange
    { bg: '#f59e0b', border: '#d97706', text: '#000000' }, // Amber
    { bg: '#eab308', border: '#ca8a04', text: '#000000' }, // Yellow
  ];

  positionClusters.forEach((cluster, clusterIndex) => {
    const clusterNodes = cluster.allNodes;
    
    if (clusterNodes.length === 0) return;

    // Find bounds of all nodes in this cluster
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    clusterNodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const nodeSize = 140;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nodeSize);
      maxY = Math.max(maxY, y + nodeSize);
    });
    
    // Add padding around the cluster
    const padding = 40;
    const bgX = minX - padding;
    const bgY = minY - padding;
    const bgWidth = (maxX - minX) + (padding * 2);
    const bgHeight = (maxY - minY) + (padding * 2);
    
    // Get cluster color
    const clusterColor = positionColors[cluster.colorIndex % positionColors.length];
    
    // Collect node positions for organic shape
    const nodePositions = clusterNodes.map(node => ({
      x: node.position.x + 70, // Center of node
      y: node.position.y + 70
    }));
    
    backgroundNodes.push({
      id: `position-cluster-bg-${clusterIndex}`,
      type: 'clusterBackground',
      position: { x: bgX, y: bgY },
      data: {
        clusterIndex: `pos-${clusterIndex}`,
        clusterName: cluster.name,
        colorIndex: cluster.colorIndex,
        customColor: clusterColor, // Pass the orange color directly
        width: bgWidth,
        height: bgHeight,
        nodePositions,
        minX: bgX,
        minY: bgY,
        // No hover functionality for position clusters
      },
      selectable: false,
      draggable: false,
      zIndex: -2 // Below opening clusters (-1)
    });
  });

  return backgroundNodes;
};

// Function to create background nodes for clusters
const createClusterBackgroundNodes = (nodes, clusters, handleClusterHover, handleClusterHoverEnd) => {
  if (!clusters || clusters.length === 0) return [];
  
  const backgroundNodes = [];
  
  clusters.forEach((cluster, clusterIndex) => {
    const clusterNodes = nodes.filter(node => 
      node.data.openingClusterId === clusterIndex && !node.data.isRoot
    );
    
    if (clusterNodes.length === 0) return;
    
    // Collect all node positions for organic shape calculation
    const nodePositions = clusterNodes.map(node => ({
      x: node.position.x + 70, // Center of node
      y: node.position.y + 70
    }));
    
    // Find bounds of all nodes in this cluster
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    clusterNodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const nodeSize = 140;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nodeSize);
      maxY = Math.max(maxY, y + nodeSize);
    });
    
    // Add padding around the cluster
    const padding = 50;
    const bgX = minX - padding;
    const bgY = minY - padding;
    const bgWidth = (maxX - minX) + (padding * 2);
    const bgHeight = (maxY - minY) + (padding * 2);
    
    // Get cluster color
    const clusterColor = OPENING_CLUSTER_COLORS[cluster.colorIndex % OPENING_CLUSTER_COLORS.length];
    
    backgroundNodes.push({
      id: `cluster-bg-${clusterIndex}`,
      type: 'clusterBackground',
      position: { x: bgX, y: bgY },
      data: {
        clusterIndex,
        clusterName: cluster.name,
        colorIndex: cluster.colorIndex, // Pass the color index from cluster
        width: bgWidth,
        height: bgHeight,
        nodePositions,
        minX: bgX,
        minY: bgY,
        onHover: (clusterName) => {
          handleClusterHover(clusterName, clusterColor);
        },
        onHoverEnd: () => {
          handleClusterHoverEnd();
        }
      },
      selectable: false,
      draggable: false,
      zIndex: -1 // Below nodes but above position clusters (-2)
    });
  });
  
  return backgroundNodes;
};

// Duplicate functions removed - now imported from shared utilities

// Main Performance Graph Component
function PerformanceGraphContent() {
  // Get auth context for syncing state
  const { isSyncing, syncProgress, syncStatus, pendingAutoSync } = useAuth();
  
  // Component lifecycle logging
  useEffect(() => {
    return () => {
      // Component unmounted
    };
  }, []);
  
  // Graph state for Canvas rendering
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState('white');
  const [performanceZones, setPerformanceZones] = useState([]);
  const [criticalPaths, setCriticalPaths] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null); // For position info dialog
  const [graphLoaded, setGraphLoaded] = useState(false); // Track when graph is loaded
  const [initialLoad, setInitialLoad] = useState(true); // Track initial page load
  
  // Ref must be declared before using in hooks
  const openingGraphRef = useRef(null);
  
  // Auto-zoom toggle state - controls both click-based and position-change-based auto-zoom
  const [autoZoomOnClick, setAutoZoomOnClick] = useState(() => {
    const savedState = localStorage.getItem('canvas-auto-zoom-on-click');
    return savedState ? JSON.parse(savedState) : true;
  }); // On by default

  // Use shared performance graph state management
  const performanceState = useCanvasState({
    openingGraph: openingGraphRef.current,
    selectedPlayer,
    enableClustering: false,
    enablePositionClusters: true,
    enableAutoZoom: true, // Keep general auto-zoom enabled for programmatic changes
    enableClickAutoZoom: autoZoomOnClick, // This controls click-based auto-zoom specifically
    autoFitOnResize: true // This controls resize-based auto-fit (always enabled)
  });

  // Auto-zoom toggle handler with persistence
  const handleAutoZoomOnClickChange = useCallback((newState) => {
    setAutoZoomOnClick(newState);
    localStorage.setItem('canvas-auto-zoom-on-click', JSON.stringify(newState));
  }, []);
  
  // Saved openings state
  const [nodeOpeningsMap, setNodeOpeningsMap] = useState(new Map()); // Map of FEN -> openings containing it
  
  // Chessboard integration state
  const [hoveredMove, setHoveredMove] = useState(null); // Track hovered move for arrows
  // const [enableHoverArrows, setEnableHoverArrows] = useState(true); // Always enabled now
  const enableHoverArrows = true; // Always enabled
  
  // UI visibility state - individual toggles for each component
  // Performance controls and clustering now handled by performanceState
  
  // Clustering UI state
  const [showClusteringControls, setShowClusteringControls] = useState(false); // Hide clustering controls by default
  
  // Flexible Layout State - allows independent control of each component
  const [showOpeningMoves, setShowOpeningMoves] = useState(true); // Show opening moves
  const [showPositionAnalysis, setShowPositionAnalysis] = useState(true); // Show position analysis (chessboard)
  const [showPerformanceGraph, setShowPerformanceGraph] = useState(true); // Show performance graph
  
  // Legacy chessboard state (now handled by showPositionAnalysis)
  const showChessboard = showPositionAnalysis; // Backward compatibility
  
  // Opening Moves integration state
  const [openingGraph, setOpeningGraph] = useState(null); // Opening graph data
  const [movesStats, setMovesStats] = useState(null); // Moves statistics
  const [movesHoveredMove, setMovesHoveredMove] = useState(null); // Moves hovered move for arrows
  const [movesDirectScrollFn, setMovesDirectScrollFn] = useState(null); // Direct scroll function from moves
  const [hoveredNextMoveNodeId, setHoveredNextMoveNodeId] = useState(null); // Track hovered next move node
  const [movesCurrentPath, setMovesCurrentPath] = useState([]); // Persistent moves path state
  
  // Use shared chessboard sync hook
  const chessboardSync = useChessboardSync({
    nodes,
    onNodeSelect: (node) => {
      setSelectedNode(node);
      performanceState.updateCurrentPosition(node?.id, node?.data?.fen); // Update current position using shared state
    },
    setNodes
  });

  // Canvas zoom functionality now handled by shared performance state
  


  // Keyboard shortcut handler for view reset
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Check if 'R' or 'r' is pressed (not in an input field)
      if ((event.key === 'R' || event.key === 'r') && 
          !event.target.matches('input, textarea, select')) {
        event.preventDefault();
        handleReset();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyPress);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []); // Empty dependency array since handleReset is stable

  // State to trigger data refresh
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshInProgress, setIsRefreshInProgress] = useState(false);

  // Load opening graph data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Don't load if syncing is in progress OR if there's a pending auto-sync
        // UNLESS we're in the middle of a refresh (which means import just completed)
        if ((isSyncing || pendingAutoSync) && !isRefreshInProgress) {
          setLoading(true); // Keep loading state during sync
          return;
        }
        
        setLoading(true);
        
        // Get username from localStorage
        const username = localStorage.getItem('chesscope_username');
        
        if (!username) {
          console.warn('No username found - user needs to import games first');
          setLoading(false);
          return;
        }
        
        // Load opening graph from IndexedDB
        const graph = await loadOpeningGraph(username);
        
        if (!graph) {
          console.warn('No opening graph data found for user:', username);
          setLoading(false);
          return;
        }
        
        openingGraphRef.current = graph;
        setGraphLoaded(true); // Trigger recalculation
        setInitialLoad(false); // Mark initial load as complete
        
        // Always default to white's perspective
        const overallStats = graph.getOverallStats();
        const whiteGames = overallStats.white?.totalGames || 0;
        const blackGames = overallStats.black?.totalGames || 0;
        
        // Always set selectedPlayer to white (user can manually switch if needed)
        setSelectedPlayer('white');
        
        // Also set up opening moves with the same graph
        setOpeningGraph(graph);
        setMovesStats(overallStats);
        
      } catch (error) {
        console.error('Error loading opening graph:', error);
      } finally {
        // Only set loading false if not syncing (unless we're doing a refresh)
        if (!isSyncing || isRefreshInProgress) {
          setLoading(false);
        }
        
        // Clear refresh flag when loading completes
        if (isRefreshInProgress) {
          setIsRefreshInProgress(false);
        }
      }
    };
    
    loadData();
  }, [refreshTrigger, isSyncing, pendingAutoSync, isRefreshInProgress]); // Include refresh flag as dependency

  // Listen for custom refresh event from settings
  useEffect(() => {
    const handleRefresh = (event) => {
      // Set refresh in progress flag
      setIsRefreshInProgress(true);
      
      // Clear all cached state
      openingGraphRef.current = null;
      setOpeningGraph(null);
      setMovesStats(null);
      setGraphData({ nodes: [], edges: [], maxGameCount: 0 });
      setNodes([]);
      setEdges([]);
      performanceState.setOpeningClusters([]);
      performanceState.setPositionClusters([]);
      setInitialLoad(true);
      setGraphLoaded(false);
      performanceState.setIsGenerating(false);
      
      // Reset UI states
      setHoveredMove(null);
      performanceState.setHoveredOpeningName(null);
      performanceState.setHoveredClusterColor(null);
      setSelectedNode(null);
      
      // Reset chessboard state - using the ref directly if available
      if (chessboardSync?.resetToStartingPosition) {
        chessboardSync.resetToStartingPosition();
      }
      
      // Reset view states
      performanceState.updateCurrentPosition(null, null);
      performanceState.setHoveredNextMoveNodeId(null);
      setMovesHoveredMove(null);
      setMovesCurrentPath([]);
      setHasInitialRootSelection(false); // Reset so root gets selected again on new data
      
      // Force loading state to show immediately
      setLoading(true);
      
      // Trigger data reload with a small delay to ensure auth state is updated
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 100); // Small delay to allow auth state to settle
    };

    window.addEventListener('refreshPerformanceGraph', handleRefresh);
    
    // Add test function to window for manual testing
    window.testPerformanceGraphRefresh = () => {
      const event = new CustomEvent('refreshPerformanceGraph', { 
        detail: { source: 'manual-test', timestamp: Date.now() } 
      });
      const result = window.dispatchEvent(event);
      return result;
    };
    
    return () => {
      window.removeEventListener('refreshPerformanceGraph', handleRefresh);
      delete window.testPerformanceGraphRefresh;
    };
  }, []); // Empty dependency array - set up only once

  // State for graph data
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], maxGameCount: 0 });
  
  // Immediately set loading state when parameters change (before graph generation)
  useEffect(() => {
    if (openingGraphRef.current && !loading && !initialLoad) {
      // Only set generating if not already generating to prevent unnecessary state updates
      if (!performanceState.isGenerating) {
        performanceState.setIsGenerating(true);
      }
    }
  }, [selectedPlayer, performanceState.maxDepth, performanceState.minGameCount, performanceState.winRateFilter, loading, initialLoad, performanceState.isGenerating]);
  
  // enrichNodesWithOpeningClusters now imported from shared utilities
  
  // Update position clusters when current position changes
  useEffect(() => {
    if (graphData.nodes.length > 0 && performanceState.currentPositionFen) {
      const clusters = createPositionClusters(graphData.nodes, performanceState.currentPositionFen);
      performanceState.setPositionClusters(clusters);
    } else {
      performanceState.setPositionClusters([]);
    }
  }, [graphData.nodes, performanceState.currentPositionFen]);

  // Auto-zoom is now handled by usePerformanceGraphState hook - removed duplicate logic

  // Sync moves with chessboard moves
  useEffect(() => {
    if (movesDirectScrollFn && chessboardSync.currentMoves && showOpeningMoves) {
      // Update moves to show current position - only when moves is visible
      setTimeout(() => {
        movesDirectScrollFn(chessboardSync.currentMoves);
      }, 100);
    }
  }, [chessboardSync.currentMoves, movesDirectScrollFn, showOpeningMoves]);

  // Load saved openings for all nodes
  useEffect(() => {
    const loadNodeOpenings = async () => {
      if (graphData.nodes.length === 0) return;
      
      const username = localStorage.getItem('chesscope_username');
      if (!username) return;
      
      const newMap = new Map();
      
      // Check each unique FEN position
      const uniqueFens = new Set(graphData.nodes.map(node => node.data.fen));
      
      for (const fen of uniqueFens) {
        const openings = await checkPositionInOpenings(fen, username);
        if (openings.length > 0) {
          newMap.set(fen, openings);
        }
      }
      
      setNodeOpeningsMap(newMap);
    };
    
    loadNodeOpenings();
  }, [graphData.nodes]);

  // Update opening clusters when graph data changes or clustering is toggled
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const clusters = createOpeningClusters(graphData.nodes);
      performanceState.setOpeningClusters(clusters);
      
      // Update nodes with clustering information and current position
      const enrichedNodes = enrichNodesWithOpeningClusters(
        graphData.nodes, 
        clusters, 
        performanceState.currentNodeId, 
        performanceState.hoveredNextMoveNodeId, 
        performanceState.openingClusteringEnabled,
        nodeOpeningsMap
      );
      
      // Combine background nodes from both opening clusters and position clusters
      let allBackgroundNodes = [];
      
      // Add opening cluster backgrounds if enabled
      if (performanceState.openingClusteringEnabled) {
        const openingBackgroundNodes = createClusterBackgroundNodes(
          enrichedNodes, 
          clusters,
          performanceState.handleClusterHover,
          performanceState.handleClusterHoverEnd
        );
        allBackgroundNodes = [...allBackgroundNodes, ...openingBackgroundNodes];
      }
      
      // Add position cluster backgrounds (when enabled and available)
      if (performanceState.showPositionClusters && performanceState.positionClusters.length > 0) {
        const positionBackgroundNodes = createPositionClusterBackgroundNodes(performanceState.positionClusters);
        allBackgroundNodes = [...allBackgroundNodes, ...positionBackgroundNodes];
      }
      
      setNodes([...allBackgroundNodes, ...enrichedNodes]);
    }
  }, [graphData, performanceState.openingClusteringEnabled, performanceState.currentNodeId, performanceState.hoveredNextMoveNodeId, performanceState.positionClusters, performanceState.showPositionClusters, nodeOpeningsMap, setNodes]);
  
  // Async graph generation to prevent UI blocking
  useEffect(() => {
    const generateGraph = async () => {
      // If we are still loading the opening graph data, wait until it finishes
      if (loading) {
        return; // Avoid rendering an interim placeholder that causes a visual blink
      }

      // If loading has finished but we still don't have any graph data (e.g. user hasn't imported games yet)
      if (!openingGraphRef.current) {
        // Show a default node indicating no data is available
        const noDataNode = {
          id: 'no-data',
          type: 'chessPosition',
          position: { x: 0, y: 0 },
          data: {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            winRate: 50,
            gameCount: 0,
            san: null,
            openingName: 'Import games to see your opening moves',
            openingEco: '',
            ecoOpeningName: 'Import games to see your opening moves',
            isRoot: true,
            depth: 0,
            moveSequence: []
          }
        };
        setGraphData({ nodes: [noDataNode], edges: [], maxGameCount: 0 });
        performanceState.setIsGenerating(false);
        return;
      }
      
      try {
      // Get root moves
      const rootMoves = openingGraphRef.current.getRootMoves(selectedPlayer === 'white');
      
      if (!rootMoves || rootMoves.length === 0) {
        console.warn(`No root moves found for ${selectedPlayer} - showing default empty moves`);
        // Return a default moves with just the root node so it's never completely empty
        const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const defaultRootNode = {
          id: rootFen,
          type: 'chessPosition',
          position: { x: 0, y: 0 },
          data: {
            fen: rootFen,
            winRate: 50,
            gameCount: 0,
            san: null,
            openingName: 'Starting Position - No Data Available',
            openingEco: '',
            ecoOpeningName: 'Starting Position - No Data Available',
            isRoot: true,
            depth: 0,
            moveSequence: []
          }
        };
        
        const finalGraphData = { nodes: [defaultRootNode], edges: [], maxGameCount: 0 };
        setGraphData(finalGraphData);
        performanceState.setIsGenerating(false);
        return;
      }
      
      let rawNodes = [];
      let rawEdges = [];
      let maxGameCount = 0;
      
      // Tree layout configuration - optimized for 180px NODES
      const LEVEL_HEIGHT = 350; // Even larger spacing for bigger nodes  
      const NODE_SPACING = 240; // More horizontal spacing for 180px nodes (was 200 for 140px nodes)
      
      // Add root node at the top center
      const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const totalGames = rootMoves.reduce((sum, move) => sum + (move.gameCount || 0), 0);
      
      rawNodes.push({
        id: rootFen,
        type: 'chessPosition',
        position: { x: 0, y: 0 },
        data: {
          fen: rootFen,
          winRate: 50,
          gameCount: totalGames,
          san: null,
          openingName: 'Starting Position',
          openingEco: '',
          ecoOpeningName: 'Starting Position',
          isRoot: true,
          depth: 0,
          moveSequence: []
        }
      });
      
      // Filter root moves by minimum game count AND win rate
      const filteredRootMoves = rootMoves.filter(move => {
        const gameCount = move.gameCount || 0;
        const winRate = move.details?.winRate || move.winRate || 0;
        return gameCount >= performanceState.minGameCount && 
               winRate >= performanceState.winRateFilter[0] && 
               winRate <= performanceState.winRateFilter[1];
      });
      
      // NO FALLBACK - Strictly respect the filter settings
      let finalRootMoves = filteredRootMoves;
      
      if (finalRootMoves.length === 0) {
        console.warn(`No root moves meet the ${performanceState.minGameCount}+ games filter`);
        
        // Update root node to show filter message
        rawNodes[0].data.openingName = `No moves with ${performanceState.minGameCount}+ games`;
        rawNodes[0].data.ecoOpeningName = `Filter: ${performanceState.minGameCount}+ games`;
        
        // Return just the root node (no popup alert)
        const finalGraphData = { 
          nodes: rawNodes, 
          edges: [], 
          maxGameCount: totalGames 
        };
        
        setGraphData(finalGraphData);
        performanceState.setIsGenerating(false);
        return;
      }
      
      // Tree structure for proper layout
      const treeStructure = new Map(); // nodeId -> { children: [], parent: null, level: 0 }
      treeStructure.set(rootFen, { children: [], parent: null, level: 0, width: 0 });
      
      // Build the tree structure level by level - WORKING EXACTLY LIKE OPENING TREE
      const buildTreeLevel = (parentNodes, currentLevel) => {
        if (currentLevel >= performanceState.maxDepth || parentNodes.length === 0) {
          return [];
        }
        
        const childNodes = [];
        
        for (const parentNode of parentNodes) {
          try {
            let movesToGet = [];
            
            if (currentLevel === 1) {
              // First level - use root moves
              movesToGet = finalRootMoves;
            } else {
              // Deeper levels - get moves from position using the SAME logic as Opening Tree
              const moveSequence = parentNode.moveSequence || [];
              // Use the EXACT same method as ChunkVisualization
              movesToGet = openingGraphRef.current.getMovesFromPosition(
                moveSequence, 
                selectedPlayer === 'white'
              );
            }
            
            if (!movesToGet || movesToGet.length === 0) {
              continue;
            }
            
            // SIMPLE FILTER: Apply minimum game count to all moves
            const validMoves = movesToGet.filter(move => {
              const gameCount = move.gameCount || 0;
              const winRate = move.details?.winRate || move.winRate || 0;
              return gameCount >= performanceState.minGameCount && 
                     winRate >= performanceState.winRateFilter[0] && 
                     winRate <= performanceState.winRateFilter[1];
            });
            
            if (validMoves.length === 0) continue;
            
            // Add children to tree structure
            const parentTreeNode = treeStructure.get(parentNode.id);
            if (!parentTreeNode) continue;
            
            validMoves.forEach((move, index) => {
              const gameCount = move.gameCount || 0;
              maxGameCount = Math.max(maxGameCount, gameCount);
              
              const nodeId = move.toFen || `${parentNode.id}-${move.san}-${currentLevel}-${index}`;
              const parentMoveSequence = parentNode.moveSequence || [];
              const moveSequence = [...parentMoveSequence, move.san];
              
              // Prevent duplicates
              if (rawNodes.some(n => n.id === nodeId)) {
                return;
              }
              
              const calculatedWinRate = move.details?.winRate || move.winRate || 0;
              
              // Debug logging for Lichess win rates removed
              
              const childNode = {
                id: nodeId,
                type: 'chessPosition',
                position: { x: 0, y: 0 }, // Will be calculated later
                data: {
                  fen: move.toFen,
                  winRate: calculatedWinRate,
                  gameCount: gameCount,
                  san: move.san,
                  openingName: move.openingInfo?.name || 'Unknown Opening',
                  openingEco: move.openingInfo?.eco || '',
                  ecoOpeningName: move.openingInfo?.eco && move.openingInfo?.name 
                    ? `${move.openingInfo.eco} ${move.openingInfo.name}` 
                    : (move.openingInfo?.name || 'Unknown Opening'),
                  isRoot: false,
                  depth: currentLevel,
                  moveSequence: moveSequence
                },
                // Store moveSequence at top level for next iteration
                moveSequence: moveSequence
              };
              
              rawNodes.push(childNode);
              childNodes.push(childNode);
              
              // Add to tree structure
              treeStructure.set(nodeId, { 
                children: [], 
                parent: parentNode.id, 
                level: currentLevel, 
                width: 0 
              });
              parentTreeNode.children.push(nodeId);
              
              // Add edge with validation
              const edgeId = `${parentNode.id}-${nodeId}`;
              
              // Verify this is a valid parent-child relationship
              const isValidEdge = parentNode.moveSequence.length === moveSequence.length - 1;
              
              if (isValidEdge) {
                rawEdges.push({
                  id: edgeId,
                  source: parentNode.id,
                  target: nodeId,
                  sourceHandle: 'bottom',
                  targetHandle: 'top',
                  type: 'chessMove',
                  animated: false,
                  data: {
                    san: move.san,
                    winRate: move.details?.winRate || move.winRate || 0,
                    gameCount: gameCount,
                    maxGameCount: maxGameCount
                  }
                });
                

              } else {
                console.warn(`❌ INVALID EDGE BLOCKED: ${edgeId} - Parent sequence length: ${parentNode.moveSequence.length}, Child sequence length: ${moveSequence.length}`);
              }
            });
            
          } catch (error) {
            console.error(`🚨 Error processing level ${currentLevel}:`, error);
          }
        }
        
        return childNodes;
      };
      
      // Build tree structure - GO DEEP LIKE OPENING TREE!
      let currentLevelNodes = [{ 
        id: rootFen, 
        moveSequence: [],
        data: { moveSequence: [] }
      }];
      
      for (let level = 1; level <= performanceState.maxDepth; level++) {
        const nextLevelNodes = buildTreeLevel(currentLevelNodes, level);
        
        if (nextLevelNodes.length === 0) {
          break;
        }
        
        currentLevelNodes = nextLevelNodes;
      }
      
      // BRANCH TRIMMING: Remove single-game branches, keep only first move
      const trimSingleGameBranches = () => {
        const nodesToRemove = new Set();
        const edgesToRemove = new Set();
        
        // Find branches that continue with single games (keep first move, trim rest)
        const checkBranchForTrimming = (nodeId, depth = 0) => {
          const node = rawNodes.find(n => n.id === nodeId);
          if (!node || node.data.isRoot) return false;
          
          const gameCount = node.data.gameCount || 0;
          
          // If this is a single-game position, trim all its children (but keep this node)
          if (gameCount === 1) {
            const treeNode = treeStructure.get(nodeId);
            if (treeNode && treeNode.children && treeNode.children.length > 0) {
              // Mark all children and their descendants for removal
              const markForRemoval = (id) => {
                nodesToRemove.add(id);
                const childTreeNode = treeStructure.get(id);
                if (childTreeNode && childTreeNode.children) {
                  childTreeNode.children.forEach(grandChildId => {
                    markForRemoval(grandChildId);
                    // Also mark edges for removal
                    edgesToRemove.add(`${id}-${grandChildId}`);
                  });
                }
              };
              
              // Remove all children of this single-game node
              treeNode.children.forEach(childId => {
                markForRemoval(childId);
                edgesToRemove.add(`${nodeId}-${childId}`);
              });
              
              // Clear children from tree structure
              treeNode.children = [];
            }
            return true;
          }
          
          // Check children recursively for multi-game nodes
          const treeNode = treeStructure.get(nodeId);
          if (treeNode && treeNode.children) {
            treeNode.children.forEach(childId => {
              checkBranchForTrimming(childId, depth + 1);
            });
          }
          
          return false;
        };
        
        // Start checking from root's children
        const rootTreeNode = treeStructure.get(rootFen);
        if (rootTreeNode && rootTreeNode.children) {
          rootTreeNode.children.forEach(childId => {
            checkBranchForTrimming(childId, 1);
          });
        }
        
        // Remove marked nodes and edges
        const originalNodeCount = rawNodes.length;
        const originalEdgeCount = rawEdges.length;
        
        // Count single-game nodes before trimming
        const singleGameNodes = rawNodes.filter(n => n.data.gameCount === 1).length;
        
        // Filter out marked nodes
        rawNodes.splice(0, rawNodes.length, ...rawNodes.filter(node => !nodesToRemove.has(node.id)));
        
        // Filter out marked edges and edges connected to removed nodes
        rawEdges.splice(0, rawEdges.length, ...rawEdges.filter(edge => {
          return !edgesToRemove.has(edge.id) && 
                 !nodesToRemove.has(edge.source) && 
                 !nodesToRemove.has(edge.target);
        }));
        
        // Update tree structure
        for (const nodeId of nodesToRemove) {
          const treeNode = treeStructure.get(nodeId);
          if (treeNode && treeNode.parent) {
            const parentTreeNode = treeStructure.get(treeNode.parent);
            if (parentTreeNode) {
              parentTreeNode.children = parentTreeNode.children.filter(childId => !nodesToRemove.has(childId));
            }
          }
          treeStructure.delete(nodeId);
        }

      };
      
      // Apply branch trimming (always enabled)
      trimSingleGameBranches();
      
      // Calculate tree layout positions
      const calculateTreeLayout = () => {
        // Bottom-up width calculation
        const calculateWidths = (nodeId) => {
          const treeNode = treeStructure.get(nodeId);
          if (!treeNode) return 0;
          
          if (treeNode.children.length === 0) {
            treeNode.width = 1;
            return 1;
          }
          
          let totalWidth = 0;
          for (const childId of treeNode.children) {
            totalWidth += calculateWidths(childId);
          }
          treeNode.width = Math.max(1, totalWidth);
          return treeNode.width;
        };
        
        // Top-down position assignment - SIMPLIFIED AND FIXED
        const assignPositions = (nodeId, x, y, availableWidth) => {
          const treeNode = treeStructure.get(nodeId);
          const node = rawNodes.find(n => n.id === nodeId);
          
          if (!treeNode || !node) return;
          
          // Position this node at the given coordinates
          node.position = { x, y };
          
          // Position children if any
          if (treeNode.children.length > 0) {
            const childY = y + LEVEL_HEIGHT;
            
            // Calculate total spacing needed for all children
            const totalChildWidth = availableWidth * NODE_SPACING;
            const startX = x - totalChildWidth / 2;
            
            // Position children evenly across the available width
            let currentX = startX;
            
            for (const childId of treeNode.children) {
              const childTreeNode = treeStructure.get(childId);
              if (childTreeNode) {
                const childSubtreeWidth = childTreeNode.width * NODE_SPACING;
                const childCenterX = currentX + childSubtreeWidth / 2;
                
                // Recursively position this child and its subtree
                assignPositions(childId, childCenterX, childY, childTreeNode.width);
                currentX += childSubtreeWidth;
              }
            }
          }
        };
        
        // Calculate and assign positions
        calculateWidths(rootFen);
        const rootWidth = treeStructure.get(rootFen).width;
        assignPositions(rootFen, 0, 0, rootWidth);
      };
      
      calculateTreeLayout();
      

      
      // Validate coordinates
      const validNodes = rawNodes.filter(node => {
        const hasValidCoords = !isNaN(node.position.x) && !isNaN(node.position.y) && 
                             isFinite(node.position.x) && isFinite(node.position.y);
        if (!hasValidCoords) {
          console.warn('Invalid node coordinates:', node);
        }
        return hasValidCoords;
      });
      
      // Clean up edges - remove duplicates and validate relationships
      const edgeMap = new Map();
      const cleanEdges = [];
      
      rawEdges.forEach(edge => {
        const sourceExists = validNodes.some(n => n.id === edge.source);
        const targetExists = validNodes.some(n => n.id === edge.target);
        
        if (!sourceExists || !targetExists) {
          console.warn(`❌ EDGE VALIDATION FAILED: Missing nodes for edge ${edge.id}`);
          return;
        }
        
        // Check for duplicates
        if (edgeMap.has(edge.id)) {
          console.warn(`❌ DUPLICATE EDGE REMOVED: ${edge.id}`);
          return;
        }
        
        // Validate parent-child relationship
        const sourceNode = validNodes.find(n => n.id === edge.source);
        const targetNode = validNodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const sourceSequence = sourceNode.data.moveSequence || [];
          const targetSequence = targetNode.data.moveSequence || [];
          
          // Target should have exactly one more move than source
          const isValidRelationship = targetSequence.length === sourceSequence.length + 1 &&
                                    sourceSequence.every((move, index) => move === targetSequence[index]);
          
          if (!isValidRelationship) {
            console.warn(`❌ INVALID PARENT-CHILD RELATIONSHIP: ${edge.id}`, {
              source: sourceSequence,
              target: targetSequence
            });
            return;
          }
        }
        
        edgeMap.set(edge.id, edge);
        cleanEdges.push(edge);
      });
      
      const validEdges = cleanEdges;
      
      const finalGraphData = { 
        nodes: validNodes, 
        edges: validEdges, 
        maxGameCount 
      };
      

      
      // Set the graph data and clear generating state
      setGraphData(finalGraphData);
      performanceState.setIsGenerating(false);
      
    } catch (error) {
      console.error('Error generating graph data:', error);
      setGraphData({ nodes: [], edges: [], maxGameCount: 0 });
      performanceState.setIsGenerating(false);
    }
  };
  
  generateGraph();
}, [selectedPlayer, performanceState.maxDepth, performanceState.minGameCount, performanceState.winRateFilter, loading, graphLoaded, initialLoad]);

  // Track if we've done initial root selection
  const [hasInitialRootSelection, setHasInitialRootSelection] = useState(false);

  // Update nodes and edges when data changes
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      // Don't set nodes here - let the opening clustering effect handle it
      setEdges(graphData.edges);
      
      // Set initial current node to root ONLY on first load, not on deselection
      if (!performanceState.currentNodeId && !hasInitialRootSelection) {
        const rootNode = graphData.nodes.find(node => node.data.isRoot);
        if (rootNode) {
          performanceState.updateCurrentPosition(rootNode.id, rootNode.data.fen, 'initial');
          setHasInitialRootSelection(true);
        }
      }
      
      // Note: Canvas handles its own auto-fit timing internally
    }
  }, [graphData, setEdges, hasInitialRootSelection]);

  // Simple cluster hover handlers - deferred to prevent setState during render
  const handleClusterHover = useCallback((clusterName, clusterColor) => {
    // Defer state updates to prevent setState during render
    requestAnimationFrame(() => {
      setHoveredOpeningName(clusterName);
      setHoveredClusterColor(clusterColor);
    });
  }, []);

  const handleClusterHoverEnd = useCallback(() => {
    // Defer state updates to prevent setState during render
    requestAnimationFrame(() => {
      setHoveredOpeningName(null);
      setHoveredClusterColor(null);
    });
  }, []);

  // Example context menu actions (commented out for now)
  // const contextMenuActions = useMemo(() => [
  //   {
  //     label: 'Analyze Position',
  //     icon: Target,
  //     onClick: (node) => {
  //       // Navigate to position analysis
  //       console.log('Analyzing position:', node.data.fen);
  //     }
  //   },
  //   {
  //     label: 'Copy FEN',
  //     icon: Copy,
  //     onClick: (node) => {
  //       navigator.clipboard.writeText(node.data.fen);
  //       // Show toast notification
  //     }
  //   },
  //   {
  //     label: 'View Games',
  //     icon: BookOpen,
  //     onClick: (node) => {
  //       // Open games viewer for this position
  //       console.log('Viewing games for:', node.data.san);
  //     },
  //     disabled: (node) => (node.data.gameCount || 0) === 0
  //   }
  // ], []);

  // Handle node clicks
  const onNodeClick = (event, node) => {
    // Ignore cluster background nodes - they shouldn't trigger position changes
    if (node.type === 'clusterBackground') {
      return;
    }
    
    // Check if clicking on currently selected node - if so, deselect it
    if (performanceState.currentNodeId === node.id) {
      // Deselect the current node
      performanceState.updateCurrentPosition(null, null, 'click');
      // Reset chessboard to starting position
      chessboardSync.syncMovesToChessboard([]);
      return;
    }
    
    // Extract move sequence from node data
    const moveSequence = node.data.moveSequence || [];
    
    // Use shared chessboard sync to update position
    chessboardSync.syncMovesToChessboard(moveSequence);
    
    // Track currently selected node and position
    performanceState.updateCurrentPosition(node.id, node.data.fen, 'click');
    
    // Don't open position dialog - it clashes with the chessboard
    // setSelectedNode(node);
  };

  // Optimized hover handlers with throttling
  const onNodeMouseEnter = useCallback((event, node) => {
    if (!enableHoverArrows || !performanceState.currentNodeId) return; // Only show arrows if enabled and we have a current position
    
    const currentNode = nodes.find(n => n.id === performanceState.currentNodeId);
    if (!currentNode) return;
    
    const currentMoves = currentNode.data.moveSequence || [];
    const hoveredMoves = node.data.moveSequence || [];
    
    // Check if the hovered node is exactly one move ahead
    if (hoveredMoves.length === currentMoves.length + 1 && 
        currentMoves.every((move, index) => move === hoveredMoves[index])) {
      
      const nextMove = hoveredMoves[hoveredMoves.length - 1];
      
              // Create move data similar to opening moves format
      const moveData = {
        san: nextMove,
        gameCount: node.data.gameCount || 0,
        maxGameCount: graphData.maxGameCount,
        details: {
          winRate: node.data.winRate || 0
        },
        winRate: node.data.winRate || 0
      };
      
      setHoveredMove(moveData);
    }
  }, [enableHoverArrows, performanceState.currentNodeId, nodes, graphData.maxGameCount]);

  // Handle node hover end
  const onNodeMouseLeave = useCallback((event, node) => {
    setHoveredMove(null);
  }, []);

  const handleReset = () => {
    performanceState.canvasState.fitView();
  };

  // Position dialog removed - function kept for potential future use
  // const closePositionDialog = () => {
  //   setSelectedNode(null);
  // };

  // Apply win rate filter - now handled by shared performance state

  // Canvas control handlers - now handled by shared performance state

  const toggleOpeningMoves = () => {
    setShowOpeningMoves(!showOpeningMoves);
  };

  const togglePositionAnalysis = () => {
    setShowPositionAnalysis(!showPositionAnalysis);
  };

  const togglePerformanceGraph = () => {
    setShowPerformanceGraph(!showPerformanceGraph);
  };

  // Legacy functions for backward compatibility
  const toggleChessboard = togglePositionAnalysis;

  // Toggle clustering features - now handled by shared performance state



  // Moves integration handlers
  const handleMovesCurrentMovesChange = (moves) => {
    // Moves updates current moves - sync with performance graph
    
    // Store moves path persistently
    setMovesCurrentPath(moves);
    
    // Check if moves are actually different from current chessboard state
    const currentMoves = chessboardSync.currentMoves || [];
    const movesChanged = moves.length !== currentMoves.length ||
                        moves.some((move, index) => move !== currentMoves[index]);
    
    if (movesChanged) {
      // Update chessboard to reflect moves selection
      chessboardSync.syncMovesToChessboard(moves);
    }
    
    // Find corresponding node in the performance graph and update current position
    const targetNode = nodes.find(node => {
      const nodeMoves = node.data.moveSequence || [];
      return nodeMoves.length === moves.length && 
             nodeMoves.every((move, index) => move === moves[index]);
    });
    
    if (targetNode) {
      // Detect reset action (empty moves array going to root)
      const isReset = moves.length === 0;
      const source = isReset ? 'reset' : 'sync';
      
      // Don't overwrite recent user clicks with 'programmatic' - preserve the original source
      // This prevents interfering with click auto-zoom detection
      performanceState.updateCurrentPosition(targetNode.id, targetNode.data.fen, source);
    }
  };

  // Navigation handlers for opening moves NavigationButtons
  const handleMovesPrevious = () => {
    if (movesCurrentPath.length > 0) {
      const newPath = movesCurrentPath.slice(0, -1);
      setMovesCurrentPath(newPath);
      chessboardSync.syncMovesToChessboard(newPath);
      
      // Update direct scroll function if available
      if (movesDirectScrollFn) {
        movesDirectScrollFn(newPath);
      }
    }
  };

  const handleMovesNext = () => {
    // For opening moves, next navigation is typically done by clicking moves
    // This could be enhanced to go to the most popular next move
  };

  const handleMovesReset = () => {
    const newPath = [];
    setMovesCurrentPath(newPath);
    chessboardSync.syncMovesToChessboard(newPath);
    
    // Update direct scroll function if available
    if (movesDirectScrollFn) {
      movesDirectScrollFn(newPath);
    }
    
    // Find root node and update position with reset source
    const rootNode = nodes.find(node => node.data.isRoot);
    if (rootNode) {
      performanceState.updateCurrentPosition(rootNode.id, rootNode.data.fen, 'reset');
    }
  };

  // Universal flip handler that flips both board orientation AND player perspective
  const handleUniversalFlip = () => {
    // Switch player perspective (White Moves ↔ Black Moves)
    const newPlayer = selectedPlayer === 'white' ? 'black' : 'white';
    setSelectedPlayer(newPlayer);
    
    // This will automatically trigger the moves to reload with the opposite perspective
    // and the board orientation will follow the new player perspective
  };

  // Alias for moves flip
  const handleMovesFlip = handleUniversalFlip;

  // Note: ChunkVisualization handles its own move selection internally
  // and calls onCurrentMovesChange when the path changes

  const handleMovesDirectScroll = (scrollFn) => {
    setMovesDirectScrollFn(() => scrollFn);
  };

  const handleMovesMoveHover = (moveData) => {
    setMovesHoveredMove(moveData);
    
    // Find the corresponding node in the graph for the hovered move
    if (moveData && moveData.san) {
      // Get current path from chessboard
      const currentPath = chessboardSync.currentMoves || [];
      // The next move would be current path + hovered move
      const nextMovePath = [...currentPath, moveData.san];
      
      // Find the node that matches this move sequence
      const hoveredNode = nodes.find(node => {
        const nodeMoves = node.data.moveSequence || [];
        return nodeMoves.length === nextMovePath.length && 
               nodeMoves.every((move, index) => move === nextMovePath[index]);
      });
      
      if (hoveredNode) {
        // Set a state to track which node should glow
        performanceState.setHoveredNextMoveNodeId(hoveredNode.id);
      } else {
        performanceState.setHoveredNextMoveNodeId(null);
      }
    } else {
      performanceState.setHoveredNextMoveNodeId(null);
    }
  };

  const handleMovesMoveHoverEnd = () => {
    setMovesHoveredMove(null);
    performanceState.setHoveredNextMoveNodeId(null);
  };

  // Layout state - using flexible layout system
  const [layoutInfo, setLayoutInfo] = useState({});

  // Component visibility state for flexible layout
  const componentVisibility = {
    moves: showOpeningMoves,
    board: showPositionAnalysis,
    graph: showPerformanceGraph
  };

  // Handle layout changes - memoized to prevent infinite re-renders
  const handleLayoutChange = useCallback((layoutData) => {
    setLayoutInfo(layoutData);
  }, []);

  // Show loading screen during initial load OR when syncing/pending auto-sync
  if ((loading && !isSyncing && !pendingAutoSync) || (initialLoad && !openingGraphRef.current)) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-purple-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-lg"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-slate-200">
              Loading Performance Graph
            </h2>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              Preparing your chess analysis and opening performance data
            </p>
            <div className="flex items-center justify-center gap-2 mt-6">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!openingGraphRef.current) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">No Chess Data Found</h3>
          <p className="text-slate-400 mb-4">Import your games first to see the performance graph.</p>
          <Button onClick={() => window.location.href = '/import'} className="bg-blue-600 hover:bg-blue-700">
            Import Games
          </Button>
        </div>
      </div>
    );
  }

  // Component toggle configuration
  const componentToggleConfig = {
    moves: { icon: Menu, label: 'Moves' },
    board: { icon: Grid3x3, label: 'Board' },
    graph: { icon: Network, label: 'Graph' }
  };

  // Handle component toggles
  const handleComponentToggle = (componentKey) => {
    switch (componentKey) {
      case 'moves':
        toggleOpeningMoves();
        break;
      case 'board':
        togglePositionAnalysis();
        break;
      case 'graph':
        togglePerformanceGraph();
        break;
    }
  };

  return (
    <div className="h-full w-full bg-slate-900">
      {/* Main Content using FlexibleLayout with integrated AppBar */}
      <FlexibleLayout
        title="Performance Graph"
        icon={Target}
        rightControls={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white">
                  <div className="flex items-center gap-2">
                    {selectedPlayer === 'white' ? (
                      <Crown className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Shield className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="hidden sm:inline">
                      {selectedPlayer === 'white' ? 'White' : 'Black'}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                <DropdownMenuItem 
                  onClick={() => setSelectedPlayer('white')}
                  className="text-slate-200 hover:text-white hover:bg-slate-700"
                >
                  <Crown className="w-4 h-4 mr-2 text-amber-400" />
                  White
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSelectedPlayer('black')}
                  className="text-slate-200 hover:text-white hover:bg-slate-700"
                >
                  <Shield className="w-4 h-4 mr-2 text-slate-400" />
                  Black
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        components={componentVisibility}
        componentConfig={ComponentConfigs.performanceGraph}
        componentToggleConfig={componentToggleConfig}
        onComponentToggle={handleComponentToggle}
        onLayoutChange={handleLayoutChange}
      >
        {{
          moves: (
            <LayoutSection
              key="moves"
              headerControls={
                <div className="max-w-sm">
                  <NavigationButtons
                    currentIndex={movesCurrentPath.length}
                    totalCount={movesCurrentPath.length}
                    onPrevious={handleMovesPrevious}
                    onNext={handleMovesNext}
                    onReset={handleMovesReset}
                    onFlip={handleMovesFlip}
                    features={NavigationPresets.chessboard.features}
                    labels={{
                      ...NavigationPresets.chessboard.labels,
                      previous: "Back one move",
                      next: "Forward one move", 
                      reset: "Reset to root position",
                      flip: "Flip moves view"
                    }}
                    disabled={!openingGraph}
                    styling={{
                      size: "sm",
                      className: "max-w-full"
                    }}
                  />
                </div>
              }
            >
              {!initialLoad && openingGraph ? (
                <div className="h-full w-full">
                  <ChunkVisualization
                    openingGraph={openingGraph}
                    isWhiteTree={selectedPlayer === 'white'}
                    onCurrentMovesChange={handleMovesCurrentMovesChange}
                    externalMoves={chessboardSync.currentMoves}
                    onMoveHover={handleMovesMoveHover}
                    onMoveHoverEnd={handleMovesMoveHoverEnd}
                    onDirectScroll={handleMovesDirectScroll}
                    initialPath={movesCurrentPath}
                    maxDepth={performanceState.maxDepth}
                    minGameCount={performanceState.minGameCount}
                    winRateFilter={performanceState.winRateFilter}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-4">
                    <Menu className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs">
                      {initialLoad ? "Loading moves..." : openingGraph ? "No data" : "No data"}
                    </p>
                    {!initialLoad && !openingGraph && (
                      <p className="text-slate-500 text-xs">Import games</p>
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
              className="bg-slate-800/70"
            >
              <div className="h-full flex items-center justify-center p-2">
                {/* Only render chessboard after initial load is complete */}
                {!initialLoad && openingGraphRef.current ? (
                  <InteractiveChessboard
                    key={`chessboard-${showOpeningMoves}-${showPerformanceGraph}`}
                    currentMoves={chessboardSync.currentMoves}
                    onMoveSelect={chessboardSync.handleMoveSelect}
                    onNewMove={chessboardSync.handleNewMove}
                    isWhiteTree={selectedPlayer === 'white'}
                    openingGraph={openingGraphRef.current}
                    graphNodes={nodes}
                    hoveredMove={movesHoveredMove || hoveredMove}
                    onFlip={handleUniversalFlip}
                    className="w-full max-w-none"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-4">
                      <Grid3x3 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400 text-xs">Loading board...</p>
                    </div>
                  </div>
                )}
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
                
                <CanvasPerformanceGraph
                  graphData={graphData}
                  onNodeClick={onNodeClick}
                  onNodeHover={onNodeMouseEnter}
                  onNodeHoverEnd={onNodeMouseLeave}
                  currentNodeId={performanceState.currentNodeId}
                  hoveredNextMoveNodeId={performanceState.hoveredNextMoveNodeId}
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
                  onPlayerChange={setSelectedPlayer}
                  isGenerating={performanceState.isGenerating}
                  showPerformanceLegend={performanceState.showPerformanceLegend}
                  showPerformanceControls={performanceState.showPerformanceControls}
                  onShowPerformanceLegend={performanceState.setShowPerformanceLegend}
                  onShowPerformanceControls={performanceState.setShowPerformanceControls}
                  isClusteringLoading={false}
                  autoZoomOnClick={autoZoomOnClick}
                  onAutoZoomOnClickChange={handleAutoZoomOnClickChange}
                  className="w-full h-full"
                />
              </div>
            </LayoutSection>
          )
        }}
      </FlexibleLayout>
      
      {/* Single Consolidated Loading Overlay - Only show when generating or initial loading */}
      {(performanceState.isGenerating || (loading && (isSyncing || pendingAutoSync))) && (
        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-6"></div>
            <p className="text-slate-200 text-lg font-medium">
              {(loading && (isSyncing || pendingAutoSync)) ? 'Syncing Games' : 'Generating Performance Graph'}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              {(loading && (isSyncing || pendingAutoSync)) ? (syncStatus || 'Updating analysis...') : 'Processing your opening analysis...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformanceGraph() {
  return (
    <PerformanceGraphContent />
  );
}