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
  AppBar, 
  ComponentToggleButton, 
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
  Edit3
} from 'lucide-react';
import InteractiveChessboard from '@/components/chess/InteractiveChessboard';
import { UserOpening, UserOpeningMove, MoveAnnotation } from '@/api/entities';
import { Chess } from 'chess.js';
import CanvasPerformanceGraph from '@/components/chess/CanvasPerformanceGraph';
import { cn } from '@/lib/utils';
import { loadOpeningGraph } from '@/api/graphStorage';
import { createPositionClusters, createOpeningClusters } from '../utils/clusteringAnalysis';

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
    this.arrows = [];
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
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('white');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  
  // Move tree state
  const [moveTree, setMoveTree] = useState(new MoveNode('Start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  const [currentNode, setCurrentNode] = useState(moveTree);
  const [currentPath, setCurrentPath] = useState([]);
  
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
  
  // Layout state - using flexible layout system
  const [layoutInfo, setLayoutInfo] = useState({});
  const [showDetails, setShowDetails] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [showTree, setShowTree] = useState(true);
  
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

  // Set initial state after loading or on mount for new openings
  useEffect(() => {
    if (!loading && !initialState) {
      setInitialState({
        name,
        description,
        color,
        tags: [...tags],
        moveTreeId: moveTree.id
      });
    }
  }, [loading, name, description, color, tags, moveTree.id, initialState]);

  // Set initial state immediately for new openings
  useEffect(() => {
    if (isNewOpening && !initialState && !loading) {
      setInitialState({
        name: '',
        description: '',
        color: 'white',
        tags: [],
        moveTreeId: moveTree.id
      });
    }
  }, [isNewOpening, initialState, loading, moveTree.id]);

  // Track changes
  useEffect(() => {
    if (!initialState) return;
    
    const currentState = {
      name,
      description,
      color,
      tags: [...tags],
      moveTreeId: moveTree.id
    };
    
    const hasChanges = 
      currentState.name !== initialState.name ||
      currentState.description !== initialState.description ||
      currentState.color !== initialState.color ||
      JSON.stringify(currentState.tags) !== JSON.stringify(initialState.tags) ||
      currentState.moveTreeId !== initialState.moveTreeId;
    
    setHasUnsavedChanges(hasChanges);
  }, [name, description, color, tags, moveTree.id, initialState]);

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
      
      // Process each node in the opening tree
      graphData.nodes.forEach(node => {
        const nodeData = { ...node.data };
        
        if (nodeData.isRoot) {
          // Root node - handle differently based on whether we have moves or not
          if (hasOnlyStartPosition) {
            // For start-only position, keep it simple and clean like opening mode
            enhancedNodes.push({
              ...node,
              data: {
                ...nodeData,
                // Don't add performance data for start-only case to avoid styling issues
                winRate: null,
                gameCount: null,
                performanceData: null,
                isMissing: false // Don't mark as missing to avoid gray styling
              }
            });
          } else {
            // For root with moves, add neutral performance styling
            enhancedNodes.push({
              ...node,
              data: {
                ...nodeData,
                winRate: 50,
                gameCount: 0,
                performanceData: {
                  hasData: true,
                  winRate: 50,
                  gameCount: 0
                },
                isMissing: false
              }
            });
          }
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

  // Update graph data when tree changes
  useEffect(() => {
    // Always update the underlying opening tree data when the tree changes
    updateGraphData();
  }, [moveTree?.id]); // Only trigger on tree changes
  
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
      setDescription(opening.description || '');
      setColor(opening.color);
      setTags(opening.tags || []);
      
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

  const updateGraphData = () => {
    if (!moveTree) return;
    
    const nodes = [];
    const edges = [];
    
    const nodeWidth = 180;
    const nodeHeight = 180;
    const horizontalSpacing = 240; // Reduced from 250 to match performance graph
    const verticalSpacing = 350; // Increased from 250 to match performance graph
    
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
              hasLinks: node.links && node.links.length > 0,
              linkCount: node.links ? node.links.length : 0,
              annotation: {
                hasComment: !!node.comment,
                hasLinks: node.links && node.links.length > 0,
                commentCount: node.comment ? 1 : 0,
                linkCount: node.links ? node.links.length : 0
              },
              isRoot: node.san === 'Start',
              moveSequence: moveSequence, // Add move sequence for move color determination
              // For compatibility with performance mode
              winRate: null,
              totalGames: null,
              gameCount: null,
              performanceData: null
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
              hasLinks: node.links && node.links.length > 0,
              linkCount: node.links ? node.links.length : 0,
              annotation: {
                hasComment: !!node.comment,
                hasLinks: node.links && node.links.length > 0,
                commentCount: node.comment ? 1 : 0,
                linkCount: node.links ? node.links.length : 0
              },
              isRoot: node.san === 'Start',
              moveSequence: moveSequence, // Add move sequence for move color determination
              // For compatibility with performance mode
              winRate: null,
              totalGames: null,
              gameCount: null,
              performanceData: null
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
  };

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
        description: description.trim(),
        color,
        initial_fen: moveTree.fen,
        initial_moves: getMainLine(moveTree),
        tags
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
        description: description.trim(),
        color,
        tags: [...tags],
        moveTreeId: moveTree.id
      });
      
      // Navigate to the opening view
      navigate(`/openings-book/opening/${savedOpening.id}`);
      
    } catch (error) {
      console.error('Error saving opening:', error);
      setError('Failed to save opening');
    } finally {
      setSaving(false);
    }
  }, [isNewOpening, openingId, name, description, color, tags, moveTree, navigate]);

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
    
    // Find where the path diverges from current position
    let node = moveTree;
    let i = 0;
    
    // Follow existing path as far as possible
    while (i < newMoves.length && node.children.length > 0) {
      const childNode = node.children.find(c => c.san === newMoves[i]);
      if (childNode) {
        node = childNode;
        i++;
      } else {
        break;
      }
    }
    
    // Add new moves from divergence point
    const chess = new Chess(node.fen);
    while (i < newMoves.length) {
      const move = chess.move(newMoves[i]);
      if (move) {
        node = node.addChild(move.san, chess.fen());
      }
      i++;
    }
    
    // Update current position
    setCurrentNode(node);
    
    // Update path
    const path = [];
    let current = node;
    while (current.parent) {
      path.unshift(current.san);
      current = current.parent;
    }
    setCurrentPath(path);
    
    // Update unified performance state position
    performanceState.updateCurrentPosition(node.id, node.fen);
    
    // Recalculate main line after adding moves
    MoveNode.calculateMainLine(moveTree);
    
    // Force re-render of tree with new ID to trigger graph regeneration
    const updatedTree = { ...moveTree };
    updatedTree.id = `${moveTree.id}-${Date.now()}`;
    setMoveTree(updatedTree);
    
    // Schedule auto-fit after tree update (longer delay to ensure graph is updated)
    // Use the unified canvas state for both modes
    setTimeout(() => {
      performanceState.scheduleAutoFit('new-move-added', 200);
    }, 300);
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
      
      // Force re-render with new ID to trigger graph regeneration
      const updatedTree = { ...moveTree };
      updatedTree.id = `${moveTree.id}-${Date.now()}`;
      setMoveTree(updatedTree);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Memoized node click handler to prevent infinite re-renders
  const handleCanvasNodeClick = useCallback((e, node) => {
    if (canvasMode === 'opening' && node.data && !node.data.isRoot) {
      const treeNode = findNodeById(moveTree, node.id);
      if (treeNode) {
        // Check if clicking on currently selected node - if so, deselect it
        if (performanceState.currentNodeId === treeNode.id) {
          // Deselect the current node
          setCurrentNode(null);
          setCurrentPath([]);
          // Clear performance state position
          performanceState.updateCurrentPosition(null, null);
          return;
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
    
    // Schedule auto-fit when layout changes (after a delay to let layout settle)
    setTimeout(() => {
      performanceState.scheduleAutoFit('layout-change', 200);
    }, 300);
  }, [performanceState.scheduleAutoFit]);

  const toggleDetails = () => {
    setShowDetails(!showDetails);
    // Schedule auto-fit after layout change
    setTimeout(() => {
      performanceState.scheduleAutoFit('details-toggle', 200);
    }, 300);
  };

  const toggleEditor = () => {
    setShowEditor(!showEditor);
    // Schedule auto-fit after layout change
    setTimeout(() => {
      performanceState.scheduleAutoFit('editor-toggle', 200);
    }, 300);
  };

  const toggleTree = () => {
    setShowTree(!showTree);
    // Schedule auto-fit after layout change
    setTimeout(() => {
      performanceState.scheduleAutoFit('tree-toggle', 200);
    }, 300);
  };

  // Component visibility state for flexible layout
  const componentVisibility = {
    details: showDetails,
    editor: showEditor,
    tree: showTree
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
      
      // Remove the node and all its children
      nodeToDelete.parent.removeChild(nodeToDelete.id);
      
      // If deleted node was current, move to parent
      if (currentNode === nodeToDelete) {
        setCurrentNode(nodeToDelete.parent);
        setCurrentPath(currentPath.slice(0, -1)); // Remove last move from path
        // Update unified performance state position
        performanceState.updateCurrentPosition(nodeToDelete.parent.id, nodeToDelete.parent.fen);
      }
      
      // Recalculate main line after deletion
      MoveNode.calculateMainLine(moveTree);
      
      // Force re-render with new ID to trigger graph regeneration
      const updatedTree = { ...moveTree };
      updatedTree.id = `${moveTree.id}-${Date.now()}`;
      setMoveTree(updatedTree);
      
      // Schedule auto-fit after deletion
      setTimeout(() => {
        performanceState.scheduleAutoFit('node-deleted', 200);
      }, 100);
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

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      {/* Header using AppBar */}
      <AppBar
        title={
          <div className="flex items-center gap-2">
            {isNewOpening ? 'Create New Opening' : 'Edit Opening'}
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
        centerControls={
          <>
            <ComponentToggleButton
              isActive={showDetails}
              onClick={toggleDetails}
              icon={FileText}
              label="Details"
            />
            <ComponentToggleButton
              isActive={showEditor}
              onClick={toggleEditor}
              icon={Grid3x3}
              label="Editor"
            />
            <ComponentToggleButton
              isActive={showTree}
              onClick={toggleTree}
              icon={Network}
              label="Tree"
            />
          </>
        }
        rightControls={
          <>
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-slate-600 text-slate-300"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Opening
            </Button>
          </>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <Alert className="bg-red-900/20 border-red-700">
            <AlertDescription className="text-red-400">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content using FlexibleLayout */}
      <FlexibleLayout
        components={componentVisibility}
        componentConfig={ComponentConfigs.openingEditor}
        onLayoutChange={handleLayoutChange}
      >
        {{
          details: (
            <LayoutSection
              key="details"
            >
              <div className="space-y-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-slate-100">Opening Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Italian Game - Giuoco Piano"
                        className="bg-slate-700 border-slate-600 text-slate-100"
                      />
                    </div>

                    <div>
                      <Label className="text-slate-300">Description</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your opening..."
                        className="bg-slate-700 border-slate-600 text-slate-100"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label className="text-slate-300">Color</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={color === 'white' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setColor('white')}
                          className={color === 'white' ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700/30'}
                        >
                          <Crown className="w-4 h-4 mr-1 text-amber-400" />
                          White
                        </Button>
                        <Button
                          variant={color === 'black' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setColor('black')}
                          className={color === 'black' ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700/30'}
                        >
                          <Shield className="w-4 h-4 mr-1 text-slate-400" />
                          Black
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-slate-300">Tags</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                          placeholder="Add tag..."
                          className="bg-slate-700 border-slate-600 text-slate-100"
                        />
                        <Button
                          onClick={handleAddTag}
                          size="sm"
                          className="bg-slate-600 hover:bg-slate-700"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="bg-slate-700 text-slate-300"
                          >
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-2 hover:text-red-400"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Move Annotations */}
                {selectedNode && selectedNode.san !== 'Start' && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-lg">
                        Move: {selectedNode.san}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-slate-300">
                          <MessageSquare className="w-4 h-4 inline mr-1" />
                          Comment
                        </Label>
                        <Textarea
                          value={selectedNode.comment || ''}
                          onChange={(e) => {
                            selectedNode.comment = e.target.value;
                            setMoveTree({ ...moveTree }); // Force re-render
                          }}
                          placeholder="Add notes about this move..."
                          className="bg-slate-700 border-slate-600 text-slate-100 mt-2"
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label className="text-slate-300">
                          <LinkIcon className="w-4 h-4 inline mr-1" />
                          Links
                        </Label>
                        <div className="space-y-2 mt-2">
                          {selectedNode.links?.map((link, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={link.title}
                                onChange={(e) => {
                                  selectedNode.links[index].title = e.target.value;
                                  setMoveTree({ ...moveTree });
                                }}
                                placeholder="Link title"
                                className="bg-slate-700 border-slate-600 text-slate-100 flex-1"
                              />
                              <Input
                                value={link.url}
                                onChange={(e) => {
                                  selectedNode.links[index].url = e.target.value;
                                  setMoveTree({ ...moveTree });
                                }}
                                placeholder="URL"
                                className="bg-slate-700 border-slate-600 text-slate-100 flex-1"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  selectedNode.links.splice(index, 1);
                                  setMoveTree({ ...moveTree });
                                }}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!selectedNode.links) selectedNode.links = [];
                              selectedNode.links.push({ title: '', url: '' });
                              setMoveTree({ ...moveTree });
                            }}
                            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Link
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-slate-300">
                          Main Line Status
                        </Label>
                        <Button
                          size="sm"
                          className="w-full mt-2 bg-slate-600 hover:bg-slate-700"
                          disabled={selectedNode.isMainLine}
                          onClick={() => {
                            // Set the main line to go through the selected node
                            MoveNode.setMainLineToNode(moveTree, selectedNode);
                            
                            // Force tree update with new ID to trigger graph regeneration
                            const updatedTree = { ...moveTree };
                            updatedTree.id = `${moveTree.id}-${Date.now()}`;
                            setMoveTree(updatedTree);
                          }}
                        >
                          {selectedNode.isMainLine ? 'Already Main Line' : 'Set as Main Line'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </LayoutSection>
          ),

          editor: (
            <LayoutSection
              key="editor"
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
                  className="w-full max-w-none"
                  showPositionMessage={false}
                />
              </div>
            </LayoutSection>
          ),

          tree: (
            <LayoutSection
              key="tree"
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