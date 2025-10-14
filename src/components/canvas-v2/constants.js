import { getCanvasColor } from '@/utils/themeColors';

/**
 * Canvas V2 Constants - Theme-Aware Color System
 *
 * All color values are resolved from CSS variables at runtime,
 * enabling proper dark mode support and theme consistency.
 */

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
  get BACKGROUND_COLOR() {
    return getCanvasColor('background');
  },
  HIGH_DPI_QUALITY: 'high',

  // Text rendering
  FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  FONT_SIZE: 12,
  FONT_WEIGHT: '500',

  // Shadow effects
  SHADOW_BLUR: 4,
  SHADOW_OFFSET_X: 0,
  SHADOW_OFFSET_Y: 2,
  get SHADOW_COLOR() {
    return getCanvasColor('foreground', 0.1);
  },

  // Selection glow
  get SELECTION_GLOW_COLOR() {
    return getCanvasColor('info');
  },
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

  // Text stroke - Unified width with node-specific configs
  TEXT_STROKE_WIDTH: 2, // Consistent width for all text

  // Node-type specific stroke configurations
  NODE_TEXT_STROKES: {
    // Study mode strokes
    startNode: {
      stroke: 'rgba(0, 0, 0, 0.4)',  // Semi-transparent black on orange background
      width: 2
    },
    whiteMove: {
      stroke: 'rgba(0, 0, 0, 0.08)', // Very subtle black stroke on white background
      width: 1
    },
    blackMove: {
      stroke: 'rgba(255, 255, 255, 0.15)', // Subtle white stroke on near-black background
      width: 2
    },

    // Performance mode strokes
    excellent: {
      stroke: 'rgba(0, 0, 0, 0.3)',  // Semi-transparent black on green
      width: 2
    },
    good: {
      stroke: 'rgba(0, 0, 0, 0.25)', // Semi-transparent black on blue
      width: 2
    },
    solid: {
      stroke: 'rgba(0, 0, 0, 0.4)',  // Semi-transparent black on orange
      width: 2
    },
    challenging: {
      stroke: 'rgba(0, 0, 0, 0.35)', // Semi-transparent black on yellow-orange
      width: 2
    },
    difficult: {
      stroke: 'rgba(255, 255, 255, 0.2)', // Subtle white on red
      width: 2
    },
    missing: {
      stroke: 'rgba(0, 0, 0, 0.2)',  // Subtle black on gray
      width: 1.5
    },
    root: {
      stroke: 'rgba(0, 0, 0, 0.4)',  // Same as solid (orange background)
      width: 2
    }
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
  get SELECTED_COLOR() {
    return getCanvasColor('info'); // Blue glow for current position
  },
  get INITIAL_MOVE_COLOR() {
    return getCanvasColor('warning'); // Orange glow
  },
  get HOVERED_NEXT_MOVE_COLOR() {
    return getCanvasColor('destructive', 0.8); // Pink glow for hovered move
  },
  BLUR: 20,
  INTENSE_BLUR: 25,
  LAYERS: 8,
};

// =============================================================================
// COLOR SCHEMES (Theme-aware with lazy evaluation)
// =============================================================================

export const PERFORMANCE_COLORS = {
  get excellent() {
    return {
      bg: getCanvasColor('canvasExcellent'),
      border: getCanvasColor('canvasExcellent', 0.85),
      text: getCanvasColor('successForeground')
    };
  },
  get good() {
    return {
      bg: getCanvasColor('canvasGood'),
      border: getCanvasColor('canvasGood', 0.85),
      text: getCanvasColor('infoForeground')
    };
  },
  get solid() {
    return {
      bg: getCanvasColor('canvasSolid'),
      border: getCanvasColor('canvasSolid', 0.85),
      text: getCanvasColor('warningForeground')
    };
  },
  get challenging() {
    return {
      bg: getCanvasColor('canvasChallenging'),
      border: getCanvasColor('canvasChallenging', 0.85),
      text: getCanvasColor('warningForeground')
    };
  },
  get difficult() {
    return {
      bg: getCanvasColor('canvasDifficult'),
      border: getCanvasColor('canvasDifficult', 0.85),
      text: getCanvasColor('errorForeground')
    };
  },
  get missing() {
    return {
      bg: getCanvasColor('canvasMissing'),
      border: getCanvasColor('canvasMissing', 0.85),
      text: getCanvasColor('mutedForeground')
    };
  }
};

export const STUDY_NODE_COLORS = {
  get whiteMove() {
    return {
      bg: getCanvasColor('chessWhitePiece'),
      border: getCanvasColor('chessPieceBorder'),
      text: getCanvasColor('chessWhitePieceText')
    };
  },
  get blackMove() {
    return {
      bg: getCanvasColor('chessBlackPiece'),
      border: getCanvasColor('chessPieceBorder'),
      text: getCanvasColor('chessBlackPieceText')
    };
  },
  get selected() {
    return {
      bg: getCanvasColor('canvasSelected'),
      border: getCanvasColor('canvasSelected', 0.8),
      text: getCanvasColor('primaryForeground')
    };
  },
  get withComment() {
    return {
      bg: getCanvasColor('canvasComment'),
      border: getCanvasColor('canvasComment', 0.8),
      text: getCanvasColor('infoForeground')
    };
  },
  get withLinks() {
    return {
      bg: getCanvasColor('canvasLink'),
      border: getCanvasColor('canvasLink', 0.8),
      text: getCanvasColor('successForeground')
    };
  },
  get missing() {
    return {
      bg: getCanvasColor('canvasMissing'),
      border: getCanvasColor('canvasMissing', 0.8),
      text: getCanvasColor('mutedForeground')
    };
  },
  get startNode() {
    return {
      bg: getCanvasColor('canvasSolid'),
      border: getCanvasColor('canvasSolid', 0.8),
      text: getCanvasColor('chessBlackPieceText')  // Always white text across all themes
    };
  }
};

// Backward compatibility alias
export const OPENING_NODE_COLORS = STUDY_NODE_COLORS;

// Opening cluster colors - theme-aware
export const OPENING_CLUSTER_COLORS = [
  {
    get bg() { return getCanvasColor('cluster1'); },
    get border() { return getCanvasColor('cluster1', 0.9); },
    get text() { return getCanvasColor('foreground'); }
  }
];

// Position cluster colors - theme-aware
export const POSITION_CLUSTER_COLORS = [
  {
    get bg() { return getCanvasColor('cluster9'); }, // Orange
    get border() { return getCanvasColor('cluster9', 0.9); },
    get text() { return getCanvasColor('foreground'); }
  },
  {
    get bg() { return getCanvasColor('cluster4'); }, // Amber
    get border() { return getCanvasColor('cluster4', 0.9); },
    get text() { return getCanvasColor('foreground'); }
  },
  {
    get bg() { return getCanvasColor('chessDubious'); }, // Yellow
    get border() { return getCanvasColor('chessDubious', 0.9); },
    get text() { return getCanvasColor('foreground'); }
  }
];

export const CLUSTER_COLORS = {
  opening: OPENING_CLUSTER_COLORS,
  position: POSITION_CLUSTER_COLORS
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
