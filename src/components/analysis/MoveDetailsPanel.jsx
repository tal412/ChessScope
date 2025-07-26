import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        onClick={readOnly || disabled ? null : onClick}
        className={cn(
          "h-8 w-8 p-0 transition-colors",
          isActive 
            ? "text-white bg-gradient-to-br from-amber-400 to-orange-500 border border-amber-300 shadow-lg shadow-amber-400/50" 
            : "text-slate-400",
          !readOnly && !disabled && "hover:text-amber-400 hover:bg-amber-400/10"
        )}
      >
        <Icon className={cn(
          "w-4 h-4 transition-all stroke-2",
          isActive ? "stroke-white drop-shadow-md filter brightness-125" : "stroke-current",
          "fill-none"
        )} />
      </Button>
      
      {/* Tooltip - always show */}
      <div className="absolute right-0 bottom-full mb-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg">
        {readOnly ? (
          // View mode - just show the label
          isActive ? `${label.charAt(0).toUpperCase() + label.slice(1)}` : `Not ${label}`
        ) : (
          // Edit mode - show action text
          isActive ? `Already ${label}` : `Set as ${label}`
        )}
        <div className="absolute -bottom-1 right-3 w-2 h-2 bg-slate-800 border-r border-b border-slate-600 transform rotate-45"></div>
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
        <div className="text-center text-slate-400">
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
    onSetMainLine(selectedNode);
  };

  const handleSetAsInitialPosition = () => {
    if (readOnly) return;
    if (onSetInitialMove) {
      onSetInitialMove(selectedNode);
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
      <Card className="bg-slate-800 border-slate-700 flex-shrink-0 mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-100 text-lg flex items-center justify-between">
            <span>Move: {selectedNode.san}</span>
                        <div className="flex items-center gap-2">
              {/* Main Line Button */}
              <MoveActionButton
                icon={Star}
                label="main line"
                isActive={selectedNode.isMainLine}
                onClick={handleSetAsMainLine}
                disabled={selectedNode.isMainLine}
                readOnly={readOnly}
              />

              {/* Initial Position Button */}
              <MoveActionButton
                icon={Play}
                label="initial position"
                isActive={selectedNode.isInitialMove}
                onClick={handleSetAsInitialPosition}
                disabled={selectedNode.isInitialMove}
                readOnly={readOnly}
              />
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Move Details */}
      <Card className="bg-slate-800 border-slate-700 flex-1 flex flex-col min-h-0">
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="text-slate-100 text-base flex items-center">
            <Info className="w-4 h-4 mr-2 text-amber-500" />
            Move Details
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Comment Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <Label className="text-slate-300 flex-shrink-0 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Comment
            </Label>
            {readOnly ? (
              <div className="bg-slate-700 border border-slate-600 rounded-md p-3 flex-1 min-h-0 overflow-y-auto">
                {commentValue ? (
                  <div className="text-slate-100 whitespace-pre-wrap break-words">
                    {commentValue}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">No comment for this move</div>
                )}
              </div>
            ) : (
              <Textarea
                value={commentValue}
                onChange={(e) => handleCommentChange(e.target.value)}
                placeholder="Add notes about this move..."
                className="bg-slate-700 border-slate-600 text-slate-100 flex-1 resize-none"
              />
            )}
          </div>

          {/* Arrows Section */}
          <div className="flex-shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300 flex items-center">
                  <Target className="w-4 h-4 mr-2" />
                  Arrows ({(selectedNode.arrows || []).length})
                </Label>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant={drawingMode ? "default" : "outline"}
                    onClick={handleDrawingModeToggle}
                    disabled={selectedNode && selectedNode.san === 'Start'}
                    className={cn(
                      "transition-all duration-200",
                      selectedNode && selectedNode.san === 'Start'
                        ? "opacity-50 cursor-not-allowed border-slate-600 text-slate-500"
                        : drawingMode 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "border-slate-600 text-slate-300 hover:bg-slate-700"
                    )}
                    title={selectedNode && selectedNode.san === 'Start' ? "Cannot draw arrows on starting position" : undefined}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    {drawingMode ? "Stop Drawing" : "Draw Arrows"}
                  </Button>
                )}
              </div>
              
              {/* Show arrow count and hint */}
              {!readOnly && (
                <div className="text-xs text-slate-400">
                  {drawingMode ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Drawing mode active - right-click drag on board to draw arrows
                    </div>
                  ) : (
                    <div>
                      Click "Draw Arrows" to add arrows to this position
                    </div>
                  )}
                </div>
              )}
              
              {/* Arrow list */}
              {(selectedNode.arrows || []).length > 0 && (
                <>
                  <Separator className="bg-slate-600" />
                  <div className="space-y-2 max-h-24 overflow-y-auto">
                    {(selectedNode.arrows || []).map((arrow, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-1 rounded-full" 
                            style={{ backgroundColor: arrow.color }}
                          ></div>
                          <span className="text-slate-300 font-mono">
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
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
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
            <Label className="text-slate-300 flex-shrink-0 mb-2">
              <LinkIcon className="w-4 h-4 inline mr-1" />
              Links
            </Label>
            <div className="flex-1 overflow-y-auto space-y-2">
              {readOnly ? (
                <>
                  {linksValue && linksValue.length > 0 ? (
                    linksValue.map((link, index) => (
                      <div key={index} className="bg-slate-700 border border-slate-600 rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-slate-100 font-medium truncate">
                              {link.title || 'Untitled Link'}
                            </div>
                            <div className="text-slate-400 text-sm truncate">
                              {link.url || 'No URL'}
                            </div>
                          </div>
                          {link.url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(link.url, '_blank')}
                              className="text-amber-400 hover:text-amber-300 flex-shrink-0 ml-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-sm">No links for this move</div>
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
                        className="bg-slate-700 border-slate-600 text-slate-100 flex-1"
                      />
                      <Input
                        value={link.url}
                        onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                        placeholder="URL"
                        className="bg-slate-700 border-slate-600 text-slate-100 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveLink(index)}
                        className="text-red-400 hover:text-red-300 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddLink}
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Link
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 