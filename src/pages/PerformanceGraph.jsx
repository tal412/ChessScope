import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ReactFlow, useNodesState, useEdgesState, MiniMap, Background, Panel, useReactFlow, useViewport, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import InteractiveChessboard from '../components/chess/InteractiveChessboard';
import ChunkVisualization from '../components/opening-tree/ChunkVisualization';
import ClusterOverlay from '../components/opening-tree/ClusterOverlay';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ReactFlowProvider } from '@xyflow/react';
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

// Chess Position Node Component - OPTIMIZED FOR PERFORMANCE
const ChessPositionNode = ({ data, selected, id }) => {
  // Validate data and provide fallbacks
  const winRate = isNaN(data.winRate) ? 50 : data.winRate;
  const gameCount = isNaN(data.gameCount) ? 0 : data.gameCount;
  
  // Always use performance-based colors (no opening cluster coloring)
  const colorData = getPerformanceData(winRate, gameCount);
  
  const isRoot = data.isRoot || false;
  const isCurrentPosition = data.isCurrentPosition || false; // Check if this is the current position from data
  const isHoveredNextMove = data.isHoveredNextMove || false; // Check if this is the hovered next move from tree
  
  // Size based on importance - BIGGER NODES FOR BETTER READABILITY
  const baseSize = 140; // Uniform node size for all
  const sizeMultiplier = 1; // Uniform size for all nodes
  const finalSize = Math.round(baseSize * sizeMultiplier);
  
  return (
    <div className="relative">
      {/* Connection handles - BIGGER */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ 
          background: colorData.border,
          width: 20, 
          height: 20, 
          border: '2px solid #334155',
          borderRadius: '50%'
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ 
          background: colorData.border,
          width: 20, 
          height: 20, 
          border: '2px solid #334155',
          borderRadius: '50%'
        }}
      />
      
      {/* Main node container - BIGGER */}
      <div
        className={`relative rounded-xl transition-all duration-200 cursor-pointer border-4 ${
          selected ? 'ring-4 ring-blue-400 ring-opacity-100 border-blue-400' : ''
        } ${
          isCurrentPosition ? 'ring-8 ring-green-400 ring-opacity-100 border-green-400' : ''
        } ${
          isHoveredNextMove ? 'ring-8 ring-orange-400 ring-opacity-100 border-orange-400' : ''
        }`}
        style={{
          width: `${finalSize}px`,
          height: `${finalSize}px`,
          backgroundColor: colorData.bg,
          borderColor: colorData.border,
          boxShadow: isCurrentPosition 
            ? `0 0 60px rgba(34, 197, 94, 1), 0 0 120px rgba(34, 197, 94, 0.9), 0 0 200px rgba(34, 197, 94, 0.8), 0 0 300px rgba(34, 197, 94, 0.6), 0 0 500px rgba(34, 197, 94, 0.4)` 
            : isHoveredNextMove
              ? `0 0 60px rgba(251, 146, 60, 1), 0 0 120px rgba(251, 146, 60, 0.9), 0 0 200px rgba(251, 146, 60, 0.8), 0 0 300px rgba(251, 146, 60, 0.6), 0 0 500px rgba(251, 146, 60, 0.4)`
              : selected 
                ? `0 0 40px ${colorData.border}, 0 0 80px ${colorData.border}80, 0 0 150px ${colorData.border}60, 0 0 250px ${colorData.border}40` 
                : `0 4px 8px rgba(0,0,0,0.3)`,
          animation: (isCurrentPosition || isHoveredNextMove) 
            ? 'pulse-glow 2s ease-in-out infinite alternate' 
            : undefined
        }}
      >

        {/* Content - MUCH LARGER TEXT */}
        <div className="h-full flex flex-col items-center justify-center p-3 text-center">
          {isRoot ? (
            <>
              <div 
                className="text-2xl font-bold mb-2"
                style={{ color: colorData.text, fontSize: '24px', lineHeight: '1.2' }}
              >
                START
              </div>
              <div 
                className="text-sm font-medium px-2 py-1 rounded bg-black/20"
                style={{ color: colorData.text, fontSize: '14px' }}
              >
                {gameCount}g
              </div>
            </>
          ) : (
            <>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: colorData.text, fontSize: '28px', lineHeight: '1.1' }}
              >
                {data.san || '?'}
              </div>
              
              {/* ECO Code - Small badge */}
              {data.openingEco && (
              <div 
                  className="text-xs font-bold mb-2 px-1 py-0.5 rounded bg-black/30"
                  style={{ color: colorData.text, fontSize: '11px', fontWeight: '700' }}
                >
                  {data.openingEco}
                </div>
              )}
              
              {/* Always show performance info */}
              <>
              <div 
                className="text-sm font-bold mb-1 px-2 py-1 rounded bg-black/20"
                  style={{ color: colorData.text, fontSize: '16px', fontWeight: '800' }}
              >
                {winRate.toFixed(0)}%
              </div>
              
              <div 
                className="text-sm opacity-90"
                  style={{ color: colorData.text, fontSize: '13px' }}
              >
                {gameCount}g
              </div>
              </>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Chess Edge Component - PERFORMANCE OPTIMIZED
const ChessEdge = ({ id, sourceX, sourceY, targetX, targetY, data }) => {
  // Validate coordinates
  const safeSourceX = isNaN(sourceX) || !isFinite(sourceX) ? 0 : sourceX;
  const safeSourceY = isNaN(sourceY) || !isFinite(sourceY) ? 0 : sourceY;
  const safeTargetX = isNaN(targetX) || !isFinite(targetX) ? 100 : targetX;
  const safeTargetY = isNaN(targetY) || !isFinite(targetY) ? 100 : targetY;
  
  if (safeSourceX === safeTargetX && safeSourceY === safeTargetY) {
    return null;
  }
  
  const perfData = getPerformanceData(data.winRate || 0, data.gameCount || 0);
  
  // Thicker edges for improved visibility
  const thickness = Math.max(4, Math.min(12, 4 + (data.gameCount / 25)));
  
  // Calculate midpoint for label
  const midX = (safeSourceX + safeTargetX) / 2;
  const midY = (safeSourceY + safeTargetY) / 2;
  
  return (
    <g>
      {/* Simple path - NO GRADIENTS */}
      <path
        d={`M${safeSourceX},${safeSourceY} L${safeTargetX},${safeTargetY}`}
        stroke={perfData.border}
        strokeWidth={thickness}
        fill="none"
        strokeOpacity={0.8}
        strokeLinecap="round"
        markerEnd="url(#arrowhead)"
      />
      
      {/* Move labels removed for cleaner look */}
    </g>
  );
};

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

    if (descendantNodes.length > 0) {
      // Create cluster with parent and ALL its descendants
      const clusterNodes = [parentNode, ...descendantNodes];
      
      // Count immediate children for display
      const immediateChildren = descendantNodes.filter(childNode => {
        const parentMoves = parentNode.data.moveSequence || [];
        const childMoves = childNode.data.moveSequence || [];
        return childMoves.length === parentMoves.length + 1;
      });
      
      clusters.push({
        id: `position-cluster-${clusterIndex}`,
        name: `Position ${clusterIndex + 1} (${immediateChildren.length} moves, ${descendantNodes.length} total nodes)`,
        parentNode: parentNode,
        childNodes: immediateChildren, // Immediate children for reference
        descendantNodes: descendantNodes, // ALL descendants
        allNodes: clusterNodes,
        nodeCount: clusterNodes.length,
        type: 'position',
        colorIndex: clusterIndex % 3 // Cycle through 3 colors for different transpositions
      });
    }
  });

  return clusters;
};

