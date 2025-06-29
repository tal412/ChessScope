import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import InteractiveChessboard from '../components/chess/InteractiveChessboard';
import ChunkVisualization from '../components/opening-tree/ChunkVisualization';
import ClusterOverlay from '../components/opening-tree/ClusterOverlay';
import CanvasPerformanceGraph from '../components/chess/CanvasPerformanceGraph';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  TreePine,
  Maximize2
} from 'lucide-react';
import { useChessboardSync } from '../hooks/useChessboardSync';
import { loadOpeningGraph } from '../api/graphStorage';



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

// Function to create position-based clusters for current position and ALL its descendants
const createPositionClusters = (nodes, currentFen) => {
  if (!nodes || nodes.length === 0 || !currentFen) return [];

  const clusters = [];
  
  // Find all nodes with the current FEN (transpositions) - EXCLUDE ROOT NODES
  const currentPositionNodes = nodes.filter(node => 
    node.data.fen === currentFen && !node.data.isRoot
  );
  
  if (currentPositionNodes.length === 0) return [];

  // For each instance of the current position, create a cluster with ALL its descendants
  currentPositionNodes.forEach((parentNode, clusterIndex) => {
    
    // Recursively find ALL descendants of this parent node
    const findAllDescendants = (ancestorNode, allNodes) => {
      const descendants = [];
      const ancestorMoves = ancestorNode.data.moveSequence || [];
      
      // Find all nodes that are descendants of this ancestor
      allNodes.forEach(candidateNode => {
        const candidateMoves = candidateNode.data.moveSequence || [];
        
        // Check if candidate is a descendant (longer sequence that starts with ancestor's moves)
        if (candidateMoves.length > ancestorMoves.length &&
            ancestorMoves.every((move, index) => move === candidateMoves[index])) {
          descendants.push(candidateNode);
        }
      });
      
      return descendants;
    };

    const descendantNodes = findAllDescendants(parentNode, nodes);

    // Create cluster whether there are descendants or not (for single leaf nodes too)
    const clusterNodes = [parentNode, ...descendantNodes];
    
    // Count immediate children for display
    const immediateChildren = descendantNodes.filter(childNode => {
      const parentMoves = parentNode.data.moveSequence || [];
      const childMoves = childNode.data.moveSequence || [];
      return childMoves.length === parentMoves.length + 1;
    });
    
    // Create appropriate cluster name based on whether it has descendants
    let clusterName;
    if (descendantNodes.length > 0) {
      clusterName = `Position ${clusterIndex + 1} (${immediateChildren.length} moves, ${descendantNodes.length} total nodes)`;
    } else {
      // Single leaf node - create cluster around just this position
      clusterName = `Leaf Position ${clusterIndex + 1} (single position)`;
    }
    
    clusters.push({
      id: `position-cluster-${clusterIndex}`,
      name: clusterName,
      parentNode: parentNode,
      childNodes: immediateChildren, // Immediate children for reference (empty for leaf nodes)
      descendantNodes: descendantNodes, // ALL descendants (empty for leaf nodes)
      allNodes: clusterNodes, // Just the parent node for leaf positions
      nodeCount: clusterNodes.length,
      type: 'position',
      isLeafCluster: descendantNodes.length === 0, // Flag to identify leaf clusters
      colorIndex: clusterIndex % 3 // Cycle through 3 colors for different transpositions
    });
  });

  return clusters;
};

// Helper function to find connected components in opening subgraphs
const findConnectedComponents = (nodes, nodeMap, childrenMap) => {
  const visited = new Set();
  const components = [];
  
  // DFS to find all nodes reachable from startNode through same-opening connections
  const dfs = (nodeId, component, targetOpening) => {
    if (visited.has(nodeId)) return;
    
    const node = nodeMap.get(nodeId);
    if (!node || (node.data.ecoOpeningName || 'Unknown Opening') !== targetOpening) return;
    
    visited.add(nodeId);
    component.push(node);
    
    // Visit children that have the same opening
    const children = childrenMap.get(nodeId) || [];
    children.forEach(childId => {
      const childNode = nodeMap.get(childId);
      if (childNode && (childNode.data.ecoOpeningName || 'Unknown Opening') === targetOpening) {
        dfs(childId, component, targetOpening);
      }
    });
    
    // Visit parent if it has the same opening
    const parentId = [...childrenMap.entries()].find(([_, children]) => children.includes(nodeId))?.[0];
    if (parentId) {
      const parentNode = nodeMap.get(parentId);
      if (parentNode && (parentNode.data.ecoOpeningName || 'Unknown Opening') === targetOpening) {
        dfs(parentId, component, targetOpening);
      }
    }
  };
  
  // Find connected components for each opening
  nodes.forEach(node => {
    if (visited.has(node.id)) return;
    
    const opening = node.data.ecoOpeningName || 'Unknown Opening';
    const component = [];
    dfs(node.id, component, opening);
    
    if (component.length > 0) {
      components.push(component);
    }
  });
  
  return components;
};

