import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCanvasState } from '../hooks/useCanvasState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { 
  FlexibleLayout, 
  LayoutSection,
  ComponentConfigs
} from '@/components/ui/flexible-layout';
import { 
  Save, 
  X, 
  ChevronLeft,
  Trash2,
  Plus,
  MessageSquare,
  LinkIcon,
  Info,
  Crown,
  Shield,
  Loader2,
  BarChart3,
  FileText,
  Grid3x3,
  Network,
  Edit,
  AlertTriangle,
  Edit3,
  Star
} from 'lucide-react';
import InteractiveChessboard from '@/components/chess/InteractiveChessboard';
import { UserOpening, UserOpeningMove, MoveAnnotation } from '@/api/entities';
import { Chess } from 'chess.js';
import CanvasPerformanceGraph from '@/components/chess/CanvasPerformanceGraph';
import { cn } from '@/lib/utils';
import { loadOpeningGraph } from '@/api/graphStorage';
import { createPositionClusters, createOpeningClusters } from '../utils/clusteringAnalysis';
import MoveDetailsPanel from '@/components/opening-moves/MoveDetailsPanel';

// Move tree node structure
class MoveNode {
  constructor(san, fen, parent = null) {
    this.id = `${san}-${Date.now()}-${Math.random()}`;
    this.san = san;
    this.fen = fen;
    this.parent = parent;
    this.children = [];
    this.isMainLine = !parent || parent.children.length === 0;
    this.comment = '';
    this.links = []; // Array of {title, url}
    this.arrows = []; // Array of {from, to, color} for colored arrows
  }
  
  addChild(san, fen) {
    const child = new MoveNode(san, fen, this);
    // Don't automatically set main line here - will be calculated later
    child.isMainLine = false;
    this.children.push(child);
    return child;
  }
  
  removeChild(childId) {
    this.children = this.children.filter(child => child.id !== childId);
    // After removing a child, recalculate the main line for the entire tree
    // This will be handled by the parent component
    return true; // Return true to indicate successful removal
  }

  // Method to calculate and set the main line for the entire tree
  static calculateMainLine(rootNode) {
    // First, reset all nodes to not be main line
    const resetMainLine = (node) => {
      node.isMainLine = false;
      node.children.forEach(child => resetMainLine(child));
    };
    resetMainLine(rootNode);
    
    // Find the longest path or the path with the most "important" moves
    // For now, we'll use the first child at each level (can be enhanced later)
    const setMainLinePath = (node) => {
      node.isMainLine = true;
      
      // If this node has children, continue the main line through the first child
      if (node.children.length > 0) {
        // Choose the first child as main line (this can be enhanced with better logic)
        setMainLinePath(node.children[0]);
      }
    };
    
    // Start from root
    setMainLinePath(rootNode);
  }

  // Method to set the main line to go through a specific node
  static setMainLineToNode(rootNode, targetNode) {
    // First, reset all nodes to not be main line
    const resetMainLine = (node) => {
      node.isMainLine = false;
      node.children.forEach(child => resetMainLine(child));
    };
    resetMainLine(rootNode);
    
    // Build the path from root to target node
    const pathToTarget = [];
    let current = targetNode;
    while (current.parent) {
      pathToTarget.unshift(current);
      current = current.parent;
    }
    pathToTarget.unshift(current); // Add root
    
    // Mark all nodes in the path as main line
    pathToTarget.forEach(node => {
      node.isMainLine = true;
    });
    
    // Continue the main line from target node through its first child (if any)
    const continueMainLine = (node) => {
      if (node.children.length > 0) {
        const firstChild = node.children[0];
        firstChild.isMainLine = true;
        continueMainLine(firstChild);
      }
    };
    
    continueMainLine(targetNode);
  }
}