// Function to create opening-based node clusters with distinct colors
const createOpeningClusters = (nodes) => {
  if (!nodes || nodes.length === 0) return [];
  
  // Group nodes by opening name
  const openingGroups = new Map();
  
  nodes.forEach(node => {
    if (node.data.isRoot) return; // Skip root node
    
    const ecoOpeningName = node.data.ecoOpeningName || 'Unknown Opening';
    // Use ECO + Opening Name for precise clustering (e.g., "C20 King's Pawn Game")
    
    if (!openingGroups.has(ecoOpeningName)) {
      openingGroups.set(ecoOpeningName, []);
    }
    openingGroups.get(ecoOpeningName).push(node);
  });
  
  // Include all clusters (even single nodes)
  const filteredGroups = new Map();
  openingGroups.forEach((clusterNodes, ecoOpeningName) => {
    if (clusterNodes.length >= 1) {
      filteredGroups.set(ecoOpeningName, clusterNodes);
    }
  });
  
  // Get all opening names for consistent color assignment (still alphabetical for color consistency)
  const allOpeningNames = Array.from(filteredGroups.keys()).sort();
  
  // Convert to array and sort by node count first, then alphabetically
  const clusters = Array.from(filteredGroups.entries())
    .map(([ecoOpeningName, clusterNodes]) => ({
      id: allOpeningNames.indexOf(ecoOpeningName),
      name: ecoOpeningName,
      nodes: clusterNodes,
      nodeCount: clusterNodes.length,
      totalGames: clusterNodes.reduce((sum, node) => sum + (node.data.gameCount || 0), 0),
      avgWinRate: clusterNodes.reduce((sum, node) => sum + (node.data.winRate || 0), 0) / clusterNodes.length,
      colorIndex: getOpeningColorIndex(ecoOpeningName, allOpeningNames) // Distinct color for each opening
    }))
    .sort((a, b) => {
      // First sort by node count (descending)
      if (b.nodeCount !== a.nodeCount) {
        return b.nodeCount - a.nodeCount;
      }
      // Then sort alphabetically by name (ascending)
      return a.name.localeCompare(b.name);
    });
  
  return clusters; // Show all clusters (including single nodes)
};

