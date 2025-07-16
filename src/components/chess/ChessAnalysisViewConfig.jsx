/**
 * Configuration helper for ChessAnalysisView
 * Provides pre-configured setups for different chess analysis modes
 */

import { Target, Edit, Eye, Crown, Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Component configurations for different modes
export const ComponentConfigs = {
  performanceGraph: {
    moves: {
      desktopWidth: '1.25fr',
      twoActive: {
        'moves+board': '1.25fr',
        'moves+graph': '1.25fr'
      },
      oneActive: '1fr'
    },
    board: {
      desktopWidth: '1.5fr',
      twoActive: {
        'board+moves': '1.5fr',
        'board+graph': '1.5fr'
      },
      oneActive: '1fr'
    },
    graph: {
      desktopWidth: '2.25fr',
      twoActive: {
        'graph+moves': '2.25fr',
        'graph+board': '2.25fr'
      },
      oneActive: '1fr'
    }
  },
  
  openingEditor: {
    moves: {
      desktopWidth: '1.25fr',
      twoActive: {
        'moves+board': '1.25fr',
        'moves+details': '1.25fr'
      },
      oneActive: '1fr'
    },
    board: {
      desktopWidth: '1.5fr',
      twoActive: {
        'board+moves': '1.5fr',
        'board+details': '1.5fr'
      },
      oneActive: '1fr'
    },
    graph: {
      desktopWidth: '2.25fr',
      oneActive: '1fr'
    },
    details: {
      desktopWidth: '1fr',
      twoActive: {
        'details+moves': '1fr',
        'board+details': '1fr'
      },
      oneActive: '1fr'
    }
  }
};

// Performance Graph specific configuration
export const createPerformanceGraphConfig = ({
  selectedPlayer = 'white',
  onSelectedPlayerChange = null,
  graphData = { nodes: [], edges: [], maxGameCount: 0 },
  openingGraph = null,
  loading = false,
  isGenerating = false,
  autoZoomOnClick = false,
  onAutoZoomOnClickChange = null,
  onRefresh = null
}) => ({
  mode: 'performance',
  title: 'Performance Graph',
  icon: Target,
  
  // Data
  graphData,
  openingGraph,
  
  // State
  selectedPlayer,
  onSelectedPlayerChange,
  
  // Component visibility defaults
  showMoves: true,
  showBoard: true,
  showGraph: true,
  
  // Canvas configuration
  canvasMode: 'performance',
  
  // Loading states
  loading,
  isGenerating,
  
  // Auto zoom
  autoZoomOnClick,
  onAutoZoomOnClickChange,
  
  // Component config
  componentConfig: ComponentConfigs.performanceGraph,
  
  // Right controls
  rightControls: (
    <div className="flex items-center gap-2 text-slate-300 mr-3">
      {selectedPlayer === 'white' ? (
        <>
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm">White</span>
        </>
      ) : (
        <>
          <Shield className="w-4 h-4 text-slate-400" />
          <span className="text-sm">Black</span>
        </>
      )}
    </div>
  )
});

// Opening Editor specific configuration
export const createOpeningEditorConfig = ({
  mode = 'edit', // 'edit' | 'view'
  name = '',
  lastSaved = null,
  onSave = null,
  onEdit = null,
  onView = null,
  onNavigateBack = null,
  openingId = null,
  selectedPlayer = 'white',
  onSelectedPlayerChange = null,
  graphData = { nodes: [], edges: [], maxGameCount: 0 },
  performanceGraphData = { nodes: [], edges: [], maxGameCount: 0 },
  openingGraph = null,
  moveTree = null,
  currentNode = null,
  canvasMode = 'opening',
  onCanvasModeChange = null,
  loading = false,
  saving = false,
  autoZoomOnClick = false,
  onAutoZoomOnClickChange = null,
  contextMenuActions = null,
  customArrows = [],
  onArrowDraw = null,
  drawingMode = false,
  onDrawingModeChange = null,
  detailsPanel = null
}) => {
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  
  // Helper to format last saved time
  const getAutoSaveStatus = () => {
    if (!lastSaved || isViewMode) return null;
    
    const now = Date.now();
    const secondsAgo = Math.floor((now - lastSaved) / 1000);
    
    if (secondsAgo < 5) {
      return 'Saved just now';
    } else if (secondsAgo < 60) {
      return `Saved ${secondsAgo}s ago`;
    } else {
      const minutesAgo = Math.floor(secondsAgo / 60);
      return `Saved ${minutesAgo}m ago`;
    }
  };
  
  return {
    mode: isViewMode ? 'opening-viewer' : 'opening-editor',
    title: (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          {/* Opening name with smooth animation */}
          <div className="relative">
            <span className="text-slate-400 text-sm">
              {isEditMode && !openingId ? 'Create Opening' : 
               isViewMode ? 'View Opening' : 
               'Edit Opening'}
              {name && ':'}
            </span>
            {name && (
              <span 
                className="ml-2 text-white font-medium animate-in fade-in slide-in-from-left-2 duration-300"
                key={name} // Re-trigger animation when name changes
              >
                {name}
              </span>
            )}
          </div>
        </div>
        {getAutoSaveStatus() && (
          <span className="bg-green-500/20 text-green-400 border-green-500/30 px-2 py-1 rounded text-xs">
            {getAutoSaveStatus()}
          </span>
        )}
        {isEditMode && (
          <span className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-2 py-1 rounded text-xs font-semibold">
            <Edit className="w-3 h-3 inline mr-1" />
            EDIT MODE
          </span>
        )}
      </div>
    ),
    icon: isViewMode ? Eye : Edit,
    
    // Custom header styling based on mode (only for edit mode)
    headerClassName: isEditMode 
      ? "bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-b-2 border-amber-500/50"
      : "",
    
    // Custom content area styling based on mode (only for edit mode)
    className: isEditMode 
      ? "bg-gradient-to-br from-amber-950/10 via-slate-900 to-orange-950/10"
      : "",
    
    // Data
    graphData,
    performanceGraphData,
    openingGraph,
    moveTree,
    currentNode,
    
    // State
    selectedPlayer,
    onSelectedPlayerChange,
    
    // Component visibility defaults
    showMoves: true,
    showBoard: true,
    showGraph: true,
    showDetails: true,
    
    // Canvas configuration
    canvasMode,
    onCanvasModeChange,
    
    // Editing capabilities
    allowEditing: isEditMode,
    readOnly: isViewMode,
    
    // Custom arrows
    customArrows,
    onArrowDraw: isEditMode ? onArrowDraw : null,
    drawingMode: isEditMode ? drawingMode : false,
    onDrawingModeChange: isEditMode ? onDrawingModeChange : null,
    
    // Loading states
    loading,
    isGenerating: saving,
    
    // Auto zoom
    autoZoomOnClick,
    onAutoZoomOnClickChange,
    
    // Context menu
    contextMenuActions: isEditMode ? contextMenuActions : null,
    
    // Component config
    componentConfig: ComponentConfigs.openingEditor,
    
    // Left controls
    leftControls: onNavigateBack && (
      <Button
        variant="ghost"
        onClick={onNavigateBack}
        className="text-slate-300 hover:text-white"
      >
        <span className="mr-1">←</span>
        Back
      </Button>
    ),
    
    // Right controls
    rightControls: (
      <div className="flex items-center gap-2">
        {/* Player perspective display */}
        <div className="flex items-center gap-2 text-slate-300 mr-3">
          {selectedPlayer === 'white' ? (
            <>
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm">White</span>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Black</span>
            </>
          )}
        </div>
        
        {/* Mode-specific buttons */}
        {isViewMode ? (
          /* Edit button for view mode */
          onEdit && (
            <Button
              onClick={onEdit}
              size="sm"
              variant="outline"
              className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white"
            >
              <Edit className="w-4 h-4 mr-0.5" />
              Edit Opening
            </Button>
          )
        ) : (
          /* Done Editing button for edit mode */
          onView && (
            <Button
              onClick={onView}
              size="sm"
              variant="outline"
              className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white"
            >
              <Check className="w-4 h-4 mr-0.5" />
              Done Editing
            </Button>
          )
        )}
        
        {/* Save button (if provided) */}
        {!isViewMode && onSave && (
          <Button
            onClick={onSave}
            disabled={saving}
            size="sm"
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 animate-spin mr-2">⟳</span>
                Auto-saving...
              </>
            ) : (
              <>
                <span className="w-4 h-4 mr-2">💾</span>
                Save Now
              </>
            )}
          </Button>
        )}
      </div>
    ),
    
    // Additional sections
    additionalSections: detailsPanel ? {
      details: detailsPanel
    } : {}
  };
};

