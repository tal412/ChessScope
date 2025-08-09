import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  FolderPlus,
  Folder,
  BookOpen,
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

export default function FolderCreateDialog({ onCreateFolder, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const [selectedColor, setSelectedColor] = useState('#6366f1');

  const handleCreate = () => {
    if (!folderName.trim()) return;

    onCreateFolder({
      name: folderName.trim(),
      icon: selectedIcon,
      color: selectedColor
    });

    // Reset form
    setFolderName('');
    setSelectedIcon('folder');
    setSelectedColor('#6366f1');
    setIsOpen(false);
  };

  const handleCancel = () => {
    setFolderName('');
    setSelectedIcon('folder');
    setSelectedColor('#6366f1');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button 
            variant="outline" 
            size="sm"
            className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            Create New Folder
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 block">
              Folder Name
            </label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="bg-slate-700 border-slate-600 text-slate-100"
              placeholder="Enter folder name"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 block">
              Icon
            </label>
            <div className="grid grid-cols-5 gap-2">
              {FOLDER_ICONS.map(({ icon: Icon, name }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedIcon(name)}
                  className={cn(
                    "p-2 rounded-md border-2 transition-all hover:bg-slate-700",
                    selectedIcon === name 
                      ? "border-amber-500 bg-amber-500/20" 
                      : "border-slate-600 bg-slate-800"
                  )}
                >
                  <Icon className="w-4 h-4 mx-auto" style={{ color: selectedColor }} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 block">
              Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                    selectedColor === color 
                      ? "border-white scale-110" 
                      : "border-slate-600"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 block">
              Preview
            </label>
            <div className="p-3 bg-slate-900 rounded-md border border-slate-700 flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ 
                  backgroundColor: `${selectedColor}20`,
                  border: `1px solid ${selectedColor}40`
                }}
              >
                {React.createElement(
                  FOLDER_ICONS.find(f => f.name === selectedIcon)?.icon || Folder,
                  {
                    className: "w-5 h-5",
                    style: { color: selectedColor }
                  }
                )}
              </div>
              <div className="text-slate-200 font-medium">
                {folderName || 'Folder Name'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}