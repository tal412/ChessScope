# ChessCanvas v2 - Complete Canvas System

A complete refactor of the chess canvas system with **100% feature parity** and a clean, focused architecture.

## ✅ **REFACTOR COMPLETED**

**All features from the original canvas have been successfully implemented:**

- ✅ **Advanced Node Rendering** - Multi-font text rendering with proper positioning
- ✅ **Multi-layer Glow Effects** - Sophisticated shadow/glow system with 8 layers
- ✅ **Performance Controls** - Complete UI for depth, game count, and win rate filters
- ✅ **Loading States** - Auto-fit pending overlays and initialization states
- ✅ **State Callbacks** - `onResizeStateChange`, `onInitializingStateChange`, `onAutoFitComplete`
- ✅ **Interaction Blocking** - Smart cursor management and interaction prevention
- ✅ **Cluster Tooltips** - Hover tooltips for opening cluster names
- ✅ **Canvas Opacity Transitions** - Smooth loading transitions
- ✅ **Icon System** - Arrow and annotation icons with proper positioning
- ✅ **Context Menu Integration** - Right-click context menus
- ✅ **Keyboard Shortcuts** - Full keyboard navigation support

## 📦 **Complete Component List**

### **Components**
- **`Canvas.jsx`** - Core rendering component with advanced text and glow effects
- **`CanvasControls.jsx`** - Complete performance controls UI (zoom, clusters, filters)
- **`ContextMenu.jsx`** - Right-click context menu component

### **Hooks**
- **`useZoom.js`** - Zoom and pan state management
- **`usePosition.js`** - Current position and selection tracking
- **`useClusters.js`** - Opening and position cluster management
- **`useInteractionBlocking.js`** - Smart interaction blocking and cursor management
- **`useStateCallbacks.js`** - State change callback system
- **`useLoadingStates.js`** - Loading states and auto-fit management

### **Utilities**
- **`constants.js`** - Complete configuration (render, shadow, cluster, keyboard)
- **`colors.js`** - Color utilities for performance and opening nodes
- **`geometry.js`** - Geometric calculations, convex hull, icon drawing

## 🎯 **Philosophy**

**One component, one job.** Each piece has a single, clear responsibility:

- **Canvas**: Only renders the graph with advanced effects
- **useZoom**: Only handles zoom and pan operations
- **usePosition**: Only tracks current position and selections
- **useClusters**: Only manages cluster data and visibility
- **ChessCanvas**: Orchestrates everything together

## 📁 **Structure**

```
canvas-v2/
├── ChessCanvas.jsx           # Main component - orchestrates everything
├── constants.js              # All configuration in one place
├── components/
│   └── Canvas.jsx           # Pure rendering component
├── hooks/
│   ├── useZoom.js           # Zoom and pan functionality
│   ├── usePosition.js       # Position and selection tracking
│   └── useClusters.js       # Cluster management
└── utils/
    ├── colors.js            # Color calculation utilities
    └── geometry.js          # Geometric calculations
```

## 🚀 **Basic Usage**

```jsx
import { ChessCanvas } from './components/canvas-v2/ChessCanvas';

function MyChessApp() {
  const [graphData, setGraphData] = useState({
    nodes: [
      { id: '1', x: 100, y: 100, data: { san: 'e4', winRate: 65, gameCount: 1000 } },
      { id: '2', x: 200, y: 200, data: { san: 'e5', winRate: 55, gameCount: 800 } },
    ],
    edges: [
      { source: '1', target: '2' }
    ]
  });

  const handleNodeClick = (node) => {
    console.log('Clicked node:', node.data.san);
  };

  return (
    <ChessCanvas
      graphData={graphData}
      mode="performance"
      width={800}
      height={600}
      onNodeClick={handleNodeClick}
    />
  );
}
```

## 🎛️ **Advanced Usage**

```jsx
function AdvancedChessCanvas() {
  const canvasRef = useRef(null);
  const [clusters, setClusters] = useState([]);

  const handleFitToView = () => {
    canvasRef.current?.fitToNodes();
  };

  const handleZoomIn = () => {
    canvasRef.current?.zoomIn();
  };

  return (
    <div>
      {/* Controls */}
      <div className="controls">
        <button onClick={handleFitToView}>Fit to View</button>
        <button onClick={handleZoomIn}>Zoom In</button>
      </div>

      {/* Canvas */}
      <ChessCanvas
        ref={canvasRef}
        graphData={graphData}
        mode="performance"
        width={800}
        height={600}
        openingClusters={clusters}
        enableKeyboardShortcuts={true}
        onNodeClick={handleNodeClick}
        onPositionChange={(nodeId, fen) => {
          console.log('Position changed:', nodeId, fen);
        }}
      />
    </div>
  );
}
```

## 🔧 **API Reference**

