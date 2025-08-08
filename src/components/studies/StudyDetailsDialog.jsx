import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Crown, Shield, Edit, Plus, Loader2, BookOpen, X, Tags, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { studyTag } from '@/api/studyEntities';

export default function StudyDetailsDialog({ 
  trigger, 
  children, 
  defaultName = '', 
  defaultColor = 'white',
  onConfirm,
  title = 'Create New Study',
  confirmText = 'Create Study',
  confirmIcon: ConfirmIcon = Plus
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [color, setColor] = useState(defaultColor);
  const [startingMethod, setStartingMethod] = useState('standard'); // 'standard', 'fen', 'pgn'
  const [startingFen, setStartingFen] = useState('');
  const [startingPgn, setStartingPgn] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#22c55e');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load available tags when dialog opens
  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  const loadTags = async () => {
    try {
      const tags = await studyTag.getAll();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
      setAvailableTags([]);
    }
  };

  const handleCreateNewTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name is required');
      return;
    }

    // Check if tag already exists
    if (availableTags.some(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      setError('Tag with this name already exists');
      return;
    }

    try {
      const newTag = await studyTag.create({
        name: newTagName.trim(),
        color: newTagColor
      });
      
      setAvailableTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTags(prev => [...prev, newTag]); // Auto-select the new tag
      setNewTagName('');
      setNewTagColor('#22c55e');
      setShowNewTagForm(false);
      setError('');
    } catch (error) {
      console.error('Error creating tag:', error);
      setError('Failed to create tag');
    }
  };

  const DEFAULT_COLORS = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
  ];

  const validatePosition = (fen) => {
    try {
      const chess = new Chess(fen);
      return chess.isGameOver() ? 'Position is in checkmate or stalemate' : null;
    } catch (error) {
      return 'Invalid FEN notation';
    }
  };

  const validatePgn = (pgn) => {
    try {
      const chess = new Chess();
      const moves = pgn.trim().split(/\s+/).filter(move => {
        // Remove move numbers and annotations
        return !/^\d+\./.test(move) && move !== '' && !move.startsWith('{') && !move.endsWith('}');
      });
      
      for (const move of moves) {
        const result = chess.move(move);
        if (!result) {
          return `Invalid move: ${move}`;
        }
      }
      return null;
    } catch (error) {
      return 'Invalid PGN format';
    }
  };

  const handleConfirm = async () => {
    if (!name.trim()) {
      setError('Study name is required');
      return;
    }

    let finalFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let finalPgn = '';

    // Validate starting position based on method
    if (startingMethod === 'fen') {
      if (!startingFen.trim()) {
        setError('FEN position is required');
        return;
      }
      const fenError = validatePosition(startingFen.trim());
      if (fenError) {
        setError(fenError);
        return;
      }
      finalFen = startingFen.trim();
    } else if (startingMethod === 'pgn') {
      if (!startingPgn.trim()) {
        setError('PGN moves are required');
        return;
      }
      const pgnError = validatePgn(startingPgn.trim());
      if (pgnError) {
        setError(pgnError);
        return;
      }
      
      // Calculate final position from PGN
      try {
        const chess = new Chess();
        const moves = startingPgn.trim().split(/\s+/).filter(move => {
          return !/^\d+\./.test(move) && move !== '' && !move.startsWith('{') && !move.endsWith('}');
        });
        
        for (const move of moves) {
          chess.move(move);
        }
        finalFen = chess.fen();
        finalPgn = startingPgn.trim();
      } catch (error) {
        setError('Error processing PGN moves');
        return;
      }
    }

    setError('');
    setLoading(true);

    try {
      if (onConfirm) {
        await onConfirm({ 
          name: name.trim(), 
          color,
          initialFen: finalFen,
          startingPgn: finalPgn,
          selectedTags
        });
      } else {
        // Default behavior - navigate to editor with query params
        const params = new URLSearchParams({
          name: name.trim(),
          color: color,
          initialFen: finalFen,
          startingPgn: finalPgn,
          tags: selectedTags.map(tag => tag.id).join(',')
        });
        navigate(`/studies-book/editor/new?${params.toString()}`);
      }
      
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err.message || 'Failed to create study');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(defaultName);
    setColor(defaultColor);
    setStartingMethod('standard');
    setStartingFen('');
    setStartingPgn('');
    setSelectedTags([]);
    setShowNewTagForm(false);
    setNewTagName('');
    setNewTagColor('#22c55e');
    setError('');
  };

  const handleCancel = () => {
    setOpen(false);
    resetForm();
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      const exists = prev.find(t => t.id === tag.id);
      if (exists) {
        return prev.filter(t => t.id !== tag.id);
      } else {
        return [...prev, tag];
      }
    });
  };

  const triggerElement = trigger || (
    <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
      <Plus className="w-4 h-4 mr-2" />
      Add Study
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || triggerElement}
      </DialogTrigger>
      <DialogContent className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Study Name */}
          <div className="space-y-2">
            <Label className="text-slate-300">Study Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Italian Game - Giuoco Piano"
              className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
              disabled={loading}
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <Label className="text-slate-300">Playing Color</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setColor('white')}
                disabled={loading}
                className={cn(
                  "flex-1 h-12 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center border",
                  color === 'white' 
                    ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' 
                    : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Crown className={cn(
                  "w-5 h-5 mr-2",
                  color === 'white' ? 'text-white' : 'text-amber-400'
                )} />
                White
              </button>
              <button
                type="button"
                onClick={() => setColor('black')}
                disabled={loading}
                className={cn(
                  "flex-1 h-12 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center border",
                  color === 'black' 
                    ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' 
                    : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Shield className={cn(
                  "w-5 h-5 mr-2",
                  color === 'black' ? 'text-white' : 'text-slate-400'
                )} />
                Black
              </button>
            </div>
          </div>

          {/* Starting Position */}
          <div className="space-y-3">
            <Label className="text-slate-300">Starting Position</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartingMethod('standard');
                  setError('');
                }}
                disabled={loading}
                className={cn(
                  "flex-1 h-10 px-3 rounded-md text-sm font-medium transition-all duration-200 border",
                  startingMethod === 'standard' 
                    ? 'bg-amber-500 text-white border-amber-500' 
                    : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/50',
                )}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartingMethod('fen');
                  setError('');
                }}
                disabled={loading}
                className={cn(
                  "flex-1 h-10 px-3 rounded-md text-sm font-medium transition-all duration-200 border",
                  startingMethod === 'fen' 
                    ? 'bg-amber-500 text-white border-amber-500' 
                    : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/50',
                )}
              >
                FEN
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartingMethod('pgn');
                  setError('');
                }}
                disabled={loading}
                className={cn(
                  "flex-1 h-10 px-3 rounded-md text-sm font-medium transition-all duration-200 border",
                  startingMethod === 'pgn' 
                    ? 'bg-amber-500 text-white border-amber-500' 
                    : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/50',
                )}
              >
                PGN
              </button>
            </div>
            
            {startingMethod === 'fen' && (
              <div className="space-y-2">
                <Input
                  value={startingFen}
                  onChange={(e) => {
                    setStartingFen(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400 font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-slate-400">Enter a FEN position to start your study from</p>
              </div>
            )}
            
            {startingMethod === 'pgn' && (
              <div className="space-y-2">
                <Textarea
                  value={startingPgn}
                  onChange={(e) => {
                    setStartingPgn(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5"
                  className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400 font-mono text-sm min-h-[80px]"
                  disabled={loading}
                />
                <p className="text-xs text-slate-400">Enter the moves to reach your starting position</p>
              </div>
            )}
          </div>

          {/* Tags Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 flex items-center gap-2">
                <Tags className="w-4 h-4" />
                Tags
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewTagForm(!showNewTagForm)}
                disabled={loading}
                className="h-6 text-xs text-slate-400 hover:text-slate-300"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Tag
              </Button>
            </div>

            {/* New Tag Form */}
            {showNewTagForm && (
              <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600 space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    placeholder="Tag name..."
                    value={newTagName}
                    onChange={(e) => {
                      setNewTagName(e.target.value);
                      setError('');
                    }}
                    className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
                    disabled={loading}
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {DEFAULT_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewTagColor(color)}
                          className={cn(
                            "w-6 h-6 rounded-full border transition-all",
                            newTagColor === color 
                              ? 'border-white scale-110' 
                              : 'border-transparent hover:scale-105'
                          )}
                          style={{ backgroundColor: color }}
                          disabled={loading}
                        />
                      ))}
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-2"
                      style={{
                        backgroundColor: newTagColor,
                        borderColor: newTagColor,
                        color: 'white'
                      }}
                    >
                      {newTagName || 'Preview'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateNewTag}
                      disabled={loading || !newTagName.trim()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Create
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNewTagForm(false);
                        setNewTagName('');
                        setError('');
                      }}
                      disabled={loading}
                      className="text-slate-400"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => {
                  const isSelected = selectedTags.find(t => t.id === tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className={cn(
                        "cursor-pointer transition-all duration-200 border-2",
                        isSelected 
                          ? 'border-current text-white' 
                          : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                      )}
                      style={{
                        backgroundColor: isSelected ? tag.color : 'transparent',
                        borderColor: isSelected ? tag.color : undefined
                      }}
                      onClick={() => !loading && toggleTag(tag)}
                    >
                      {tag.name}
                      {isSelected && <X className="w-3 h-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            )}
            
            <p className="text-xs text-slate-400">Select tags to categorize your study, or create new ones</p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-900/20 border border-red-700">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !name.trim()}
            className={cn(
              "flex-1 text-white transition-all duration-200",
              loading || !name.trim()
                ? "bg-transparent border border-slate-600 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <ConfirmIcon className="w-4 h-4 mr-2" />
                {confirmText}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}