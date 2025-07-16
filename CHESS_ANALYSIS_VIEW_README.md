# ChessAnalysisView - Shared Chess Analysis Component

## Overview

The `ChessAnalysisView` component is a shared, reusable component that provides comprehensive chess analysis functionality. It was created to eliminate code duplication between `PerformanceGraph` and `OpeningEditor` components, which previously had ~80% similar code.

## Architecture

### Core Components

1. **ChessAnalysisView** (`src/components/chess/ChessAnalysisView.jsx`)
   - Main shared component that orchestrates all chess analysis functionality
   - Provides a unified interface for chess analysis across different modes
   - Handles layout management, state synchronization, and component integration

2. **ChessAnalysisViewConfig** (`src/components/chess/ChessAnalysisViewConfig.jsx`)
   - Configuration helper that provides pre-configured setups for different modes
   - Contains `createPerformanceGraphConfig()` and `createOpeningEditorConfig()` functions
   - Defines component layouts and UI configurations

3. **MoveDetailsSection** (`src/components/chess/MoveDetailsSection.jsx`)
   - Wrapper component for the move details panel
   - Integrates `MoveDetailsPanel` with the flexible layout system

## Usage Patterns

### Performance Graph Integration

```jsx
import ChessAnalysisView from '../components/chess/ChessAnalysisView';
import { createPerformanceGraphConfig } from '../components/chess/ChessAnalysisViewConfig.jsx';

function PerformanceGraph() {
  const [selectedPlayer, setSelectedPlayer] = useState('white');
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  
  const analysisConfig = useMemo(() => {
    return createPerformanceGraphConfig({
      selectedPlayer,
      onSelectedPlayerChange: setSelectedPlayer,
      graphData,
      // ... other props
    });
  }, [selectedPlayer, graphData]);
  
  return (
    <ChessAnalysisView
      {...analysisConfig}
      showMoves={showMoves}
      showBoard={showBoard}
      showGraph={showGraph}
      onShowMovesChange={setShowMoves}
      // ... other props
    />
  );
}
```

### Opening Editor Integration

```jsx
import ChessAnalysisView from '../components/chess/ChessAnalysisView';
import MoveDetailsSection from '../components/chess/MoveDetailsSection';
import { createOpeningEditorConfig } from '../components/chess/ChessAnalysisViewConfig.jsx';

function OpeningEditor() {
  const [moveTree, setMoveTree] = useState(/* ... */);
  const [currentNode, setCurrentNode] = useState(/* ... */);
  
  const moveDetailsSection = (
    <MoveDetailsSection
      selectedNode={currentNode}
      moveTree={moveTree}
      readOnly={isViewMode}
      // ... other props
    />
  );
  
  const analysisConfig = useMemo(() => {
    return createOpeningEditorConfig({
      mode: isViewMode ? 'view' : 'edit',
      moveTree,
      currentNode,
      detailsPanel: moveDetailsSection,
      // ... other props
    });
  }, [isViewMode, moveTree, currentNode]);
  
  return (
    <ChessAnalysisView
      {...analysisConfig}
      showDetails={showDetails}
      onShowDetailsChange={setShowDetails}
      // ... other props
    />
  );
}
```

## Component Modes

### Performance Mode (`mode: 'performance'`)
- Displays performance analysis of played games
- Shows win rates, game counts, and statistical data
- Uses opening graph data for move statistics
- Includes clustering and filtering capabilities

### Opening Editor Mode (`mode: 'opening-editor'`)
- Allows creation and editing of opening repertoires
- Supports move tree manipulation, annotations, and arrows
- Includes details panel for move-specific information
- Provides canvas mode switching between opening and performance views

### Opening Viewer Mode (`mode: 'opening-viewer'`)
- Read-only view of opening repertoires
- Same functionality as editor mode but without editing capabilities
- Includes navigation to edit mode

## Key Features

### Unified State Management
- Shared canvas state via `useCanvasState` hook
- Synchronized chessboard state via `useChessboardSync` hook
- Consistent performance state across all modes

### Flexible Layout System
- Uses `FlexibleLayout` component for responsive design
- Configurable component visibility (moves, board, graph, details)
- Adaptive layout based on active components

### Component Integration
- **Moves**: `ChunkVisualization` component for move lists and statistics
- **Board**: `InteractiveChessboard` component for position display and interaction
- **Graph**: `CanvasPerformanceGraph` component for visual analysis
- **Details**: `MoveDetailsPanel` component for opening editor functionality

### Cross-Mode Functionality
- Auto-zoom and view management
- Move navigation and synchronization
- Hover effects and visual feedback
- Context menus and interaction handling

## Configuration Options

### Core Configuration
```jsx
{
  mode: 'performance' | 'opening-editor' | 'opening-viewer',
  title: string | ReactElement,
  icon: ReactComponent,
  
  // Data props
  graphData: { nodes: [], edges: [], maxGameCount: 0 },
  openingGraph: OpeningGraph | null,
  moveTree: MoveNode | null,
  
  // State management
  selectedPlayer: 'white' | 'black',
  onSelectedPlayerChange: (player) => void,
  
  // Component visibility
  showMoves: boolean,
  showBoard: boolean,
  showGraph: boolean,
  showDetails: boolean, // Only for opening editor
}
```

### Performance Graph Specific
```jsx
{
  autoZoomOnClick: boolean,
  onAutoZoomOnClickChange: (enabled) => void,
  loading: boolean,
  isGenerating: boolean,
}
```

### Opening Editor Specific
```jsx
{
  allowEditing: boolean,
  readOnly: boolean,
  customArrows: Array<{from, to, color}>,
  onArrowDraw: (from, to, color) => void,
  drawingMode: boolean,
  onDrawingModeChange: (enabled) => void,
  contextMenuActions: Array<ActionConfig>,
  detailsPanel: ReactElement,
}
```

## Benefits of the Refactor

### Code Reduction
- Eliminated ~80% code duplication between PerformanceGraph and OpeningEditor
- Reduced maintenance burden and potential for bugs
- Centralized chess analysis logic

### Improved Consistency
- Unified behavior across different analysis modes
- Consistent layout and interaction patterns
- Shared state management and synchronization

### Enhanced Maintainability
- Single source of truth for chess analysis functionality
- Easier to add new features or fix bugs
- Better separation of concerns

### Flexible Configuration
- Easy to configure for different use cases
- Extensible for future chess analysis modes
- Reusable across the application

## Migration Notes

### From Old PerformanceGraph
- Removed duplicate FlexibleLayout usage
- Removed redundant state management
- Simplified to configuration-based approach

### From Old OpeningEditor
- Extracted move details panel to separate component
- Removed duplicate canvas and chessboard logic
- Maintained all editing functionality through configuration

## Testing

Both components should be tested to ensure:
- All original functionality is preserved
- State synchronization works correctly
- Layout and component visibility work as expected
- Mode switching functions properly
- Performance characteristics are maintained

## Future Enhancements

The shared architecture makes it easier to:
- Add new chess analysis modes
- Implement cross-mode features
- Enhance state management
- Improve performance optimizations
- Add new visualization capabilities 