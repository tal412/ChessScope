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
  
  // Log state changes
  useEffect(() => {
    console.log('📄 [SETTINGS-LOADING] Display state changed to:', displayState, 'at', new Date().toLocaleTimeString());
  }, [displayState]);

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
          const successStartTime = performance.now();
          console.log('✅ [SETTINGS-LOADING] Success state triggered at', new Date().toLocaleTimeString());
          console.log('✅ [SETTINGS-LOADING] Will show success message for', successDuration, 'ms');
          
          setDisplayState('success');
          
          // After successDuration, hide and call completion
          const timer = setTimeout(() => {
            const successEndTime = performance.now();
            console.log('✅ [SETTINGS-LOADING] Success duration ended after', Math.round(successEndTime - successStartTime), 'ms');
            console.log('✅ [SETTINGS-LOADING] Calling onComplete callback');
            
            setDisplayState('hidden');
            if (onComplete) {
              onComplete();
            }
          }, successDuration);
          
          return () => clearTimeout(timer);
        } else {
          // If there's an error, go back to buttons immediately
          console.log('❌ [SETTINGS-LOADING] Error detected, returning to buttons');
          setDisplayState('buttons');
        }
      } else if (progress < 100) {
        console.log('⏳ [SETTINGS-LOADING] Still loading, progress:', progress + '%');
        setDisplayState('loading');
      }
    } else if (!isLoading && displayState === 'loading') {
      // If loading ends without reaching 100%, only show success if no error
      if (!error) {
        const successStartTime = performance.now();
        console.log('✅ [SETTINGS-LOADING] Success state triggered (loading ended) at', new Date().toLocaleTimeString());
        console.log('✅ [SETTINGS-LOADING] Will show success message for', successDuration, 'ms');
        
        setDisplayState('success');
        
        const timer = setTimeout(() => {
          const successEndTime = performance.now();
          console.log('✅ [SETTINGS-LOADING] Success duration ended after', Math.round(successEndTime - successStartTime), 'ms');
          console.log('✅ [SETTINGS-LOADING] Calling onComplete callback');
          
          setDisplayState('hidden');
          if (onComplete) {
            onComplete();
          }
        }, successDuration);
        
        return () => clearTimeout(timer);
      } else {
        // If there's an error, go back to buttons
        console.log('❌ [SETTINGS-LOADING] Error detected, returning to buttons');
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
          <div className="flex items-center justify-center space-x-3 animate-in slide-in-from-bottom-2 duration-300 min-h-[44px] w-full">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-sm font-medium text-success">
              {successMessage}
            </span>
          </div>
        ) : displayState === 'loading' ? (
          // Loading Animation - Progress bar with consistent dimensions
          <div className="space-y-2 py-2 min-h-[44px] flex flex-col justify-center w-full">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium truncate pr-4">
                {progress >= 100 ? 'Finalizing...' : status || 'Updating Analysis...'}
              </span>
              <span className="text-muted-foreground flex-shrink-0">
                {Math.round(progress)}%
              </span>
            </div>
            
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-blue rounded-full origin-left"
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
                  className="bg-gradient-blue hover:bg-gradient-blue-hover text-white px-12 py-2 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full max-w-[300px] min-h-[44px]"
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