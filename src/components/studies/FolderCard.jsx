import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Folder, 
  FolderOpen, 
  Edit, 
  Trash2, 
  BookOpen,
  Palette,
  Star,
  Heart,
  Target,
  Briefcase,
  Archive,
  Crown,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FOLDER_ICONS = [
  { icon: Folder, name: 'folder' },
  { icon: BookOpen, name: 'book' },
  { icon: Star, name: 'star' },
  { icon: Heart, name: 'heart' },
  { icon: Target, name: 'target' },
  { icon: Briefcase, name: 'briefcase' },
  { icon: Archive, name: 'archive' },
  { icon: Crown, name: 'crown' },
  { icon: Shield, name: 'shield' }
];

const FOLDER_COLORS = [
  '#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'
];

export default function FolderCard({ 
  folder, 
  studiesCount = 0,
  isOpen = false,
  onClick,
  onEdit,
  onDelete,
  isDragging = false,
  isDragOver = false,
  className = ""
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [editIcon, setEditIcon] = useState(folder.icon || 'folder');
  const [editColor, setEditColor] = useState(folder.color || '#6366f1');

  const IconComponent = FOLDER_ICONS.find(f => f.name === (folder.icon || 'folder'))?.icon || Folder;

  const handleEditSave = () => {
    onEdit?.({
      ...folder,
      name: editName,
      icon: editIcon,
      color: editColor
    });
    setShowEditDialog(false);
  };

  const handleEditCancel = () => {
    setEditName(folder.name);
    setEditIcon(folder.icon || 'folder');
    setEditColor(folder.color || '#6366f1');
    setShowEditDialog(false);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <Card 
            className={cn(
              "bg-card border-border hover:border-amber-500/50 transition-all cursor-pointer group relative",
              isDragging && "opacity-50 rotate-2 scale-105",
              isDragOver && "border-amber-400 bg-amber-500/10 scale-102",
              className
            )}
            onClick={onClick}
            style={{
              borderColor: isDragOver ? '#f59e0b' : undefined
            }}
          >
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center gap-3">
                <div 
                  className="relative p-3 rounded-lg"
                  style={{ 
                    backgroundColor: `${folder.color || '#6366f1'}20`,
                    border: `1px solid ${folder.color || '#6366f1'}40`
                  }}
                >
                  {isOpen ? (
                    <FolderOpen 
                      className="w-6 h-6" 
                      style={{ color: folder.color || '#6366f1' }}
                    />
                  ) : (
                    <IconComponent 
                      className="w-6 h-6" 
                      style={{ color: folder.color || '#6366f1' }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm text-card-foreground truncate leading-tight">
                    {folder.name}
                  </CardTitle>
                  <Badge 
                    variant="outline" 
                    className="text-xs mt-1 border-border text-muted-foreground"
                  >
                    {studiesCount} {studiesCount === 1 ? 'study' : 'studies'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="px-4 pb-4">
              <div className="h-16 bg-muted rounded-md border border-border flex items-center justify-center">
                <div className="text-muted-foreground text-xs text-center">
                  {studiesCount === 0 ? 'Empty folder' : `${studiesCount} studies inside`}
                </div>
              </div>
            </CardContent>

            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-amber-500/20 border-2 border-amber-400 border-dashed rounded-lg flex items-center justify-center">
                <div className="text-amber-300 font-medium">Drop studies here</div>
              </div>
            )}
          </Card>
        </ContextMenuTrigger>
        
        <ContextMenuContent className="bg-popover border-border">
          <ContextMenuItem 
            onClick={(e) => {
              e.stopPropagation();
              setShowEditDialog(true);
            }}
            className="text-popover-foreground hover:text-accent-foreground hover:bg-accent"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Folder
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Delete Folder</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{folder.name}"? The studies inside will be moved to the root level. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-secondary-foreground hover:bg-accent">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.(folder);
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Folder Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Edit Folder</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Folder Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-input border-border text-foreground"
                placeholder="Enter folder name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Icon
              </label>
              <div className="grid grid-cols-5 gap-2">
                {FOLDER_ICONS.map(({ icon: Icon, name }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setEditIcon(name)}
                    className={cn(
                      "p-2 rounded-md border-2 transition-all hover:bg-accent",
                      editIcon === name 
                        ? "border-amber-500 bg-amber-500/20" 
                        : "border-border bg-card"
                    )}
                  >
                    <Icon className="w-4 h-4 mx-auto" style={{ color: editColor }} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Color
              </label>
              <div className="grid grid-cols-5 gap-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                      editColor === color 
                        ? "border-foreground scale-110" 
                        : "border-border"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleEditCancel}
              className="bg-secondary border-border text-secondary-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editName.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}