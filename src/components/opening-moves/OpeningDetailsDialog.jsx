import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Shield, Edit, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OpeningDetailsDialog({ 
  trigger, 
  children, 
  defaultName = '', 
  defaultColor = 'white',
  onConfirm,
  title = 'Create New Opening',
  confirmText = 'Create Opening',
  confirmIcon: ConfirmIcon = Plus
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [color, setColor] = useState(defaultColor);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!name.trim()) {
      setError('Opening name is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (onConfirm) {
        await onConfirm({ name: name.trim(), color });
      } else {
        // Default behavior - navigate to editor with query params
        const params = new URLSearchParams({
          name: name.trim(),
          color: color
        });
        navigate(`/openings-book/editor/new?${params.toString()}`);
      }
      
      setOpen(false);
      // Reset form
      setName(defaultName);
      setColor(defaultColor);
    } catch (err) {
      setError(err.message || 'Failed to create opening');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setError('');
    setName(defaultName);
    setColor(defaultColor);
  };

  const triggerElement = trigger || (
    <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
      <Plus className="w-4 h-4 mr-2" />
      Add Opening
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || triggerElement}
      </DialogTrigger>
      <DialogContent className="bg-slate-800/95 backdrop-blur-xl border-slate-700/50 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <Edit className="w-5 h-5 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Opening Name */}
          <div className="space-y-2">
            <Label className="text-slate-300">Opening Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Italian Game - Giuoco Piano"
              className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <Label className="text-slate-300">Playing Color</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setColor('white')}
                disabled={loading}
                className={cn(
                  "flex-1 h-12 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center border",
                  color === 'white' 
                    ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' 
                    : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Crown className={cn(
                  "w-5 h-5 mr-2",
                  color === 'white' ? 'text-white' : 'text-amber-400'
                )} />
                White
              </button>
              <button
                type="button"
                onClick={() => setColor('black')}
                disabled={loading}
                className={cn(
                  "flex-1 h-12 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center border",
                  color === 'black' 
                    ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' 
                    : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Shield className={cn(
                  "w-5 h-5 mr-2",
                  color === 'black' ? 'text-white' : 'text-slate-400'
                )} />
                Black
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !name.trim()}
            className={cn(
              "flex-1 text-white transition-all duration-200",
              loading || !name.trim()
                ? "bg-transparent border border-slate-600 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <ConfirmIcon className="w-4 h-4 mr-2" />
                {confirmText}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 