// Helper to create node handlers for different modes
export const createNodeHandlers = ({
  mode = 'performance',
  moveTree = null,
  onNodeSelect = null,
  onCurrentNodeChange = null,
  performanceState = null,
  chessboardSync = null,
  findNodeById = null,
  buildMoveSequenceFromNode = null
}) => {
  if (mode === 'performance') {
    return {
      onNodeClick: (e, node) => {
        if (performanceState.currentNodeId === node.id) {
          performanceState.updateCurrentPosition(null, null, 'click');
          chessboardSync.syncMovesToChessboard([]);
          return;
        }
        
        const moveSequence = node.data.moveSequence || [];
        chessboardSync.syncMovesToChessboard(moveSequence);
        performanceState.updateCurrentPosition(node.id, node.data.fen, 'click');
      },
      
      onNodeHover: (e, node) => {
        // Performance graph hover logic
        if (!performanceState.currentNodeId) return;
        
        const currentNode = performanceState.currentNodeId;
        const currentMoves = node.data.moveSequence || [];
        const hoveredMoves = node.data.moveSequence || [];
        
        if (hoveredMoves.length === currentMoves.length + 1 && 
            currentMoves.every((move, index) => move === hoveredMoves[index])) {
          
          const nextMove = hoveredMoves[hoveredMoves.length - 1];
          const moveData = {
            san: nextMove,
            gameCount: node.data.gameCount || 0,
            details: { winRate: node.data.winRate || 0 },
            winRate: node.data.winRate || 0
          };
          
          // Set hovered move for chessboard arrow
          if (onNodeSelect) onNodeSelect(moveData);
        }
      },
      
      onNodeHoverEnd: () => {
        if (onNodeSelect) onNodeSelect(null);
      }
    };
  }
  
  // Opening editor handlers
  return {
    onNodeClick: (e, node) => {
      if (node.type === 'clusterBackground') return;
      
      if (performanceState.currentNodeId === node.id) {
        if (!node.data.isRoot) {
          performanceState.updateCurrentPosition(null, null, 'click');
          chessboardSync.syncMovesToChessboard([]);
          return;
        }
      }
      
      if (findNodeById && buildMoveSequenceFromNode) {
        const treeNode = findNodeById(moveTree, node.id);
        if (treeNode) {
          const moveSequence = buildMoveSequenceFromNode(treeNode);
          chessboardSync.syncMovesToChessboard(moveSequence);
          if (onCurrentNodeChange) onCurrentNodeChange(treeNode);
        }
      }
    },
    
    onNodeHover: (e, node) => {
      // Opening editor hover logic
      if (!performanceState.currentNodeId) return;
      
      const currentMoves = node.data.moveSequence || [];
      const hoveredMoves = node.data.moveSequence || [];
      
      if (hoveredMoves.length === currentMoves.length + 1 && 
          currentMoves.every((move, index) => move === hoveredMoves[index])) {
        
        const nextMove = hoveredMoves[hoveredMoves.length - 1];
        const shouldUsePinkArrow = mode === 'opening-editor' || 
                                   node.data.isMissing || 
                                   node.data.winRate === null;
        
        const moveData = {
          san: nextMove,
          gameCount: node.data.gameCount || 0,
          details: { winRate: node.data.winRate || null },
          winRate: node.data.winRate || null,
          arrowColor: shouldUsePinkArrow ? '#ec4899' : undefined,
          fixedThickness: shouldUsePinkArrow ? 14 : undefined
        };
        
        performanceState.setHoveredNextMoveNodeId(node.id);
        if (onNodeSelect) onNodeSelect(moveData);
      }
    },
    
    onNodeHoverEnd: () => {
      if (onNodeSelect) onNodeSelect(null);
      performanceState.setHoveredNextMoveNodeId(null);
    }
  };
}; 