// Function to create opening-based node clusters using connected components
const createOpeningClusters = (nodes) => {
  if (!nodes || nodes.length === 0) return [];
  
  // Filter out root nodes
  const nonRootNodes = nodes.filter(node => !node.data.isRoot);
  if (nonRootNodes.length === 0) return [];
  
  // Build tree structure maps
  const nodeMap = new Map();
  const childrenMap = new Map();
  
  // Build node map and initialize children map
  nonRootNodes.forEach(node => {
    nodeMap.set(node.id, node);
    childrenMap.set(node.id, []);
  });
  
  // Build parent-child relationships
  nonRootNodes.forEach(node => {
    const nodeSequence = node.data.moveSequence || [];
    if (nodeSequence.length > 0) {
      const parentSequence = nodeSequence.slice(0, -1);
      
      // Find parent node
      const parentNode = nonRootNodes.find(n => {
        const parentSeq = n.data.moveSequence || [];
        return parentSeq.length === parentSequence.length &&
               parentSeq.every((move, index) => move === parentSequence[index]);
      });
      
      if (parentNode) {
        const parentChildren = childrenMap.get(parentNode.id) || [];
        parentChildren.push(node.id);
        childrenMap.set(parentNode.id, parentChildren);
      }
    }
  });
  
  // Find connected components where nodes can only be connected if they share the same opening
  // AND there's a direct tree path between them through nodes of the same opening
  const connectedComponents = findConnectedComponents(nonRootNodes, nodeMap, childrenMap);
  
  const clusters = [];
  let clusterIdCounter = 0;
  
  // Convert connected components to clusters
  connectedComponents.forEach(component => {
    if (component.length === 0) return;
    
    const opening = component[0].data.ecoOpeningName || 'Unknown Opening';
    
    // Group components by opening name to add branch numbers if needed
    const existingClustersForOpening = clusters.filter(c => c.openingName === opening);
    
    let clusterName = opening;
    if (existingClustersForOpening.length > 0) {
      clusterName += ` (Branch ${existingClustersForOpening.length + 1})`;
    }
    
    clusters.push({
      id: clusterIdCounter,
      name: clusterName,
      nodes: component,
      nodeCount: component.length,
      totalGames: component.reduce((sum, node) => sum + (node.data.gameCount || 0), 0),
      avgWinRate: component.reduce((sum, node) => sum + (node.data.winRate || 0), 0) / component.length,
      colorIndex: clusterIdCounter, // Each cluster gets its own color
      openingName: opening // Store original opening name
    });
    
    clusterIdCounter++;
  });
  
  // Sort clusters by node count (descending), then alphabetically
  clusters.sort((a, b) => {
    // First by node count (descending)
    if (b.nodeCount !== a.nodeCount) {
      return b.nodeCount - a.nodeCount;
    }
    // Then alphabetically by name
    return a.name.localeCompare(b.name);
  });
  
  return clusters;
};

