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
    <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-purple-500 mx-auto"></div>
          <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-lg"></div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-200">
            {title}
          </h2>
          <p className="text-slate-400 text-base max-w-md mx-auto">
            {subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
          </div>
          
          {/* Progress Bar - Only show during actual syncing */}
          {showProgress && (
            <div className="mt-6 space-y-4">
              <div className="w-96 max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium flex-1 mr-4">
                    {syncProgress >= 100 ? 'Finalizing...' : syncStatus || 'Updating Analysis...'}
                  </span>
                  <span className="text-slate-400 flex-shrink-0">
                    {Math.round(syncProgress || 0)}%
                  </span>
                </div>
                
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full origin-left"
                    style={{ 
                      transform: `scaleX(${Math.min(syncProgress || 0, 100) / 100})`,
                      transition: 'transform 0.3s ease-out',
                      willChange: 'transform'
                    }}
                  />
                </div>
              </div>
              <p className="text-slate-500 text-sm">
                This runs in the background - feel free to switch tabs
              </p>
            </div>
          )}
          
          {/* Status text without progress bar */}
          {!showProgress && (
            <div className="mt-6">
              <p className="text-slate-300 text-sm">
                {syncStatus || 'Processing...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 