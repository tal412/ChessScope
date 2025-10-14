import { getCanvasColor, getContrastingTextColor } from '@/utils/themeColors';

/**
 * Canvas Constants - Theme-Aware Color System
 *
 * All color values are now resolved from CSS variables at runtime,
 * enabling proper dark mode support and theme consistency.
 *
 * Colors are lazily evaluated using getters to ensure they reflect
 * the current theme when accessed.
 */

// Performance/Evaluation color mappings (lazy-loaded from theme)
export const PERFORMANCE_COLORS = {
  get excellent() {
    return {
      bg: getCanvasColor('canvasExcellent'),
      border: getCanvasColor('canvasExcellent', 0.8),
      text: getCanvasColor('successForeground')
    };
  },
  get good() {
    return {
      bg: getCanvasColor('canvasGood'),
      border: getCanvasColor('canvasGood', 0.8),
      text: getCanvasColor('infoForeground')
    };
  },
  get solid() {
    return {
      bg: getCanvasColor('canvasSolid'),
      border: getCanvasColor('canvasSolid', 0.8),
      text: getCanvasColor('warningForeground')
    };
  },
  get challenging() {
    return {
      bg: getCanvasColor('canvasChallenging'),
      border: getCanvasColor('canvasChallenging', 0.8),
      text: getCanvasColor('warningForeground')
    };
  },
  get difficult() {
    return {
      bg: getCanvasColor('canvasDifficult'),
      border: getCanvasColor('canvasDifficult', 0.8),
      text: getCanvasColor('errorForeground')
    };
  },
  get missing() {
    return {
      bg: getCanvasColor('canvasMissing'),
      border: getCanvasColor('canvasMissing', 0.8),
      text: getCanvasColor('mutedForeground')
    };
  }
};

// Opening tree node colors (lazy-loaded from theme)
export const OPENING_NODE_COLORS = {
  get whiteMove() {
    return {
      bg: getCanvasColor('canvasWhiteMove'),
      border: getCanvasColor('border'),
      text: getCanvasColor('foreground')
    };
  },
  get blackMove() {
    return {
      bg: getCanvasColor('canvasBlackMove'),
      border: getCanvasColor('canvasBlackMove', 0.8),
      text: getCanvasColor('card')
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
      text: getCanvasColor('warningForeground')
    };
  }
};

// Opening cluster colors (lazy-loaded from theme)
export const OPENING_CLUSTER_COLORS = [
  {
    get bg() { return getCanvasColor('cluster1'); },
    get border() { return getCanvasColor('cluster1', 0.9); },
    get text() { return getCanvasColor('foreground'); }
  }
];

// Position cluster colors (lazy-loaded from theme)
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

// Canvas configuration (no colors here - all numeric config)
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

// Render configuration (theme-aware colors via getters)
export const RENDER_CONFIG = {
  get BACKGROUND_COLOR() {
    return getCanvasColor('background');
  },
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

// Cluster rendering configuration (no colors)
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

// Shadow and glow effects (theme-aware)
export const SHADOW_CONFIG = {
  get SELECTED_COLOR() {
    // Pink glow for selected nodes
    return getCanvasColor('destructive', 0.8);
  },
  get INITIAL_MOVE_COLOR() {
    // Orange glow for initial moves
    return getCanvasColor('warning');
  },
  get HOVERED_NEXT_MOVE_COLOR() {
    // Blue glow for hovered next moves
    return getCanvasColor('info');
  },
  BLUR: 20,
  INTENSE_BLUR: 25,
  LAYERS: 8,
};

// Keyboard shortcuts (no colors)
export const KEYBOARD_SHORTCUTS = {
  FIT_VIEW: ['r', 'R'],
  EMERGENCY_RESET: ['Escape'],
};

// Mouse buttons (no colors)
export const MOUSE_BUTTONS = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
};
