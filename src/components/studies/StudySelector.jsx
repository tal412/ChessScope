import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Crown, Shield, ExternalLink, Loader2 } from 'lucide-react';
import { checkPositionInStudies } from '@/api/hybridEntities';
import StudyDetailsDialog from './StudyDetailsDialog';

export default function StudySelector({ fen, trigger, children, openings = [] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  

  const handleStudyClick = (studyId) => {
    setOpen(false);
    navigate(`/studies-book/study/${studyId}`);
  };

  const handleCreateStudy = (studyDetails) => {
    const params = new URLSearchParams({
      name: studyDetails.name,
      color: studyDetails.color,
      initialFen: studyDetails.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      startingPgn: studyDetails.startingPgn || '',
      tags: studyDetails.selectedTags?.map(tag => tag.id).join(',') || ''
    });
    navigate(`/studies-book/editor/new?${params.toString()}`);
  };

  const triggerElement = trigger || (
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
      <BookOpen className="w-4 h-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || triggerElement}
      </DialogTrigger>
      <DialogContent className="bg-card border-border text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            Studies containing this position
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {openings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No saved studies contain this position</p>
              <StudyDetailsDialog 
                onConfirm={handleCreateStudy}
                title="Create New Study"
                confirmText="Create Study"
              >
                <Button className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  Create New Study
                </Button>
              </StudyDetailsDialog>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {openings.map((study) => (
                  <button
                    key={study.id}
                    onClick={() => handleStudyClick(study.id)}
                    className="w-full p-3 bg-muted hover:bg-accent transition-colors text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{study.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${study.color === 'white' ? 'border-amber-500/50 text-amber-400' : 'border-border text-muted-foreground'}`}>
                              {study.color === 'white' ? (
                                <Crown className="w-3 h-3 mr-1" />
                              ) : (
                                <Shield className="w-3 h-3 mr-1" />
                              )}
                              {study.color}
                            </Badge>
                            {/* Show tags if available */}
                            {study.tags && study.tags.length > 0 && (
                              <div className="flex gap-1">
                                {study.tags.slice(0, 2).map(tag => (
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
                                {study.tags.length > 2 && (
                                  <span className="text-xs text-muted-foreground">+{study.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}