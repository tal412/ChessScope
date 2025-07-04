import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsLoading({ 
  isLoading, 
  progress = 0, 
  status = '', 
  onComplete = null,
  className = '',
  successMessage = 'Settings Updated Successfully!',
  successDuration = 1500 // Make the duration configurable
}) {
  const [displayState, setDisplayState] = useState('loading'); // 'loading', 'success', 'hidden'

  // Reset state when isLoading changes from false to true
  useEffect(() => {
    if (isLoading) {
      setDisplayState('loading');
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) {
      if (progress >= 100 && displayState === 'loading') {
        // Show success immediately when reaching 100%
        setDisplayState('success');
        
        // After successDuration, hide and call completion
        const timer = setTimeout(() => {
          setDisplayState('hidden');
          if (onComplete) {
            onComplete();
          }
        }, successDuration);
        
        return () => clearTimeout(timer);
      } else if (progress < 100) {
        setDisplayState('loading');
      }
    } else if (!isLoading && displayState === 'loading') {
      // If loading ends without reaching 100%, go straight to success
      setDisplayState('success');
      
      const timer = setTimeout(() => {
        setDisplayState('hidden');
        if (onComplete) {
          onComplete();
        }
      }, successDuration);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, progress, displayState, onComplete, successDuration]);

  // Always reserve space for the component to prevent layout shifts
  return (
    <div 
      className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        "min-h-[60px] flex items-center justify-center",
        displayState !== 'hidden' ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="w-full max-w-lg">
        {displayState === 'success' ? (
          // Success Animation
          <div className="flex items-center justify-center space-x-3 animate-in slide-in-from-bottom-2 duration-300">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              {successMessage}
            </span>
          </div>
        ) : displayState === 'loading' ? (
          // Loading Animation - Progress bar with integrated text
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300 font-medium truncate pr-4">
                {progress >= 100 ? 'Finalizing...' : status || 'Updating Analysis...'}
              </span>
              <span className="text-slate-400 flex-shrink-0">
                {Math.round(progress)}%
              </span>
            </div>
            
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full origin-left"
                style={{ 
                  transform: `scaleX(${Math.min(progress, 100) / 100})`,
                  transition: 'transform 0.3s ease-out',
                  willChange: 'transform'
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default SettingsLoading; 