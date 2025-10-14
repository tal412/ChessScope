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
import { PrimaryGradientButton, GreenGradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Crown, Shield, Edit, Plus, BookOpen, X, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { studyTag } from '@/api/hybridEntities';
import { TAG_COLORS } from '@/constants/colors';
import { getContrastingTextColor } from '@/utils/themeColors';

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
  const [startingMethod, setStartingMethod] = useState('standard'); // 'standard', 'fen'
  const [startingFen, setStartingFen] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[2].value); // Default to green
  const [error, setError] = useState('');
  const [fenError, setFenError] = useState('');
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
      // Auto-select the new tag only if under the limit
      setSelectedTags(prev => prev.length < MAX_TAGS ? [...prev, newTag] : prev);
      setNewTagName('');
      setNewTagColor(TAG_COLORS[2].value); // Reset to green
      setShowNewTagForm(false);
      setError('');
    } catch (error) {
      console.error('Error creating tag:', error);
      setError('Failed to create tag');
    }
  };

  // Use first 8 colors from TAG_COLORS for the color picker
  const DEFAULT_COLORS = TAG_COLORS.slice(0, 8).map(c => c.value);

  const MAX_TAGS = 3;

  const validatePosition = (fen) => {
    try {
      const chess = new Chess(fen);
      return chess.isGameOver() ? 'Position is in checkmate or stalemate' : null;
    } catch (error) {
      return 'Invalid FEN notation';
    }
  };


  // Real-time FEN validation
  const handleFenChange = (value) => {
    setStartingFen(value);
    if (value.trim()) {
      const error = validatePosition(value.trim());
      setFenError(error || '');
    } else {
      setFenError('');
    }
    if (error) setError('');
  };


  const handleConfirm = async () => {
    if (!name.trim()) {
      setError('Study name is required');
      return;
    }

    // Check for field-specific errors
    if (fenError) {
      return;
    }

    let finalFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    // Validate starting position based on method
    if (startingMethod === 'fen') {
      if (!startingFen.trim()) {
        setFenError('FEN position is required');
        return;
      }
      const validation = validatePosition(startingFen.trim());
      if (validation) {
        setFenError(validation);
        return;
      }
      finalFen = startingFen.trim();
    }

    setError('');
    setLoading(true);

    try {
      if (onConfirm) {
        await onConfirm({ 
          name: name.trim(), 
          color,
          initialFen: finalFen,
          selectedTags
        });
      } else {
        // Default behavior - navigate to editor with query params
        const params = new URLSearchParams({
          name: name.trim(),
          color: color,
          initialFen: finalFen,
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
    setSelectedTags([]);
    setShowNewTagForm(false);
    setNewTagName('');
    setNewTagColor(TAG_COLORS[2].value); // Reset to green
    setError('');
    setFenError('');
  };

  const handleCancel = () => {
    setOpen(false);
    resetForm();
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      const exists = prev.find(t => t.id === tag.id);
      if (exists) {
        // Remove tag (always allowed)
        return prev.filter(t => t.id !== tag.id);
      } else {
        // Add tag only if under the limit
        if (prev.length < MAX_TAGS) {
          return [...prev, tag];
        }
        return prev; // Don't add if at max limit
      }
    });
  };

  const triggerElement = trigger || (
    <PrimaryGradientButton>
      <Plus className="w-4 h-4 mr-2" />
      Add Study
    </PrimaryGradientButton>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || triggerElement}
      </DialogTrigger>
      <DialogContent className="bg-card/95 backdrop-blur-optimized border-border text-card-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-card-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-warning" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Study Name */}
          <div className="space-y-2">
            <Label className="text-foreground">Study Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Italian Game - Giuoco Piano"
              className="bg-input border-input text-foreground placeholder:text-muted-foreground"
              disabled={loading}
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <Label className="text-foreground">Playing Color</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setColor('white')}
                disabled={loading}
                className={cn(
                  "flex-1 h-12 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center border",
                  color === 'white'
                    ? 'bg-warning text-warning-foreground border-warning hover:bg-warning/90'
                    : 'bg-transparent border-border text-foreground hover:bg-accent hover:border-accent',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Crown className={cn(
                  "w-5 h-5 mr-2",
                  color === 'white' ? 'text-warning-foreground' : 'text-warning'
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
                    ? 'bg-warning text-warning-foreground border-warning hover:bg-warning/90'
                    : 'bg-transparent border-border text-foreground hover:bg-accent hover:border-accent',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Shield className={cn(
                  "w-5 h-5 mr-2",
                  color === 'black' ? 'text-warning-foreground' : 'text-muted-foreground'
                )} />
                Black
              </button>
            </div>
          </div>

          {/* Starting Position */}
          <div className="space-y-3">
            <Label className="text-foreground">Starting Position</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartingMethod('standard');
                  setError('');
                  setFenError('');
                }}
                disabled={loading}
                className={cn(
                  "flex-1 h-10 px-3 rounded-md text-sm font-medium transition-all duration-200 border",
                  startingMethod === 'standard'
                    ? 'bg-warning text-warning-foreground border-warning'
                    : 'bg-transparent border-border text-foreground hover:bg-accent',
                )}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartingMethod('fen');
                  setError('');
                  setFenError('');
                }}
                disabled={loading}
                className={cn(
                  "flex-1 h-10 px-3 rounded-md text-sm font-medium transition-all duration-200 border",
                  startingMethod === 'fen'
                    ? 'bg-warning text-warning-foreground border-warning'
                    : 'bg-transparent border-border text-foreground hover:bg-accent',
                )}
              >
                FEN
              </button>
            </div>
            
            {startingMethod === 'fen' && (
              <div className="space-y-2">
                <Input
                  value={startingFen}
                  onChange={(e) => handleFenChange(e.target.value)}
                  placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  className={cn(
                    "bg-input text-foreground placeholder:text-muted-foreground font-mono text-sm",
                    fenError
                      ? "border-destructive focus:border-destructive focus:ring-destructive"
                      : "border-input"
                  )}
                  disabled={loading}
                />
                {fenError ? (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">!</span>
                    {fenError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Enter a FEN position to start your study from</p>
                )}
              </div>
            )}
          </div>

          {/* Tags Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-foreground flex items-center gap-2">
                  <Tags className="w-4 h-4" />
                  Tags
                </Label>
                <span className="text-xs text-muted-foreground">
                  ({selectedTags.length}/{MAX_TAGS})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewTagForm(!showNewTagForm)}
                disabled={loading || (selectedTags.length >= MAX_TAGS && !showNewTagForm)}
                className={cn(
                  "h-6 text-xs transition-all",
                  (selectedTags.length >= MAX_TAGS && !showNewTagForm)
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={(selectedTags.length >= MAX_TAGS && !showNewTagForm) ? "Maximum tags reached" : undefined}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Tag
              </Button>
            </div>

            {/* New Tag Form */}
            {showNewTagForm && (
              <div className="p-3 bg-secondary/50 rounded-lg border border-border space-y-3">
                {selectedTags.length >= MAX_TAGS && (
                  <div className="p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
                    <span className="font-medium">Note:</span> You've reached the {MAX_TAGS} tag limit.
                    New tags will be created but not automatically selected.
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    placeholder="Tag name..."
                    value={newTagName}
                    onChange={(e) => {
                      setNewTagName(e.target.value);
                      setError('');
                    }}
                    className="bg-input border-input text-foreground placeholder:text-muted-foreground"
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
                        color: getContrastingTextColor(newTagColor)
                      }}
                    >
                      {newTagName || 'Preview'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <GreenGradientButton
                      type="button"
                      size="sm"
                      onClick={handleCreateNewTag}
                      disabled={!newTagName.trim()}
                      loading={loading}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Create
                    </GreenGradientButton>
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
                      className="text-muted-foreground hover:text-foreground"
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
                  const isAtLimit = selectedTags.length >= MAX_TAGS;
                  const canSelect = isSelected || !isAtLimit;
                  
                  return (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className={cn(
                        "transition-all duration-200 border-2",
                        canSelect ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                        isSelected
                          ? 'border-current text-white'
                          : canSelect
                            ? 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                            : 'border-border/50 text-muted-foreground/50'
                      )}
                      style={{
                        backgroundColor: isSelected ? tag.color : 'transparent',
                        borderColor: isSelected ? tag.color : undefined
                      }}
                      onClick={() => !loading && canSelect && toggleTag(tag)}
                      title={!canSelect ? `Maximum ${MAX_TAGS} tags allowed` : undefined}
                    >
                      {tag.name}
                      {isSelected && <X className="w-3 h-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Select up to {MAX_TAGS} tags to categorize your study, or create new ones
              {selectedTags.length >= MAX_TAGS && (
                <span className="text-warning ml-1">(Maximum reached)</span>
              )}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 border-border text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </Button>
          <PrimaryGradientButton
            onClick={handleConfirm}
            disabled={!name.trim() || fenError}
            loading={loading}
            className="flex-1"
          >
            <ConfirmIcon className="w-4 h-4 mr-2" />
            {loading ? 'Creating...' : confirmText}
          </PrimaryGradientButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}