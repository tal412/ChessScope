// Performance color constants
export const PERFORMANCE_COLORS = {
  excellent: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  good: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  solid: { bg: '#f59e0b', border: '#d97706', text: '#000000' },
  challenging: { bg: '#f97316', border: '#ea580c', text: '#ffffff' },
  difficult: { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' },
  missing: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' }, // Gray for missing moves
};

// Opening tree node colors
export const OPENING_NODE_COLORS = {
  // New color scheme based on move color
  whiteMove: { bg: '#ffffff', border: '#d1d5db', text: '#000000' }, // White background for white moves
  blackMove: { bg: '#1f2937', border: '#374151', text: '#ffffff' }, // Black background for black moves
  selected: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' }, // Blue for selected
  withComment: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' }, // Cyan for annotated
  withLinks: { bg: '#10b981', border: '#059669', text: '#ffffff' }, // Green for links
  missing: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' }, // Gray for missing moves
  startNode: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' }, // Gray for start node
};

// Opening cluster colors - EXACT match with ReactFlow
export const OPENING_CLUSTER_COLORS = [{ bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }];

// Position cluster colors
export const POSITION_CLUSTER_COLORS = [
  { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Bright Orange
  { bg: '#f59e0b', border: '#d97706', text: '#000000' }, // Amber  
  { bg: '#eab308', border: '#ca8a04', text: '#000000' }, // Yellow
];

// Canvas configuration
export const CANVAS_CONFIG = {
  NODE_SIZE: 180,
  NODE_HALF_SIZE: 90,
  DEFAULT_PADDING: 50,
  CLUSTER_PADDING: 100,
  POSITION_CLUSTER_PADDING: 80,
  SINGLE_NODE_CLUSTER_PADDING_MULTIPLIER: 1.5,
  ANIMATION_DURATION: 300,
  ZOOM_LIMITS: {
    MIN: 0.01,
    MAX: 5.0,
    SCALE_FACTOR: 0.9,
    SCALE_FACTOR_IN: 1.1,
  },
  DRAG_THRESHOLD: 3,
  INITIALIZATION_TIMEOUT: 5000,
  FALLBACK_DIMENSIONS: { width: 800, height: 600 },
  RESIZE_DEBOUNCE: 300,
  PERIODIC_CHECK_INTERVAL: 2000,
  CONTEXT_MENU_MIN_WIDTH: 160,
  CONTEXT_MENU_OFFSET: 200,
  CONTEXT_MENU_ITEM_HEIGHT: 40,
  CONTEXT_MENU_PADDING: 20,
};

// Render configuration
export const RENDER_CONFIG = {
  BACKGROUND_COLOR: '#0f172a', // slate-900
  HIGH_DPI_QUALITY: 'high',
  FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  GLOW_BLUR: 20,
  GLOW_LAYERS: 8,
  EDGE_THICKNESS: {
    MIN: 4,
    MAX: 12,
    BASE: 4,
    GAME_COUNT_DIVISOR: 25,
  },
  TEXT_STROKE_WIDTH: {
    BLACK_TEXT: 2,
    WHITE_TEXT: 3,
  },
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
  ICON_SIZES: {
    ANNOTATION: 20,
    ARROW: 16,
  },
  OFFSETS: {
    ARROW_Y: -65,
    ANNOTATION_Y: 65,
    ROOT_GAME_COUNT_Y: 25,
    MOVE_LABEL_Y: -35,
    WIN_RATE_Y: 0,
    GAME_COUNT_Y: 35,
    PERFORMANCE_ROOT_LABEL_Y: -30,
    PERFORMANCE_ROOT_GAME_COUNT_Y: 25,
    PERFORMANCE_MOVE_LABEL_Y: -35,
    PERFORMANCE_WIN_RATE_Y: 0,
    PERFORMANCE_GAME_COUNT_Y: 35,
    PERFORMANCE_NO_DATA_Y: 10,
  },
  SPACING: {
    ARROW_CIRCLE: 22,
    ANNOTATION_ICON: 32,
  },
};

// Cluster rendering configuration
export const CLUSTER_CONFIG = {
  HULL_PADDING: 50,
  CONSERVATIVE_PADDING_FACTOR: 0.3,
  CORNER_RADIUS: 12,
  CORNER_RADIUS_CLUSTER: 20,
  CURVE_CONTROL_FACTOR: 0.2,
  FILL_OPACITY: {
    NORMAL: 0.45,
    HOVERED: 0.7,
    POSITION: 0.4,
  },
  STROKE_WIDTH: {
    NORMAL: 3,
    HOVERED: 4,
  },
  PADDING: {
    SINGLE_NODE: 100,
    TWO_NODES: 80,
    MULTI_NODES: 60,
  },
};

// Shadow and glow effects
export const SHADOW_CONFIG = {
  SELECTED_COLOR: 'rgba(236, 72, 153, 1.0)', // Pink glow
  INITIAL_MOVE_COLOR: 'rgba(249, 115, 22, 1.0)', // Orange glow
  HOVERED_NEXT_MOVE_COLOR: 'rgba(59, 130, 246, 1.0)', // Blue glow
  BLUR: 20,
  INTENSE_BLUR: 25,
  LAYERS: 8,
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  FIT_VIEW: ['r', 'R'],
  EMERGENCY_RESET: ['Escape'],
};

// Mouse buttons
export const MOUSE_BUTTONS = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
}; 