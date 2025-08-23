import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { 
  Crown, 
  Shield,
  Edit,
  Trash2,
  ChevronRight,
  FolderInput,
  Folder,
  BookOpen,
  Star,
  Heart,
  Target,
  Briefcase,
  Archive
} from 'lucide-react';
import Chessground from 'react-chessground';
import 'react-chessground/dist/styles/chessground.css';
import { cn } from '@/lib/utils';

const FOLDER_ICONS = {
  'folder': Folder,
  'book': BookOpen,
  'star': Star,
  'heart': Heart,
  'target': Target,
  'briefcase': Briefcase,
  'archive': Archive,
  'crown': Crown,
  'shield': Shield
};

export default function StudyCard({ 
  study, 
  onClick,
  onEdit,
  onDelete,
  onMoveToFolder,
  folders = [],
  isDragging = false,
  folderInfo = null, // Display folder info when filtering by tags
  className = ""
}) {
  const handleContextAction = (action, e) => {
    e?.stopPropagation();
    action();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card 
          className={cn(
            "bg-card border-border hover:border-amber-500/50 transition-all cursor-pointer group",
            isDragging && "opacity-50 rotate-2 scale-105",
            className
          )}
          onClick={onClick}
        >
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm text-card-foreground truncate leading-tight">
                  {study.name}
                </CardTitle>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${study.color === 'white' ? 'border-amber-500/50 text-amber-400' : 'border-border text-muted-foreground'}`}>
                    {study.color === 'white' ? (
                      <Crown className="w-2.5 h-2.5 mr-1" />
                    ) : (
                      <Shield className="w-2.5 h-2.5 mr-1" />
                    )}
                    {study.color.charAt(0).toUpperCase() + study.color.slice(1)}
                  </Badge>
                  {folderInfo && (
                    <Badge 
                      variant="outline" 
                      className="text-xs px-1.5 py-0.5 flex items-center gap-1"
                      style={{
                        borderColor: `${folderInfo.color}50`,
                        color: folderInfo.color,
                        backgroundColor: `${folderInfo.color}10`
                      }}
                    >
                      {React.createElement(
                        FOLDER_ICONS[folderInfo.icon] || Folder,
                        { className: "w-2.5 h-2.5" }
                      )}
                      {folderInfo.name}
                    </Badge>
                  )}
                </div>
                {/* Tags */}
                {study.tags && study.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {study.tags.slice(0, 3).map(tag => (
                      <Badge 
                        key={tag.id}
                        variant="outline"
                        className="text-xs px-1 py-0"
                        style={{
                          borderColor: tag.color,
                          color: tag.color,
                          fontSize: '10px'
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {study.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs px-1 py-0 border-border text-muted-foreground" style={{ fontSize: '10px' }}>
                        +{study.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleContextAction(() => onEdit?.(study), e)}
                  className="h-6 w-6 p-0"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleContextAction(() => onDelete?.(study), e)}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-3">
            {/* Mini Chessboard Preview - Made smaller */}
            <div className="w-3/4 mx-auto">
              <div className="aspect-square mb-2 rounded-md overflow-hidden bg-muted">
                <Chessground
                  fen={study.initial_view_fen || study.initial_fen}
                  orientation={study.color}
                  viewOnly={true}
                  coordinates={false}
                  style={{
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{study.initial_moves?.length || 0} moves</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      
      <ContextMenuContent className="bg-popover border-border">
        <ContextMenuItem 
          onClick={(e) => handleContextAction(() => onEdit?.(study), e)}
          className="text-popover-foreground hover:text-accent-foreground hover:bg-accent"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Study
        </ContextMenuItem>
        
        {folders.length > 0 && (
          <>
            <ContextMenuItem 
              onClick={(e) => handleContextAction(() => onMoveToFolder?.(study, null), e)}
              className="text-popover-foreground hover:text-accent-foreground hover:bg-accent"
            >
              <FolderInput className="w-4 h-4 mr-2" />
              Move to Root
            </ContextMenuItem>
            {folders.map(folder => (
              <ContextMenuItem 
                key={folder.id}
                onClick={(e) => handleContextAction(() => onMoveToFolder?.(study, folder), e)}
                className="text-popover-foreground hover:text-accent-foreground hover:bg-accent pl-8"
              >
                <span 
                  className="w-3 h-3 rounded mr-2"
                  style={{ backgroundColor: folder.color }}
                />
                {folder.name}
              </ContextMenuItem>
            ))}
          </>
        )}
        
        <ContextMenuItem 
          onClick={(e) => handleContextAction(() => onDelete?.(study), e)}
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Study
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}