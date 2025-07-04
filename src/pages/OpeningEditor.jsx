import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  X, 
  ChevronLeft,
  Trash2,
  Plus,
  Eye,
  Edit3,
  MessageSquare,
  LinkIcon,
  Info,
  Crown,
  Shield,
  Loader2,
  BarChart3
} from 'lucide-react';
import InteractiveChessboard from '@/components/chess/InteractiveChessboard';
import { UserOpening, UserOpeningMove, MoveAnnotation } from '@/api/entities';
import { Chess } from 'chess.js';
import CanvasPerformanceGraph from '@/components/chess/CanvasPerformanceGraph';
import { cn } from '@/lib/utils';
import { loadOpeningGraph } from '@/api/graphStorage';

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
    // If this is not the first child, it's a variation
    if (this.children.length > 0) {
      child.isMainLine = false;
    }
    this.children.push(child);
    return child;
  }
  
  removeChild(childId) {
    this.children = this.children.filter(child => child.id !== childId);
    // If we removed the main line, make the first remaining child the main line
    if (this.children.length > 0 && !this.children.some(c => c.isMainLine)) {
      this.children[0].isMainLine = true;
    }
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
  const [selectedNode, setSelectedNode] = useState(moveTree);
  const [currentPath, setCurrentPath] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('moves');
  
  // Canvas state
  const [canvasMode, setCanvasMode] = useState('opening'); // 'opening' | 'performance'
  const [openingGraph, setOpeningGraph] = useState(null); // For performance mode
  
  // Load existing opening
  useEffect(() => {
    if (!isNewOpening) {
      loadOpening();
    }
  }, [openingId]);
  
  // Memoize the graph structure (without selection state)
  const graphStructure = useMemo(() => {
    if (!moveTree) return { nodes: [], edges: [] };
    
    const nodes = [];
    const edges = [];
    
    const nodeWidth = 180;
    const nodeHeight = 180;
    const horizontalSpacing = 250;
    const verticalSpacing = 250;
    
    const traverseTree = (node, depth = 0, parentId = null, xOffset = 0) => {
      const nodeId = node.id;
      
      // Calculate position
      const x = xOffset * horizontalSpacing;
      const y = depth * verticalSpacing;
      
      // Add node with all necessary data except selection state
      nodes.push({
        id: nodeId,
        type: 'custom',
        position: { x, y },
        data: {
          label: node.san,
          san: node.san,
          fen: node.fen,
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
          // For compatibility with performance mode
          winRate: null,
          totalGames: null,
          gameCount: null,
          performanceData: null
        }
      });
      
      // Add edge from parent
      if (parentId) {
        edges.push({
          id: `edge-${parentId}-${nodeId}`,
          source: parentId,
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
      
      // Process children
      const childCount = node.children.length;
      const startOffset = -(childCount - 1) / 2;
      
      node.children.forEach((child, index) => {
        traverseTree(child, depth + 1, nodeId, xOffset + startOffset + index);
      });
    };
    
    // Start traversal from root
    traverseTree(moveTree);
    
    return { nodes, edges };
  }, [moveTree]);

  // Combine structure with selection state
  const memoizedGraphData = useMemo(() => {
    if (canvasMode !== 'opening') return graphStructure;
    
    // Add selection state to nodes
    const nodesWithSelection = graphStructure.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedNode?.id
      }
    }));
    
    return { nodes: nodesWithSelection, edges: graphStructure.edges };
  }, [graphStructure, selectedNode?.id, canvasMode]);

  // Memoize performance graph data
  const memoizedPerformanceGraphData = useMemo(() => {
    if (!openingGraph || canvasMode !== 'performance') return { nodes: [], edges: [], maxGameCount: 0 };
    
    // Get moves from the current opening tree path
    const mainLineMoves = [];
    let current = moveTree;
    while (current.children.length > 0) {
      const mainChild = current.children.find(c => c.isMainLine) || current.children[0];
      mainLineMoves.push(mainChild.san);
      current = mainChild;
    }
    
    // Generate performance data based on the opening moves
    const nodes = [];
    const edges = [];
    let maxGameCount = 0;
    
    // Tree layout configuration
    const LEVEL_HEIGHT = 350;
    const NODE_SPACING = 240;
    
    // Add root node
    const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    nodes.push({
      id: rootFen,
      type: 'chessPosition',
      position: { x: 0, y: 0 },
      data: {
        fen: rootFen,
        winRate: 50,
        gameCount: 100, // Placeholder
        san: null,
        openingName: 'Starting Position',
        isRoot: true,
        depth: 0,
        moveSequence: []
      }
    });
    
    // Add some sample performance nodes based on the opening
    // In real implementation, this would pull from the opening graph
    let parentId = rootFen;
    let currentFen = rootFen;
    
    mainLineMoves.slice(0, 5).forEach((move, index) => {
      const nodeId = `${currentFen}-${move}`;
      const x = (index - 2) * NODE_SPACING;
      const y = (index + 1) * LEVEL_HEIGHT;
      
      nodes.push({
        id: nodeId,
        type: 'chessPosition',
        position: { x, y },
        data: {
          fen: nodeId, // Simplified for demo
          winRate: 50 + Math.random() * 20,
          gameCount: Math.floor(80 - index * 15),
          san: move,
          openingName: name,
          isRoot: false,
          depth: index + 1,
          moveSequence: mainLineMoves.slice(0, index + 1)
        }
      });
      
      edges.push({
        id: `${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'chessMove',
        data: {
          san: move,
          winRate: 50 + Math.random() * 20,
          gameCount: Math.floor(80 - index * 15)
        }
      });
      
      parentId = nodeId;
      maxGameCount = Math.max(maxGameCount, Math.floor(80 - index * 15));
    });
    
    return { nodes, edges, maxGameCount };
  }, [moveTree, openingGraph, canvasMode, name]);

  // Load performance graph data
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (canvasMode === 'performance') {
        const username = localStorage.getItem('chesscope_username');
        if (username) {
          const graph = await loadOpeningGraph(username);
          setOpeningGraph(graph);
        }
      }
    };
    loadPerformanceData();
  }, [canvasMode]);

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
      
      setMoveTree(root);
      setCurrentNode(root);
      setSelectedNode(root);
      
    } catch (error) {
      console.error('Error loading opening:', error);
      navigate('/openings-book');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
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
      
      // Navigate to the opening view
      navigate(`/openings-book/opening/${savedOpening.id}`);
      
    } catch (error) {
      console.error('Error saving opening:', error);
      setError('Failed to save opening');
    } finally {
      setSaving(false);
    }
  };

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
    setSelectedNode(node);
    
    // Update path
    const path = [];
    let current = node;
    while (current.parent) {
      path.unshift(current.san);
      current = current.parent;
    }
    setCurrentPath(path);
    
    // Force re-render of tree
    setMoveTree({ ...moveTree });
  };
  
  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    setCurrentNode(node);
    
    // Build path from root to selected node
    const path = [];
    let current = node;
    while (current.parent) {
      path.unshift(current.san);
      current = current.parent;
    }
    setCurrentPath(path);
  };
  
  const handleNodeDelete = (node) => {
    if (node.parent) {
      node.parent.removeChild(node.id);
      // If deleted node was current, move to parent
      if (currentNode === node || selectedNode === node) {
        setCurrentNode(node.parent);
        setSelectedNode(node.parent);
      }
      // Force re-render
      setMoveTree({ ...moveTree });
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

  // Helper function to find node by ID in tree
  const findNodeById = (root, targetId) => {
    if (root.id === targetId) return root;
    for (const child of root.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
    return null;
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

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/openings-book')}
              className="text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-slate-100">
              {isNewOpening ? 'Create New Opening' : 'Edit Opening'}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/openings-book')}
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
          </div>
        </div>

        {error && (
          <Alert className="mb-6 bg-red-900/20 border-red-700">
            <AlertDescription className="text-red-400">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Opening Details */}
          <div className="lg:col-span-1 space-y-4">
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
                        // Make this variation the main line
                        const parent = selectedNode.parent;
                        if (parent) {
                          parent.children.forEach(child => {
                            child.isMainLine = child === selectedNode;
                          });
                          setMoveTree({ ...moveTree });
                        }
                      }}
                    >
                      {selectedNode.isMainLine ? 'Already Main Line' : 'Set as Main Line'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Board and Tree View */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-800">
                <TabsTrigger value="moves" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Moves
                </TabsTrigger>
                <TabsTrigger value="tree" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                  <Eye className="w-4 h-4 mr-2" />
                  Tree View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="moves" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Chessboard */}
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <InteractiveChessboard
                        currentMoves={currentPath}
                        onNewMove={handleNewMove}
                        onMoveSelect={(moves) => {
                          // When user navigates via chessboard, sync with tree
                          handleNewMove(moves);
                        }}
                        isWhiteTree={color === 'white'}
                        className="w-full"
                      />
                    </CardContent>
                  </Card>

                  {/* Tree View for Navigation */}
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CardTitle className="text-slate-100 text-lg">Opening Tree</CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCanvasMode(canvasMode === 'opening' ? 'performance' : 'opening')}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        {canvasMode === 'opening' ? 'Performance' : 'Tree'}
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 h-[500px]">
                      <CanvasPerformanceGraph
                        graphData={canvasMode === 'opening' ? memoizedGraphData : memoizedPerformanceGraphData}
                        mode={canvasMode}
                        onNodeClick={(e, node) => {
                          if (canvasMode === 'opening' && node.data && !node.data.isRoot) {
                            const treeNode = findNodeById(moveTree, node.id);
                            if (treeNode) {
                              handleNodeSelect(treeNode);
                            }
                          }
                        }}
                        currentNodeId={selectedNode?.id}
                        isGenerating={false}
                        showPerformanceLegend={false}
                        showPerformanceControls={false}
                        className="w-full h-full"
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="tree" className="mt-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-slate-100">
                      {canvasMode === 'opening' ? 'Full Tree View' : 'Performance Analysis'} 
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCanvasMode(canvasMode === 'opening' ? 'performance' : 'opening')}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      {canvasMode === 'opening' ? 'Show Performance' : 'Show Tree'}
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 h-[700px]">
                    <CanvasPerformanceGraph
                      graphData={canvasMode === 'opening' ? memoizedGraphData : memoizedPerformanceGraphData}
                      mode={canvasMode}
                      onNodeClick={(e, node) => {
                        if (canvasMode === 'opening' && node.data && !node.data.isRoot) {
                          const treeNode = findNodeById(moveTree, node.id);
                          if (treeNode) {
                            handleNodeSelect(treeNode);
                          }
                        }
                      }}
                      currentNodeId={selectedNode?.id}
                      isGenerating={false}
                      showPerformanceLegend={false}
                      showPerformanceControls={canvasMode === 'performance'}
                      className="w-full h-full"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
} 