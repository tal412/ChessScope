import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  MessageSquare, 
  LinkIcon, 
  Plus, 
  X, 
  Star,
  Play,
  FileText,
  Info,
  Pencil,
  Target,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// Shared button component for both edit and view modes
const MoveActionButton = ({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick, 
  disabled, 
  readOnly 
}) => {
  return (
    <div className="relative group">
      <Button
        size="sm"
        variant="ghost"
        disabled={false}
        onClick={(e) => {
          if (!readOnly && onClick) {
            onClick(e);
          }
        }}
        className={cn(
          "h-9 w-9 p-0 border transition-all duration-200",
          isActive 
            ? "bg-amber-500 border-amber-400 text-white" 
            : "bg-card border-border text-muted-foreground",
          !readOnly && !isActive && "hover:bg-accent hover:border-border hover:text-foreground",
          !readOnly && isActive && "hover:bg-amber-600",
          readOnly && "cursor-default"
        )}
      >
        <Icon className="w-4 h-4" />
      </Button>
      
      {/* Enhanced tooltip with better positioning and styling - positioned below button */}
      <div className="absolute right-0 top-full mt-3 px-3 py-2 bg-popover/95 backdrop-blur-sm border border-border/50 rounded-md text-xs text-popover-foreground whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
        {readOnly ? (
          // View mode - just show the label
          isActive ? `✓ ${label.charAt(0).toUpperCase() + label.slice(1)}` : `Not ${label}`
        ) : (
          // Edit mode - show action text
          isActive ? `✓ ${label.charAt(0).toUpperCase() + label.slice(1)} (active)` : `Set as ${label}`
        )}
        <div className="absolute -top-1 right-3 w-2 h-2 bg-popover border-l border-t border-border/50 transform rotate-45"></div>
      </div>
    </div>
  );
};

