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
  AppBar, 
  ComponentToggleButton, 
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
import { usePerformanceGraphState } from '../hooks/useCanvasState';
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
    console.log('🎬 PerformanceGraph component MOUNTED at', new Date().toISOString());
    
    return () => {
      console.log('💥 PerformanceGraph component UNMOUNTED at', new Date().toISOString());
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
  
  // Use shared performance graph state management
  const performanceState = usePerformanceGraphState({
    openingGraph: openingGraphRef.current,
    selectedPlayer,
    enableClustering: true,
    enablePositionClusters: true,
    enableAutoZoom: true
  });
  
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

  // Load opening graph data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Don't load if syncing is in progress OR if there's a pending auto-sync
        if (isSyncing || pendingAutoSync) {
          console.log('🔄 Skipping graph load - sync in progress or pending auto-sync');
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
        
        // Auto-detect user's primary playing color and set as default
        const overallStats = graph.getOverallStats();
        const whiteGames = overallStats.white?.totalGames || 0;
        const blackGames = overallStats.black?.totalGames || 0;
        
        // Set selectedPlayer to the color with more games (or white if equal)
        if (blackGames > whiteGames) {
          console.log(`🎯 Auto-detected primary color: black (${blackGames} games vs ${whiteGames} white games)`);
          setSelectedPlayer('black');
        } else if (whiteGames > 0) {
          console.log(`🎯 Auto-detected primary color: white (${whiteGames} games vs ${blackGames} black games)`);
          setSelectedPlayer('white');
        } else {
          console.log('🎯 No games found, keeping default white selection');
        }
        
        // Also set up opening moves with the same graph
        setOpeningGraph(graph);
        setMovesStats(overallStats);
        
      } catch (error) {
        console.error('Error loading opening graph:', error);
      } finally {
        // Only set loading false if not syncing
        if (!isSyncing) {
          setLoading(false);
        }
      }
    };
    
    loadData();
  }, [refreshTrigger, isSyncing, pendingAutoSync]); // Include isSyncing and pendingAutoSync as dependencies

  // Listen for custom refresh event from settings
  useEffect(() => {
    const handleRefresh = (event) => {
      console.log('🔄 PerformanceGraph received refresh event from settings', {
        detail: event?.detail,
        timestamp: new Date().toISOString()
      });
      
      // Add a visual indicator that refresh is happening
      console.log('🔄 Starting PerformanceGraph refresh...');
      
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
      
      // Force loading state to show immediately
      setLoading(true);
      
      // Trigger data reload
      setRefreshTrigger(prev => {
        console.log('📈 Incrementing refresh trigger from', prev, 'to', prev + 1);
        return prev + 1;
      });
      
      console.log('✅ PerformanceGraph state reset complete, data reload triggered');
    };

    console.log('🎧 PerformanceGraph setting up refresh event listener at', new Date().toISOString());
    window.addEventListener('refreshPerformanceGraph', handleRefresh);
    
    // Test that the listener is working
    console.log('🧪 Testing event listener setup - current listeners:', window._getEventListeners?.('refreshPerformanceGraph'));
    
    // Add test function to window for manual testing
    window.testPerformanceGraphRefresh = () => {
      console.log('🧪 Manual test: Dispatching refreshPerformanceGraph event');
      const event = new CustomEvent('refreshPerformanceGraph', { 
        detail: { source: 'manual-test', timestamp: Date.now() } 
      });
      const result = window.dispatchEvent(event);
      console.log('🧪 Manual test dispatch result:', result);
      return result;
    };
    console.log('💡 Test function added: Run window.testPerformanceGraphRefresh() in console to test refresh');
    
    return () => {
      console.log('🧹 PerformanceGraph cleaning up refresh event listener');
      window.removeEventListener('refreshPerformanceGraph', handleRefresh);
      delete window.testPerformanceGraphRefresh;
    };
  }, []); // Empty dependency array - set up only once

  // State for graph data
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], maxGameCount: 0 });
  
  // Immediately set loading state when parameters change (before graph generation)
  useEffect(() => {
    if (openingGraphRef.current && !loading && !initialLoad) {
      performanceState.setIsGenerating(true);
    }
  }, [selectedPlayer, performanceState.maxDepth, performanceState.minGameCount, performanceState.winRateFilter]);
  
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
        setIsGenerating(false);
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
      
      // Apply fallback logic that respects win rate filter and dataset size
      let finalRootMoves = filteredRootMoves;
      if (filteredRootMoves.length < 3 && rootMoves.length > 0) {
        // Calculate total games and max games in any move to determine if fallback should apply
        const maxGamesInAnyMove = Math.max(...rootMoves.map(m => m.gameCount || 0));
        
        // Apply different logic based on filter level:
        // - Low filters (1-5 games): Always show moves that meet win rate criteria
        // - High filters (10+ games): Only show if dataset is reasonable
        let shouldApplyFallback = false;
        
        if (performanceState.minGameCount <= 5) {
          // Low filter - always apply fallback for game count (user wants to see data)
          shouldApplyFallback = true;
        } else if (performanceState.minGameCount <= 20) {
          // Medium filter - apply fallback if there's reasonable data
          shouldApplyFallback = totalGames >= 50 || maxGamesInAnyMove >= 10;
        } else {
          // High filter - only apply fallback if there's substantial data
          shouldApplyFallback = totalGames >= 150 || maxGamesInAnyMove >= 30;
        }
        
        if (shouldApplyFallback) {
          // Check if it's a win rate filter issue vs game count issue
          const winRateFilteredRootMoves = rootMoves.filter(move => {
            const winRate = move.details?.winRate || move.winRate || 0;
            return winRate >= performanceState.winRateFilter[0] && winRate <= performanceState.winRateFilter[1];
          });
          
          if (winRateFilteredRootMoves.length === 0) {
            // No root moves meet win rate criteria - respect the filter
            finalRootMoves = [];
          } else if (winRateFilteredRootMoves.length < 3) {
            // Few moves meet win rate but not enough - show all that meet win rate
            finalRootMoves = winRateFilteredRootMoves;
          } else {
            // Enough moves meet win rate but not game count - apply fallback for game count only
            const sortedMoves = [...winRateFilteredRootMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0));
            finalRootMoves = sortedMoves.slice(0, Math.min(8, winRateFilteredRootMoves.length));
          }
        } else {
          // High filter on small dataset - respect the user's explicit filter choice
          console.log(`🔍 Small dataset (${totalGames} total games, max ${maxGamesInAnyMove} per move) - respecting ${performanceState.minGameCount}+ games filter`);
          finalRootMoves = [];
        }
      }
      
      if (finalRootMoves.length === 0) {
        console.warn('No root moves to display - filter too restrictive');
        
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
            
            // Apply filtering - but be more generous to go deeper
            const levelAdjustedMinGames = Math.max(1, Math.floor(performanceState.minGameCount / Math.pow(1.5, currentLevel - 1)));
            
            // Filter moves by game count AND win rate
            let validMoves = movesToGet.filter(move => {
              const gameCount = move.gameCount || 0;
              const winRate = move.details?.winRate || move.winRate || 0;
              return gameCount >= levelAdjustedMinGames && 
                     winRate >= performanceState.winRateFilter[0] && 
                     winRate <= performanceState.winRateFilter[1];
            });
            
            // Only apply fallback for game count filtering, NOT win rate filtering
            if (validMoves.length === 0 && movesToGet.length > 0) {
              // Calculate total games and max games in any move to determine if fallback should apply
              const totalGamesAtLevel = movesToGet.reduce((sum, move) => sum + (move.gameCount || 0), 0);
              const maxGamesInAnyMove = Math.max(...movesToGet.map(m => m.gameCount || 0));
              
              // Apply different logic based on filter level:
              // - Low filters (1-5 games): Always show moves that meet win rate criteria
              // - High filters (10+ games): Only show if dataset is reasonable
              let shouldApplyFallback = false;
              
              if (performanceState.minGameCount <= 5) {
                // Low filter - always apply fallback for game count (user wants to see data)
                shouldApplyFallback = true;
              } else if (performanceState.minGameCount <= 20) {
                // Medium filter - apply fallback if there's reasonable data at this level
                shouldApplyFallback = totalGamesAtLevel >= 20 || maxGamesInAnyMove >= 5;
              } else {
                // High filter - only apply fallback if there's substantial data at this level
                shouldApplyFallback = totalGamesAtLevel >= 50 || maxGamesInAnyMove >= 15;
              }
              
              if (shouldApplyFallback) {
                // Check if it's a win rate filter issue vs game count issue
                const winRateFilteredMoves = movesToGet.filter(move => {
                  const winRate = move.details?.winRate || move.winRate || 0;
                  return winRate >= performanceState.winRateFilter[0] && winRate <= performanceState.winRateFilter[1];
                });
                
                if (winRateFilteredMoves.length === 0) {
                  // No moves meet win rate criteria - respect the filter and show nothing
                  validMoves = [];
                } else {
                  // Some moves meet win rate but not game count - apply fallback for game count only
                  const sortedMoves = [...winRateFilteredMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0));
                  validMoves = sortedMoves.slice(0, Math.min(5, winRateFilteredMoves.length));
                }
              } else {
                // High filter on small dataset at this level - respect the user's explicit filter choice
                validMoves = [];
              }
            }
            
            // Limit breadth at deeper levels to prevent explosion but allow depth
            const maxMovesAtLevel = Math.max(3, Math.floor(8 / Math.sqrt(currentLevel)));
            if (validMoves.length > maxMovesAtLevel) {
              validMoves = [...validMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0))
                                        .slice(0, maxMovesAtLevel);
            }
            
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
              
              // Debug logging for Lichess win rates
              if (currentLevel === 1 && calculatedWinRate < 40) {
                console.log(`🔍 DEBUG Low win rate for ${move.san}: ${calculatedWinRate}% (${gameCount} games)`);
                console.log(`  - move.details:`, move.details);
                console.log(`  - move.winRate:`, move.winRate);
              }
              
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
        
        // Top-down position assignment
        const assignPositions = (nodeId, x, y, availableWidth) => {
          const treeNode = treeStructure.get(nodeId);
          const node = rawNodes.find(n => n.id === nodeId);
          
          if (!treeNode || !node) return;
          
          if (node.data.isRoot && treeNode.children.length > 0) {
            // Calculate the center position of all children
            let minChildX = Infinity;
            let maxChildX = -Infinity;
            let childXs = [];

            // First pass: position children to get their bounds
            const childY = y + LEVEL_HEIGHT;
            let currentX = -(availableWidth * NODE_SPACING) / 2;

            for (const childId of treeNode.children) {
              const childTreeNode = treeStructure.get(childId);
              const childNode = rawNodes.find(n => n.id === childId);
              if (childTreeNode && childNode) {
                const childWidth = childTreeNode.width * NODE_SPACING;
                const childCenterX = currentX + childWidth / 2;
                childXs.push(childCenterX);
                minChildX = Math.min(minChildX, childCenterX);
                maxChildX = Math.max(maxChildX, childCenterX);
                // Offset child so its center is at childCenterX
                assignPositions(childId, childCenterX - (childNode ? (parseInt(childNode.data.isRoot ? 200 : Math.round(180 * Math.min(1.8, 1 + (childNode.data.gameCount / 100)))) / 2) : 0), childY, childTreeNode.width);
                currentX += childWidth;
              }
            }

            // Center root node exactly above the first move (if only one), or average if multiple
            let rootCenterX = 0;
            if (childXs.length === 1) {
              rootCenterX = childXs[0];
            } else if (childXs.length > 1) {
              rootCenterX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
            }
            // Offset root so its center is at rootCenterX
            const rootNodeWidth = parseInt(node.data.isRoot ? 200 : Math.round(180 * Math.min(1.8, 1 + (node.data.gameCount / 100))));
            node.position = { x: rootCenterX - rootNodeWidth / 2, y };
          } else {
            // Position this node normally
            node.position = { x, y };
            
            // Position children
            if (treeNode.children.length > 0) {
              const childY = y + LEVEL_HEIGHT;
              let currentX = x - (availableWidth * NODE_SPACING) / 2;
              
              for (const childId of treeNode.children) {
                const childTreeNode = treeStructure.get(childId);
                if (childTreeNode) {
                  const childWidth = childTreeNode.width * NODE_SPACING;
                  const childCenterX = currentX + childWidth / 2;
                  
                  assignPositions(childId, childCenterX, childY, childTreeNode.width);
                  currentX += childWidth;
                }
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
      
      // Debug: Check layout bounds after calculation
      if (rawNodes.length > 0) {
        const bounds = rawNodes.reduce((acc, node) => ({
          minX: Math.min(acc.minX, node.position.x),
          maxX: Math.max(acc.maxX, node.position.x),
          minY: Math.min(acc.minY, node.position.y),
          maxY: Math.max(acc.maxY, node.position.y)
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
        
        console.log('🏗️ TREE LAYOUT BOUNDS:', {
          bounds,
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
          nodeCount: rawNodes.length
        });
      }
      
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
      
      console.log(`🔗 EDGE SUMMARY: ${rawEdges.length} raw edges -> ${cleanEdges.length} clean edges (${rawEdges.length - cleanEdges.length} removed)`);
      
      const validEdges = cleanEdges;
      

      
      const finalGraphData = { 
        nodes: validNodes, 
        edges: validEdges, 
        maxGameCount 
      };
      
      // Debug: Show win rate distribution for Lichess
      if (validNodes.length > 0) {
        const winRates = validNodes.map(n => n.data.winRate || 0);
        const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
        const minWinRate = Math.min(...winRates);
        const maxWinRate = Math.max(...winRates);
        
        const redNodes = winRates.filter(wr => wr < 40).length;
        const orangeNodes = winRates.filter(wr => wr >= 40 && wr < 50).length;
        const yellowNodes = winRates.filter(wr => wr >= 50 && wr < 60).length;
        const greenNodes = winRates.filter(wr => wr >= 60).length;
        
        console.log(`📊 WIN RATE DISTRIBUTION (${validNodes.length} nodes):`);
        console.log(`  - Average: ${avgWinRate.toFixed(1)}%`);
        console.log(`  - Range: ${minWinRate.toFixed(1)}% - ${maxWinRate.toFixed(1)}%`);
        console.log(`  - Red (<40%): ${redNodes} nodes`);
        console.log(`  - Orange (40-50%): ${orangeNodes} nodes`);
        console.log(`  - Yellow (50-60%): ${yellowNodes} nodes`);
        console.log(`  - Green (60%+): ${greenNodes} nodes`);
      }
      
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

  // Update nodes and edges when data changes
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      // Don't set nodes here - let the opening clustering effect handle it
      setEdges(graphData.edges);
      
      // Set initial current node to root if not already set
      if (!performanceState.currentNodeId) {
        const rootNode = graphData.nodes.find(node => node.data.isRoot);
        if (rootNode) {
          performanceState.updateCurrentPosition(rootNode.id, rootNode.data.fen);
        }
      }
      
      // Note: Canvas handles its own auto-fit timing internally
    }
  }, [graphData, setEdges]);

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

  // Handle node clicks
  const onNodeClick = (event, node) => {
    // Ignore cluster background nodes - they shouldn't trigger position changes
    if (node.type === 'clusterBackground') {
      return;
    }
    
    // Extract move sequence from node data
    const moveSequence = node.data.moveSequence || [];
    
    // Use shared chessboard sync to update position
    chessboardSync.syncMovesToChessboard(moveSequence);
    
    // Track currently selected node and position
    performanceState.updateCurrentPosition(node.id, node.data.fen);
    
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

  // Trigger layout updates for components when layout changes
  const triggerCanvasResize = () => {
    // Force window resize event to trigger chessboard recalculation
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  const toggleOpeningMoves = () => {
    setShowOpeningMoves(!showOpeningMoves);
    triggerCanvasResize();
  };

  const togglePositionAnalysis = () => {
    setShowPositionAnalysis(!showPositionAnalysis);
    triggerCanvasResize();
  };

  const togglePerformanceGraph = () => {
    const wasHidden = !showPerformanceGraph;
    setShowPerformanceGraph(!showPerformanceGraph);
    
    // Trigger resize to update chessboard when layout changes
    triggerCanvasResize();
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
      performanceState.updateCurrentPosition(targetNode.id, targetNode.data.fen);
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
    console.log('Moves next navigation - typically done by clicking moves');
  };

  const handleMovesReset = () => {
    const newPath = [];
    setMovesCurrentPath(newPath);
    chessboardSync.syncMovesToChessboard(newPath);
    
    // Update direct scroll function if available
    if (movesDirectScrollFn) {
      movesDirectScrollFn(newPath);
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
    analysis: showPositionAnalysis,
    graph: showPerformanceGraph
  };

  // Handle layout changes - memoized to prevent infinite re-renders
  const handleLayoutChange = useCallback((layoutData) => {
    setLayoutInfo(layoutData);
  }, []);

  if (loading && !isSyncing && !pendingAutoSync) {
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

        return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      
      {/* Header using AppBar */}
      <AppBar
        title="Performance Graph"
        icon={Target}
        rightControls={
          <>
            <ComponentToggleButton
              isActive={showOpeningMoves}
              onClick={toggleOpeningMoves}
              icon={Menu}
              label="Moves"
            />
            <ComponentToggleButton
              isActive={showPositionAnalysis}
              onClick={togglePositionAnalysis}
              icon={Grid3x3}
              label="Board"
            />
            <ComponentToggleButton
              isActive={showPerformanceGraph}
              onClick={togglePerformanceGraph}
              icon={Network}
              label="Graph"
            />
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
      />
      
      {/* Main Content using FlexibleLayout */}
      <FlexibleLayout
        components={componentVisibility}
        componentConfig={ComponentConfigs.performanceGraph}
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
              {openingGraph ? (
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
                    <p className="text-slate-400 text-xs">No data</p>
                    <p className="text-slate-500 text-xs">Import games</p>
                  </div>
                </div>
              )}
            </LayoutSection>
          ),
          
          analysis: (
            <LayoutSection
              key="analysis"
              noPadding={true}
              className="bg-slate-800/70"
            >
              <div className="h-full flex items-center justify-center p-2">
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
                  onFitView={performanceState.canvasState.onFitView}
                  onZoomToClusters={performanceState.canvasState.onZoomToClusters}
                  onZoomTo={performanceState.canvasState.onZoomTo}
                  onResizeStateChange={performanceState.canvasState.onResizeStateChange}
                  onInitializingStateChange={performanceState.canvasState.onInitializingStateChange}
                  maxDepth={performanceState.maxDepth}
                  minGameCount={performanceState.minGameCount}
                  winRateFilter={performanceState.winRateFilter}
                  tempWinRateFilter={performanceState.tempWinRateFilter}
                  onMaxDepthChange={performanceState.handleMaxDepthChange}
                  onMinGameCountChange={performanceState.handleMinGameCountChange}
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
                  className="w-full h-full"
                />

                {/* Graph Loading Overlay */}
                {loading && (
                  <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mb-4 mx-auto"></div>
                      <div className="text-slate-200 text-lg font-medium mb-2">
                        {(isSyncing || pendingAutoSync) ? 'Syncing Games' : 'Preparing Graph'}
                      </div>
                      <div className="text-slate-400 text-sm">
                        {(isSyncing || pendingAutoSync) ? (syncStatus || 'Updating analysis...') : 'Building performance analysis...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </LayoutSection>
          )
        }}
      </FlexibleLayout>
      
      {/* Global Loading Overlay */}
      {performanceState.isGenerating && (
        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-6"></div>
            <p className="text-slate-200 text-lg font-medium">Generating Performance Graph</p>
            <p className="text-slate-400 text-sm mt-2">Processing your opening analysis...</p>
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