// Main Performance Graph Component
function PerformanceGraphContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState('white');
  const [maxDepth, setMaxDepth] = useState(20); // Default 20 moves depth
  const [minGameCount, setMinGameCount] = useState(5); // Default 5+ games
  const [performanceZones, setPerformanceZones] = useState([]);
  const [criticalPaths, setCriticalPaths] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null); // For position info dialog
  const [graphLoaded, setGraphLoaded] = useState(false); // Track when graph is loaded
  const [winRateFilter, setWinRateFilter] = useState([0, 100]); // [min, max] win rate filter (applied)
  const [tempWinRateFilter, setTempWinRateFilter] = useState([0, 100]); // [min, max] win rate filter (temporary)
  const [isGenerating, setIsGenerating] = useState(false); // Track graph generation
  const [isReady, setIsReady] = useState(false); // Track when everything is ready to show
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
  const [openingTreeWidth, setOpeningTreeWidth] = useState(280); // Opening tree panel width
  const [positionAnalysisWidth, setPositionAnalysisWidth] = useState(350); // Position analysis panel width
  
  // Legacy chessboard state (now handled by showPositionAnalysis)
  const showChessboard = showPositionAnalysis; // Backward compatibility
  const chessboardWidth = positionAnalysisWidth; // Backward compatibility
  
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
      console.log('🎯 Node selected via chessboard sync:', node);
      setSelectedNode(node);
      setCurrentNodeId(node?.id); // Update current position when chessboard changes
      setCurrentPositionFen(node?.data?.fen); // Update current position FEN for clustering
    },
    setNodes
  });

  // Memoize node types to prevent React Flow performance warnings - stable reference
  const nodeTypes = useMemo(() => ({
    chessPosition: ChessPositionNode,
    clusterBackground: ClusterBackgroundNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    chessMove: ChessEdge,
  }), []);
  
  const { fitView } = useReactFlow();
  const viewport = useViewport();
  const openingGraphRef = useRef(null);

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
        setIsReady(false); // Reset ready state
        
        // Also set up opening tree with the same graph
        setOpeningGraph(graph);
        const overallStats = graph.getOverallStats();
        setTreeStats(overallStats);
        
        console.log('📈 Loaded opening graph with', 
          openingGraphRef.current.whiteGraph.nodes.size, 'white positions and',
          openingGraphRef.current.blackGraph.nodes.size, 'black positions'
        );
        
        console.log('🌳 Opening tree stats:', overallStats);
        
        // Debug: check if we can get root moves
        console.log('🔍 Debug - Testing root moves for white:', openingGraphRef.current.getRootMoves(true));
        console.log('🔍 Debug - Testing root moves for black:', openingGraphRef.current.getRootMoves(false));
        
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
      setIsReady(false);
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
      console.log('🎯 Position clusters created:', clusters);
    } else {
      setPositionClusters([]);
    }
  }, [graphData.nodes, currentPositionFen]);

  // Sync tree with chessboard moves
  useEffect(() => {
    if (treeDirectScrollFn && chessboardSync.currentMoves && showOpeningTree) {
      // Update tree to show current position - only when tree is visible
      console.log('🌳 Syncing tree with chessboard moves:', chessboardSync.currentMoves);
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
      console.log('🔄 GraphData recalculating...', {
        hasGraph: !!openingGraphRef.current,
        loading,
        selectedPlayer,
        maxDepth,
        minGameCount
      });
      
      if (!openingGraphRef.current || loading) {
        console.log('🚨 No opening graph available or still loading - showing default node');
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
      console.log(`🎯 Root moves for ${selectedPlayer}:`, rootMoves);
      
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
      
      // Tree layout configuration - optimized for BIGGER NODES
      const LEVEL_HEIGHT = 350; // Even larger spacing for bigger nodes
      const NODE_SPACING = 200; // More horizontal spacing for bigger nodes
      
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
        console.log(`🔍 Root move ${move.san}: games=${gameCount}, winRate=${winRate}%, filter=[${winRateFilter[0]}%-${winRateFilter[1]}%]`);
        return gameCount >= minGameCount && 
               winRate >= winRateFilter[0] && 
               winRate <= winRateFilter[1];
      });
      
      console.log(`🎯 Root moves after filtering: ${filteredRootMoves.length}/${rootMoves.length} (min ${minGameCount} games, win rate ${winRateFilter[0]}%-${winRateFilter[1]}%)`);
      
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
          console.log(`🚫 No root moves meet win rate filter [${winRateFilter[0]}%-${winRateFilter[1]}%] - respecting filter`);
          finalRootMoves = [];
        } else if (winRateFilteredRootMoves.length < 3) {
          // Few moves meet win rate but not enough - show all that meet win rate
          console.log(`🔧 Only ${winRateFilteredRootMoves.length} root moves meet win rate filter - showing all of them`);
          finalRootMoves = winRateFilteredRootMoves;
        } else {
          // Enough moves meet win rate but not game count - apply fallback for game count only
          console.log(`🔧 Root moves don't meet min games criteria ${minGameCount}, but ${winRateFilteredRootMoves.length} meet win rate filter - taking top moves within win rate range`);
          const sortedMoves = [...winRateFilteredRootMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0));
          finalRootMoves = sortedMoves.slice(0, Math.min(8, winRateFilteredRootMoves.length));
        }
      }
      
      console.log(`🎯 Final root moves: ${finalRootMoves.length}/${rootMoves.length} (min ${minGameCount} games)`);
      
      if (finalRootMoves.length === 0) {
        console.warn('No root moves to display - filter too restrictive');
        
        // Show alert message to user
        alert(`No moves match your current filters:\n• Minimum ${minGameCount} games\n• Win rate between ${winRateFilter[0]}% and ${winRateFilter[1]}%\n\nTry adjusting your filters to see results.`);
        
        // Return just the root node
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
              console.log(`🔧 Getting moves for level ${currentLevel}, sequence:`, moveSequence);
              
              // Use the EXACT same method as ChunkVisualization
              movesToGet = openingGraphRef.current.getMovesFromPosition(
                moveSequence, 
                selectedPlayer === 'white'
              );
              
              console.log(`🔧 Got ${movesToGet.length} moves for sequence [${moveSequence.join(' ')}]`);
            }
            
            if (!movesToGet || movesToGet.length === 0) {
              console.log(`🔧 No moves available for level ${currentLevel}, parent: ${parentNode.id}`);
              continue;
            }
            
            // Apply filtering - but be more generous to go deeper
            const levelAdjustedMinGames = Math.max(1, Math.floor(minGameCount / Math.pow(1.5, currentLevel - 1)));
            
            // Filter moves by game count AND win rate
            let validMoves = movesToGet.filter(move => {
              const gameCount = move.gameCount || 0;
              const winRate = move.details?.winRate || move.winRate || 0;
              console.log(`🔍 Filtering move ${move.san}: games=${gameCount}, winRate=${winRate}%, filter=[${winRateFilter[0]}%-${winRateFilter[1]}%]`);
              return gameCount >= levelAdjustedMinGames && 
                     winRate >= winRateFilter[0] && 
                     winRate <= winRateFilter[1];
            });
            
            console.log(`🎯 Win rate filter [${winRateFilter[0]}%-${winRateFilter[1]}%] result: ${validMoves.length}/${movesToGet.length} moves passed`);
            
            // Only apply fallback for game count filtering, NOT win rate filtering
            if (validMoves.length === 0 && movesToGet.length > 0) {
              // Check if it's a win rate filter issue vs game count issue
              const winRateFilteredMoves = movesToGet.filter(move => {
                const winRate = move.details?.winRate || move.winRate || 0;
                return winRate >= winRateFilter[0] && winRate <= winRateFilter[1];
              });
              
              if (winRateFilteredMoves.length === 0) {
                // No moves meet win rate criteria - respect the filter and show nothing
                console.log(`🚫 No moves meet win rate filter [${winRateFilter[0]}%-${winRateFilter[1]}%] - respecting filter`);
                validMoves = [];
              } else {
                // Some moves meet win rate but not game count - apply fallback for game count only
                console.log(`🔧 No moves meet min games criteria ${levelAdjustedMinGames}, but ${winRateFilteredMoves.length} meet win rate filter - taking top moves within win rate range`);
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
            
            console.log(`🎯 Level ${currentLevel}: Showing ${validMoves.length} moves (min games: ${levelAdjustedMinGames})`);
            
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
                console.log(`🔧 Skipping duplicate node: ${nodeId}`);
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
              
              // Add edge
              rawEdges.push({
                id: `${parentNode.id}-${nodeId}`,
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
      
      console.log(`🚀 Starting DEEP tree build with max depth: ${maxDepth}, min games: ${minGameCount}`);
      
      for (let level = 1; level <= maxDepth; level++) {
        console.log(`🌳 Building level ${level}/${maxDepth} with ${currentLevelNodes.length} parents`);
        const nextLevelNodes = buildTreeLevel(currentLevelNodes, level);
        
        if (nextLevelNodes.length === 0) {
          console.log(`🛑 No more nodes at level ${level}, stopping tree build`);
          break;
        }
        
        currentLevelNodes = nextLevelNodes;
        console.log(`📊 Level ${level} complete: ${nextLevelNodes.length} nodes`);
        
        // Log detailed info about the moves at this level
        if (nextLevelNodes.length > 0) {
          const sampleNode = nextLevelNodes[0];
          console.log(`🎯 Sample move sequence at level ${level}: [${sampleNode.moveSequence.join(' ')}]`);
          console.log(`🎯 Sample node games: ${sampleNode.data.gameCount}, winRate: ${sampleNode.data.winRate}%`);
        }
      }
      
      console.log(`🏁 Tree building complete! Final depth achieved: ${Math.max(...rawNodes.map(n => n.data.depth))}`);
      
      // BRANCH TRIMMING: Remove single-game branches, keep only first move
      const trimSingleGameBranches = () => {
        console.log(`✂️ Starting branch trimming...`);
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
        
        console.log(`✂️ Branch trimming complete: Removed ${originalNodeCount - rawNodes.length} nodes and ${originalEdgeCount - rawEdges.length} edges`);
        console.log(`📊 Trimmed tree: ${rawNodes.length} nodes, ${rawEdges.length} edges remaining`);
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
                assignPositions(childId, childCenterX - (childNode ? (parseInt(childNode.data.isRoot ? 160 : Math.round(140 * Math.min(1.8, 1 + (childNode.data.gameCount / 100)))) / 2) : 0), childY, childTreeNode.width);
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
            const rootNodeWidth = parseInt(node.data.isRoot ? 160 : Math.round(140 * Math.min(1.8, 1 + (node.data.gameCount / 100))));
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
      
      // Validate coordinates
      const validNodes = rawNodes.filter(node => {
        const hasValidCoords = !isNaN(node.position.x) && !isNaN(node.position.y) && 
                             isFinite(node.position.x) && isFinite(node.position.y);
        if (!hasValidCoords) {
          console.warn('Invalid node coordinates:', node);
        }
        return hasValidCoords;
      });
      
      const validEdges = rawEdges.filter(edge => {
        const sourceExists = validNodes.some(n => n.id === edge.source);
        const targetExists = validNodes.some(n => n.id === edge.target);
        return sourceExists && targetExists;
      });
      
      console.log(`🌳 Generated TREE layout with ${validNodes.length} nodes and ${validEdges.length} edges`);
      console.log(`🎯 Tree depth: ${Math.max(...validNodes.map(n => n.data.depth))}, Max games: ${maxGameCount}`);
      
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
      
      // Fit view after a short delay and then mark as ready
      setTimeout(() => {
        fitView({ padding: 0.05, duration: 800 });
        // Mark as ready after the animation completes
        setTimeout(() => {
          setIsReady(true);
        }, 900); // 800ms animation + 100ms buffer
      }, 100);
    }
  }, [graphData, setEdges, fitView]);

  // Simple cluster hover handlers with zoom threshold
  const handleClusterHover = useCallback((clusterName, clusterColor) => {
    // Only show cluster hover when zoomed out (zoom < 0.6)
    if (viewport.zoom >= 0.6) return;
    
    setHoveredOpeningName(clusterName);
    setHoveredClusterColor(clusterColor);
  }, [viewport.zoom]);

  const handleClusterHoverEnd = useCallback(() => {
    setHoveredOpeningName(null);
    setHoveredClusterColor(null);
  }, []);

  // Handle node clicks
  const onNodeClick = (event, node) => {
    console.log('🔍 Node clicked:', node);
    
    // Ignore cluster background nodes - they shouldn't trigger position changes
    if (node.type === 'clusterBackground') {
      return;
    }
    
    // Extract move sequence from node data
    const moveSequence = node.data.moveSequence || [];
    console.log('🎯 Setting chessboard to moves:', moveSequence);
    
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
    fitView({ padding: 0.05, duration: 800 });
  };

  // Position dialog removed - function kept for potential future use
  // const closePositionDialog = () => {
  //   setSelectedNode(null);
  // };

  const applyWinRateFilter = () => {
    setWinRateFilter([...tempWinRateFilter]);
  };

  // Flexible Layout Controls
  const togglePositionAnalysis = () => {
    const wasHidden = !showPositionAnalysis;
    setShowPositionAnalysis(!showPositionAnalysis);
    
    // Reset graph view when showing position analysis
    if (wasHidden && showPerformanceGraph) {
      setTimeout(() => {
        fitView({ padding: 0.05, duration: 800 });
      }, 100);
    }
  };

  const togglePerformanceGraph = () => {
    const wasHidden = !showPerformanceGraph;
    setShowPerformanceGraph(!showPerformanceGraph);
    
    // Reset graph view when showing performance graph
    if (wasHidden) {
      setTimeout(() => {
        fitView({ padding: 0.05, duration: 800 });
      }, 100);
    }
  };

  const adjustPositionAnalysisWidth = (delta) => {
    setPositionAnalysisWidth(prev => Math.max(300, Math.min(600, prev + delta)));
  };

  // Legacy functions for backward compatibility
  const toggleChessboard = togglePositionAnalysis;
  const adjustChessboardWidth = adjustPositionAnalysisWidth;

  // Toggle opening clustering
  const toggleOpeningClustering = () => {
    setOpeningClusteringEnabled(!openingClusteringEnabled);
  };

  // Toggle position clustering
  const togglePositionClusters = () => {
    setShowPositionClusters(!showPositionClusters);
  };

  // Toggle opening tree
  const toggleOpeningTree = () => {
    setShowOpeningTree(!showOpeningTree);
    // Reset ReactFlow view position after tree toggle to fit the new layout
    setTimeout(() => {
      fitView({ padding: 0.05, duration: 800 });
    }, 100); // Small delay to allow layout to update
  };

  const adjustOpeningTreeWidth = (delta) => {
    const newWidth = Math.max(300, Math.min(600, openingTreeWidth + delta));
    setOpeningTreeWidth(newWidth);
  };

  // Tree integration handlers
  const handleTreeCurrentMovesChange = (moves) => {
    // Tree updates current moves - sync with performance graph
    console.log('🌳 Tree current moves changed:', moves);
    
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
      console.log('🎯 Found matching node in graph:', targetNode.id);
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
        console.log('🎯 Found hovered next move node:', hoveredNode.id, 'for move:', moveData.san);
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
      <div className="w-full h-full bg-slate-900 relative flex flex-col">
        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-6"></div>
            <p className="text-slate-200 text-lg font-medium">Loading chess performance data...</p>
            <p className="text-slate-400 text-sm mt-2">Please wait while we prepare your analysis</p>
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
    <div className="h-full w-full flex flex-col overflow-hidden">
      
      {/* View Management Controls - Neutral Space Above All Components */}
      <div className="bg-slate-800/90 border-b border-slate-700/50 backdrop-blur-lg p-4 flex-shrink-0">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          
          {/* Left Side: Main Controls */}
          <div className="flex gap-2 flex-wrap items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-slate-700 border-slate-600 text-slate-200">
                  <Crown className="w-4 h-4 mr-2" />
                  {selectedPlayer === 'white' ? 'White' : 'Black'}
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

          {/* Right Side: View Management Controls */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-slate-400 text-sm font-medium mr-2">Views:</span>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleOpeningTree}
              className={`${showOpeningTree ? 'bg-green-600 border-green-500' : 'bg-slate-700 border-slate-600'} text-slate-200`}
              title="Toggle Opening Tree Navigation"
            >
              <TreePine className="w-4 h-4 mr-2" />
              Tree
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={togglePositionAnalysis}
              className={`${showPositionAnalysis ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'} text-slate-200`}
              title="Toggle Position Analysis (Chessboard)"
            >
              <Brain className="w-4 h-4 mr-2" />
              Analysis
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={togglePerformanceGraph}
              className={`${showPerformanceGraph ? 'bg-red-600 border-red-500' : 'bg-slate-700 border-slate-600'} text-slate-200`}
              title="Toggle Performance Graph"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Graph
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main content area - Flexible Layout: Tree | Position Analysis | Performance Graph */}
      <div className="flex-1 overflow-hidden relative flex">
        
        {/* Show message when all components are hidden */}
        {!showOpeningTree && !showPositionAnalysis && !showPerformanceGraph && (
          <div className="flex-1 flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <Eye className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-300 mb-2">All Components Hidden</h3>
              <p className="text-slate-400 mb-4">Use the controls to show the components you want to see.</p>
            </div>
          </div>
        )}
        
        {/* Opening Tree Sidebar - Left side */}
        {showOpeningTree && (
          <div 
            className="h-full overflow-hidden max-h-full"
            style={{ width: `${openingTreeWidth}px`, minWidth: `${openingTreeWidth}px`, maxWidth: `${openingTreeWidth}px` }}
          >
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl h-full max-h-full flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-200 flex items-center gap-2">
                    {selectedPlayer === 'white' ? (
                      <Crown className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Shield className="w-5 h-5 text-slate-400" />
                    )}
                    {selectedPlayer === 'white' ? 'White' : 'Black'} Opening Tree
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleOpeningTree}
                    className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 p-1"
                    title="Hide opening tree"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
                {treeStats && (
                  <div className="flex gap-4 text-xs text-slate-400 mt-2">
                    <span>{treeStats[selectedPlayer]?.totalGames || 0} games</span>
                    <span>{treeStats[selectedPlayer]?.totalPositions || 0} positions</span>
                    <span>{(treeStats[selectedPlayer]?.winRate || 0).toFixed(1)}% win rate</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 max-h-full overflow-hidden">
                <div className="h-full max-h-full overflow-hidden">
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
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <TreePine className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400">No opening data available</p>
                        <p className="text-slate-500 text-sm">Import games to see the tree</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Position Analysis Sidebar - Center */}
        {showPositionAnalysis && (
          <div 
            className={`bg-slate-800/95 border-r border-slate-700 backdrop-blur-lg relative flex flex-col overflow-hidden ${
              showPerformanceGraph ? 'flex-shrink-0' : 'flex-1'
            }`}
            style={showPerformanceGraph ? { 
              width: `${positionAnalysisWidth}px`, 
              minWidth: `${positionAnalysisWidth}px`, 
              maxWidth: `${positionAnalysisWidth}px` 
            } : { 
              minWidth: '350px' 
            }}
          >
            {/* Chessboard content */}
            <div className="flex-1 min-h-0 p-4 flex items-center justify-center overflow-hidden">
              <div className="w-full max-w-sm" style={{ minWidth: '280px' }}>
                <InteractiveChessboard
                  currentMoves={chessboardSync.currentMoves}
                  onMoveSelect={chessboardSync.handleMoveSelect}
                  onNewMove={chessboardSync.handleNewMove}
                  isWhiteTree={selectedPlayer === 'white'}
                  openingGraph={openingGraphRef.current}
                  hoveredMove={treeHoveredMove || hoveredMove}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        )}

        {/* Performance Graph - Right side (was center) */}
        {showPerformanceGraph && (
          <div className="flex-1 min-h-0 relative overflow-hidden bg-slate-900" style={{ minWidth: '0' }}>
        
        {/* Always render ReactFlow to get dimensions */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          attributionPosition="bottom-left"
          className="bg-slate-900 relative w-full h-full"
          style={{ width: '100%', height: '100%' }}
          minZoom={0.05}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          selectNodesOnDrag={false}
        >



        {/* Graph Controls - Top Left */}
        <Panel position="top-left" className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
              title="Fit graph to view"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleOpeningClustering}
              className={`${openingClusteringEnabled ? 'bg-purple-600 border-purple-500' : 'bg-slate-700 border-slate-600'} text-slate-200`}
              title="Toggle Opening Clusters"
            >
              <Layers className="w-4 h-4 mr-2" />
              Opening Clusters
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={togglePositionClusters}
              className={`${showPositionClusters ? 'bg-orange-600 border-orange-500' : 'bg-slate-700 border-slate-600'} text-slate-200`}
              title="Toggle Position Clusters (Current Move)"
            >
              <Target className="w-4 h-4 mr-2" />
              Position Clusters
            </Button>
          </div>
        </Panel>

        
        {/* MiniMap disabled for better performance */}
        {false && (
          <MiniMap 
            className="bg-slate-800/95 border-slate-700"
            nodeColor="#64748b"
            maskColor="rgba(15, 23, 42, 0.9)"
            position="bottom-right"
            style={{ 
              width: '150px',
              height: '100px'
            }}
          />
        )}

        {/* Legends and Show Buttons - Right Side */}
        <Panel position="top-right" className="space-y-4 max-w-sm">
          {/* Show Buttons for Legend and Controls - aligned to the right */}
          <div className="flex gap-2 flex-wrap justify-end">
            {!showPerformanceLegend && (
              <Button
                onClick={() => setShowPerformanceLegend(true)}
                className="bg-slate-800/95 border border-slate-700 text-slate-200 hover:bg-slate-700/95"
                size="sm"
              >
                <Info className="w-4 h-4 mr-2" />
                Legend
              </Button>
            )}
            
            {!showPerformanceControls && (
              <Button
                onClick={() => setShowPerformanceControls(true)}
                className="bg-slate-800/95 border border-slate-700 text-slate-200 hover:bg-slate-700/95"
                size="sm"
              >
                <Target className="w-4 h-4 mr-2" />
                Controls
              </Button>
            )}
          </div>

          {showPerformanceLegend && (
          <Card className="bg-slate-800/98 border-slate-600 backdrop-blur-lg shadow-2xl border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2 font-bold">
                <Info className="w-5 h-5 text-blue-400" />
                Performance Legend
                                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowPerformanceLegend(false)}
                    className="ml-auto text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 p-1"
                    title="Hide legend"
                  >
                    <EyeOff className="w-4 h-4" />
                  </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries({
                'Good (70%+)': PERFORMANCE_COLORS.excellent,
                'Decent (60-70%)': PERFORMANCE_COLORS.good,
                'Average (50-60%)': PERFORMANCE_COLORS.solid,
                'Below Average (40-50%)': PERFORMANCE_COLORS.challenging,
                'Poor (<40%)': PERFORMANCE_COLORS.difficult,
              }).map(([label, color]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <div 
                    className="w-4 h-4 rounded-sm border-2 shadow-sm"
                    style={{ backgroundColor: color.bg, borderColor: color.border }}
                  />
                  <span className="text-slate-100 font-medium">{label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          )}

          {/* Controls Card - moved to right side */}
          {showPerformanceControls && (
          <Card className="bg-slate-800/95 border-slate-700 backdrop-blur-lg shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-200 text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Controls
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowPerformanceControls(false)}
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
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className={`w-full px-2 py-1 rounded ${isGenerating ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-200'}`}
                    disabled={isGenerating}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 35, 40, 50].map(d => (
                      <option key={d} value={d}>{d} moves</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Min Games</label>
                  <select 
                    value={minGameCount} 
                    onChange={(e) => setMinGameCount(Number(e.target.value))}
                    className={`w-full px-2 py-1 rounded ${isGenerating ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-200'}`}
                    disabled={isGenerating}
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
                    onValueChange={setTempWinRateFilter}
                    min={0}
                    max={100}
                    step={5}
                      className="w-full [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-400 [&_[role=slider]]:shadow-lg [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-blue-500 [&_.bg-primary]:to-blue-600 [&_.bg-slate-200]:bg-slate-600/80"
                    disabled={isGenerating}
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
                  onClick={applyWinRateFilter}
                  disabled={isGenerating || (tempWinRateFilter[0] === winRateFilter[0] && tempWinRateFilter[1] === winRateFilter[1])}
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


        </Panel>

        {/* Background disabled for better performance */}
        {false && <Background variant="dots" className="!bg-slate-900" />}

        {/* Keyboard shortcut indicator - positioned as ReactFlow Panel */}
        <Panel position="bottom-left" className="pointer-events-none">
          <div className="text-xs text-slate-500 bg-slate-800/90 px-2 py-1 rounded border border-slate-700/50 backdrop-blur-sm shadow-lg mb-2 ml-2">
            Press <kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-slate-300 font-mono text-xs">R</kbd> for view reset
                        </div>
        </Panel>



        {/* Hover tooltip for opening names */}
        {hoveredOpeningName && (
          <Panel position="bottom-center" className="pointer-events-none">
            <div 
              className="border rounded-lg px-4 py-2 shadow-xl backdrop-blur-lg"
              style={{
                backgroundColor: hoveredClusterColor ? `${hoveredClusterColor.bg}20` : 'rgba(30, 41, 59, 0.95)',
                borderColor: hoveredClusterColor ? hoveredClusterColor.border : '#475569'
              }}
            >
              <div 
                className="font-semibold text-lg"
                style={{
                  color: hoveredClusterColor ? hoveredClusterColor.text : '#e2e8f0'
                }}
              >
                {hoveredOpeningName}
              </div>
            </div>
          </Panel>
        )}
        
        {/* Cluster Overlay disabled - ellipses removed */}
        {false && (
        <ClusterOverlay
          clusterAnalysis={clusteringEnabled ? clusterAnalysis : null}
          zoom={viewport.zoom}
          showClusters={showClusters && clusteringEnabled}
          showInsights={false}
          zoomThreshold={0.4}
          insightsPosition="bottom-right"
          viewport={viewport}
        />
        )}
        
        {/* SVG definitions for arrow markers - SIMPLIFIED */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
            >
              <path
                d="M 0 0 L 10 4 L 0 8 L 2 4 Z"
                fill="#64748b"
                stroke="#475569"
                strokeWidth="0.5"
              />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
      
      {/* Loading overlay - covers ReactFlow exactly when not ready */}
      {!isReady && (
        <div className="absolute inset-0 bg-slate-900/98 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-6"></div>
            <p className="text-slate-200 text-lg font-medium">
              {isGenerating ? 'Generating performance graph...' : 'Fitting view...'}
            </p>
            <p className="text-slate-400 text-sm mt-2">This may take a moment</p>
          </div>
        </div>
      )}
      
      </div>
        )}


      

            </div>
            
      



      {/* Position Info Dialog - Removed to avoid clash with chessboard sidebar */}
    </div>
  );
}

export default function PerformanceGraph() {
  return (
    <ReactFlowProvider>
      <PerformanceGraphContent />
    </ReactFlowProvider>
  );
}