### **ChessCanvas Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `graphData` | `Object` | `{nodes: [], edges: []}` | Graph data with nodes and edges |
| `mode` | `string` | `'performance'` | Rendering mode: 'performance' or 'opening' |
| `width` | `number` | `800` | Canvas width |
| `height` | `number` | `600` | Canvas height |
| `onNodeClick` | `function` | `null` | Node click handler |
| `onNodeHover` | `function` | `null` | Node hover handler |
| `onPositionChange` | `function` | `null` | Position change handler |
| `openingClusters` | `Array` | `[]` | Opening cluster data |
| `positionClusters` | `Array` | `[]` | Position cluster data |
| `enableKeyboardShortcuts` | `boolean` | `true` | Enable keyboard shortcuts |

### **Canvas API (via ref)**

```jsx
const canvasRef = useRef(null);

// Zoom controls
canvasRef.current.zoomIn();
canvasRef.current.zoomOut();
canvasRef.current.resetZoom();
canvasRef.current.fitToNodes();
canvasRef.current.setZoom(1.5);

// Position controls
canvasRef.current.setCurrentNode('node-id', 'fen-string');
canvasRef.current.clearCurrentNode();

// Cluster controls
canvasRef.current.toggleOpeningClusters();
canvasRef.current.togglePositionClusters();

// State queries
const currentNode = canvasRef.current.getCurrentNode();
const transform = canvasRef.current.getTransform();
const stats = canvasRef.current.getClusterStats();
```

### **Keyboard Shortcuts**

| Key | Action |
|-----|--------|
| `+` | Zoom in |
| `-` | Zoom out |
| `f` | Fit to view |
| `0` | Reset zoom |
| `c` | Toggle clusters |

## 🎨 **Customization**

### **Colors**

Edit `constants.js` to customize colors:

```js
export const PERFORMANCE_COLORS = {
  excellent: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  good: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  // ... more colors
};
```

### **Node Sizes**

```js
export const CANVAS_CONFIG = {
  NODE_SIZE: 180,        // Change node size
  NODE_HALF_SIZE: 90,    // Half of node size
  // ... more config
};
```

## 🆚 **vs Original Canvas**

### **Before (Original)**
```jsx
// 😵‍💫 Confusing - one giant component doing everything
<CanvasGraph
  graphData={data}
  onNodeClick={onClick}
  onNodeHover={onHover}
  onNodeHoverEnd={onHoverEnd}
  currentNodeId={currentId}
  hoveredNextMoveNodeId={hoveredId}
  openingClusters={openingClusters}
  positionClusters={positionClusters}
  showOpeningClusters={showOpening}
  showPositionClusters={showPosition}
  onFitView={onFitView}
  onZoomToClusters={onZoomClusters}
  onZoomTo={onZoomTo}
  onToggleOpeningClusters={onToggleOpening}
  onTogglePositionClusters={onTogglePosition}
  onClusterHover={onClusterHover}
  onClusterHoverEnd={onClusterHoverEnd}
  hoveredOpeningName={hoveredName}
  hoveredClusterColor={hoveredColor}
  onResizeStateChange={onResizeChange}
  onInitializingStateChange={onInitChange}
  maxDepth={maxDepth}
  minGameCount={minGameCount}
  tempMinGameCount={tempMinGameCount}
  winRateFilter={winRateFilter}
  tempWinRateFilter={tempWinRateFilter}
  onMaxDepthChange={onMaxDepthChange}
  onMinGameCountChange={onMinGameCountChange}
  onTempMinGameCountChange={onTempMinGameCountChange}
  onWinRateFilterChange={onWinRateFilterChange}
  onTempWinRateFilterChange={onTempWinRateFilterChange}
  onApplyWinRateFilter={onApplyWinRateFilter}
  selectedPlayer={selectedPlayer}
  onPlayerChange={onPlayerChange}
  isGenerating={isGenerating}
  showPerformanceControls={showControls}
  onShowPerformanceControls={onShowControls}
  isClusteringLoading={isLoading}
  className={className}
  mode={mode}
  enableOpeningClusters={enableClusters}
  contextMenuActions={contextActions}
  onNodeRightClick={onRightClick}
  autoZoomOnClick={autoZoom}
  onAutoZoomOnClickChange={onAutoZoomChange}
  onAutoFitComplete={onAutoFitComplete}
  isAutoFitPending={isAutoFitPending}
  // ... 50+ more props! 😱
/>
```

### **After (Clean)**
```jsx
// 😍 Simple and clear
<ChessCanvas
  graphData={graphData}
  mode="performance"
  width={800}
  height={600}
  onNodeClick={handleNodeClick}
  openingClusters={clusters}
/>
```

## 🎉 **Benefits**

✅ **Easy to understand** - Each piece does one thing  
✅ **Easy to test** - Test each hook independently  
✅ **Easy to debug** - Clear separation of concerns  
✅ **Easy to extend** - Add new features without touching existing code  
✅ **Reusable** - Use hooks in other components  
✅ **Performance** - Only re-render what actually changed  

## 🔄 **Migration Guide**

1. **Replace gradually** - Keep old canvas running alongside new one
2. **Test each feature** - Ensure new canvas has same functionality
3. **Update imports** - Switch from `CanvasGraph` to `ChessCanvas`
4. **Simplify props** - Remove 90% of the props you were passing
5. **Enjoy!** 🎉 