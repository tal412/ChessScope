
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  Save, 
  Trash2,
  Loader2,
  Edit,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { userStudy as UserStudy, userStudyMove as UserStudyMove, moveAnnotation as MoveAnnotation } from '@/api/studyEntities';
import { Chess } from 'chess.js';
import { loadOpeningGraph } from '@/api/graphStorage';
import ChessAnalysisView from '../components/analysis/ChessAnalysisView';
import MoveDetailsSection from '../components/analysis/MoveDetailsSection';
import { createOpeningEditorConfig } from '../components/analysis/ChessAnalysisViewConfig.jsx';
import { createOpeningClusters } from '../utils/clusteringAnalysis';

// Move tree node structure
class MoveNode {
  constructor(san, fen, parent = null) {
    this.id = `${san}-${Date.now()}-${Math.random()}`;
    this.san = san;
    this.fen = fen;
    this.parent = parent;
    this.children = [];
    this.isMainLine = !parent || parent.children.length === 0;
    this.isInitialMove = false; // Whether this is the initial position for viewing
    this.comment = '';
    this.links = []; // Array of {title, url}
    this.arrows = []; // Array of {from, to, color} for colored arrows
  }
  
  addChild(san, fen) {
    const child = new MoveNode(san, fen, this);
    child.isMainLine = false;
    this.children.push(child);
    return child;
  }
  
  removeChild(childId) {
    this.children = this.children.filter(child => child.id !== childId);
    return true;
  }

  static calculateMainLine(rootNode) {
    const resetMainLine = (node) => {
      node.isMainLine = false;
      node.children.forEach(child => resetMainLine(child));
    };
    resetMainLine(rootNode);
    
    const setMainLinePath = (node) => {
      node.isMainLine = true;
      if (node.children.length > 0) {
        setMainLinePath(node.children[0]);
      }
    };
    
    setMainLinePath(rootNode);
  }

  static setMainLineToNode(rootNode, targetNode) {
    const resetMainLine = (node) => {
      node.isMainLine = false;
      node.children.forEach(child => resetMainLine(child));
    };
    resetMainLine(rootNode);
    
    // Build the path from root to target node
    const pathToTarget = [];
    let current = targetNode;
    while (current && current.parent) {
      pathToTarget.unshift(current);
      current = current.parent;
    }
    // Include the root node if it exists
    if (current) {
      pathToTarget.unshift(current);
    }
    
    // Mark all nodes in the path as main line
    pathToTarget.forEach(node => {
      node.isMainLine = true;
    });
    
    // Continue the main line from the target node by selecting the first child
    const continueMainLine = (node) => {
      if (node.children.length > 0) {
        const firstChild = node.children[0];
        firstChild.isMainLine = true;
        continueMainLine(firstChild);
      }
    };
    
    continueMainLine(targetNode);
  }

  static setInitialMoveToNode(rootNode, targetNode) {
    const resetInitialMove = (node) => {
      node.isInitialMove = false;
      node.children.forEach(child => resetInitialMove(child));
    };
    resetInitialMove(rootNode);
    
    // Only set initial move if targetNode is not the root
    if (targetNode && targetNode.san !== 'Start') {
      targetNode.isInitialMove = true;
    }
  }
}

