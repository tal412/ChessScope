import React from 'react';

export default function SyncingOverlay({ 
  isVisible, 
  syncProgress, 
  syncStatus, 
  title = 'Syncing Games',
  subtitle = 'Updating your chess database with latest games. This may take a moment...',
  showProgress = true
}) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-border border-t-primary mx-auto"></div>
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-lg"></div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">
            {title}
          </h2>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            {subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          </div>
          
          {/* Progress Bar - Only show during actual syncing */}
          {showProgress && (
            <div className="mt-6 space-y-4">
              <div className="w-[28rem] max-w-2xl mx-auto space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium flex-1 mr-4 whitespace-nowrap overflow-hidden text-ellipsis">
                    {syncProgress >= 100 ? 'Finalizing...' : syncStatus || 'Updating Analysis...'}
                  </span>
                  <span className="text-muted-foreground flex-shrink-0">
                    {Math.round(syncProgress || 0)}%
                  </span>
                </div>
                
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-info rounded-full origin-left"
                    style={{
                      transform: `scaleX(${Math.min(syncProgress || 0, 100) / 100})`,
                      transition: 'transform 0.3s ease-out',
                      willChange: 'transform'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Status text without progress bar */}
          {!showProgress && (
            <div className="mt-6">
              <p className="text-foreground text-sm">
                {syncStatus || 'Processing...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 