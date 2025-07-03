import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsLoading({ 
  isLoading, 
  progress = 0, 
  status = '', 
  onComplete = null,
  className = '' 
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setShowSuccess(false);
      setIsAnimating(true);
    } else if (progress >= 100 && isAnimating) {
      // Show success animation when loading completes
      setShowSuccess(true);
      
      // Hide success and call completion callback after animation
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setIsAnimating(false);
        if (onComplete) {
          onComplete();
        }
      }, 1500); // Reduced from 2000ms to 1500ms
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, progress, isAnimating, onComplete]);

  // Always reserve space for the component to prevent layout shifts
  return (
    <div 
      className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        "min-h-[60px] flex items-center justify-center", // Reduced from 120px to 60px
        isLoading || showSuccess ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="w-full max-w-lg">
        {showSuccess ? (
          // Success Animation - More minimalist
          <div className="flex items-center justify-center space-x-3 animate-in slide-in-from-bottom-2 duration-300">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              Settings Updated Successfully!
            </span>
          </div>
        ) : isLoading ? (
          // Loading Animation - Progress bar with integrated text
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300 font-medium truncate pr-4">
                {status || 'Updating Analysis...'}
              </span>
              <span className="text-slate-400 flex-shrink-0">
                {Math.round(progress)}%
              </span>
            </div>
            
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full origin-left"
                style={{ 
                  transform: `scaleX(${progress / 100})`,
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