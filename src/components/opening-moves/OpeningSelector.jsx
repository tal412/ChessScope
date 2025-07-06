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
import { checkPositionInOpenings } from '@/api/openingEntities';
import OpeningDetailsDialog from './OpeningDetailsDialog';

export default function OpeningSelector({ fen, trigger, children }) {
  const navigate = useNavigate();
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && fen) {
      loadOpenings();
    }
  }, [open, fen]);

  const loadOpenings = async () => {
    try {
      setLoading(true);
      const username = localStorage.getItem('chesscope_username');
      if (!username) return;

      const matchingOpenings = await checkPositionInOpenings(fen, username);
      setOpenings(matchingOpenings);
    } catch (error) {
      console.error('Error loading openings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpeningClick = (openingId) => {
    setOpen(false);
    navigate(`/openings-book/opening/${openingId}`);
  };

  const handleCreateOpening = (openingDetails) => {
    const params = new URLSearchParams({
      name: openingDetails.name,
      color: openingDetails.color
    });
    navigate(`/openings-book/editor/new?${params.toString()}`);
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
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            Openings containing this position
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : openings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No saved openings contain this position</p>
              <OpeningDetailsDialog 
                onConfirm={handleCreateOpening}
                title="Create New Opening"
                confirmText="Create Opening"
              >
                <Button className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  Create New Opening
                </Button>
              </OpeningDetailsDialog>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {openings.map((opening) => (
                  <button
                    key={opening.id}
                    onClick={() => handleOpeningClick(opening.id)}
                    className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-100">{opening.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${opening.color === 'white' ? 'border-amber-500/50 text-amber-400' : 'border-slate-500 text-slate-400'}`}>
                              {opening.color === 'white' ? (
                                <Crown className="w-3 h-3 mr-1" />
                              ) : (
                                <Shield className="w-3 h-3 mr-1" />
                              )}
                              {opening.color}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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