export default function OpeningEditor() {
  const navigate = useNavigate();
  const { studyId } = useParams();
  const isNewStudy = !studyId;
  
  // Detect if we're in view mode vs edit mode based on the URL path
  const location = useLocation();
  const isViewMode = location.pathname.includes('/studies-book/study/');
  const isEditMode = location.pathname.includes('/studies-book/editor/') || isNewStudy;
  
  console.log('🔧 Mode detection:', {
    pathname: location.pathname,
    isViewMode,
    isEditMode,
    isNewStudy
  });
  
  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState('white');
  
  // Get initial FEN from URL parameters or use default
  const getInitialFen = () => {
    if (isNewStudy) {
      const urlParams = new URLSearchParams(window.location.search);
      const fenParam = urlParams.get('initialFen');
      if (fenParam) {
        return fenParam;
      }
    }
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  };
  
  // Initialize form state from URL parameters for new openings
  useEffect(() => {
    if (isNewStudy) {
      const urlParams = new URLSearchParams(window.location.search);
      const nameParam = urlParams.get('name');
      const colorParam = urlParams.get('color');
      const fenParam = urlParams.get('initialFen');
      const pgnParam = urlParams.get('startingPgn');
      
      if (nameParam) setName(nameParam);
      if (colorParam && ['white', 'black'].includes(colorParam)) setColor(colorParam);
      
      // If we have a custom FEN, update the move tree
      if (fenParam && fenParam !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
        const newTree = new MoveNode('Start', fenParam);
        setMoveTree(newTree);
        setCurrentNode(newTree);
        setTreeVersion(v => v + 1);
        setTreeChangeVersion(v => v + 1);
      }
      
      // If we have starting PGN moves, apply them after initializing the tree
      if (pgnParam) {
        try {
          const chess = new Chess(fenParam || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
          const moves = pgnParam.trim().split(/\s+/).filter(move => {
            return !/^\d+\./.test(move) && move !== '' && !move.startsWith('{') && !move.endsWith('}');
          });
          
          let currentTreeNode = fenParam ? new MoveNode('Start', fenParam) : new MoveNode('Start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
          
          // Apply each move from the PGN
          for (const moveStr of moves) {
            const move = chess.move(moveStr);
            if (move) {
              currentTreeNode = currentTreeNode.addChild(move.san, chess.fen());
            } else {
              console.error(`Failed to apply move: ${moveStr}`);
              break;
            }
          }
          
          // Get the root of the tree
          while (currentTreeNode.parent) {
            currentTreeNode = currentTreeNode.parent;
          }
          
          // Calculate main line
          MoveNode.calculateMainLine(currentTreeNode);
          
          setMoveTree(currentTreeNode);
          setCurrentNode(currentTreeNode);
          setTreeVersion(v => v + 1);
          setTreeChangeVersion(v => v + 1);
        } catch (error) {
          console.error('Error applying PGN moves:', error);
        }
      }
    }
  }, [isNewStudy]);
  
  // Move tree state - initialize with FEN from URL or default
  const initialTree = useMemo(() => new MoveNode('Start', getInitialFen()), []);
  const [moveTree, setMoveTree] = useState(initialTree);
  const [currentNode, setCurrentNode] = useState(initialTree);
  const [currentPath, setCurrentPath] = useState([]);
  const [treeVersion, setTreeVersion] = useState(0);
  const [treeChangeVersion, setTreeChangeVersion] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Auto-save state
  const autoSaveTimeoutRef = useRef(null);
  const [savedStudyId, setSavedOpeningId] = useState(null);
  
  // Hover state for chessboard arrows
  const [hoveredMove, setHoveredMove] = useState(null);
  const [movesHoveredMove, setMovesHoveredMove] = useState(null);
  
  // Arrow drawing state
  const [drawingMode, setDrawingMode] = useState(false);

  // Layout state
  const [showBoard, setShowBoard] = useState(true);
  const [showGraph, setShowGraph] = useState(true);
  const [showMoves, setShowMoves] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  
  // Canvas state
  const [canvasMode, setCanvasMode] = useState('opening');
  const [openingGraph, setOpeningGraph] = useState(null);
  const [performanceGraphData, setPerformanceGraphData] = useState({ nodes: [], edges: [], maxGameCount: 0 });
  
  // Graph data for canvas view
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  
  // Delete confirmation dialog state
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState(null);
  
  // Auto zoom state
  const [autoZoomOnClick, setAutoZoomOnClick] = useState(() => {
    const savedState = localStorage.getItem('canvas-auto-zoom-on-click');
    return savedState ? JSON.parse(savedState) : true;
  });
  
  const handleAutoZoomOnClickChange = useCallback((newState) => {
    setAutoZoomOnClick(newState);
    localStorage.setItem('canvas-auto-zoom-on-click', JSON.stringify(newState));
  }, []);
  
  // Helper functions
  const findNodeById = useCallback((root, targetId) => {
    if (root.id === targetId) return root;
    for (const child of root.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
    return null;
  }, []);

  const buildMoveSequenceFromNode = useCallback((node) => {
    if (!node || node.san === 'Start') return [];
    
    const sequence = [];
    let current = node;
    
    while (current.parent) {
      sequence.unshift(current.san);
      current = current.parent;
    }
    
    return sequence;
  }, []);
  
  // Handle arrow drawing from chessboard
  const handleArrowDraw = useCallback((from, to, color = null) => {
    if (currentNode) {
      const arrowColor = color || '#22c55e';
      const newArrow = { from, to, color: arrowColor };
      currentNode.arrows = [...(currentNode.arrows || []), newArrow];
      setTreeVersion(v => v + 1);
      setTreeChangeVersion(v => v + 1);
    }
  }, [currentNode]);

  // Handle drawing mode toggle
  const handleDrawingModeToggle = useCallback(() => {
    if (currentNode && currentNode.san === 'Start') {
      return;
    }
    setDrawingMode(!drawingMode);
  }, [drawingMode, currentNode]);

  // Automatically disable drawing mode when on start position
  useEffect(() => {
    if (currentNode && currentNode.san === 'Start' && drawingMode) {
      setDrawingMode(false);
    }
  }, [currentNode, drawingMode]);
  
  // Load existing opening
  const loadedOpeningIdRef = useRef(null);
  useEffect(() => {
    if (!isNewStudy) {
      const currentOpeningId = parseInt(studyId);
      const hasTreeData = moveTree && moveTree.children.length > 0;
      const isSameOpening = loadedOpeningIdRef.current === currentOpeningId;
      const hasValidOpeningData = hasTreeData && name && name.trim() !== '';
      const isAlreadyLoaded = (isSameOpening && hasTreeData) || hasValidOpeningData;
      
      if (!isAlreadyLoaded) {
        loadOpening();
      } else {
        loadedOpeningIdRef.current = currentOpeningId;
      }
    } else {
      // Reset state for new opening
      loadedOpeningIdRef.current = null;
      setSavedOpeningId(null);
      setCurrentNode(moveTree);
      setCurrentPath([]);
    }
  }, [studyId]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (isViewMode || !name.trim()) return;
    
    try {
      const username = localStorage.getItem('chesscope_username');
      
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
      
      const findInitialMove = (node) => {
        if (node.isInitialMove) return node;
        for (const child of node.children) {
          const found = findInitialMove(child);
          if (found) return found;
        }
        return null;
      };
      
      const initialMoveNode = findInitialMove(moveTree);
      const initialViewFen = initialMoveNode ? initialMoveNode.fen : moveTree.fen;

      const openingData = {
        username,
        name: name.trim(),
        color,
        initial_fen: moveTree.fen,
        initial_moves: getMainLine(moveTree),
        initial_view_fen: initialViewFen
      };
      
      let savedStudy;
      if (!savedStudyId) {
        // First time saving - create new opening
        savedStudy = await UserStudy.create(openingData);
        setSavedOpeningId(savedStudy.id);
        // Update URL to edit mode for existing opening
        window.history.replaceState(null, '', `/studies-book/editor/${savedStudy.id}`);
      } else {
        // Update existing opening
        await UserStudy.update(savedStudyId, openingData);
        savedStudy = { id: savedStudyId };
      }
      
      // Clear existing moves
      const existingMoves = await UserStudyMove.getByStudyId(savedStudy.id);
      for (const move of existingMoves) {
        await MoveAnnotation.deleteByMoveId(move.id);
        await UserStudyMove.delete(move.id);
      }
      
      // Save new moves
      let moveNumber = 1;
      const saveMoveNode = async (node, parentFen) => {
        if (node.san === 'Start') return;
        
        const moveData = {
          study_id: savedStudy.id,
          fen: node.fen,
          san: node.san,
          move_number: moveNumber++,
          parent_fen: parentFen,
          is_main_line: node.isMainLine,
          is_initial_move: node.isInitialMove,
          comment: node.comment || '',
          arrows: node.arrows || []
        };
        
        const savedMove = await UserStudyMove.create(moveData);
        
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
        
        for (const child of node.children) {
          await saveMoveNode(child, node.fen);
        }
      };
      
      for (const child of moveTree.children) {
        await saveMoveNode(child, moveTree.fen);
      }
        
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, [isViewMode, name, color, moveTree, savedStudyId]);

  // Immediate auto-save on changes
  useEffect(() => {
    if (isViewMode) return;
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save (500ms after last change for immediate feel)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 500);
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [name, color, moveTree, treeChangeVersion, autoSave, isViewMode]);

  // Load performance graph data
  useEffect(() => {
    const loadPerformanceData = async () => {
      const username = localStorage.getItem('chesscope_username');
      if (username) {
        const graph = await loadOpeningGraph(username);
        setOpeningGraph(graph);
      }
    };
    loadPerformanceData();
  }, []);

  // Update graph data when tree changes
  useEffect(() => {
    updateGraphData();
    
    if (graphData.nodes.length > 0 && isViewMode) {
      setTimeout(() => {
        // Schedule auto-fit for view mode
      }, 600);
    }
  }, [moveTree, openingGraph, treeVersion, isViewMode, color, currentNode]);

  // Handle performance mode overlay
  const navigateToPerformancePosition = useCallback(() => {
    if (!openingGraph || graphData.nodes.length === 0) return;
    
    console.log('🎯 navigateToPerformancePosition called with color:', color, 'nodes:', graphData.nodes.length);
    
    const overlayPerformanceData = () => {
      const enhancedNodes = [];
      const enhancedEdges = [];
      
      let maxGameCount = 0;
      
      // Calculate root total games
      let rootTotalGames = 0;
      try {
        const rootMoves = openingGraph.getRootMoves(color === 'white');
        rootTotalGames = rootMoves ? rootMoves.reduce((sum, move) => sum + (move.gameCount || 0), 0) : 0;
        console.log('📊 Root total games:', rootTotalGames, 'for color:', color, 'isWhite:', color === 'white');
      } catch (error) {
        console.error('Error calculating root total games:', error);
        rootTotalGames = 0;
      }
      
      // Process each node
      graphData.nodes.forEach(node => {
        const nodeData = { ...node.data };
        
        if (nodeData.isRoot) {
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
          let performanceData = null;
          let hasPerformanceData = false;
          
          try {
            const getMoveSequence = (nodeId) => {
              const sequence = [];
              let current = graphData.nodes.find(n => n.id === nodeId);
              
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
              const parentSequence = moveSequence.slice(0, -1);
              const moves = openingGraph.getMovesFromPosition(parentSequence, color === 'white');
              
              if (moves && moves.length > 0) {
                const matchingMove = moves.find(m => m.san === moveSequence[moveSequence.length - 1]);
                
                if (matchingMove) {
                  hasPerformanceData = true;
                  performanceData = {
                    winRate: matchingMove.details?.winRate || matchingMove.winRate || 50,
                    gameCount: matchingMove.gameCount || 0,
                    hasData: true
                  };
                  maxGameCount = Math.max(maxGameCount, performanceData.gameCount);
                  console.log('✅ Found performance data for move:', moveSequence[moveSequence.length - 1], 
                    'winRate:', performanceData.winRate, 'gameCount:', performanceData.gameCount);
                } else {
                  console.log('❌ No matching move found for:', moveSequence[moveSequence.length - 1], 'in moves:', moves.map(m => m.san));
                }
              } else {
                console.log('❌ No moves found for parent sequence:', parentSequence);
              }
            }
          } catch (error) {
            console.error('Error getting performance data for node:', error);
          }
          
          enhancedNodes.push({
            ...node,
            data: {
              ...nodeData,
              winRate: performanceData?.winRate || null,
              gameCount: performanceData?.gameCount || 0,
              performanceData: performanceData || { hasData: false, winRate: null, gameCount: 0 },
              isMissing: !hasPerformanceData
            }
          });
        }
      });
      
      // Process edges
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
    
    const enhancedGraph = overlayPerformanceData();
    
    // Generate opening clusters using DFS for connected openings
    const openingClusters = createOpeningClusters(enhancedGraph.nodes);
    enhancedGraph.openingClusters = openingClusters;
    
    setPerformanceGraphData(enhancedGraph);
    console.log('🎯 Performance graph data updated:', enhancedGraph.nodes.length, 'nodes, maxGameCount:', enhancedGraph.maxGameCount);
  }, [openingGraph, graphData, color]);

  // Update performance graph data when canvas mode changes
  useEffect(() => {
    console.log('🔄 Canvas mode effect triggered:', {
      canvasMode, 
      hasOpeningGraph: !!openingGraph, 
      nodesLength: graphData.nodes.length,
      shouldUpdate: canvasMode === 'performance' && openingGraph && graphData.nodes.length > 0
    });
    
    if (canvasMode === 'performance' && openingGraph && graphData.nodes.length > 0) {
      console.log('🔄 Updating performance graph data - canvasMode:', canvasMode, 'color:', color, 'nodes:', graphData.nodes.length);
      navigateToPerformancePosition();
    }
  }, [graphData.nodes.length, canvasMode, openingGraph, navigateToPerformancePosition]);
  
  // Also update performance graph data when player color changes
  useEffect(() => {
    console.log('🎨 Color change effect triggered:', {
      color, 
      canvasMode, 
      hasOpeningGraph: !!openingGraph,
      nodesLength: graphData.nodes.length,
      shouldUpdate: canvasMode === 'performance' && openingGraph && graphData.nodes.length > 0
    });
    
    if (canvasMode === 'performance' && openingGraph && graphData.nodes.length > 0) {
      console.log('🎨 Updating performance graph data due to color change - color:', color);
      navigateToPerformancePosition();
    }
  }, [color, canvasMode, openingGraph, graphData.nodes.length, navigateToPerformancePosition]);

  const updateGraphData = useCallback(() => {
    if (!moveTree) return;
    
    console.log('🎯 updateGraphData called with color:', color, 'moveTree children:', moveTree.children.length);
    
    const nodes = [];
    const edges = [];
    
    const nodeWidth = 180;
    const nodeHeight = 180;
    const horizontalSpacing = 240;
    const verticalSpacing = 350;
    
    // Calculate root total games
    let rootTotalGames = 0;
    if (openingGraph) {
      try {
        const rootMoves = openingGraph.getRootMoves(color === 'white');
        rootTotalGames = rootMoves ? rootMoves.reduce((sum, move) => sum + (move.gameCount || 0), 0) : 0;
        console.log('📊 updateGraphData - Root total games:', rootTotalGames, 'for color:', color);
      } catch (error) {
        console.error('Error calculating root total games:', error);
        rootTotalGames = 0;
      }
    }
    
    // Build tree structure
    const treeStructure = new Map();
    
    const buildTreeStructure = (node, depth = 0, parentId = null) => {
      const nodeId = node.id;
      
      treeStructure.set(nodeId, {
        children: [],
        parent: parentId,
        level: depth,
        width: 0,
        node: node
      });
      
      if (parentId) {
        const parentTreeNode = treeStructure.get(parentId);
        if (parentTreeNode) {
          parentTreeNode.children.push(nodeId);
        }
      }
      
      node.children.forEach(child => {
        buildTreeStructure(child, depth + 1, nodeId);
      });
    };
    
    buildTreeStructure(moveTree);
    
    // Calculate tree layout
    const calculateTreeLayout = () => {
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

      const assignPositions = (nodeId, x, y, availableWidth) => {
        const treeNode = treeStructure.get(nodeId);
        const node = treeNode?.node;
        
        if (!treeNode || !node) return;
        
        const moveSequence = buildMoveSequence(nodeId);
        
        if (node.san === 'Start' && treeNode.children.length > 0) {
          const childY = y + verticalSpacing;
          let currentX = -(availableWidth * horizontalSpacing) / 2;
          let childXs = [];
          
          for (const childId of treeNode.children) {
            const childTreeNode = treeStructure.get(childId);
            if (childTreeNode) {
              const childWidth = childTreeNode.width * horizontalSpacing;
              const childCenterX = currentX + childWidth / 2;
              childXs.push(childCenterX);
              
              assignPositions(childId, childCenterX, childY, childTreeNode.width);
              currentX += childWidth;
            }
          }
          
          let rootCenterX = 0;
          if (childXs.length === 1) {
            rootCenterX = childXs[0];
          } else if (childXs.length > 1) {
            rootCenterX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
          }
          
                      nodes.push({
              id: nodeId,
              type: 'custom',
              position: { x: rootCenterX - nodeWidth / 2, y },
              data: {
                label: node.san,
                san: node.san,
                fen: node.fen,
                isSelected: node === currentNode,
                isMainLine: node.isMainLine,
                isInitialMove: node.isInitialMove,
                hasComment: !!node.comment,
                hasLinks: node.links && node.links.some(link => link.title || link.url),
                linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0,
                arrows: node.arrows || [],
                annotation: {
                  hasComment: !!node.comment,
                  hasLinks: node.links && node.links.some(link => link.title || link.url),
                  commentCount: node.comment ? 1 : 0,
                  linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0
                },
                isRoot: node.san === 'Start',
                moveSequence: moveSequence,
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
          nodes.push({
            id: nodeId,
            type: 'custom',
            position: { x: x - nodeWidth / 2, y },
            data: {
              label: node.san,
              san: node.san,
              fen: node.fen,
              isSelected: node === currentNode,
              isMainLine: node.isMainLine,
              isInitialMove: node.isInitialMove,
              hasComment: !!node.comment,
              hasLinks: node.links && node.links.some(link => link.title || link.url),
              linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0,
              arrows: node.arrows || [],
              annotation: {
                hasComment: !!node.comment,
                hasLinks: node.links && node.links.some(link => link.title || link.url),
                commentCount: node.comment ? 1 : 0,
                linkCount: node.links ? node.links.filter(link => link.title || link.url).length : 0
              },
              isRoot: node.san === 'Start',
              moveSequence: moveSequence,
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
      
      calculateWidths(moveTree.id);
      const rootWidth = treeStructure.get(moveTree.id)?.width || 1;
      assignPositions(moveTree.id, 0, 0, rootWidth);
    };
    
    calculateTreeLayout();
    setGraphData({ nodes, edges });
  }, [moveTree, currentNode, openingGraph, color]);

  const loadOpening = async () => {
    try {
      setLoading(true);
      
      const openings = await UserStudy.filter({ id: parseInt(studyId) });
      if (openings.length === 0) {
        navigate('/studies-book');
        return;
      }
      
      const opening = openings[0];
      setName(opening.name);
      setColor(opening.color);
      setSavedOpeningId(opening.id);
      
      const moves = await UserStudyMove.getByStudyId(parseInt(studyId));
      
      const root = new MoveNode('Start', opening.initial_fen);
      const nodeMap = new Map();
      nodeMap.set(opening.initial_fen, root);
      
      moves.sort((a, b) => a.move_number - b.move_number);
      
      for (const move of moves) {
        const parentNode = nodeMap.get(move.parent_fen);
        if (parentNode) {
          const childNode = parentNode.addChild(move.san, move.fen);
          childNode.isMainLine = move.is_main_line;
          childNode.isInitialMove = move.is_initial_move || false;
          childNode.comment = move.comment || '';
          childNode.links = [];
          childNode.arrows = move.arrows || [];
          nodeMap.set(move.fen, childNode);
          childNode.moveId = move.id;
        }
      }
      
      for (const [fen, node] of nodeMap) {
        if (node.moveId) {
          const annotations = await MoveAnnotation.getByMoveId(node.moveId);
          node.links = annotations
            .filter(ann => ann.type === 'link')
            .map(ann => ({ title: ann.content, url: ann.url }));
        }
      }
      
      MoveNode.calculateMainLine(root);
      
      setMoveTree(root);
      
      // Find the initial move node for navigation (UI preference only)
      const findInitialMove = (node) => {
        if (node.isInitialMove) return node;
        for (const child of node.children) {
          const found = findInitialMove(child);
          if (found) return found;
        }
        return null;
      };
      
      const initialMoveNode = findInitialMove(root);
      
      // Only use initial move for navigation in view mode, not edit mode
      if (isViewMode && initialMoveNode) {
        setCurrentNode(initialMoveNode);
        
        // Set the current path to the initial move
        const initialPath = [];
        let current = initialMoveNode;
        while (current.parent) {
          initialPath.unshift(current.san);
          current = current.parent;
        }
        setCurrentPath(initialPath);
      } else {
        // In edit mode or when no initial move is set, start at root
        setCurrentNode(root);
        setCurrentPath([]);
      }
      
      loadedOpeningIdRef.current = parseInt(studyId);
      
    } catch (error) {
      console.error('Error loading opening:', error);
      navigate('/studies-book');
    } finally {
      setLoading(false);
    }
  };

  // Manual save removed - everything is auto-saved

  // Keyboard shortcuts - removed manual save since we auto-save everything
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Auto-save is always active, no manual save needed
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewMove = (newMoves) => {
    console.log('🎯 handleNewMove called with:', {
      newMoves,
      isViewMode,
      moveTreeChildren: moveTree?.children.length || 0,
      currentNodeSan: currentNode?.san || 'null'
    });
    
    if (newMoves.length === 0) {
      setCurrentNode(moveTree);
      setCurrentPath([]);
      return;
    }
    
    // Start from root and traverse the entire move sequence
    let node = moveTree;
    let i = 0;
    let needsUpdate = false;
    
    console.log('🔍 Starting from root node:', node.san, 'at position:', node.fen);
    
    // Traverse existing moves in the tree
    console.log('🔍 Starting to traverse existing moves...');
    while (i < newMoves.length) {
      const move = newMoves[i];
      const existingChild = node.children.find(c => c.san === move);
      
      console.log(`🔍 Move ${i}: ${move}, existing child:`, existingChild?.san || 'none');
      
      if (existingChild) {
        node = existingChild;
        i++;
      } else {
        console.log(`🛑 No existing child for move: ${move}, breaking at index ${i}`);
        break;
      }
    }
    
    console.log('🔍 After traversal:', {
      finalIndex: i,
      totalMoves: newMoves.length,
      needsNewMoves: i < newMoves.length,
      isViewMode,
      canAddMoves: i < newMoves.length && !isViewMode
    });
    
    // Add any remaining moves to the tree
    if (i < newMoves.length && !isViewMode) {
      console.log('✅ Adding new moves starting from index:', i);
      const chess = new Chess(node.fen);
      
      while (i < newMoves.length) {
        const moveToAdd = newMoves[i];
        console.log(`🔄 Trying to add move: ${moveToAdd} to position:`, chess.fen());
        
        const move = chess.move(moveToAdd);
        if (move) {
          console.log(`✅ Successfully added move: ${move.san} (${moveToAdd})`);
          node = node.addChild(move.san, chess.fen());
          needsUpdate = true;
        } else {
          console.log(`❌ Failed to add move: ${moveToAdd}`);
          break;
        }
        i++;
      }
    } else if (i < newMoves.length && isViewMode) {
      console.log('❌ Trying to add moves in view mode - not allowed');
    } else {
      console.log('✅ All moves already exist in tree');
    }
    
    // In view mode, if we didn't find all moves in the tree, don't set currentNode
    // This prevents the blink when navigating to moves not in the opening
    if (isViewMode && i < newMoves.length) {
      console.log('🚫 Not setting currentNode in view mode for moves not fully in tree');
      return; // Exit early without setting currentNode or currentPath
    }
    
    setCurrentNode(node);
    
    // Calculate the full path from root to current node
    const fullPath = [];
    let pathNode = node;
    while (pathNode && pathNode.parent) {
      fullPath.unshift(pathNode.san);
      pathNode = pathNode.parent;
    }
    setCurrentPath(fullPath);
    
    console.log('🔄 Set current path:', fullPath);
    
    // Also notify the analysis view about the path change so ChunkVisualization stays in sync
    if (fullPath.length !== currentPath.length || 
        !fullPath.every((move, index) => move === currentPath[index])) {
      console.log('🔄 Triggering onCurrentMovesChange to sync ChunkVisualization');
      // This will be handled by the ChessAnalysisView's handleMovesCurrentMovesChange
    }
    
    // Always trigger save after any move operation (whether new moves were added or just navigation)
    if (!isViewMode) {
      console.log('🔄 Updating tree version and recalculating main line');
      MoveNode.calculateMainLine(moveTree);
      setTreeVersion(v => v + 1);
      setTreeChangeVersion(v => v + 1);
    }
  };
  
  const handleNodeSelect = (node) => {
    console.log('🎯 handleNodeSelect called with node:', node?.san || node?.data?.san || 'null');
    
    // If this is a graph node (from canvas), convert it to tree node
    if (node && node.data && !node.san) {
      console.log('🔍 Converting graph node to tree node, ID:', node.id);
      const treeNode = findNodeById(moveTree, node.id);
      if (treeNode) {
        console.log('✅ Found tree node:', treeNode.san);
        setCurrentNode(treeNode);
        
        const path = [];
        let current = treeNode;
        while (current.parent) {
          path.unshift(current.san);
          current = current.parent;
        }
        setCurrentPath(path);
      } else {
        console.log('❌ Could not find tree node for graph node ID:', node.id);
        // Don't set currentNode to invalid node - this prevents the blink
      }
    } else if (node) {
      // This is already a tree node - verify it's valid
      const isValidNode = findNodeById(moveTree, node.id);
      if (isValidNode) {
        setCurrentNode(node);
        
        const path = [];
        let current = node;
        while (current && current.parent) {
          path.unshift(current.san);
          current = current.parent;
        }
        setCurrentPath(path);
      } else {
        console.log('❌ Invalid tree node, not setting currentNode');
        // Don't set currentNode to invalid node - this prevents the blink
      }
    }
  };
  
  const handleNodeDelete = (node) => {
    if (node.parent) {
      node.parent.removeChild(node.id);
      if (currentNode === node) {
        setCurrentNode(node.parent);
      }
      
      MoveNode.calculateMainLine(moveTree);
      setTreeVersion(v => v + 1);
      setTreeChangeVersion(v => v + 1);
    }
  };

  // Context menu actions
  const contextMenuActions = useMemo(() => {
    if (canvasMode !== 'opening' || isViewMode) {
      return null;
    }
    
    return [
      {
        label: 'Delete Move',
        icon: Trash2,
        onClick: (node) => {
          if (node.data.isRoot) {
            return;
          }
          
          const treeNode = findNodeById(moveTree, node.id);
          if (treeNode && treeNode.parent) {
            setNodeToDelete(treeNode);
            setShowDeleteConfirmDialog(true);
          }
        },
        disabled: (node) => node.data.isRoot || !node.data.san
      }
    ];
  }, [canvasMode, moveTree, isViewMode, findNodeById]);

  const handleConfirmDelete = useCallback(() => {
    if (nodeToDelete && nodeToDelete.parent) {
      const cloneNode = (node, parent = null, skipNodeId = null) => {
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
        
        cloned.children = node.children
          .map(child => cloneNode(child, cloned, skipNodeId))
          .filter(child => child !== null);
        
        return cloned;
      };
      
      const updatedTree = cloneNode(moveTree, null, nodeToDelete.id);
      
      const findNodeInClone = (node, targetId) => {
        if (node.id === targetId) return node;
        for (const child of node.children) {
          const found = findNodeInClone(child, targetId);
          if (found) return found;
        }
        return null;
      };
      
      const isDeletedNodeInCurrentPath = () => {
        let node = currentNode;
        while (node) {
          if (node.id === nodeToDelete.id) return true;
          node = node.parent;
        }
        return false;
      };
      
      let newCurrentNode;
      
      if (currentNode === nodeToDelete || isDeletedNodeInCurrentPath()) {
        newCurrentNode = findNodeInClone(updatedTree, nodeToDelete.parent.id);
      } else {
        newCurrentNode = findNodeInClone(updatedTree, currentNode.id);
      }
      
      if (newCurrentNode) {
        setCurrentNode(newCurrentNode);
        
        const newPath = [];
        let current = newCurrentNode;
        while (current && current.parent) {
          newPath.unshift(current.san);
          current = current.parent;
        }
        
        setCurrentPath([...newPath]);
      } else {
        setCurrentNode(updatedTree);
        setCurrentPath([]);
      }
      
      MoveNode.calculateMainLine(updatedTree);
      setMoveTree(updatedTree);
      setTreeVersion(v => v + 1);
      setTreeChangeVersion(v => v + 1);
    }
    
    setShowDeleteConfirmDialog(false);
    setNodeToDelete(null);
  }, [nodeToDelete, currentNode, moveTree]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirmDialog(false);
    setNodeToDelete(null);
  }, []);

  // Simple navigation handlers - no more dialogs!
  const handleNavigateBack = () => {
    navigate('/studies-book');
  };

  const handleCancel = () => {
    navigate('/studies-book');
  };

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

  // Create move details section (memoized to update when currentNode changes)
  const moveDetailsSection = useMemo(() => {
    console.log('🔧 Creating move details section for node:', currentNode?.san || 'null');
    
    return (
      <MoveDetailsSection
        key={`${currentNode?.id || 'none'}`}
        selectedNode={currentNode}
        onUpdateNode={isViewMode ? null : () => {
          setTreeVersion(v => v + 1);
          setTreeChangeVersion(v => v + 1);
        }}
        onSetMainLine={isViewMode ? null : (node) => {
          MoveNode.setMainLineToNode(moveTree, node);
          // Force currentNode to update by incrementing treeChangeVersion
          setTreeChangeVersion(v => v + 1);
          setTreeVersion(v => v + 1);
        }}
        onSetInitialMove={isViewMode ? null : (node) => {
          MoveNode.setInitialMoveToNode(moveTree, node);
          // Force currentNode to update by incrementing treeChangeVersion
          setTreeChangeVersion(v => v + 1);
          setTreeVersion(v => v + 1);
        }}
        moveTree={moveTree}
        drawingMode={drawingMode}
        onDrawingModeToggle={handleDrawingModeToggle}
        readOnly={isViewMode}
      />
    );
  }, [currentNode, isViewMode, moveTree, drawingMode, handleDrawingModeToggle, treeChangeVersion]);

  // Create configuration for ChessAnalysisView
  const analysisConfig = useMemo(() => {
    console.log('🔧 Creating analysis config:', {
      isViewMode,
      canvasMode,
      color,
      graphDataNodes: graphData.nodes.length,
      performanceGraphDataNodes: performanceGraphData.nodes.length,
      hasOpeningGraph: !!openingGraph,
      currentNodeSan: currentNode?.san || 'null'
    });
    
    return createOpeningEditorConfig({
      mode: isViewMode ? 'opening-viewer' : 'opening-editor',
      name,
      lastSaved: null, // Remove save status
      onSave: null, // Remove manual save option
      onEdit: isViewMode ? () => navigate(`/studies-book/editor/${studyId}`) : null,
      onView: isEditMode ? () => navigate(`/studies-book/study/${studyId}`) : null,
      onNavigateBack: handleNavigateBack,
      studyId,
      selectedPlayer: color,
      onSelectedPlayerChange: (newColor) => {
        console.log('🎨 Player color changed from', color, 'to', newColor);
        setColor(newColor);
      },
      graphData,
      performanceGraphData,
      openingGraph,
      moveTree,
      currentNode,
      canvasMode,
      onCanvasModeChange: (newMode) => {
        console.log('📊 Canvas mode changed from', canvasMode, 'to', newMode);
        setCanvasMode(newMode);
      },
      loading,
      saving: false, // Remove saving indicator
      autoZoomOnClick,
      onAutoZoomOnClickChange: handleAutoZoomOnClickChange,
      contextMenuActions,
      customArrows: currentNode?.arrows || [],
      onArrowDraw: handleArrowDraw,
      drawingMode,
      onDrawingModeChange: setDrawingMode,
      detailsPanel: moveDetailsSection
    });
  }, [
    isViewMode,
    name,
    navigate,
    studyId,
    handleNavigateBack,
    color,
    graphData,
    performanceGraphData,
    openingGraph,
    moveTree,
    currentNode,
    canvasMode,
    loading,
    autoZoomOnClick,
    handleAutoZoomOnClickChange,
    contextMenuActions,
    handleArrowDraw,
    drawingMode,
    moveDetailsSection
  ]);

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

      <ChessAnalysisView
        {...analysisConfig}
        // Component visibility
        showMoves={showMoves}
        showBoard={showBoard}
        showGraph={showGraph}
        showDetails={showDetails}
        onShowMovesChange={setShowMoves}
        onShowBoardChange={setShowBoard}
        onShowGraphChange={setShowGraph}
        onShowDetailsChange={setShowDetails}
        // Move handling
        currentMoves={currentPath}
        onCurrentMovesChange={(newPath) => {
          console.log('🔄 onCurrentMovesChange called with:', newPath);
          setCurrentPath(newPath);
        }}
        onNewMove={handleNewMove}
        // Node selection
        onCurrentNodeChange={(node) => {
          console.log('🔧 onCurrentNodeChange called with node:', node?.san || 'null');
          setCurrentNode(node);
        }}
        onNodeSelect={handleNodeSelect}
        // Hover move state
                  hoveredMove={movesHoveredMove || hoveredMove}
        onHoveredMoveChange={setHoveredMove}
        // Context menu
        onNodeRightClick={(event, node) => {
          if (canvasMode === 'opening') {
            return;
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50">
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


    </div>
  );
}