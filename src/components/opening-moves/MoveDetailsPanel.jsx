import React from 'react';
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
  FileText,
  Info,
  Pencil,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function MoveDetailsPanel({ 
  selectedNode, 
  onUpdateNode, 
  onSetMainLine,
  moveTree,
  className = "",
  drawingMode = false,
  onDrawingModeToggle = null
}) {
  if (!selectedNode || selectedNode.san === 'Start') {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-center text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-2">No Move Selected</p>
          <p className="text-sm">
            Select a move from the board or graph to view and edit its details
          </p>
        </div>
      </div>
    );
  }

  const handleCommentChange = (value) => {
    selectedNode.comment = value;
    onUpdateNode();
  };

  const handleLinkChange = (index, field, value) => {
    if (!selectedNode.links) selectedNode.links = [];
    selectedNode.links[index][field] = value;
    onUpdateNode();
  };

  const handleAddLink = () => {
    if (!selectedNode.links) selectedNode.links = [];
    selectedNode.links.push({ title: '', url: '' });
    onUpdateNode();
  };

  const handleRemoveLink = (index) => {
    if (selectedNode.links) {
      selectedNode.links.splice(index, 1);
      onUpdateNode();
    }
  };

  const handleSetAsMainLine = () => {
    onSetMainLine(selectedNode);
  };

  const handleArrowsChange = (newArrows) => {
    selectedNode.arrows = newArrows;
    onUpdateNode();
  };

  const handleDrawingModeToggle = () => {
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
            <div className="relative group">
              <Button
                size="sm"
                variant="ghost"
                disabled={selectedNode.isMainLine}
                onClick={handleSetAsMainLine}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  selectedNode.isMainLine 
                    ? "text-amber-400 bg-amber-400/10" 
                    : "text-slate-400 hover:text-amber-400 hover:bg-amber-400/10"
                )}
              >
                <Star className={cn(
                  "w-4 h-4 transition-all",
                  selectedNode.isMainLine ? "fill-amber-400" : "fill-none"
                )} />
              </Button>
              
              {/* Custom tooltip */}
              <div className="absolute right-0 bottom-full mb-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg">
                {selectedNode.isMainLine 
                  ? 'Already on main line' 
                  : 'Set as main line'}
                <div className="absolute -bottom-1 right-3 w-2 h-2 bg-slate-800 border-r border-b border-slate-600 transform rotate-45"></div>
              </div>
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
            <Textarea
              value={selectedNode.comment || ''}
              onChange={(e) => handleCommentChange(e.target.value)}
              placeholder="Add notes about this move..."
              className="bg-slate-700 border-slate-600 text-slate-100 flex-1 resize-none"
            />
          </div>

          {/* Arrows Section */}
          <div className="flex-shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300 flex items-center">
                  <Target className="w-4 h-4 mr-2" />
                  Arrows ({(selectedNode.arrows || []).length})
                </Label>
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
              </div>
              
              {/* Show arrow count and hint */}
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
              {selectedNode.links?.map((link, index) => (
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 