// Main Performance Graph Component
function PerformanceGraphContent() {
  // Graph state for Canvas rendering
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState('white');
  const [maxDepth, setMaxDepth] = useState(20); // Default 20 moves depth
  const [minGameCount, setMinGameCount] = useState(20); // Default 20+ games
  const [performanceZones, setPerformanceZones] = useState([]);
  const [criticalPaths, setCriticalPaths] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null); // For position info dialog
  const [graphLoaded, setGraphLoaded] = useState(false); // Track when graph is loaded
  const [winRateFilter, setWinRateFilter] = useState([0, 100]); // [min, max] win rate filter (applied)
  const [tempWinRateFilter, setTempWinRateFilter] = useState([0, 100]); // [min, max] win rate filter (temporary)
  const [isGenerating, setIsGenerating] = useState(false); // Track graph generation
  const [initialLoad, setInitialLoad] = useState(true); // Track initial page load
  
  // Opening clustering state
  const [openingClusteringEnabled, setOpeningClusteringEnabled] = useState(false);
  const [openingClusters, setOpeningClusters] = useState([]);
  const [hoveredOpeningName, setHoveredOpeningName] = useState(null); // Hover state for ECO opening names
  const [hoveredClusterColor, setHoveredClusterColor] = useState(null); // Store the cluster color for hover tooltip
  
  // Chessboard integration state
  const [hoveredMove, setHoveredMove] = useState(null); // Track hovered move for arrows
  const [currentNodeId, setCurrentNodeId] = useState(null); // Track currently selected node
  // const [enableHoverArrows, setEnableHoverArrows] = useState(true); // Always enabled now
  const enableHoverArrows = true; // Always enabled
  
  // Position clustering state
  const [positionClusters, setPositionClusters] = useState([]); // Clusters for current position and its children
  const [currentPositionFen, setCurrentPositionFen] = useState(null); // Track current position FEN
  
  // UI visibility state - individual toggles for each component
  const [showPerformanceLegend, setShowPerformanceLegend] = useState(false);
  const [showPerformanceControls, setShowPerformanceControls] = useState(false);
  
  // Clustering UI state
  const [showClusteringControls, setShowClusteringControls] = useState(false); // Hide clustering controls by default
  const [showPositionClusters, setShowPositionClusters] = useState(true); // Show position clusters by default
  
  // Flexible Layout State - allows independent control of each component
  const [showOpeningTree, setShowOpeningTree] = useState(true); // Show opening tree
  const [showPositionAnalysis, setShowPositionAnalysis] = useState(true); // Show position analysis (chessboard)
  const [showPerformanceGraph, setShowPerformanceGraph] = useState(true); // Show performance graph
  
  // Legacy chessboard state (now handled by showPositionAnalysis)
  const showChessboard = showPositionAnalysis; // Backward compatibility
  
  // Opening Tree integration state
  const [openingGraph, setOpeningGraph] = useState(null); // Opening graph data
  const [treeStats, setTreeStats] = useState(null); // Tree statistics
  const [treeHoveredMove, setTreeHoveredMove] = useState(null); // Tree hovered move for arrows
  const [treeDirectScrollFn, setTreeDirectScrollFn] = useState(null); // Direct scroll function from tree
  const [hoveredNextMoveNodeId, setHoveredNextMoveNodeId] = useState(null); // Track hovered next move node
  const [treeCurrentPath, setTreeCurrentPath] = useState([]); // Persistent tree path state
  
  // Use shared chessboard sync hook
  const chessboardSync = useChessboardSync({
    nodes,
    onNodeSelect: (node) => {
      setSelectedNode(node);
      setCurrentNodeId(node?.id); // Update current position when chessboard changes
      setCurrentPositionFen(node?.data?.fen); // Update current position FEN for clustering
    },
    setNodes
  });

  const openingGraphRef = useRef(null);
  
  // Canvas fitView function reference
  const [canvasFitView, setCanvasFitView] = useState(null);
  
  // Canvas zoomToClusters function reference
  const [canvasZoomToClusters, setCanvasZoomToClusters] = useState(null);
  
  // Track zoom function availability
  useEffect(() => {
    // Auto-zoom function ready when available
  }, [canvasZoomToClusters]);
  


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

  // Load opening graph data
  useEffect(() => {
    const loadData = async () => {
      try {
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
        
        // Also set up opening tree with the same graph
        setOpeningGraph(graph);
        const overallStats = graph.getOverallStats();
        setTreeStats(overallStats);
        

        
      } catch (error) {
        console.error('Error loading opening graph:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // State for graph data
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], maxGameCount: 0 });
  
  // Immediately set loading state when parameters change (before graph generation)
  useEffect(() => {
    if (openingGraphRef.current && !loading && !initialLoad) {
      setIsGenerating(true);
    }
  }, [selectedPlayer, maxDepth, minGameCount, winRateFilter]);
  
  // Function to enrich nodes with opening cluster information and current position
  const enrichNodesWithOpeningClusters = (nodes, clusters) => {
    const baseEnrichedNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isCurrentPosition: node.id === currentNodeId, // Add current position info
        isHoveredNextMove: node.id === hoveredNextMoveNodeId, // Add hovered next move info
        openingClusteringEnabled: openingClusteringEnabled && clusters.length > 0,
        openingClusterId: undefined
      }
    }));

    if (!openingClusteringEnabled || clusters.length === 0) {
      return baseEnrichedNodes;
    }
    
    // Create node-to-cluster mapping
    const nodeToClusterMap = new Map();
    
    clusters.forEach((cluster, clusterIndex) => {
      cluster.nodes.forEach(node => {
        nodeToClusterMap.set(node.id, clusterIndex);
      });
    });
    
    // Enrich nodes with cluster information (for background shapes)
    return baseEnrichedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        openingClusteringEnabled: true,
        openingClusterId: nodeToClusterMap.get(node.id) ?? -1 // -1 for unclustered
      }
    }));
  };
  
  // Update position clusters when current position changes
  useEffect(() => {
    if (graphData.nodes.length > 0 && currentPositionFen) {
      const clusters = createPositionClusters(graphData.nodes, currentPositionFen);
      setPositionClusters(clusters);
    } else {
      setPositionClusters([]);
    }
  }, [graphData.nodes, currentPositionFen]);

  // Enhanced debounced auto-zoom with better error handling
  const autoZoomTimeoutRef = useRef(null);
  const [showZoomDebounceOverlay, setShowZoomDebounceOverlay] = useState(false);
  const lastPositionFenRef = useRef(null);

  // TEST: NO DEBOUNCE - immediate auto-zoom to test if root cause is truly fixed
  useEffect(() => {
    const positionChanged = currentPositionFen !== lastPositionFenRef.current;
    
    if (positionChanged) {
      // Update position tracking
      lastPositionFenRef.current = currentPositionFen;
    }
    
    // Immediate zoom - no debounce, no delay
    if (positionClusters.length > 0 && canvasZoomToClusters && showPerformanceGraph && positionChanged) {
      try {
        canvasZoomToClusters();
      } catch (error) {
        console.error('❌ Error executing immediate auto-zoom:', error);
      }
    }
    
    // Always hide overlay since we're not using debounce
    setShowZoomDebounceOverlay(false);
  }, [positionClusters, canvasZoomToClusters, showPerformanceGraph, currentPositionFen]);

  // Sync tree with chessboard moves
  useEffect(() => {
    if (treeDirectScrollFn && chessboardSync.currentMoves && showOpeningTree) {
      // Update tree to show current position - only when tree is visible
      setTimeout(() => {
        treeDirectScrollFn(chessboardSync.currentMoves);
      }, 100);
    }
  }, [chessboardSync.currentMoves, treeDirectScrollFn, showOpeningTree]);

  // Update opening clusters when graph data changes or clustering is toggled
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const clusters = createOpeningClusters(graphData.nodes);
      setOpeningClusters(clusters);
      
      // Update nodes with clustering information and current position
      const enrichedNodes = enrichNodesWithOpeningClusters(graphData.nodes, clusters);
      
      // Combine background nodes from both opening clusters and position clusters
      let allBackgroundNodes = [];
      
      // Add opening cluster backgrounds if enabled
      if (openingClusteringEnabled) {
        const openingBackgroundNodes = createClusterBackgroundNodes(
          enrichedNodes, 
          clusters,
          handleClusterHover,
          handleClusterHoverEnd
        );
        allBackgroundNodes = [...allBackgroundNodes, ...openingBackgroundNodes];
      }
      
      // Add position cluster backgrounds (when enabled and available)
      if (showPositionClusters && positionClusters.length > 0) {
        const positionBackgroundNodes = createPositionClusterBackgroundNodes(positionClusters);
        allBackgroundNodes = [...allBackgroundNodes, ...positionBackgroundNodes];
      }
      
      setNodes([...allBackgroundNodes, ...enrichedNodes]);
    }
  }, [graphData, openingClusteringEnabled, currentNodeId, hoveredNextMoveNodeId, positionClusters, showPositionClusters, setNodes]);
  
  // Async graph generation to prevent UI blocking
  useEffect(() => {
    const generateGraph = async () => {
      if (!openingGraphRef.current || loading) {
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
            openingName: loading ? 'Loading...' : 'Import games to see your opening tree',
            openingEco: '',
            ecoOpeningName: loading ? 'Loading...' : 'Import games to see your opening tree',
            isRoot: true,
            depth: 0,
            moveSequence: []
          }
        };
        setGraphData({ nodes: [noDataNode], edges: [], maxGameCount: 0 });
        setIsGenerating(false);
        return;
      }
      
      try {
      // Get root moves
      const rootMoves = openingGraphRef.current.getRootMoves(selectedPlayer === 'white');
      
      if (!rootMoves || rootMoves.length === 0) {
        console.warn(`No root moves found for ${selectedPlayer} - showing default empty tree`);
        // Return a default tree with just the root node so it's never completely empty
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
        return gameCount >= minGameCount && 
               winRate >= winRateFilter[0] && 
               winRate <= winRateFilter[1];
      });
      
      // Apply fallback logic that respects win rate filter
      let finalRootMoves = filteredRootMoves;
      if (filteredRootMoves.length < 3 && rootMoves.length > 0) {
        // Check if it's a win rate filter issue vs game count issue
        const winRateFilteredRootMoves = rootMoves.filter(move => {
          const winRate = move.details?.winRate || move.winRate || 0;
          return winRate >= winRateFilter[0] && winRate <= winRateFilter[1];
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
        setIsGenerating(false);
        return;
      }
      
      // Tree structure for proper layout
      const treeStructure = new Map(); // nodeId -> { children: [], parent: null, level: 0 }
      treeStructure.set(rootFen, { children: [], parent: null, level: 0, width: 0 });
      
      // Build the tree structure level by level - WORKING EXACTLY LIKE OPENING TREE
      const buildTreeLevel = (parentNodes, currentLevel) => {
        if (currentLevel >= maxDepth || parentNodes.length === 0) {
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
            const levelAdjustedMinGames = Math.max(1, Math.floor(minGameCount / Math.pow(1.5, currentLevel - 1)));
            
            // Filter moves by game count AND win rate
            let validMoves = movesToGet.filter(move => {
              const gameCount = move.gameCount || 0;
              const winRate = move.details?.winRate || move.winRate || 0;
              return gameCount >= levelAdjustedMinGames && 
                     winRate >= winRateFilter[0] && 
                     winRate <= winRateFilter[1];
            });
            
            // Only apply fallback for game count filtering, NOT win rate filtering
            if (validMoves.length === 0 && movesToGet.length > 0) {
              // Check if it's a win rate filter issue vs game count issue
              const winRateFilteredMoves = movesToGet.filter(move => {
                const winRate = move.details?.winRate || move.winRate || 0;
                return winRate >= winRateFilter[0] && winRate <= winRateFilter[1];
              });
              
              if (winRateFilteredMoves.length === 0) {
                // No moves meet win rate criteria - respect the filter and show nothing
                validMoves = [];
              } else {
                // Some moves meet win rate but not game count - apply fallback for game count only
                const sortedMoves = [...winRateFilteredMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0));
                validMoves = sortedMoves.slice(0, Math.min(5, winRateFilteredMoves.length));
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
              
              const childNode = {
                id: nodeId,
                type: 'chessPosition',
                position: { x: 0, y: 0 }, // Will be calculated later
                data: {
                  fen: move.toFen,
                  winRate: move.details?.winRate || move.winRate || 0,
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
      
      for (let level = 1; level <= maxDepth; level++) {
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
      
      // Set the graph data and clear generating state
      setGraphData(finalGraphData);
      setIsGenerating(false);
      
    } catch (error) {
      console.error('Error generating graph data:', error);
      setGraphData({ nodes: [], edges: [], maxGameCount: 0 });
      setIsGenerating(false);
    }
  };
  
  generateGraph();
}, [selectedPlayer, maxDepth, minGameCount, winRateFilter, loading, graphLoaded, initialLoad]);

  // Update nodes and edges when data changes
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      // Don't set nodes here - let the opening clustering effect handle it
      setEdges(graphData.edges);
      
      // Set initial current node to root if not already set
      if (!currentNodeId) {
        const rootNode = graphData.nodes.find(node => node.data.isRoot);
        if (rootNode) {
          setCurrentNodeId(rootNode.id);
          setCurrentPositionFen(rootNode.data.fen); // Set initial position FEN for clustering
        }
      }
      
      // Note: Canvas handles its own auto-fit timing internally
    }
  }, [graphData, setEdges]);

  // Simple cluster hover handlers
  const handleClusterHover = useCallback((clusterName, clusterColor) => {
    setHoveredOpeningName(clusterName);
    setHoveredClusterColor(clusterColor);
  }, []);

  const handleClusterHoverEnd = useCallback(() => {
    setHoveredOpeningName(null);
    setHoveredClusterColor(null);
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
    setCurrentNodeId(node.id);
    setCurrentPositionFen(node.data.fen); // Update position FEN for clustering
    
    // Don't open position dialog - it clashes with the chessboard
    // setSelectedNode(node);
  };

  // Optimized hover handlers with throttling
  const onNodeMouseEnter = useCallback((event, node) => {
    if (!enableHoverArrows || !currentNodeId) return; // Only show arrows if enabled and we have a current position
    
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return;
    
    const currentMoves = currentNode.data.moveSequence || [];
    const hoveredMoves = node.data.moveSequence || [];
    
    // Check if the hovered node is exactly one move ahead
    if (hoveredMoves.length === currentMoves.length + 1 && 
        currentMoves.every((move, index) => move === hoveredMoves[index])) {
      
      const nextMove = hoveredMoves[hoveredMoves.length - 1];
      
      // Create move data similar to opening tree format
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
  }, [enableHoverArrows, currentNodeId, nodes, graphData.maxGameCount]);

  // Handle node hover end
  const onNodeMouseLeave = useCallback((event, node) => {
    setHoveredMove(null);
  }, []);

  const handleReset = () => {
    canvasFitView?.();
  };

  // Position dialog removed - function kept for potential future use
  // const closePositionDialog = () => {
  //   setSelectedNode(null);
  // };

  const applyWinRateFilter = () => {
    setWinRateFilter([...tempWinRateFilter]);
  };

  // Canvas control handlers
  const handleMaxDepthChange = (newDepth) => {
    setMaxDepth(newDepth);
  };

  const handleMinGameCountChange = (newMinCount) => {
    setMinGameCount(newMinCount);
  };

  const handleWinRateFilterChange = (newFilter) => {
    setWinRateFilter(newFilter);
  };

  const handleTempWinRateFilterChange = (newTempFilter) => {
    setTempWinRateFilter(newTempFilter);
  };

  // Simplified canvas resize - DISABLED to prevent zoom conflicts
  const triggerCanvasResize = () => {
    // DISABLED - was causing multiple zoom operations during opening tree interactions
    // if (showPerformanceGraph && canvasFitView) {
    //   setTimeout(() => canvasFitView(), 300);
    // }
  };

  const toggleOpeningTree = () => {
    setShowOpeningTree(!showOpeningTree);
    triggerCanvasResize();
  };

  const togglePositionAnalysis = () => {
    setShowPositionAnalysis(!showPositionAnalysis);
    triggerCanvasResize();
  };

  const togglePerformanceGraph = () => {
    const wasHidden = !showPerformanceGraph;
    setShowPerformanceGraph(!showPerformanceGraph);
    
    // Simplified - let Canvas handle its own initial setup
  };

  // Legacy functions for backward compatibility
  const toggleChessboard = togglePositionAnalysis;

  // Toggle clustering features
  const toggleOpeningClustering = () => {
    setOpeningClusteringEnabled(!openingClusteringEnabled);
  };

  const togglePositionClusters = () => {
    setShowPositionClusters(!showPositionClusters);
  };



  // Tree integration handlers
  const handleTreeCurrentMovesChange = (moves) => {
    // Tree updates current moves - sync with performance graph
    
    // Store tree path persistently
    setTreeCurrentPath(moves);
    
    // Check if moves are actually different from current chessboard state
    const currentMoves = chessboardSync.currentMoves || [];
    const movesChanged = moves.length !== currentMoves.length ||
                        moves.some((move, index) => move !== currentMoves[index]);
    
    if (movesChanged) {
      // Update chessboard to reflect tree selection
      chessboardSync.syncMovesToChessboard(moves);
    }
    
    // Find corresponding node in the performance graph and update current position
    const targetNode = nodes.find(node => {
      const nodeMoves = node.data.moveSequence || [];
      return nodeMoves.length === moves.length && 
             nodeMoves.every((move, index) => move === moves[index]);
    });
    
    if (targetNode) {
      setCurrentNodeId(targetNode.id);
      setCurrentPositionFen(targetNode.data.fen);
    }
  };

  // Note: ChunkVisualization handles its own move selection internally
  // and calls onCurrentMovesChange when the path changes

  const handleTreeDirectScroll = (scrollFn) => {
    setTreeDirectScrollFn(() => scrollFn);
  };

  const handleTreeMoveHover = (moveData) => {
    setTreeHoveredMove(moveData);
    
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
        setHoveredNextMoveNodeId(hoveredNode.id);
      } else {
        setHoveredNextMoveNodeId(null);
      }
    } else {
      setHoveredNextMoveNodeId(null);
    }
  };

  const handleTreeMoveHoverEnd = () => {
    setTreeHoveredMove(null);
    setHoveredNextMoveNodeId(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-purple-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-lg"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-slate-200">Loading Performance Graph</h2>
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
    <div className="h-screen w-full bg-slate-900 grid grid-rows-[auto_1fr] overflow-hidden">
      
      {/* Header Controls - Fixed Height */}
      <header className="bg-slate-800/90 border-b border-slate-700/50 backdrop-blur-lg px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 h-12">
          
          {/* Left: Player Controls */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600">
                  <Crown className="w-4 h-4 mr-2" />
                  <span>{selectedPlayer === 'white' ? 'White' : 'Black'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuItem onClick={() => setSelectedPlayer('white')} className="text-slate-200 hover:bg-slate-700 hover:text-slate-200 focus:bg-slate-700 focus:text-slate-200">
                  <Crown className="w-4 h-4 mr-2 text-amber-400" />
                  White Perspective
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedPlayer('black')} className="text-slate-200 hover:bg-slate-700 hover:text-slate-200 focus:bg-slate-700 focus:text-slate-200">
                  <Shield className="w-4 h-4 mr-2 text-slate-400" />
                  Black Perspective
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right: View Toggle Controls */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm font-medium">Views:</span>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleOpeningTree}
              className={`${showOpeningTree ? 'bg-green-600 border-green-500 hover:bg-green-700' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'} text-slate-200 transition-colors`}
              title="Toggle Opening Tree"
            >
              <TreePine className="w-4 h-4 mr-2" />
              Tree
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={togglePositionAnalysis}
              className={`${showPositionAnalysis ? 'bg-blue-600 border-blue-500 hover:bg-blue-700' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'} text-slate-200 transition-colors`}
              title="Toggle Position Analysis"
            >
              <Brain className="w-4 h-4 mr-2" />
              Analysis
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={togglePerformanceGraph}
              className={`${showPerformanceGraph ? 'bg-red-600 border-red-500 hover:bg-red-700' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'} text-slate-200 transition-colors`}
              title="Toggle Performance Graph"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Graph
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content Grid - CSS Grid for perfect responsive layout */}
      <main 
        className="min-h-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          display: 'grid',
          gridTemplateColumns: [
            showOpeningTree && '20%',
            showPositionAnalysis && '30%', 
            showPerformanceGraph && '1fr'
          ].filter(Boolean).join(' ') || '1fr'
        }}
      >
          
                  {/* Global Loading Overlay */}
        {isGenerating && (
          <div className="col-span-full row-span-full bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-6"></div>
              <p className="text-slate-200 text-lg font-medium">Generating Performance Graph</p>
              <p className="text-slate-400 text-sm mt-2">Processing your opening analysis...</p>
            </div>
          </div>
        )}
        
        {/* Empty State when all components hidden */}
        {!showOpeningTree && !showPositionAnalysis && !showPerformanceGraph && (
          <div className="col-span-full row-span-full flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <Eye className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-300 mb-2">All Components Hidden</h3>
              <p className="text-slate-400 mb-4">Use the view controls above to show components.</p>
            </div>
          </div>
        )}
        
        {/* Opening Tree */}
        {showOpeningTree && (
          <section className="min-h-0 overflow-hidden border-r border-slate-700/50 bg-slate-800/50 backdrop-blur-xl grid grid-rows-[auto_1fr]">
            {/* Tree Header */}
            <header className="p-3 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-slate-200 font-semibold flex items-center gap-2 text-sm">
                  {selectedPlayer === 'white' ? (
                    <Crown className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-slate-400" />
                  )}
                  {selectedPlayer === 'white' ? 'White' : 'Black'} Tree
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleOpeningTree}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 h-6 w-6 p-0"
                  title="Hide opening tree"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
              </div>
              {treeStats && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>{treeStats[selectedPlayer]?.totalGames || 0} games</span>
                  <span>{treeStats[selectedPlayer]?.totalPositions || 0} pos</span>
                  <span>{(treeStats[selectedPlayer]?.winRate || 0).toFixed(1)}%</span>
                </div>
              )}
            </header>
            
            {/* Tree Content */}
            <div className="min-h-0 overflow-hidden p-2">
              {openingGraph ? (
                <ChunkVisualization
                  openingGraph={openingGraph}
                  isWhiteTree={selectedPlayer === 'white'}
                  onCurrentMovesChange={handleTreeCurrentMovesChange}
                  externalMoves={chessboardSync.currentMoves}
                  onMoveHover={handleTreeMoveHover}
                  onMoveHoverEnd={handleTreeMoveHoverEnd}
                  onDirectScroll={handleTreeDirectScroll}
                  initialPath={treeCurrentPath}
                  maxDepth={maxDepth}
                  minGameCount={minGameCount}
                  winRateFilter={winRateFilter}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-4">
                    <TreePine className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs">No data</p>
                    <p className="text-slate-500 text-xs">Import games</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        
        {/* Position Analysis */}
        {showPositionAnalysis && (
          <section className="min-h-0 overflow-hidden border-r border-slate-700/50 bg-slate-800/70 backdrop-blur-xl grid grid-rows-[auto_1fr]">
            {/* Analysis Header */}
            <header className="p-3 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-200 font-semibold flex items-center gap-2 text-sm">
                  <Brain className="w-4 h-4 text-blue-400" />
                  Position Analysis
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePositionAnalysis}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 h-6 w-6 p-0"
                  title="Hide position analysis"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </header>
            
            {/* Chessboard Content */}
            <div className="min-h-0 overflow-hidden flex items-center justify-center p-2">
              <InteractiveChessboard
                currentMoves={chessboardSync.currentMoves}
                onMoveSelect={chessboardSync.handleMoveSelect}
                onNewMove={chessboardSync.handleNewMove}
                isWhiteTree={selectedPlayer === 'white'}
                openingGraph={openingGraphRef.current}
                hoveredMove={treeHoveredMove || hoveredMove}
                className="w-full max-w-none"
              />
            </div>
          </section>
        )}

        {/* Performance Graph */}
        {showPerformanceGraph && (
          <section className="min-h-0 overflow-hidden bg-slate-900 relative">
            {/* Zoom Debounce Overlay */}
            {showZoomDebounceOverlay && (
              <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-none">
                <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg border border-blue-500">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
                    <span className="font-medium">Auto-zoom scheduled</span>
                  </div>
                  <p className="text-blue-200 text-sm mt-1">Will zoom to position in 1.2s (waiting for clicks to stop)</p>
                </div>
              </div>
            )}
            
            <CanvasPerformanceGraph
              graphData={graphData}
              onNodeClick={onNodeClick}
              onNodeHover={onNodeMouseEnter}
              onNodeHoverEnd={onNodeMouseLeave}
              currentNodeId={currentNodeId}
              hoveredNextMoveNodeId={hoveredNextMoveNodeId}
              openingClusters={openingClusters}
              positionClusters={positionClusters}
              showOpeningClusters={openingClusteringEnabled}
              showPositionClusters={showPositionClusters}
              onToggleOpeningClusters={toggleOpeningClustering}
              onTogglePositionClusters={togglePositionClusters}
              onClusterHover={handleClusterHover}
              onClusterHoverEnd={handleClusterHoverEnd}
              onFitView={setCanvasFitView}
              onZoomToClusters={setCanvasZoomToClusters}
              maxDepth={maxDepth}
              minGameCount={minGameCount}
              winRateFilter={winRateFilter}
              tempWinRateFilter={tempWinRateFilter}
              onMaxDepthChange={handleMaxDepthChange}
              onMinGameCountChange={handleMinGameCountChange}
              onWinRateFilterChange={handleWinRateFilterChange}
              onTempWinRateFilterChange={handleTempWinRateFilterChange}
              onApplyWinRateFilter={applyWinRateFilter}
              selectedPlayer={selectedPlayer}
              onPlayerChange={setSelectedPlayer}
              isGenerating={isGenerating}
              showPerformanceLegend={showPerformanceLegend}
              showPerformanceControls={showPerformanceControls}
              onShowPerformanceLegend={setShowPerformanceLegend}
              onShowPerformanceControls={setShowPerformanceControls}
              isClusteringLoading={false}
              className="w-full h-full"
            />

            {/* Graph Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mb-4 mx-auto"></div>
                  <div className="text-slate-200 text-lg font-medium mb-2">Preparing Graph</div>
                  <div className="text-slate-400 text-sm">Building performance analysis...</div>
                </div>
              </div>
            )}
          </section>
        )}
        
      </main>
    </div>
  );
}

export default function PerformanceGraph() {
  return (
    <PerformanceGraphContent />
  );
}