export default function OpeningEditor() {
  const navigate = useNavigate();
  const { openingId } = useParams();
  const isNewOpening = !openingId;
  
  // Form state - initialized from URL params for new openings
  const [name, setName] = useState('');
  const [color, setColor] = useState('white');
  
  // Initialize form state from URL parameters for new openings
  useEffect(() => {
    if (isNewOpening) {
      const urlParams = new URLSearchParams(window.location.search);
      const nameParam = urlParams.get('name');
      const colorParam = urlParams.get('color');
      
      if (nameParam) setName(nameParam);
      if (colorParam && ['white', 'black'].includes(colorParam)) setColor(colorParam);
    }
  }, [isNewOpening]);
  
  // Move tree state
  const [moveTree, setMoveTree] = useState(new MoveNode('Start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  const [currentNode, setCurrentNode] = useState(moveTree);
  const [currentPath, setCurrentPath] = useState([]);
  const [treeVersion, setTreeVersion] = useState(0); // Version counter to force re-renders
  const [treeChangeVersion, setTreeChangeVersion] = useState(0); // Version counter for tracking changes
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  
  // Store initial state for comparison
  const [initialState, setInitialState] = useState(null);
  
  // Hover state for chessboard arrows
  const [hoveredMove, setHoveredMove] = useState(null);
  const [movesHoveredMove, setMovesHoveredMove] = useState(null);
  
  // Arrow drawing state
  const [drawingMode, setDrawingMode] = useState(false);

  // Handle arrow drawing from chessboard
  const handleArrowDraw = useCallback((from, to, color = null) => {
    if (currentNode) {
      // Use the provided color or default to green
      const arrowColor = color || '#22c55e';
      const newArrow = { from, to, color: arrowColor };
      currentNode.arrows = [...(currentNode.arrows || []), newArrow];
      setTreeVersion(v => v + 1); // Force re-render
      
      // Trigger change detection by updating the tree version
      setTreeChangeVersion(v => v + 1);
    }
  }, [currentNode]);

  // Layout state - using flexible layout system (removed details section)
  const [layoutInfo, setLayoutInfo] = useState({});
  const [showBoard, setShowBoard] = useState(true);
  const [showGraph, setShowGraph] = useState(true);
  
  // Canvas state
  const [canvasMode, setCanvasMode] = useState('opening'); // 'opening' | 'performance'
  const [openingGraph, setOpeningGraph] = useState(null); // For performance mode
  const [performanceGraphData, setPerformanceGraphData] = useState({ nodes: [], edges: [], maxGameCount: 0 });
  
  // Graph data for canvas view
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  
  // NEW: Context menu state
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState(null);
  
  // Helper function to find node by ID in tree
  const findNodeById = useCallback((root, targetId) => {
    if (root.id === targetId) return root;
    for (const child of root.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
    return null;
  }, []);
  
  // Shared performance graph state for all canvas functionality (unified for both modes)
  const performanceState = useCanvasState({
    openingGraph: openingGraph,
    selectedPlayer: color,
    enableClustering: false, // Disable opening clustering in opening editor
    enablePositionClusters: canvasMode === 'performance', // Only enable position clusters in performance mode
    enableAutoZoom: false // Disable auto-zoom in opening editor - only manual fit to all
  });
  
  // Derived selected node state from unified performance state
  const selectedNode = useMemo(() => {
    if (!performanceState.currentNodeId) return null;
    return findNodeById(moveTree, performanceState.currentNodeId);
  }, [performanceState.currentNodeId, moveTree, findNodeById]);

  // Handle drawing mode toggle
  const handleDrawingModeToggle = useCallback(() => {
    // Don't allow drawing mode on the start position
    if (selectedNode && selectedNode.san === 'Start') {
      return;
    }
    setDrawingMode(!drawingMode);
  }, [drawingMode, selectedNode]);

  // Automatically disable drawing mode when on start position
  useEffect(() => {
    if (selectedNode && selectedNode.san === 'Start' && drawingMode) {
      setDrawingMode(false);
    }
  }, [selectedNode, drawingMode]);
  
  // Override the navigate function to check for unsaved changes
  const navigateWithCheck = useCallback((to, options = {}) => {
    if (hasUnsavedChanges && !isNavigatingAway) {
      setShowUnsavedChangesDialog(true);
      setPendingNavigation('router-navigation');
      // Store the navigation details for later use
      pendingNavigationRef.current = { to, options };
      return;
    }
    navigate(to, options);
  }, [hasUnsavedChanges, isNavigatingAway, navigate]);

  // Store pending navigation details
  const pendingNavigationRef = useRef(null);

  // Intercept all Link clicks in the document to check for unsaved changes
  useEffect(() => {
    const handleLinkClick = (event) => {
      // Only intercept if we have unsaved changes and not already navigating
      if (!hasUnsavedChanges || isNavigatingAway) return;
      
      // Check if the clicked element is a link or inside a link
      const link = event.target.closest('a[href]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      
      // Only intercept internal navigation (React Router links)
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        event.preventDefault();
        event.stopPropagation();
        
        setShowUnsavedChangesDialog(true);
        setPendingNavigation('router-navigation');
        // Store the navigation details
        pendingNavigationRef.current = { to: href, options: {} };
      }
    };

    // Add event listener to capture all link clicks
    document.addEventListener('click', handleLinkClick, true);
    
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [hasUnsavedChanges, isNavigatingAway]);

  // Load existing opening
  useEffect(() => {
    if (!isNewOpening) {
      loadOpening();
    } else {
      // Initialize performance state position for new opening
      performanceState.updateCurrentPosition(moveTree.id, moveTree.fen);
    }
  }, [openingId]);

  // Helper function to serialize tree for change detection
  const serializeTree = useCallback((node) => {
    const serialize = (n) => ({
      san: n.san,
      fen: n.fen,
      isMainLine: n.isMainLine,
      comment: n.comment || '',
      links: (n.links || []).map(link => ({ title: link.title || '', url: link.url || '' })),
      arrows: (n.arrows || []).map(arrow => ({ from: arrow.from, to: arrow.to, color: arrow.color })),
      children: n.children.map(child => serialize(child))
    });
    return JSON.stringify(serialize(node));
  }, []);

  // Set initial state after loading or on mount for new openings
  useEffect(() => {
    if (!loading && !initialState) {
      setInitialState({
        name,
        color,
        treeStructure: serializeTree(moveTree)
      });
    }
  }, [loading, name, color, moveTree, initialState, serializeTree]);

  // Set initial state immediately for new openings
  useEffect(() => {
    if (isNewOpening && !initialState && !loading) {
      setInitialState({
        name: '',
        color: 'white',
        treeStructure: serializeTree(moveTree)
      });
    }
  }, [isNewOpening, initialState, loading, moveTree, serializeTree]);

  // Track changes - now includes tree structure changes
  useEffect(() => {
    if (!initialState) return;
    
    const currentState = {
      name,
      color,
      treeStructure: serializeTree(moveTree)
    };
    
    const hasChanges = 
      currentState.name !== initialState.name ||
      currentState.color !== initialState.color ||
      currentState.treeStructure !== initialState.treeStructure;
    
    setHasUnsavedChanges(hasChanges);
  }, [name, color, moveTree, treeChangeVersion, initialState, serializeTree]);

  // Prevent navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    const handlePopState = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        setShowUnsavedChangesDialog(true);
        setPendingNavigation('back');
        // Push state back to prevent navigation
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Push a state to catch back button
    if (hasUnsavedChanges) {
      window.history.pushState(null, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges]);

  // Cleanup canvas state on unmount
  useEffect(() => {
    return () => {
      performanceState.cleanup();
    };
  }, [performanceState.cleanup]);
  
  // Load performance graph data once
  useEffect(() => {
    const loadPerformanceData = async () => {
      const username = localStorage.getItem('chesscope_username');
      if (username) {
        const graph = await loadOpeningGraph(username);
        setOpeningGraph(graph);
      }
    };
    loadPerformanceData();
  }, []); // Load once on mount

  const navigateToPerformancePosition = useCallback(() => {
    if (!openingGraph || graphData.nodes.length === 0) return;
    
    // Check if we only have the start position (no moves)
    const hasOnlyStartPosition = graphData.nodes.length === 1 && 
                                graphData.nodes[0].data.isRoot &&
                                graphData.edges.length === 0;
    
    // Instead of building a separate performance graph, overlay performance data onto the opening tree
    const overlayPerformanceData = () => {
      const enhancedNodes = [];
      const enhancedEdges = [];
      
      let maxGameCount = 0;
      
      // Calculate total games for root node like PerformanceGraph.jsx does
      let rootTotalGames = 0;
      try {
        const rootMoves = openingGraph.getRootMoves(color === 'white');
        rootTotalGames = rootMoves ? rootMoves.reduce((sum, move) => sum + (move.gameCount || 0), 0) : 0;
      } catch (error) {
        console.error('Error calculating root total games:', error);
        rootTotalGames = 0;
      }
      
      // Process each node in the opening tree
      graphData.nodes.forEach(node => {
        const nodeData = { ...node.data };
        
        if (nodeData.isRoot) {
          // Root node - always show actual game count from performance data
          enhancedNodes.push({
            ...node,
            data: {
              ...nodeData,
              winRate: 50,
              gameCount: rootTotalGames,
              performanceData: {
                hasData: true,
                winRate: 50,
                gameCount: rootTotalGames
              },
              isMissing: false
            }
          });
          maxGameCount = Math.max(maxGameCount, rootTotalGames);
        } else {
          // Try to get performance data for this node
          let performanceData = null;
          let hasPerformanceData = false;
          
          try {
            // Build the move sequence for this node by traversing up the tree
            const getMoveSequence = (nodeId) => {
              const sequence = [];
              let current = graphData.nodes.find(n => n.id === nodeId);
              
              // Find the path by looking at edges
              while (current && !current.data.isRoot) {
                const parentEdge = graphData.edges.find(e => e.target === current.id);
                if (parentEdge) {
                  sequence.unshift(current.data.san);
                  current = graphData.nodes.find(n => n.id === parentEdge.source);
                } else {
                  break;
                }
              }
              
              return sequence;
            };
            
            const moveSequence = getMoveSequence(node.id);
            
            if (moveSequence.length > 0) {
              // Get moves from the performance graph for the parent position
              const parentSequence = moveSequence.slice(0, -1);
              const moves = openingGraph.getMovesFromPosition(parentSequence, color === 'white');
              
              if (moves && moves.length > 0) {
                // Find the move that matches this node's move
                const matchingMove = moves.find(m => m.san === moveSequence[moveSequence.length - 1]);
                
                if (matchingMove) {
                  hasPerformanceData = true;
                  performanceData = {
                    winRate: matchingMove.details?.winRate || matchingMove.winRate || 50,
                    gameCount: matchingMove.gameCount || 0,
                    hasData: true
                  };
                  maxGameCount = Math.max(maxGameCount, performanceData.gameCount);
                }
              }
            }
          } catch (error) {
            console.error('Error getting performance data for node:', error);
          }
          
          // Create enhanced node with performance data or mark as missing
          enhancedNodes.push({
            ...node,
            data: {
              ...nodeData,
              winRate: performanceData?.winRate || null,
              gameCount: performanceData?.gameCount || 0,
              performanceData: performanceData || { hasData: false, winRate: null, gameCount: 0 },
              isMissing: !hasPerformanceData // Flag for gray styling
            }
          });
        }
      });
      
      // Process edges - add performance data to edges as well
      graphData.edges.forEach(edge => {
        const sourceNode = enhancedNodes.find(n => n.id === edge.source);
        const targetNode = enhancedNodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          enhancedEdges.push({
            ...edge,
            data: {
              ...edge.data,
              winRate: targetNode.data.winRate,
              gameCount: targetNode.data.gameCount,
              isMissing: targetNode.data.isMissing
            }
          });
        }
      });
      
      return { nodes: enhancedNodes, edges: enhancedEdges, maxGameCount };
    };
    
    // Generate the enhanced graph with performance data
    const enhancedGraph = overlayPerformanceData();
    
    // Always update - remove the comparison that was causing the infinite loop
    setPerformanceGraphData(enhancedGraph);
  }, [openingGraph, graphData, color]); // Removed performanceGraphData dependency

  // Update graph data when tree changes or opening graph becomes available
  useEffect(() => {
    // Always update the underlying opening tree data when the tree changes
    updateGraphData();
  }, [moveTree, openingGraph, treeVersion]); // Trigger on any tree changes (structure or content) or when opening graph loads
  
  // Handle performance mode overlay when graphData is updated
  useEffect(() => {
    if (canvasMode === 'performance' && openingGraph && graphData.nodes.length > 0) {
      // Call immediately since graphData is now updated
      navigateToPerformancePosition();
    }
  }, [graphData.nodes.length, canvasMode, openingGraph]); // Trigger when graphData is actually updated
  
  // Trigger canvas graph change handling only when nodes actually change
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      performanceState.handleGraphChange(graphData);
    }
  }, [graphData.nodes.length]); // Removed performanceState.handleGraphChange to prevent infinite loops

  // Generate clusters (both opening and position) in a single effect
  useEffect(() => {
    const currentGraphData = canvasMode === 'opening' ? graphData : performanceGraphData;
    
    if (currentGraphData.nodes.length === 0) {
      // Clear clusters if no nodes
      performanceState.setOpeningClusters([]);
      performanceState.setPositionClusters([]);
      return;
    }
    
    // Generate opening clusters for the current graph data (only if clustering is enabled)
    if (performanceState.openingClusteringEnabled) {
      const openingClusters = createOpeningClusters(currentGraphData.nodes);
      performanceState.setOpeningClusters(openingClusters);
    } else {
      performanceState.setOpeningClusters([]);
    }
    
    // Generate position clusters ONLY in performance mode
    if (canvasMode === 'performance') {
      const currentFen = performanceState.currentPositionFen;
      if (currentFen) {
        const positionClusters = createPositionClusters(currentGraphData.nodes, currentFen);
        performanceState.setPositionClusters(positionClusters);
      } else {
        performanceState.setPositionClusters([]);
      }
    } else {
      // Clear position clusters in opening mode
      performanceState.setPositionClusters([]);
    }
  }, [
    // Only trigger when these actually change - removed function dependencies to prevent infinite loops
    graphData.nodes.length, 
    performanceGraphData.nodes.length, 
    performanceState.currentPositionFen, 
    canvasMode
    // Removed performanceState.setOpeningClusters and performanceState.setPositionClusters to prevent infinite loops
  ]);

  // Handle mode switching - ensure current position is valid in the new mode
  useEffect(() => {
    if (!currentNode) return;
    
    const currentGraphData = canvasMode === 'opening' ? graphData : performanceGraphData;
    if (currentGraphData.nodes.length === 0) return;
    
    // Find the node in the current mode's graph that matches the current tree node
    let targetNodeId = null;
    
    if (canvasMode === 'opening') {
      // In opening mode, use the tree node ID directly
      targetNodeId = currentNode.id;
    } else {
      // In performance mode, find the node with matching move sequence
      const currentMoveSequence = currentPath || [];
      const matchingNode = currentGraphData.nodes.find(node => {
        const nodeMoveSequence = node.data.moveSequence || [];
        return nodeMoveSequence.length === currentMoveSequence.length &&
               nodeMoveSequence.every((move, index) => move === currentMoveSequence[index]);
      });
      targetNodeId = matchingNode?.id || null;
    }
    
    // Update the performance state if we found a matching node
    if (targetNodeId && targetNodeId !== performanceState.currentNodeId) {
      const targetNode = currentGraphData.nodes.find(n => n.id === targetNodeId);
      if (targetNode) {
        performanceState.updateCurrentPosition(targetNodeId, targetNode.data.fen);
      }
    } else if (!targetNodeId && performanceState.currentNodeId) {
      // Clear the current position if no matching node found
      performanceState.updateCurrentPosition(null, null);
    }
  }, [canvasMode, currentNode, currentPath, graphData.nodes, performanceGraphData.nodes]);

  const loadOpening = async () => {
    try {
      setLoading(true);
      
      // Load opening
      const openings = await UserOpening.filter({ id: parseInt(openingId) });
      if (openings.length === 0) {
        navigate('/openings-book');
        return;
      }
      
      const opening = openings[0];
      setName(opening.name);
      setColor(opening.color);
      
      // Load moves
      const moves = await UserOpeningMove.getByOpeningId(parseInt(openingId));
      
      // Create root node
      const root = new MoveNode('Start', opening.initial_fen);
      
      // Build tree from moves
      const nodeMap = new Map();
      nodeMap.set(opening.initial_fen, root);
      
      // Sort moves by move number to ensure proper tree construction
      moves.sort((a, b) => a.move_number - b.move_number);
      
      // First pass: create all nodes
      for (const move of moves) {
        const parentNode = nodeMap.get(move.parent_fen);
        if (parentNode) {
          const childNode = parentNode.addChild(move.san, move.fen);
          childNode.isMainLine = move.is_main_line;
          childNode.comment = move.comment || '';
          childNode.links = []; // Initialize empty, will load separately
          childNode.arrows = move.arrows || [];
          nodeMap.set(move.fen, childNode);
          
          // Store move ID for loading annotations
          childNode.moveId = move.id;
        }
      }
      
      // Second pass: load annotations (links) for each move
      for (const [fen, node] of nodeMap) {
        if (node.moveId) {
          const annotations = await MoveAnnotation.getByMoveId(node.moveId);
          node.links = annotations
            .filter(ann => ann.type === 'link')
            .map(ann => ({ title: ann.content, url: ann.url }));
        }
      }
      
      // Calculate the main line after building the tree
      MoveNode.calculateMainLine(root);
      
      setMoveTree(root);
      setCurrentNode(root);
      
      // Initialize unified performance state position
      performanceState.updateCurrentPosition(root.id, root.fen);
      
    } catch (error) {
      console.error('Error loading opening:', error);
      navigate('/openings-book');
    } finally {
      setLoading(false);
    }
  };

  const updateGraphData = useCallback(() => {
    if (!moveTree) return;
    
    const nodes = [];
    const edges = [];
    
    const nodeWidth = 180;
    const nodeHeight = 180;
    const horizontalSpacing = 240; // Reduced from 250 to match performance graph
    const verticalSpacing = 350; // Increased from 250 to match performance graph
    
    // Calculate root total games for display even in opening mode
    let rootTotalGames = 0;
    if (openingGraph) {
      try {
        const rootMoves = openingGraph.getRootMoves(color === 'white');
        rootTotalGames = rootMoves ? rootMoves.reduce((sum, move) => sum + (move.gameCount || 0), 0) : 0;
      } catch (error) {
        console.error('Error calculating root total games in updateGraphData:', error);
        rootTotalGames = 0;
      }
    }
    
    // Build tree structure map for proper layout calculation
    const treeStructure = new Map();
    
    const buildTreeStructure = (node, depth = 0, parentId = null) => {
      const nodeId = node.id;
      
      // Initialize tree structure for this node
      treeStructure.set(nodeId, {
        children: [],
        parent: parentId,
        level: depth,
        width: 0,
        node: node // Store reference to original node
      });
      
      // Add to parent's children list
      if (parentId) {
        const parentTreeNode = treeStructure.get(parentId);
        if (parentTreeNode) {
          parentTreeNode.children.push(nodeId);
        }
      }
      
      // Process children recursively
      node.children.forEach(child => {
        buildTreeStructure(child, depth + 1, nodeId);
      });
    };
    
    // Build the tree structure
    buildTreeStructure(moveTree);
    
    // Calculate tree layout using sophisticated algorithm
    const calculateTreeLayout = () => {
      // Bottom-up width calculation - each node's width is the sum of its children's widths
      const calculateWidths = (nodeId) => {
        const treeNode = treeStructure.get(nodeId);
        if (!treeNode) return 0;
        
        if (treeNode.children.length === 0) {
          // Leaf node has width of 1
          treeNode.width = 1;
          return 1;
        }
        
        // Internal node's width is the sum of all children's widths
        let totalWidth = 0;
        for (const childId of treeNode.children) {
          totalWidth += calculateWidths(childId);
        }
        treeNode.width = Math.max(1, totalWidth);
        return treeNode.width;
      };
      
      // Helper function to build move sequence for a node
      const buildMoveSequence = (targetNodeId) => {
        const sequence = [];
        let currentId = targetNodeId;
        
        while (currentId) {
          const treeNode = treeStructure.get(currentId);
          if (!treeNode || !treeNode.node || treeNode.node.san === 'Start') break;
          
          sequence.unshift(treeNode.node.san);
          currentId = treeNode.parent;
        }
        
        return sequence;
      };

      // Top-down position assignment
      const assignPositions = (nodeId, x, y, availableWidth) => {
        const treeNode = treeStructure.get(nodeId);
        const node = treeNode?.node;
        
        if (!treeNode || !node) return;
        
        // Build move sequence for this node
        const moveSequence = buildMoveSequence(nodeId);
        
        if (node.san === 'Start' && treeNode.children.length > 0) {
          // Special handling for root node - center it above its children
          const childY = y + verticalSpacing;
          let currentX = -(availableWidth * horizontalSpacing) / 2;
          let childXs = [];
          
          // First pass: position children to get their bounds
          for (const childId of treeNode.children) {
            const childTreeNode = treeStructure.get(childId);
            if (childTreeNode) {
              const childWidth = childTreeNode.width * horizontalSpacing;
              const childCenterX = currentX + childWidth / 2;
              childXs.push(childCenterX);
              
              // Recursively position this child and its subtree
              assignPositions(childId, childCenterX, childY, childTreeNode.width);
              currentX += childWidth;
            }
          }
          
          // Center root node above its children
          let rootCenterX = 0;
          if (childXs.length === 1) {
            rootCenterX = childXs[0];
          } else if (childXs.length > 1) {
            rootCenterX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
          }
          
          // Add node with calculated position
          nodes.push({
            id: nodeId,
            type: 'custom',
            position: { x: rootCenterX - nodeWidth / 2, y },
            data: {
              label: node.san,
              san: node.san,
              fen: node.fen,
              isSelected: node === selectedNode,
              isMainLine: node.isMainLine,
              hasComment: !!node.comment,
              hasLinks: node.links && node.links.some(link => link.title || link.url),
              linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0,
              arrows: node.arrows || [], // Add arrows data for rendering
              annotation: {
                hasComment: !!node.comment,
                hasLinks: node.links && node.links.some(link => link.title || link.url),
                commentCount: node.comment ? 1 : 0,
                linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0
              },
              isRoot: node.san === 'Start',
              moveSequence: moveSequence, // Add move sequence for move color determination
              // For compatibility with performance mode - include actual game count for root
              winRate: node.san === 'Start' ? 50 : null,
              totalGames: node.san === 'Start' ? rootTotalGames : null,
              gameCount: node.san === 'Start' ? rootTotalGames : null,
              performanceData: node.san === 'Start' ? {
                hasData: true,
                winRate: 50,
                gameCount: rootTotalGames
              } : null
            }
          });
        } else {
          // Regular node positioning
          nodes.push({
            id: nodeId,
            type: 'custom',
            position: { x: x - nodeWidth / 2, y },
            data: {
              label: node.san,
              san: node.san,
              fen: node.fen,
              isSelected: node === selectedNode,
              isMainLine: node.isMainLine,
              hasComment: !!node.comment,
              hasLinks: node.links && node.links.some(link => link.title || link.url),
              linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0,
              arrows: node.arrows || [], // Add arrows data for rendering
              annotation: {
                hasComment: !!node.comment,
                hasLinks: node.links && node.links.some(link => link.title || link.url),
                commentCount: node.comment ? 1 : 0,
                linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0
              },
              isRoot: node.san === 'Start',
              moveSequence: moveSequence, // Add move sequence for move color determination
              // For compatibility with performance mode - include actual game count for root
              winRate: node.san === 'Start' ? 50 : null,
              totalGames: node.san === 'Start' ? rootTotalGames : null,
              gameCount: node.san === 'Start' ? rootTotalGames : null,
              performanceData: node.san === 'Start' ? {
                hasData: true,
                winRate: 50,
                gameCount: rootTotalGames
              } : null
            }
          });
          
          // Position children if any
          if (treeNode.children.length > 0) {
            const childY = y + verticalSpacing;
            let currentX = x - (availableWidth * horizontalSpacing) / 2;
            
            for (const childId of treeNode.children) {
              const childTreeNode = treeStructure.get(childId);
              if (childTreeNode) {
                const childWidth = childTreeNode.width * horizontalSpacing;
                const childCenterX = currentX + childWidth / 2;
                
                assignPositions(childId, childCenterX, childY, childTreeNode.width);
                currentX += childWidth;
              }
            }
          }
        }
        
        // Add edges from this node to its children
        if (treeNode.parent) {
          edges.push({
            id: `edge-${treeNode.parent}-${nodeId}`,
            source: treeNode.parent,
            target: nodeId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'smoothstep',
            animated: false,
            data: {
              isMainLine: node.isMainLine
            }
          });
        }
      };
      
      // Calculate widths bottom-up
      calculateWidths(moveTree.id);
      
      // Assign positions top-down
      const rootWidth = treeStructure.get(moveTree.id)?.width || 1;
      assignPositions(moveTree.id, 0, 0, rootWidth);
    };
    
    // Execute the layout calculation
    calculateTreeLayout();
    
    setGraphData({ nodes, edges });
  }, [moveTree, selectedNode, openingGraph, color]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Opening name is required');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      const username = localStorage.getItem('chesscope_username');
      
      // Get initial moves (main line from root)
      const getMainLine = (node) => {
        const moves = [];
        let current = node;
        while (current.children.length > 0) {
          const mainChild = current.children.find(c => c.isMainLine) || current.children[0];
          moves.push(mainChild.san);
          current = mainChild;
        }
        return moves;
      };
      
      const openingData = {
        username,
        name: name.trim(),
        color,
        initial_fen: moveTree.fen,
        initial_moves: getMainLine(moveTree)
      };
      
      let savedOpening;
      if (isNewOpening) {
        savedOpening = await UserOpening.create(openingData);
      } else {
        // Update existing opening
        await UserOpening.update(parseInt(openingId), openingData);
        
        // Delete all existing moves and annotations to re-insert fresh
        const existingMoves = await UserOpeningMove.getByOpeningId(parseInt(openingId));
        for (const move of existingMoves) {
          // Delete annotations for this move
          await MoveAnnotation.deleteByMoveId(move.id);
          await UserOpeningMove.delete(move.id);
        }
        savedOpening = { id: parseInt(openingId) };
      }
      
      // Save move tree structure
      let moveNumber = 1;
      const saveMoveNode = async (node, parentFen) => {
        if (node.san === 'Start') return; // Skip root
        
        const moveData = {
          opening_id: savedOpening.id,
          fen: node.fen,
          san: node.san,
          move_number: moveNumber++,
          parent_fen: parentFen,
          is_main_line: node.isMainLine,
          comment: node.comment || '',
          arrows: node.arrows || []
        };
        
        const savedMove = await UserOpeningMove.create(moveData);
        
        // Save links as annotations
        if (node.links && node.links.length > 0) {
          for (const link of node.links) {
            if (link.title || link.url) {
              await MoveAnnotation.create({
                move_id: savedMove.id,
                type: 'link',
                content: link.title || 'Link',
                url: link.url || ''
              });
            }
          }
        }
        
        // Save children
        for (const child of node.children) {
          await saveMoveNode(child, node.fen);
        }
      };
      
      // Save all moves
      for (const child of moveTree.children) {
        await saveMoveNode(child, moveTree.fen);
      }
      
      // Reset unsaved changes state
      setHasUnsavedChanges(false);
      setInitialState({
        name: name.trim(),
        color,
        treeStructure: serializeTree(moveTree)
      });
      
      // Navigate to the opening view
      navigate(`/openings-book/opening/${savedOpening.id}`);
      
    } catch (error) {
      console.error('Error saving opening:', error);
      setError('Failed to save opening');
    } finally {
      setSaving(false);
    }
  }, [isNewOpening, openingId, name, color, moveTree, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, handleSave]);

  const handleNewMove = (newMoves) => {
    // Handle new move from chessboard
    // newMoves is an array of SAN moves from the root
    
    // If empty moves array, go to start position
    if (newMoves.length === 0) {
      setCurrentNode(moveTree);
      setCurrentPath([]);
      performanceState.updateCurrentPosition(moveTree.id, moveTree.fen);
      return;
    }
    
    // Start from the root and follow/create the path
    let node = moveTree;
    let i = 0;
    let needsUpdate = false;
    
    // Follow existing moves as far as possible
    while (i < newMoves.length) {
      const move = newMoves[i];
      const existingChild = node.children.find(c => c.san === move);
      
      if (existingChild) {
        // Move exists, follow it
        node = existingChild;
        i++;
      } else {
        // Move doesn't exist, create new branch from here
        break;
      }
    }
    
    // Create any new moves from the divergence point
    if (i < newMoves.length) {
      const chess = new Chess(node.fen);
      
      while (i < newMoves.length) {
        const move = chess.move(newMoves[i]);
        if (move) {
          node = node.addChild(move.san, chess.fen());
          needsUpdate = true;
        }
        i++;
      }
    }
    
    // Update current position to the final node
    setCurrentNode(node);
    setCurrentPath([...newMoves]);
    performanceState.updateCurrentPosition(node.id, node.fen);
    
    // Only update the tree if we added new moves
    if (needsUpdate) {
      // Recalculate main line after adding moves
      MoveNode.calculateMainLine(moveTree);
      
      // Increment version to force React to re-render
      setTreeVersion(v => v + 1);
      
      // Trigger change detection
      setTreeChangeVersion(v => v + 1);
      
      // Schedule auto-fit after tree update (longer delay to ensure graph is updated)
      // Use the unified canvas state for both modes
      setTimeout(() => {
        performanceState.scheduleAutoFit('new-move-added', 200);
      }, 300);
    }
  };
  
  const handleNodeSelect = (node) => {
    setCurrentNode(node);
    
    // Build path from root to selected node
    const path = [];
    let current = node;
    while (current.parent) {
      path.unshift(current.san);
      current = current.parent;
    }
    setCurrentPath(path);
    
    // Update unified performance state position
    performanceState.updateCurrentPosition(node.id, node.fen);
    
    // Don't auto-fit on node selection - let user control the view
    // This prevents the view from jumping when user clicks nodes
  };
  
  const handleNodeDelete = (node) => {
    if (node.parent) {
      node.parent.removeChild(node.id);
      // If deleted node was current, move to parent
      if (currentNode === node) {
        setCurrentNode(node.parent);
        // Update unified performance state position
        performanceState.updateCurrentPosition(node.parent.id, node.parent.fen);
      }
      
      // Recalculate main line after deletion
      MoveNode.calculateMainLine(moveTree);
      
      // Increment version to force re-render
      setTreeVersion(v => v + 1);
      
      // Trigger change detection
      setTreeChangeVersion(v => v + 1);
    }
  };



  // Memoized node click handler to prevent infinite re-renders
  const handleCanvasNodeClick = useCallback((e, node) => {
    if (canvasMode === 'opening' && node.data) {
      const treeNode = findNodeById(moveTree, node.id);
      if (treeNode) {
        // Check if clicking on currently selected node - if so, deselect it
        if (performanceState.currentNodeId === treeNode.id) {
          // Don't deselect the root node - it should always be selectable
          if (!node.data.isRoot) {
            // Deselect the current node
            setCurrentNode(null);
            setCurrentPath([]);
            // Clear performance state position
            performanceState.updateCurrentPosition(null, null);
            return;
          }
        }
        handleNodeSelect(treeNode);
      }
    } else if (canvasMode === 'performance' && node.data) {
      // Check if clicking on currently selected node - if so, deselect it
      if (performanceState.currentNodeId === node.id) {
        // Deselect the current node
        performanceState.updateCurrentPosition(null, null);
        return;
      }
      // Update performance state position for auto-zoom functionality
      performanceState.updateCurrentPosition(node.id, node.data.fen);
      
      // Also update the local tree state to match the selected performance node
      // Find the corresponding tree node by move sequence
      const moveSequence = node.data.moveSequence || [];
      if (moveSequence.length === 0) {
        // Root node
        setCurrentNode(moveTree);
        setCurrentPath([]);
      } else {
        // Find the tree node with matching move sequence
        let treeNode = moveTree;
        for (const move of moveSequence) {
          const childNode = treeNode.children.find(c => c.san === move);
          if (childNode) {
            treeNode = childNode;
          } else {
            break;
          }
        }
        setCurrentNode(treeNode);
        setCurrentPath([...moveSequence]);
      }
    }
  }, [canvasMode, handleNodeSelect, performanceState.updateCurrentPosition, performanceState.currentNodeId, moveTree]);

  // Hover handlers for showing arrows on chessboard
  const handleCanvasNodeHover = useCallback((e, node) => {
    if (!node.data || !performanceState.currentNodeId) return;
    
    // Use the correct graph data based on canvas mode
    const currentGraphData = canvasMode === 'opening' ? graphData : performanceGraphData;
    
    // Find the current node in the graph data using the unified performance state
    const currentGraphNode = currentGraphData.nodes.find(n => n.id === performanceState.currentNodeId);
    if (!currentGraphNode) return;
    
    const currentMoves = currentGraphNode.data.moveSequence || [];
    const hoveredMoves = node.data.moveSequence || [];
    
    // Check if the hovered node is exactly one move ahead of current position
    if (hoveredMoves.length === currentMoves.length + 1 && 
        currentMoves.every((move, index) => move === hoveredMoves[index])) {
      
      const nextMove = hoveredMoves[hoveredMoves.length - 1];
      
      // Determine if we should use pink arrows
      const shouldUsePinkArrow = canvasMode === 'opening' || 
                                 node.data.isMissing || 
                                 node.data.winRate === null || 
                                 node.data.winRate === undefined ||
                                 node.data.gameCount === 0;
      
      // Create move data similar to performance graph format
      const moveData = {
        san: nextMove,
        gameCount: node.data.gameCount || 0,
        maxGameCount: currentGraphData.nodes.reduce((max, n) => Math.max(max, n.data?.gameCount || 0), 0),
        details: {
          winRate: node.data.winRate || null
        },
        winRate: node.data.winRate || null,
        // Use pink arrow color for opening mode or missing data
        arrowColor: shouldUsePinkArrow ? '#ec4899' : undefined // Pink color (pink-500)
      };
      
      setHoveredMove(moveData);
    }
  }, [performanceState.currentNodeId, graphData.nodes, performanceGraphData.nodes, canvasMode]);

  const handleCanvasNodeHoverEnd = useCallback(() => {
    setHoveredMove(null);
  }, []);



  // Layout control handlers - memoized to prevent infinite re-renders
  const handleLayoutChange = useCallback((layoutData) => {
    setLayoutInfo(layoutData);
  }, []);

  const toggleBoard = () => {
    setShowBoard(!showBoard);
  };

  const toggleGraph = () => {
    setShowGraph(!showGraph);
  };

  // Component visibility state for flexible layout (removed details)
  const componentVisibility = {
    board: showBoard,
    graph: showGraph
  };

  // Navigation handlers with unsaved changes check
  const handleNavigateBack = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
      setPendingNavigation('back');
    } else {
      navigate('/openings-book');
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
      setPendingNavigation('cancel');
    } else {
      navigate('/openings-book');
    }
  };

  const handleConfirmNavigation = () => {
    setIsNavigatingAway(true);
    setShowUnsavedChangesDialog(false);
    
    // Handle different types of navigation
    if (pendingNavigation === 'router-navigation' && pendingNavigationRef.current) {
      // For React Router navigation, use the stored navigation details
      const { to, options } = pendingNavigationRef.current;
      navigate(to, options);
      pendingNavigationRef.current = null;
    } else if (pendingNavigation === 'back' || pendingNavigation === 'cancel') {
      // For other navigation types, use navigate
      navigate('/openings-book');
    }
    
    setPendingNavigation(null);
  };

  const handleSaveAndNavigate = async () => {
    setIsNavigatingAway(true);
    setShowUnsavedChangesDialog(false);
    
    try {
      await handleSave();
      // handleSave already navigates on success, but if we have a blocked navigation, proceed with it
      if (pendingNavigation === 'router-navigation' && pendingNavigationRef.current) {
        const { to, options } = pendingNavigationRef.current;
        navigate(to, options);
        pendingNavigationRef.current = null;
      }
    } catch (error) {
      setIsNavigatingAway(false);
      console.error('Error saving before navigation:', error);
    }
    
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setShowUnsavedChangesDialog(false);
    
    // Clear the pending navigation to cancel it
    pendingNavigationRef.current = null;
    
    setPendingNavigation(null);
  };

  // NEW: Context menu actions for opening mode
  const contextMenuActions = useMemo(() => {
    if (canvasMode !== 'opening') {
      return null;
    }
    

    
    return [
      {
        label: 'Delete Move',
        icon: Trash2,
        onClick: (node) => {
          // Don't allow deleting the root node
          if (node.data.isRoot) {
            return;
          }
          
          // Find the actual tree node
          const treeNode = findNodeById(moveTree, node.id);
          if (treeNode && treeNode.parent) {
            setNodeToDelete(treeNode);
            setShowDeleteConfirmDialog(true);
          }
        },
        disabled: (node) => node.data.isRoot || !node.data.san
      }
    ];
  }, [canvasMode, moveTree]);

  // NEW: Handle confirmed node deletion
  const handleConfirmDelete = useCallback(() => {
    if (nodeToDelete && nodeToDelete.parent) {
      // Get the move notation for the confirmation message
      const moveNotation = nodeToDelete.san;
      
      // Create a deep clone of the tree FIRST to ensure React detects the change
      const cloneNode = (node, parent = null, skipNodeId = null) => {
        // Skip the node we want to delete
        if (node.id === skipNodeId) {
          return null;
        }
        
        const cloned = new MoveNode(node.san, node.fen, parent);
        cloned.id = node.id;
        cloned.isMainLine = node.isMainLine;
        cloned.comment = node.comment;
        cloned.links = [...(node.links || [])];
        cloned.arrows = [...(node.arrows || [])];
        cloned.moveId = node.moveId;
        
        // Clone children, filtering out the node to delete
        cloned.children = node.children
          .map(child => cloneNode(child, cloned, skipNodeId))
          .filter(child => child !== null);
        
        return cloned;
      };
      
      // Clone the entire tree, excluding the node to delete
      const updatedTree = cloneNode(moveTree, null, nodeToDelete.id);
      
      // Find node by ID in the cloned tree
      const findNodeInClone = (node, targetId) => {
        if (node.id === targetId) return node;
        for (const child of node.children) {
          const found = findNodeInClone(child, targetId);
          if (found) return found;
        }
        return null;
      };
      
      // Check if the deleted node is in the current path
      const isDeletedNodeInCurrentPath = () => {
        let node = currentNode;
        while (node) {
          if (node.id === nodeToDelete.id) return true;
          node = node.parent;
        }
        return false;
      };
      
      // Determine the new current node after deletion
      let newCurrentNode;
      let needsPathUpdate = false;
      
      if (currentNode === nodeToDelete || isDeletedNodeInCurrentPath()) {
        // If we're deleting the current node or an ancestor, go to parent of deleted node
        newCurrentNode = findNodeInClone(updatedTree, nodeToDelete.parent.id);
        needsPathUpdate = true;
      } else {
        // Otherwise, find the corresponding node in the cloned tree
        newCurrentNode = findNodeInClone(updatedTree, currentNode.id);
        needsPathUpdate = false;
      }
      
      if (newCurrentNode) {
        setCurrentNode(newCurrentNode);
        
        // Always rebuild the path to ensure it's correct
        const newPath = [];
        let current = newCurrentNode;
        while (current && current.parent) {
          newPath.unshift(current.san);
          current = current.parent;
        }
        
        // Use a new array instance to force React to see the change
        setCurrentPath([...newPath]);
        
        // Update unified performance state position
        performanceState.updateCurrentPosition(newCurrentNode.id, newCurrentNode.fen);
      } else {
        // If we can't find a node, go to root
        setCurrentNode(updatedTree);
        setCurrentPath([]);
        performanceState.updateCurrentPosition(updatedTree.id, updatedTree.fen);
      }
      
      // Recalculate main line after deletion
      MoveNode.calculateMainLine(updatedTree);
      
      setMoveTree(updatedTree);
      // Also increment version since we're setting a new tree
      setTreeVersion(v => v + 1);
      
      // Trigger change detection
      setTreeChangeVersion(v => v + 1);
      
            // Schedule auto-fit after deletion
      setTimeout(() => {
        performanceState.scheduleAutoFit('node-deleted', 200);
      }, 100);
      
      // No need for additional timeout - the state is already updated correctly
    }
    
    // Close dialog and reset state
    setShowDeleteConfirmDialog(false);
    setNodeToDelete(null);
  }, [nodeToDelete, currentNode, currentPath, moveTree, performanceState]);

  // NEW: Handle cancel deletion
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirmDialog(false);
    setNodeToDelete(null);
  }, []);

  // NEW: Handle right-click events
  const handleNodeRightClick = useCallback((event, node) => {
    if (canvasMode === 'opening') {
      // Context menu will be handled by the canvas component
      return;
    }
  }, [canvasMode]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading opening...</p>
        </div>
      </div>
    );
  }

  // Component toggle configuration (removed details)
  const componentToggleConfig = {
    board: { icon: Grid3x3, label: 'Board' },
    graph: { icon: Network, label: 'Graph' }
  };

  // Handle component toggles
  const handleComponentToggle = (componentKey) => {
    switch (componentKey) {
      case 'board':
        toggleBoard();
        break;
      case 'graph':
        toggleGraph();
        break;
    }
  };

  return (
    <div className="h-full w-full bg-slate-900">
      {/* Error Alert */}
      {error && (
        <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-slate-800 border-b border-slate-700">
          <Alert className="bg-red-900/20 border-red-700">
            <AlertDescription className="text-red-400">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content using FlexibleLayout with integrated AppBar */}
      <div className="h-full flex">
        {/* Main Layout */}
        <div className="flex-1 min-w-0">
          <FlexibleLayout
            title={
              <div className="flex items-center gap-2">
                {isNewOpening ? `Create Opening: ${name || 'Untitled'}` : `Edit Opening: ${name || 'Untitled'}`}
                {hasUnsavedChanges && (
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Unsaved Changes
                  </Badge>
                )}
              </div>
            }
            icon={Edit}
            leftControls={
              <Button
                variant="ghost"
                onClick={handleNavigateBack}
                className="text-slate-300 hover:text-white"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </Button>
            }
            rightControls={
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Opening
              </Button>
            }
                    components={componentVisibility}
        componentConfig={{
          board: {
            desktopWidth: '1fr',
            twoActive: {
              'board+graph': '1fr'
            },
            oneActive: '1fr'
          },
          graph: {
            desktopWidth: '1fr',
            twoActive: {
              'board+graph': '1fr'
            },
            oneActive: '1fr'
          }
        }}
        componentToggleConfig={componentToggleConfig}
            onComponentToggle={handleComponentToggle}
            onLayoutChange={handleLayoutChange}
          >
        {{

          board: (
            <LayoutSection
              key="board"
              noPadding={true}
            >
              <div className="h-full w-full flex items-center justify-center p-4">
                                  <InteractiveChessboard
                  currentMoves={currentPath}
                  onNewMove={handleNewMove}
                  onMoveSelect={(moves) => {
                    // When user navigates via chessboard, sync with tree
                    handleNewMove(moves);
                  }}
                  isWhiteTree={color === 'white'}
                  hoveredMove={movesHoveredMove || hoveredMove}
                  customArrows={currentNode?.arrows || []}
                  onArrowDraw={handleArrowDraw}
                  drawingMode={drawingMode}
                  onDrawingModeChange={handleDrawingModeToggle}
                  className="w-full max-w-none"
                  showPositionMessage={false}
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
                {/* Canvas Mode Toggle - Top Right */}
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newMode = canvasMode === 'opening' ? 'performance' : 'opening';
                      setCanvasMode(newMode);
                    
                    // Schedule auto-fit using the unified canvas state
                    setTimeout(() => {
                      performanceState.scheduleAutoFit('mode-change', 200);
                    }, 300);
                  }}
                  className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
                  title={`Switch to ${canvasMode === 'opening' ? 'Performance' : 'Opening'} view`}
                >
                  <Network className="w-4 h-4 mr-2" />
                  {canvasMode === 'opening' ? 'Performance' : 'Opening'}
                </Button>
                </div>
                
                <CanvasPerformanceGraph
                  graphData={canvasMode === 'opening' ? graphData : performanceGraphData}
                  mode={canvasMode}
                  onNodeClick={handleCanvasNodeClick}
                  onNodeHover={handleCanvasNodeHover}
                  onNodeHoverEnd={handleCanvasNodeHoverEnd}
                  onNodeRightClick={handleNodeRightClick}
                  contextMenuActions={contextMenuActions}
                  currentNodeId={performanceState.currentNodeId}
                  isGenerating={false}

                  showPerformanceControls={performanceState.showPerformanceControls}
                  onShowPerformanceControls={performanceState.setShowPerformanceControls}
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
                  // Performance control props
                  maxDepth={performanceState.maxDepth}
                  minGameCount={performanceState.minGameCount}
                  winRateFilter={performanceState.winRateFilter}
                  tempWinRateFilter={performanceState.tempWinRateFilter}
                  onMaxDepthChange={performanceState.handleMaxDepthChange}
                  onMinGameCountChange={performanceState.handleMinGameCountChange}
                  onWinRateFilterChange={performanceState.handleWinRateFilterChange}
                  onTempWinRateFilterChange={performanceState.handleTempWinRateFilterChange}
                  onApplyWinRateFilter={performanceState.applyWinRateFilter}
                  selectedPlayer={color}
                  onPlayerChange={setColor}
                  isClusteringLoading={false}
                  enableOpeningClusters={false}
                  className="w-full h-full"
                />
              </div>
            </LayoutSection>
          )
        }}
      </FlexibleLayout>
        </div>
        
        {/* Sidebar for Move Details */}
        <div className="w-80 bg-slate-800 border-l border-slate-700 flex-shrink-0">
          <div className="h-full p-4">
            <MoveDetailsPanel
              selectedNode={selectedNode}
              onUpdateNode={() => {
                setTreeVersion(v => v + 1);
                setTreeChangeVersion(v => v + 1);
              }}
              onSetMainLine={(node) => {
                // Set the main line to go through the selected node
                MoveNode.setMainLineToNode(moveTree, node);
                // Increment version to force re-render
                setTreeVersion(v => v + 1);
                // Trigger change detection
                setTreeChangeVersion(v => v + 1);
              }}
              moveTree={moveTree}
              drawingMode={drawingMode}
              onDrawingModeToggle={handleDrawingModeToggle}
            />
          </div>
        </div>
      </div>

      {/* NEW: Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent className="bg-slate-800/95 backdrop-blur-xl border-slate-700/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete Move
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete the move <span className="font-semibold text-white">{nodeToDelete?.san}</span>?
              <br />
              <span className="text-red-400 font-medium">This will also delete all moves that follow this move.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel 
              onClick={handleCancelDelete}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedChangesDialog} onOpenChange={handleCancelNavigation}>
        <AlertDialogContent className="bg-slate-800/95 backdrop-blur-xl border-slate-700/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-white">Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              You have unsaved changes to your opening. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel 
              onClick={handleCancelNavigation}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Keep Editing
            </AlertDialogCancel>
            <Button
              onClick={handleSaveAndNavigate}
              disabled={saving || isNavigatingAway}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {saving || isNavigatingAway ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save & Leave
                </>
              )}
            </Button>
            <AlertDialogAction 
              onClick={handleConfirmNavigation}
              disabled={isNavigatingAway}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isNavigatingAway ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Leaving...
                </>
              ) : (
                'Discard Changes'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 