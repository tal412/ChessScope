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
import { FOLDER_COLORS } from '@/constants/colors';

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

export default function FolderCreateDialog({ onCreateFolder, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].value);

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
    setSelectedColor(FOLDER_COLORS[0].value);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setFolderName('');
    setSelectedIcon('folder');
    setSelectedColor(FOLDER_COLORS[0].value);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="outline"
            size="sm"
            className="bg-secondary border-border text-foreground hover:bg-accent hover:text-foreground"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            Create New Folder
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Folder Name
            </label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="bg-secondary border-border text-foreground"
              placeholder="Enter folder name"
              autoFocus
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
                  onClick={() => setSelectedIcon(name)}
                  className={cn(
                    "p-2 rounded-md border-2 transition-all hover:bg-accent",
                    selectedIcon === name
                      ? "border-warning bg-warning/20"
                      : "border-border bg-secondary"
                  )}
                >
                  <Icon className="w-4 h-4 mx-auto" style={{ color: selectedColor }} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {FOLDER_COLORS.map((color, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={cn(
                    "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                    selectedColor === color.value
                      ? "border-foreground scale-110"
                      : "border-border"
                  )}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Preview
            </label>
            <div className="p-3 bg-secondary/50 rounded-md border border-border flex items-center gap-3">
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
              <div className="text-foreground font-medium">
                {folderName || 'Folder Name'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="bg-secondary border-border text-foreground hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim()}
            className="bg-warning hover:bg-warning/90 text-white"
          >
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}