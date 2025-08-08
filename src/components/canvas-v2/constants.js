// =============================================================================
// CANVAS CONFIGURATION
// =============================================================================

export const CANVAS_CONFIG = {
  // Node dimensions
  NODE_SIZE: 180,
  NODE_HALF_SIZE: 90,
  
  // Padding and spacing
  DEFAULT_PADDING: 50,
  CLUSTER_PADDING: 100,
  POSITION_CLUSTER_PADDING: 80,
  SINGLE_NODE_CLUSTER_PADDING_MULTIPLIER: 1.5,
  
  // Animation and timing
  ANIMATION_DURATION: 300,
  INITIALIZATION_TIMEOUT: 5000,
  
  // Interaction thresholds
  DRAG_THRESHOLD: 3,
  
  // Fallback dimensions when canvas can't be measured
  FALLBACK_DIMENSIONS: { width: 800, height: 600 },
  
  // Context menu
  CONTEXT_MENU_OFFSET: 200,
  CONTEXT_MENU_ITEM_HEIGHT: 32,
  CONTEXT_MENU_PADDING: 8,
};

export const ZOOM_CONFIG = {
  MIN: 0.01,
  MAX: 5.0,
  SCALE_FACTOR: 0.9,        // Zoom out factor
  SCALE_FACTOR_IN: 1.1,     // Zoom in factor
  AUTO_FIT_PADDING: 50,     // Padding around content when auto-fitting
};

export const RENDER_CONFIG = {
  // High DPI support
  DEVICE_PIXEL_RATIO: window.devicePixelRatio || 1,
  BACKGROUND_COLOR: '#0f172a', // slate-900
  HIGH_DPI_QUALITY: 'high',
  
  // Text rendering
  FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  FONT_SIZE: 12,
  FONT_WEIGHT: '500',
  
  // Shadow effects
  SHADOW_BLUR: 4,
  SHADOW_OFFSET_X: 0,
  SHADOW_OFFSET_Y: 2,
  SHADOW_COLOR: 'rgba(0, 0, 0, 0.1)',
  
  // Selection glow
  SELECTION_GLOW_COLOR: '#3b82f6',
  SELECTION_GLOW_WIDTH: 3,
  GLOW_BLUR: 20,
  GLOW_LAYERS: 8,
  
  // Edge rendering
  EDGE_THICKNESS: {
    MIN: 4,
    MAX: 12,
    BASE: 4,
    GAME_COUNT_DIVISOR: 25,
  },
  
  // Text stroke
  TEXT_STROKE_WIDTH: {
    BLACK_TEXT: 2,
    WHITE_TEXT: 3,
  },
  
  // Font sizes for different elements
  FONT_SIZES: {
    ROOT_LABEL: 36,
    MOVE_LABEL: 40,
    GAME_COUNT: 28,
    WIN_RATE: 26,
    GAME_COUNT_SHORT: 22,
    PERFORMANCE_ROOT_LABEL: 40,
    PERFORMANCE_MOVE_LABEL: 36,
    PERFORMANCE_WIN_RATE: 26,
    PERFORMANCE_GAME_COUNT: 22,
    PERFORMANCE_NO_DATA: 20,
  },
  
  // Icon sizes
  ICON_SIZES: {
    ANNOTATION: 20,
    ARROW: 16,
  },
  
  // Text positioning offsets
  OFFSETS: {
    ARROW_Y: -65,
    ANNOTATION_Y: 65,
    ROOT_LABEL_Y: -15,
    ROOT_GAME_COUNT_Y: 20,
    MOVE_LABEL_Y: -35,
    WIN_RATE_Y: 0,
    GAME_COUNT_Y: 35,
    PERFORMANCE_ROOT_LABEL_Y: -15,
    PERFORMANCE_ROOT_GAME_COUNT_Y: 20,
    PERFORMANCE_MOVE_LABEL_Y: -35,
    PERFORMANCE_WIN_RATE_Y: 0,
    PERFORMANCE_GAME_COUNT_Y: 35,
    PERFORMANCE_NO_DATA_Y: 10,
  },
  
  // Spacing
  SPACING: {
    ARROW_CIRCLE: 22,
    ANNOTATION_ICON: 32,
  },
};

// =============================================================================
// SHADOW CONFIGURATION (matching v1)
// =============================================================================

export const SHADOW_CONFIG = {
  SELECTED_COLOR: 'rgba(236, 72, 153, 1.0)', // Pink glow
  INITIAL_MOVE_COLOR: 'rgba(249, 115, 22, 1.0)', // Orange glow
  HOVERED_NEXT_MOVE_COLOR: 'rgba(59, 130, 246, 1.0)', // Blue glow
  BLUR: 20,
  INTENSE_BLUR: 25,
  LAYERS: 8,
};


// =============================================================================
// COLOR SCHEMES
// =============================================================================

export const PERFORMANCE_COLORS = {
  excellent: { bg: '#10b981', border: '#059669', text: '#ffffff' },    // Green
  good: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },         // Cyan
  solid: { bg: '#f59e0b', border: '#d97706', text: '#000000' },        // Amber
  challenging: { bg: '#f97316', border: '#ea580c', text: '#ffffff' },  // Orange
  difficult: { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' },    // Red
  missing: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },      // Gray
};

export const OPENING_NODE_COLORS = {
  whiteMove: { bg: '#ffffff', border: '#d1d5db', text: '#000000' },
  blackMove: { bg: '#374151', border: '#4b5563', text: '#ffffff' },
  selected: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  withComment: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  withLinks: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  missing: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },
  startNode: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },
};

// Opening cluster colors - EXACT match with ReactFlow
export const OPENING_CLUSTER_COLORS = [{ bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }];

// Position cluster colors
export const POSITION_CLUSTER_COLORS = [
  { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Bright Orange
  { bg: '#f59e0b', border: '#d97706', text: '#000000' }, // Amber  
  { bg: '#eab308', border: '#ca8a04', text: '#000000' }, // Yellow
];

export const CLUSTER_COLORS = {
  opening: [
    { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }  // Purple
  ],
  position: [
    { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Bright Orange
    { bg: '#f59e0b', border: '#d97706', text: '#000000' }, // Amber  
    { bg: '#eab308', border: '#ca8a04', text: '#000000' }, // Yellow
  ]
};

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================

export const KEYBOARD_SHORTCUTS = {
  ZOOM_IN: '+',
  ZOOM_OUT: '-',
  FIT_VIEW: 'f',
  RESET_ZOOM: 'r',
  TOGGLE_CLUSTERS: 'c',
  ESCAPE: 'Escape',
  ENTER: 'Enter',
};

// =============================================================================
// MOUSE BUTTONS
// =============================================================================

export const MOUSE_BUTTONS = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
};

// =============================================================================
// CLUSTER CONFIGURATION
// =============================================================================

export const CLUSTER_CONFIG = {
  MIN_NODES_FOR_CLUSTER: 2,
  CONVEX_HULL_PADDING: 20,
  STROKE_WIDTH: 2,
  FILL_OPACITY: 0.1,
  STROKE_OPACITY: 0.3,
  HOVER_FILL_OPACITY: 0.2,
  HOVER_STROKE_OPACITY: 0.5,
  HULL_PADDING: 50,
  CONSERVATIVE_PADDING_FACTOR: 0.3,
  CORNER_RADIUS: 12,
  CORNER_RADIUS_CLUSTER: 20,
  CURVE_CONTROL_FACTOR: 0.2,
  PADDING: {
    SINGLE_NODE: 100,
    TWO_NODES: 80,
    MULTI_NODES: 60,
  },
};

 