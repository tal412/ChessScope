import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Settings, 
  RotateCcw,
  Layers,
  Target,
  Search
} from 'lucide-react';

/**
 * Canvas Controls Component
 * Provides zoom controls, cluster toggles, and performance filters
 */
export function CanvasControls({
  // Canvas state
  mode = 'performance',
  isInitializing = false,
  positionedNodes = [],
  hasValidTransform = false,
  transform = null,
  
  // Interaction blocking
  isCanvasInteractionBlocked = () => false,
  isGenerating = false,
  
  // Cluster controls
  enableOpeningClusters = true,
  showOpeningClusters = false,
  onToggleOpeningClusters = null,
  
  // Position cluster controls
  showPositionClusters = false,
  onTogglePositionClusters = null,
  
  // Auto zoom controls
  autoZoomOnClick = false,
  onToggleAutoZoomOnClick = null,
  
  // Zoom functions
  onZoomToAll = null,
  
  // Performance controls
  showPerformanceControls = false,
  onShowPerformanceControls = null,
  maxDepth = 20,
  minGameCount = 1,
  tempMinGameCount = 1,
  winRateFilter = [0, 100],
  tempWinRateFilter = [0, 100],
  selectedPlayer = 'white',
  onPlayerChange = null,
  onMaxDepthChange = null,
  onMinGameCountChange = null,
  onTempMinGameCountChange = null,
  onWinRateFilterChange = null,
  onTempWinRateFilterChange = null,
  onApplyWinRateFilter = null,
  onMinGameCountSliderRelease = null,
  isClusteringLoading = false,
  
  // Context menu
  contextMenuActions = null,
}) {
  const isInteractionBlocked = isCanvasInteractionBlocked();

  return (
    <>
      {/* Main Controls - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        {/* Combined Controls - Zoom, Clusters, Auto-zoom */}
        {enableOpeningClusters && onToggleOpeningClusters && (
          <div className="flex gap-1 bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-slate-700/50">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={onZoomToAll}
              disabled={isInteractionBlocked}
              title="Fit to view"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 w-8 p-0 ${showOpeningClusters ? 'text-green-400 hover:text-green-300' : 'text-slate-400 hover:text-slate-300'} hover:bg-slate-700`}
              onClick={onToggleOpeningClusters}
              disabled={isInteractionBlocked}
              title={showOpeningClusters ? "Hide opening clusters" : "Show opening clusters"}
            >
              <Layers className="h-4 w-4" />
            </Button>
            
            {/* Position Clusters Toggle - Hidden in study mode */}
            {onTogglePositionClusters && mode !== 'study' && (
              <Button
                size="sm"
                variant="ghost"
                className={`h-8 w-8 p-0 ${showPositionClusters ? 'text-orange-400 hover:text-orange-300' : 'text-slate-400 hover:text-slate-300'} hover:bg-slate-700`}
                onClick={onTogglePositionClusters}
                disabled={isInteractionBlocked}
                title={showPositionClusters ? "Hide position clusters" : "Show position clusters"}
              >
                <Target className="h-4 w-4" />
              </Button>
            )}
            
            {/* Auto Zoom Toggle */}
            {onToggleAutoZoomOnClick && (
              <Button
                size="sm"
                variant="ghost"
                className={`h-8 w-8 p-0 ${autoZoomOnClick ? 'text-blue-400 hover:text-blue-300' : 'text-slate-400 hover:text-slate-300'} hover:bg-slate-700`}
                onClick={onToggleAutoZoomOnClick}
                disabled={isInteractionBlocked}
                title={autoZoomOnClick ? "Disable auto-zoom on click" : "Enable auto-zoom on click"}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Performance Controls Toggle */}
        {mode === 'performance' && onShowPerformanceControls && (
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-slate-700/50">
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 w-8 p-0 ${showPerformanceControls ? 'text-blue-400 hover:text-blue-300' : 'text-slate-400 hover:text-slate-300'} hover:bg-slate-700`}
              onClick={() => onShowPerformanceControls(!showPerformanceControls)}
              disabled={isInteractionBlocked}
              title={showPerformanceControls ? "Hide performance controls" : "Show performance controls"}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Performance Controls Panel */}
      {mode === 'performance' && showPerformanceControls && (
        <div className="absolute top-4 right-4 w-80 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700/50 shadow-xl z-30">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Performance Filters</h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                onClick={() => onShowPerformanceControls(false)}
              >
                ×
              </Button>
            </div>
            
            {/* Max Depth Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Max Depth</label>
                <Badge variant="secondary" className="text-xs">
                  {maxDepth}
                </Badge>
              </div>
              <select
                value={maxDepth}
                onChange={(e) => onMaxDepthChange?.(parseInt(e.target.value))}
                className={`w-full px-2 py-1 rounded ${(isGenerating || isInteractionBlocked) ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-200'}`}
                disabled={isGenerating || isInteractionBlocked || !onMaxDepthChange}
              >
                {[5, 10, 15, 20, 25, 30].map(depth => (
                  <option key={depth} value={depth}>{depth}</option>
                ))}
              </select>
            </div>

            {/* Min Game Count Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Min Games</label>
                <Badge variant="secondary" className="text-xs">
                  {tempMinGameCount}
                </Badge>
              </div>
              <Slider
                value={[tempMinGameCount]}
                onValueChange={(value) => onTempMinGameCountChange?.(value[0])}
                onValueCommit={() => onMinGameCountSliderRelease?.()}
                min={1}
                max={100}
                step={1}
                className="w-full"
                disabled={isGenerating || isInteractionBlocked || !onTempMinGameCountChange}
              />
            </div>

            {/* Win Rate Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Win Rate %</label>
                <Badge variant="secondary" className="text-xs">
                  {tempWinRateFilter[0]}%-{tempWinRateFilter[1]}%
                </Badge>
              </div>
              <Slider
                value={tempWinRateFilter}
                onValueChange={(value) => onTempWinRateFilterChange?.(value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
                disabled={isGenerating || isInteractionBlocked || !onTempWinRateFilterChange}
              />
              <Button
                size="sm"
                className="w-full"
                onClick={onApplyWinRateFilter}
                disabled={isGenerating || isInteractionBlocked || !onApplyWinRateFilter || (tempWinRateFilter[0] === winRateFilter[0] && tempWinRateFilter[1] === winRateFilter[1])}
              >
                Apply Filter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu Actions (if provided) */}
      {contextMenuActions && (
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-slate-700/50">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200"
              disabled={isInteractionBlocked}
              title="Right-click nodes for more options"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
} 