export default function MoveDetailsPanel({ 
  selectedNode, 
  onUpdateNode, 
  onSetMainLine,
  onSetInitialMove,
  moveTree,
  className = "",
  drawingMode = false,
  onDrawingModeToggle = null,
  readOnly = false
}) {
  // Local state for comment input to prevent recreating component on every keystroke
  const [commentValue, setCommentValue] = useState('');
  const commentTimeoutRef = useRef(null);
  
  // Local state for links to ensure proper re-rendering
  const [linksValue, setLinksValue] = useState([]);
  
  // Sync comment and links values with selectedNode when it changes
  useEffect(() => {
    // If we're switching nodes and there's a pending comment update, commit it immediately
    if (commentTimeoutRef.current) {
      clearTimeout(commentTimeoutRef.current);
      commentTimeoutRef.current = null;
    }
    
    if (selectedNode) {
      setCommentValue(selectedNode.comment || '');
      setLinksValue(selectedNode.links || []);
    }
  }, [selectedNode?.id]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (commentTimeoutRef.current) {
        clearTimeout(commentTimeoutRef.current);
      }
    };
  }, []);
  
  if (!selectedNode || selectedNode.san === 'Start') {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-2">No Move Selected</p>
          <p className="text-sm">
            Select a move from the board or graph to view {readOnly ? 'its details' : 'and edit its details'}
          </p>
        </div>
      </div>
    );
  }

  const handleCommentChange = (value) => {
    if (readOnly) return;
    
    // Update local state immediately for responsive UI
    setCommentValue(value);
    
    // Clear existing timeout
    if (commentTimeoutRef.current) {
      clearTimeout(commentTimeoutRef.current);
    }
    
    // Set new timeout for debounced update
    commentTimeoutRef.current = setTimeout(() => {
      selectedNode.comment = value;
      if (onUpdateNode) {
        onUpdateNode();
      }
    }, 300); // 300ms delay
  };

  const handleLinkChange = (index, field, value) => {
    if (readOnly) return;
    
    // Update local state
    const newLinks = [...linksValue];
    newLinks[index][field] = value;
    setLinksValue(newLinks);
    
    // Update selectedNode immediately
    selectedNode.links = newLinks;
    if (onUpdateNode) {
      onUpdateNode();
    }
  };

  const handleAddLink = () => {
    if (readOnly) return;
    
    // Update local state
    const newLinks = [...linksValue, { title: '', url: '' }];
    setLinksValue(newLinks);
    
    // Update selectedNode immediately
    selectedNode.links = newLinks;
    if (onUpdateNode) {
      onUpdateNode();
    }
  };

  const handleRemoveLink = (index) => {
    if (readOnly) return;
    
    // Update local state
    const newLinks = linksValue.filter((_, i) => i !== index);
    setLinksValue(newLinks);
    
    // Update selectedNode immediately
    selectedNode.links = newLinks;
    if (onUpdateNode) {
      onUpdateNode();
    }
  };

  const handleSetAsMainLine = () => {
    if (readOnly) return;
    if (onSetMainLine) {
      onSetMainLine(selectedNode);
      // Force a re-render by calling onUpdateNode if available
      if (onUpdateNode) {
        onUpdateNode();
      }
    }
  };

  const handleSetAsInitialPosition = () => {
    if (readOnly) return;
    if (onSetInitialMove) {
      onSetInitialMove(selectedNode);
      // Force a re-render by calling onUpdateNode if available
      if (onUpdateNode) {
        onUpdateNode();
      }
    }
  };

  const handleArrowsChange = (newArrows) => {
    if (readOnly) return;
    selectedNode.arrows = newArrows;
    onUpdateNode();
  };

  const handleDrawingModeToggle = () => {
    if (readOnly) return;
    if (onDrawingModeToggle) {
      onDrawingModeToggle();
    }
  };

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Move Header */}
      <div className="bg-card border border-border flex-shrink-0 mb-4">
        <div className="p-6 pb-3">
          <div className="text-card-foreground text-lg flex items-center justify-between font-semibold leading-none tracking-tight">
            <span>Move: {selectedNode.san}</span>
            <div className="flex items-center gap-2">
              {/* Main Line Button */}
              <MoveActionButton
                key={`main-line-${selectedNode.id}-${selectedNode.isMainLine}`}
                icon={Star}
                label="main line"
                isActive={selectedNode.isMainLine}
                onClick={handleSetAsMainLine}
                disabled={false}  // Always allow clicking in edit mode to change main line
                readOnly={readOnly}
              />

              {/* Initial Position Button */}
              <MoveActionButton
                key={`initial-move-${selectedNode.id}-${selectedNode.isInitialMove}`}
                icon={Play}
                label="initial position"
                isActive={selectedNode.isInitialMove}
                onClick={handleSetAsInitialPosition}
                disabled={false}  // Always allow clicking in edit mode to change initial position
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Move Details */}
      <div className="bg-card border border-border flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 pb-3 p-6">
          <div className="text-card-foreground text-base flex items-center font-semibold leading-none tracking-tight">
            <Info className="w-4 h-4 mr-2 text-amber-500" />
            Move Details
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col space-y-4 p-6 pt-0">
          {/* Comment Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <Label className="text-foreground flex-shrink-0 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Comment
            </Label>
            {readOnly ? (
              <div className="bg-muted border border-border p-3 flex-1 min-h-0 overflow-y-auto">
                {commentValue ? (
                  <div className="text-foreground whitespace-pre-wrap break-words">
                    {commentValue}
                  </div>
                ) : (
                  <div className="text-muted-foreground italic">No comment for this move</div>
                )}
              </div>
            ) : (
              <Textarea
                value={commentValue}
                onChange={(e) => handleCommentChange(e.target.value)}
                placeholder="Add notes about this move..."
                className="bg-input border-border text-foreground flex-1 resize-none"
              />
            )}
          </div>

          {/* Arrows Section */}
          <div className="flex-shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                {readOnly && (
                  <Label className="text-slate-300 flex items-center">
                    <Target className="w-4 h-4 mr-2" />
                    Arrows
                  </Label>
                )}
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDrawingModeToggle}
                    disabled={selectedNode && selectedNode.san === 'Start'}
                    className={cn(
                      "w-full transition-all duration-200 border hover:scale-[1.02] active:scale-[0.98]",
                      selectedNode && selectedNode.san === 'Start'
                        ? "opacity-50 cursor-not-allowed border-border text-muted-foreground bg-card/50"
                        : drawingMode 
                          ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white border-emerald-500/50 shadow-lg shadow-emerald-500/25" 
                          : "bg-secondary/50 border-border text-muted-foreground hover:bg-accent/70 hover:border-border hover:text-foreground"
                    )}
                    title={selectedNode && selectedNode.san === 'Start' ? "Cannot draw arrows on starting position" : undefined}
                  >
                    <Pencil className={cn(
                      "w-4 h-4 mr-2 transition-all duration-200",
                      drawingMode && "animate-pulse"
                    )} />
                    {drawingMode ? "Stop Drawing" : "Draw Arrows"}
                  </Button>
                )}
              </div>
              
              {/* Show drawing mode status */}
              {!readOnly && drawingMode && (
                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Drawing mode active - right-click drag on board to draw arrows
                  </div>
                </div>
              )}
              
              {/* Arrow list */}
              {(selectedNode.arrows || []).length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div className="space-y-2 max-h-24 overflow-y-auto">
                    {(selectedNode.arrows || []).map((arrow, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-1 rounded-full" 
                            style={{ backgroundColor: arrow.color }}
                          ></div>
                          <span className="text-foreground font-mono">
                            {arrow.from.toUpperCase()} → {arrow.to.toUpperCase()}
                          </span>
                        </div>
                        {!readOnly && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newArrows = [...(selectedNode.arrows || [])];
                              newArrows.splice(index, 1);
                              handleArrowsChange(newArrows);
                            }}
                            className="h-6 w-6 p-0 rounded-md text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-all duration-200 hover:scale-110 active:scale-95"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Links Section */}
          <div className="flex-shrink-0 min-h-0 max-h-48 flex flex-col">
            {readOnly && (
              <Label className="text-foreground flex-shrink-0 mb-2">
                <LinkIcon className="w-4 h-4 inline mr-1" />
                Links
              </Label>
            )}
            <div className="flex-1 overflow-y-auto space-y-2">
              {readOnly ? (
                <>
                  {linksValue && linksValue.length > 0 ? (
                    linksValue.map((link, index) => (
                      <div key={index} className="bg-muted border border-border p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-foreground font-medium truncate">
                              {link.title || 'Untitled Link'}
                            </div>
                            <div className="text-muted-foreground text-sm truncate">
                              {link.url || 'No URL'}
                            </div>
                          </div>
                          {link.url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(link.url, '_blank')}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 flex-shrink-0 ml-2 rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground italic text-sm">No links for this move</div>
                  )}
                </>
              ) : (
                <>
                  {linksValue?.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={link.title}
                        onChange={(e) => handleLinkChange(index, 'title', e.target.value)}
                        placeholder="Link title"
                        className="bg-input border-border text-foreground flex-1"
                      />
                      <Input
                        value={link.url}
                        onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                        placeholder="URL"
                        className="bg-input border-border text-foreground flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveLink(index)}
                        className="text-red-400 hover:text-red-200 hover:bg-red-500/20 flex-shrink-0 rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAddLink}
                    className="w-full bg-secondary/50 border border-border text-muted-foreground hover:bg-accent/70 hover:border-border hover:text-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Link
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}