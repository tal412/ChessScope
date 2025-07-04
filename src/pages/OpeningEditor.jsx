import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Link as LinkIcon,
  Info,
  Crown,
  Shield,
  Loader2
} from 'lucide-react';
import InteractiveChessboard from '@/components/chess/InteractiveChessboard';
import { userOpening, userOpeningMove, moveAnnotation } from '@/api/openingEntities';
import { Chess } from 'chess.js';
import CanvasPerformanceGraph from '@/components/chess/CanvasPerformanceGraph';

// Move tree node structure
class MoveNode {
  constructor(san, fen, parent = null) {
    this.id = `${Date.now()}-${Math.random()}`;
    this.san = san;
    this.fen = fen;
    this.parent = parent;
    this.children = [];
    this.comment = '';
    this.arrows = [];
    this.isMainLine = true;
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
    this.children = this.children.filter(c => c.id !== childId);
    // Update main line status
    if (this.children.length > 0 && !this.children.some(c => c.isMainLine)) {
      this.children[0].isMainLine = true;
    }
  }
}

// Simple tree node component for the opening tree
const OpeningTreeNode = ({ node, onSelect, selectedNodeId, onDelete, depth = 0 }) => {
  const isSelected = node.id === selectedNodeId;
  
  return (
    <div className="ml-4">
      <div 
        className={`px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between ${
          isSelected 
            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30' 
            : node.isMainLine 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }`}
        onClick={() => onSelect(node)}
      >
        <div className="flex items-center gap-2">
          {!node.isMainLine && <span className="text-xs text-slate-500">(var)</span>}
          <span className="font-mono text-sm">{node.san}</span>
          {node.comment && <MessageSquare className="w-3 h-3 text-amber-500" />}
        </div>
        {onDelete && depth > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node);
            }}
            className="h-6 w-6 p-0 hover:bg-red-500/20"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="mt-1">
          {node.children.map(child => (
            <OpeningTreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function OpeningEditor() {
  const { openingId } = useParams();
  const navigate = useNavigate();
  const isNewOpening = openingId === 'new';
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('white');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  
  // Chess state
  const [moveTree, setMoveTree] = useState(() => {
    const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    return new MoveNode('Start', rootFen);
  });
  const [currentNode, setCurrentNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentPath, setCurrentPath] = useState([]); // Path from root to current position
  
  // Annotations state (handled directly in nodes now)
  
  // UI state
  const [loading, setLoading] = useState(!isNewOpening);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('moves');

  // Graph data for canvas view
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });

  // Initialize current node
  useEffect(() => {
    setCurrentNode(moveTree);
    setSelectedNode(moveTree);
  }, []);

  // Load existing opening
  useEffect(() => {
    if (!isNewOpening) {
      loadOpening();
    }
  }, [openingId]);

  // Update graph data when moves change
  useEffect(() => {
    updateGraphData();
  }, [moveTree, currentNode]);

  const loadOpening = async () => {
    try {
      setLoading(true);
      const username = localStorage.getItem('chesscope_username');
      
      const opening = await userOpening.filter({ id: parseInt(openingId) });
      if (opening.length === 0) {
        setError('Opening not found');
        return;
      }
      
      const openingData = opening[0];
      setName(openingData.name);
      setDescription(openingData.description || '');
      setColor(openingData.color);
      setTags(openingData.tags || []);
      
      // Load moves and reconstruct tree
      const openingMoves = await userOpeningMove.getByOpeningId(parseInt(openingId));
      
      // Build tree from saved moves
      const newTree = new MoveNode('Start', openingData.initial_fen);
      const nodeMap = new Map([[openingData.initial_fen, newTree]]);
      
      // Sort moves by move_number to ensure proper order
      openingMoves.sort((a, b) => a.move_number - b.move_number);
      
      // Reconstruct tree
      for (const move of openingMoves) {
        const parentNode = nodeMap.get(move.parent_fen);
        if (parentNode) {
          const childNode = parentNode.addChild(move.san, move.fen);
          childNode.isMainLine = move.is_main_line;
          childNode.comment = move.comment || '';
          childNode.arrows = move.arrows || [];
          nodeMap.set(move.fen, childNode);
        }
      }
      
      setMoveTree(newTree);
      setCurrentNode(newTree);
      setSelectedNode(newTree);
      
    } catch (error) {
      console.error('Error loading opening:', error);
      setError('Failed to load opening');
    } finally {
      setLoading(false);
    }
  };

  const updateGraphData = () => {
    // Convert moves tree to nodes and edges for canvas
    const nodes = [];
    const edges = [];
    let nodeIndex = 0;
    
    // Tree layout constants
    const LEVEL_HEIGHT = 250;
    const NODE_SPACING = 200;
    
    // Helper to traverse tree and create nodes/edges
    const traverseTree = (node, depth = 0, parentId = null, xOffset = 0) => {
      const nodeId = `node-${nodeIndex++}`;
      
      // Calculate position
      const y = depth * LEVEL_HEIGHT;
      const x = xOffset * NODE_SPACING;
      
      nodes.push({
        id: nodeId,
        type: 'chessPosition',
        position: { x, y },
        data: {
          fen: node.fen,
          san: node.san === 'Start' ? null : node.san,
          isRoot: node.san === 'Start',
          openingName: node.san === 'Start' ? (name || 'New Opening') : node.san,
          gameCount: 1, // Dummy count for display
          isCurrentPosition: node === currentNode,
          isSelected: node === selectedNode,
          isMainLine: node.isMainLine,
          hasComment: !!node.comment
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
          type: 'chessMove',
          animated: false,
          style: {
            stroke: node.isMainLine ? '#94a3b8' : '#64748b',
            strokeWidth: node.isMainLine ? 2 : 1
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
    
    setGraphData({ nodes, edges });
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
        savedOpening = await userOpening.create(openingData);
      } else {
        // Update existing opening
        await userOpening.update(parseInt(openingId), openingData);
        
        // Delete all existing moves to re-insert fresh
        const existingMoves = await userOpeningMove.getByOpeningId(parseInt(openingId));
        for (const move of existingMoves) {
          await userOpeningMove.delete(move.id);
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
        
        await userOpeningMove.create(moveData);
        
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
                      Make Main Line
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

                  {/* Move List */}
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-slate-100">Move List</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[500px] overflow-y-auto">
                      <div className="space-y-2">
                        {moveTree.children.length === 0 ? (
                          <p className="text-slate-400 text-center py-8">
                            Make moves on the board to build your opening
                          </p>
                        ) : (
                          <div>
                            {moveTree.children.map(child => (
                              <OpeningTreeNode
                                key={child.id}
                                node={child}
                                onSelect={handleNodeSelect}
                                selectedNodeId={selectedNode?.id}
                                onDelete={handleNodeDelete}
                                depth={1}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="tree" className="mt-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4 h-[600px]">
                    <CanvasPerformanceGraph
                      graphData={graphData}
                      isGenerating={false}
                      showPerformanceLegend={false}
                      showPerformanceControls={false}
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