import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PrimaryGradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tags,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Palette,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { studyTag } from '@/api/hybridEntities';
import { TAG_COLORS } from '@/constants/colors';
import { getContrastingTextColor } from '@/utils/themeColors';

export default function TagManagementDialog({
  trigger,
  children,
  onTagsChanged
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [preventClose, setPreventClose] = useState(false);
  const [tagsChanged, setTagsChanged] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
  const [error, setError] = useState('');

  // Load tags when dialog opens
  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const allTags = await studyTag.getAll();
      setTags(allTags);
    } catch (error) {
      console.error('Error loading tags:', error);
      setError('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name is required');
      return;
    }

    // Check if tag already exists
    if (tags.some(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      setError('Tag with this name already exists');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const newTag = await studyTag.create({
        name: newTagName.trim(),
        color: newTagColor
      });

      setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0].value);

      // Mark that tags have changed so we can notify parent when dialog closes
      setTagsChanged(true);
      
    } catch (error) {
      console.error('Error creating tag:', error);
      setError('Failed to create tag');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTag = async (tagId, updatedData) => {
    try {
      setLoading(true);
      setError('');
      
      await studyTag.update(tagId, updatedData);
      
      setTags(prev => prev.map(tag => 
        tag.id === tagId ? { ...tag, ...updatedData } : tag
      ).sort((a, b) => a.name.localeCompare(b.name)));
      
      setEditingTag(null);
      
      // Mark that tags have changed so we can notify parent when dialog closes
      setTagsChanged(true);
      
    } catch (error) {
      console.error('Error updating tag:', error);
      setError('Failed to update tag');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteTag = (tagId) => {
    console.log('🔄 confirmDeleteTag called with tagId:', tagId);
    setDeletingTag(tagId);
    console.log('✅ deletingTag state set to:', tagId);
  };

  const handleDeleteTag = async (tagId) => {
    console.log('🗑️ handleDeleteTag called with tagId:', tagId);
    console.log('📊 Current state - loading:', loading, 'deletingTag:', deletingTag, 'tags count:', tags.length);
    
    try {
      setLoading(true);
      setPreventClose(true);
      setError('');
      console.log('⏳ Starting deletion process...');
      
      const result = await studyTag.delete(tagId);
      console.log('✅ studyTag.delete completed successfully:', result);
      
      // Update local state first
      const originalTagsCount = tags.length;
      setTags(prev => {
        const filtered = prev.filter(tag => tag.id !== tagId);
        console.log('📝 Tags updated - before:', originalTagsCount, 'after:', filtered.length);
        return filtered;
      });
      
      setDeletingTag(null);
      console.log('🔄 deletingTag state cleared');
      
      // Mark that tags have changed so we can notify parent when dialog closes
      setTagsChanged(true);
      console.log('🏷️ Tags changed flag set - will notify parent when dialog closes');
      
      console.log('🎉 Delete operation completed successfully');
      
      // Wait a bit before allowing dialog to close to ensure all state updates are processed
      setTimeout(() => {
        console.log('🔓 Allowing dialog to close again');
        setPreventClose(false);
      }, 500);
      
    } catch (error) {
      console.error('❌ Error deleting tag:', error);
      console.log('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        tagId: tagId
      });
      setError('Failed to delete tag');
      setDeletingTag(null);
      setPreventClose(false);
    } finally {
      setLoading(false);
      console.log('⏹️ Loading state cleared');
    }
  };

  const cancelDeleteTag = () => {
    console.log('❌ Delete operation cancelled');
    setDeletingTag(null);
  };

  const triggerElement = trigger || (
    <Button variant="outline" size="sm" className="bg-secondary border-border text-foreground hover:bg-accent hover:text-foreground">
      <Tags className="w-4 h-4 mr-2" />
      Manage Tags
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      console.log('🚪 Dialog onOpenChange called - newOpen:', newOpen, 'current open:', open, 'deletingTag:', deletingTag, 'preventClose:', preventClose, 'loading:', loading, 'tagsChanged:', tagsChanged);
      
      // Prevent closing the dialog if we're in the middle of operations
      if (!newOpen && (deletingTag || preventClose || loading)) {
        console.log('🚫 Dialog close prevented - operation in progress');
        return;
      }
      
      console.log('✅ Dialog state changing to:', newOpen);
      
      // If dialog is closing and tags have changed, notify parent
      if (!newOpen && tagsChanged && onTagsChanged) {
        console.log('📢 Dialog closing - calling onTagsChanged callback');
        onTagsChanged();
        setTagsChanged(false);
      }
      
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        {children || triggerElement}
      </DialogTrigger>
      <DialogContent className="bg-card/95 backdrop-blur-optimized border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground flex items-center gap-2">
            <Tags className="w-5 h-5 text-[hsl(var(--warning))]" />
            Manage Study Tags
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Create New Tag */}
          <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New Tag
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Tag Name</Label>
                <Input
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. Sicilian Defense"
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-foreground">Color</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map((color, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setNewTagColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        newTagColor === color.value
                          ? 'border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: color.value }}
                      disabled={loading}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: newTagColor,
                      borderColor: newTagColor,
                      color: getContrastingTextColor(newTagColor)
                    }}
                  >
                    {newTagName || 'Preview'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <PrimaryGradientButton
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              loading={loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Tag
            </PrimaryGradientButton>
          </div>

          {/* Existing Tags */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">
              Existing Tags ({tags.length})
            </h3>
            
            {loading && tags.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--warning))]" />
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tags className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No tags created yet</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto pr-2">
                <div className="space-y-3">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border"
                    >
                      {editingTag === tag.id ? (
                        <TagEditForm
                          tag={tag}
                          onSave={(updatedData) => handleUpdateTag(tag.id, updatedData)}
                          onCancel={() => setEditingTag(null)}
                          loading={loading}
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: tag.color,
                                borderColor: tag.color,
                                color: getContrastingTextColor(tag.color)
                              }}
                            >
                              {tag.name}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingTag(tag.id)}
                              disabled={loading}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                console.log('🗑️ Delete button clicked for tag:', tag.id, tag.name);
                                e.preventDefault();
                                e.stopPropagation();
                                confirmDeleteTag(tag.id);
                              }}
                              disabled={loading}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

        </div>

        {/* Delete Confirmation Overlay */}
        {deletingTag && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 mx-4 max-w-md w-full shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <Trash2 className="w-6 h-6 text-destructive" />
                <h3 className="text-lg font-semibold text-foreground">Delete Tag</h3>
              </div>

              <p className="text-foreground mb-6">
                Are you sure you want to delete this tag? It will be removed from all studies and cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelDeleteTag}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    console.log('🎯 Confirmation delete button clicked for tagId:', deletingTag);
                    handleDeleteTag(deletingTag);
                  }}
                  disabled={loading}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Inline tag editing component
function TagEditForm({ tag, onSave, onCancel, loading }) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-secondary border-border text-foreground flex-1"
        disabled={loading}
      />

      <div className="flex gap-1">
        {TAG_COLORS.slice(0, 6).map((c, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setColor(c.value)}
            className={cn(
              "w-6 h-6 rounded-full border transition-all",
              color === c.value ? 'border-foreground' : 'border-transparent'
            )}
            style={{ backgroundColor: c.value }}
            disabled={loading}
          />
        ))}
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSave}
        disabled={loading || !name.trim()}
        className="h-8 w-8 p-0 text-success"
      >
        <Save className="w-3 h-3" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={loading}
        className="h-8 w-8 p-0 text-muted-foreground"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}