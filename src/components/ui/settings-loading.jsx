import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsLoading({ 
  isLoading, 
  progress = 0, 
  status = '', 
  onComplete = null,
  className = '',
  successMessage = 'Settings Updated Successfully!',
  successDuration = 1500,
  // Generic button props
  buttonText = 'Save Changes',
  loadingText = 'Saving...',
  onButtonClick = null,
  buttonDisabled = false,
  // Custom button props (for advanced use cases)
  approveButton = null,
  cancelButton = null,
  showButtons = true, // Control whether to show buttons or loading
  error = null // Error state to prevent success messages
}) {
  const [displayState, setDisplayState] = useState('buttons'); // 'buttons', 'loading', 'success', 'hidden'

  // Reset state when isLoading changes from false to true
  useEffect(() => {
    if (isLoading) {
      setDisplayState('loading');
    } else if (!isLoading && displayState === 'loading') {
      // Reset to buttons when loading stops (in case of error)
      setDisplayState('buttons');
    }
  }, [isLoading]);

  // Reset to buttons when error state changes to true
  useEffect(() => {
    if (error && displayState !== 'buttons') {
      setDisplayState('buttons');
    }
  }, [error, displayState]);

  useEffect(() => {
    if (isLoading) {
      if (progress >= 100 && displayState === 'loading') {
        // Only show success if there's no error
        if (!error) {
          setDisplayState('success');
          
          // After successDuration, hide and call completion
          const timer = setTimeout(() => {
            setDisplayState('hidden');
            if (onComplete) {
              onComplete();
            }
          }, successDuration);
          
          return () => clearTimeout(timer);
        } else {
          // If there's an error, go back to buttons immediately
          setDisplayState('buttons');
        }
      } else if (progress < 100) {
        setDisplayState('loading');
      }
    } else if (!isLoading && displayState === 'loading') {
      // If loading ends without reaching 100%, only show success if no error
      if (!error) {
        setDisplayState('success');
        
        const timer = setTimeout(() => {
          setDisplayState('hidden');
          if (onComplete) {
            onComplete();
          }
        }, successDuration);
        
        return () => clearTimeout(timer);
      } else {
        // If there's an error, go back to buttons
        setDisplayState('buttons');
      }
    }
  }, [isLoading, progress, displayState, onComplete, successDuration, error]);

  // Don't render anything if we're in hidden state or if buttons shouldn't be shown and we're not loading
  if (displayState === 'hidden' || (!showButtons && !isLoading)) {
    return null;
  }

  return (
    <div 
      className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        "flex items-center justify-center",
        className
      )}
    >
      {/* Fixed container with consistent dimensions */}
      <div className="w-full max-w-lg min-w-[300px]">
        {displayState === 'success' ? (
          // Success Animation - maintain consistent height and width
          <div className="flex items-center justify-center space-x-3 animate-in slide-in-from-bottom-2 duration-300 min-h-[56px] w-full">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              {successMessage}
            </span>
          </div>
        ) : displayState === 'loading' ? (
          // Loading Animation - Progress bar with consistent dimensions
          <div className="space-y-2 py-2 min-h-[56px] flex flex-col justify-center w-full">
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
        ) : displayState === 'buttons' && showButtons ? (
          // Show buttons - either custom or generic with consistent dimensions
          <div className={cn(
            "flex gap-2 w-full",
            // Center generic button, right-align custom buttons
            approveButton || cancelButton ? "justify-end" : "justify-center"
          )}>
            {/* Show custom buttons if provided */}
            {approveButton || cancelButton ? (
              <>
                {cancelButton}
                {approveButton}
              </>
            ) : (
              // Show generic button - maintain consistent dimensions
              !isLoading && (
                <Button 
                  onClick={onButtonClick}
                  disabled={buttonDisabled}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-3 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full max-w-[300px] min-h-[56px]"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className="w-5 h-5" />
                    {buttonText}
                  </div>
                </Button>
              )
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default SettingsLoading; 