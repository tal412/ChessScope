import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Target, 
  EyeOff,
  Layers,
  Search,
  Settings,
  ZoomIn
} from 'lucide-react';

/**
 * Canvas Controls component
 * @param {Object} props - Component props
 */
const CanvasControls = ({
  // Mode and visibility
  mode,
  isInitializing,
  positionedNodes,
  hasValidTransform,
  transform,
  enableOpeningClusters,
  
  // Cluster controls
  showOpeningClusters,
  showPositionClusters,
  onToggleOpeningClusters,
  onTogglePositionClusters,
  
  // Auto zoom
  autoZoomOnClick,
  onToggleAutoZoomOnClick,
  
  // Zoom functions
  onZoomToAll,
  
  // Performance controls
  showPerformanceControls,
  onShowPerformanceControls,
  
  // Filter values
  maxDepth,
  minGameCount,
  tempMinGameCount,
  winRateFilter,
  tempWinRateFilter,
  
  // Filter handlers
  onMaxDepthChange,
  onMinGameCountChange,
  onTempMinGameCountChange,
  onTempWinRateFilterChange,
  onApplyWinRateFilter,
  onMinGameCountSliderRelease,
  
  // State
  isGenerating,
  isCanvasInteractionBlocked,
  
  // Context menu indicator
  contextMenuActions,
}) => {
  const shouldShowControls = !isInitializing && positionedNodes.length > 0 && hasValidTransform;
  
  return (
    <>
      {/* Graph Controls - Top Left - SHARED between modes */}
      {shouldShowControls && (
        <div className="absolute top-4 left-4 space-y-2 pointer-events-auto">
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onZoomToAll}
              className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
              title="Fit graph to view"
              disabled={isGenerating || isCanvasInteractionBlocked()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </Button>

            {/* Show opening cluster controls only when clustering is enabled */}
            {enableOpeningClusters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onToggleOpeningClusters}
                className={`${showOpeningClusters ? 'bg-purple-600 border-purple-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
                title="Toggle Opening Clusters"
                disabled={isCanvasInteractionBlocked()}
              >
                <Layers className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
                <span className="hidden group-hover:inline transition-opacity duration-100">Opening Clusters</span>
              </Button>
            )}

            {/* Show position cluster controls in both modes */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onTogglePositionClusters}
              className={`${showPositionClusters ? 'bg-orange-600 border-orange-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
              title="Toggle Position Clusters (Current Move)"
              disabled={isCanvasInteractionBlocked()}
            >
              <Target className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
              <span className="hidden group-hover:inline transition-opacity duration-100">Position Clusters</span>
            </Button>

            {/* Auto zoom on click toggle */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onToggleAutoZoomOnClick}
              className={`${autoZoomOnClick ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'} text-slate-200 group transition-all duration-100`}
              title="Auto Zoom on Click"
              disabled={isCanvasInteractionBlocked()}
            >
              <Search className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
              <span className="hidden group-hover:inline transition-opacity duration-100">Auto Zoom on Click</span>
            </Button>
          </div>
        </div>
      )}

      {/* Performance Controls - Bottom Right */}
      {mode === 'performance' && shouldShowControls && (
        <div className="absolute bottom-4 right-4 space-y-4 max-w-sm pointer-events-auto z-[150]">
          {/* Controls Card - positioned above the button */}
          {showPerformanceControls && onShowPerformanceControls && (
            <Card className="bg-slate-800/95 border-slate-700 backdrop-blur-medium-optimized shadow-xl pointer-events-auto">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-200 text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Controls
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onShowPerformanceControls(false)}
                    className="ml-auto text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 p-1"
                    title="Hide controls"
                    disabled={isCanvasInteractionBlocked()}
                  >
                    <EyeOff className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pointer-events-auto">
                {/* Controls Row 1 */}
                <div className="space-y-4">
                  {/* Max Depth */}
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Max Depth</label>
                    <select 
                      value={maxDepth} 
                      onChange={(e) => onMaxDepthChange && onMaxDepthChange(Number(e.target.value))}
                      className={`w-full px-2 py-1 rounded ${(isGenerating || isCanvasInteractionBlocked()) ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-200'}`}
                      disabled={isGenerating || isCanvasInteractionBlocked() || !onMaxDepthChange}
                    >
                      {[5, 10, 15, 20, 25, 30].map(d => (
                        <option key={d} value={d}>{d} moves</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Min Games Slider */}
                  <div className="space-y-3 bg-slate-700/30 p-3 rounded-lg border border-slate-600/50">
                    <div className="flex justify-between items-center">
                      <label className="text-slate-200 text-xs font-medium">
                        Min Games Filter
                      </label>
                      <span className="text-green-300 text-xs font-mono bg-slate-600/50 px-2 py-1 rounded">
                        {tempMinGameCount}+ games
                      </span>
                    </div>
                    
                    <div className="space-y-2 pointer-events-auto">
                      <Slider
                        value={[tempMinGameCount]}
                        onValueChange={(value) => onTempMinGameCountChange && onTempMinGameCountChange(value[0])}
                        onValueCommit={onMinGameCountSliderRelease}
                        min={1}
                        max={25}
                        step={1}
                        className="w-full pointer-events-auto [&_[role=slider]]:bg-green-500 [&_[role=slider]]:border-green-400 [&_[role=slider]]:shadow-lg [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-green-500 [&_.bg-primary]:to-green-600 [&_.bg-slate-200]:bg-slate-600/80"
                        disabled={isGenerating || isCanvasInteractionBlocked() || !onTempMinGameCountChange}
                      />
                      
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">1 game</span>
                        <span className="text-slate-400">8 games</span>
                        <span className="text-slate-400">17 games</span>
                        <span className="text-slate-400">25 games</span>
                      </div>
                    </div>
                    
                    {/* Explanation */}
                    <div className="text-xs text-slate-400 leading-relaxed">
                      Only shows moves with at least this many games.
                    </div>
                  </div>
                </div>

                {/* Controls Row 2 - Win Rate Range Filter */}
                <div className="space-y-3 bg-slate-700/30 p-3 rounded-lg border border-slate-600/50">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-200 text-xs font-medium">
                      Win Rate Range Filter
                    </label>
                    <span className="text-blue-300 text-xs font-mono bg-slate-600/50 px-2 py-1 rounded">
                      {tempWinRateFilter[0]}% - {tempWinRateFilter[1]}%
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="relative">
                      <Slider
                        value={tempWinRateFilter}
                        onValueChange={onTempWinRateFilterChange}
                        min={0}
                        max={100}
                        step={5}
                        className="w-full [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-400 [&_[role=slider]]:shadow-lg [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-blue-500 [&_.bg-primary]:to-blue-600 [&_.bg-slate-200]:bg-slate-600/80"
                        disabled={isGenerating || isCanvasInteractionBlocked() || !onTempWinRateFilterChange}
                      />
                      {/* Performance zone indicators on the slider track */}
                      <div className="absolute top-2 left-0 right-0 flex justify-between pointer-events-none">
                        <div className="w-px h-2 bg-red-400/60"></div>
                        <div className="w-px h-2 bg-orange-400/60"></div>
                        <div className="w-px h-2 bg-amber-400/60"></div>
                        <div className="w-px h-2 bg-cyan-400/60"></div>
                        <div className="w-px h-2 bg-green-400/60"></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-red-300 font-medium">0%</span>
                      <span className="text-orange-300 font-medium">25%</span>
                      <span className="text-amber-300 font-medium">50%</span>
                      <span className="text-cyan-300 font-medium">75%</span>
                      <span className="text-green-300 font-medium">100%</span>
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    onClick={onApplyWinRateFilter}
                    disabled={isGenerating || isCanvasInteractionBlocked() || !onApplyWinRateFilter || (tempWinRateFilter[0] === winRateFilter[0] && tempWinRateFilter[1] === winRateFilter[1])}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium shadow-lg transition-all duration-200"
                  >
                    Apply Filter ({tempWinRateFilter[0]}% - {tempWinRateFilter[1]}%)
                  </Button>
                  
                  {(winRateFilter[0] !== 0 || winRateFilter[1] !== 100) && (
                    <div className="text-xs text-center bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                      Active Filter: {winRateFilter[0]}% - {winRateFilter[1]}%
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show Button for Controls */}
          <div className="flex gap-2 flex-wrap justify-end pointer-events-auto">
            {!showPerformanceControls && onShowPerformanceControls && (
              <Button
                onClick={() => onShowPerformanceControls(true)}
                className="bg-slate-800/95 border border-slate-700 text-slate-200 hover:bg-slate-700/95 pointer-events-auto relative z-10 group transition-all duration-100"
                size="sm"
                style={{ pointerEvents: 'auto' }}
                title="Show Controls"
                disabled={isCanvasInteractionBlocked()}
              >
                <Settings className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
                <span className="hidden group-hover:inline transition-opacity duration-100">Controls ({maxDepth} moves, {minGameCount}+ games)</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Zoom indicator with keyboard shortcut */}
      {shouldShowControls && transform && (
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-slate-800/90 border border-slate-700 text-slate-200 px-3 py-2 rounded text-xs backdrop-blur-sm shadow-lg group transition-all duration-100">
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 mr-0 group-hover:mr-2 transition-all duration-100" />
              <span>{Math.round(transform.scale * 100)}%</span>
              <span className="text-slate-500 hidden group-hover:inline transition-opacity duration-100">
                <kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-slate-300 font-mono text-xs">R</kbd>
                <span className="mx-1">or</span>
                <span className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-slate-300 text-xs">MMB</span>
                <span className="mx-1">–</span>
                Fit
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Context menu indicator - only show when context menu actions are available and not in performance mode */}
      {shouldShowControls && contextMenuActions && contextMenuActions.length > 0 && mode !== 'performance' && (
        <div className="absolute bottom-4 right-4 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/50 text-amber-200 px-3 py-2 rounded text-xs pointer-events-none backdrop-blur-sm shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-amber-300">
              <span className="px-1 py-0.5 bg-amber-700/50 border border-amber-500/50 rounded text-amber-100 text-xs">Right&nbsp;Click</span>
              <span className="mx-1">–</span>
              Delete Move
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default CanvasControls; 