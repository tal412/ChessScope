/**
 * Shared Color Constants
 *
 * This file provides theme-aware color constants for use throughout the application.
 * All colors reference CSS variables from the theme system, ensuring consistency
 * and proper dark mode support.
 *
 * Import these constants instead of using hardcoded color values.
 */

import { getCanvasColor } from '@/utils/themeColors';

// =============================================================================
// TAG/FOLDER COLOR PALETTE
// =============================================================================

/**
 * Theme-aware color palette for tags and folders
 * Uses lazy evaluation to respect current theme
 */
export const TAG_COLORS = [
  { get value() { return getCanvasColor('tagColor1'); }, name: 'Indigo' },
  { get value() { return getCanvasColor('tagColor2'); }, name: 'Red' },
  { get value() { return getCanvasColor('tagColor3'); }, name: 'Green' },
  { get value() { return getCanvasColor('tagColor4'); }, name: 'Amber' },
  { get value() { return getCanvasColor('tagColor5'); }, name: 'Purple' },
  { get value() { return getCanvasColor('tagColor6'); }, name: 'Cyan' },
  { get value() { return getCanvasColor('tagColor7'); }, name: 'Pink' },
  { get value() { return getCanvasColor('tagColor8'); }, name: 'Lime' },
  { get value() { return getCanvasColor('tagColor9'); }, name: 'Orange' },
  { get value() { return getCanvasColor('tagColor10'); }, name: 'Slate' },
];

// Legacy array format for compatibility
export const TAG_COLOR_VALUES = TAG_COLORS.map(c => ({ get value() { return c.value; } }));

// Default tag color
export const DEFAULT_TAG_COLOR = { get value() { return getCanvasColor('tagColor1'); } };

// =============================================================================
// FOLDER COLOR PALETTE (same as tags)
// =============================================================================

export const FOLDER_COLORS = TAG_COLORS;
export const FOLDER_COLOR_VALUES = TAG_COLOR_VALUES;
export const DEFAULT_FOLDER_COLOR = DEFAULT_TAG_COLOR;

// =============================================================================
// CHESS ANNOTATION COLORS
// =============================================================================

/**
 * Semantic colors for chess move annotations
 * These are intentionally consistent across themes as they have
 * universal meaning in chess (green=good, red=bad, etc.)
 */
export const CHESS_ANNOTATION_COLORS = {
  get green() { return getCanvasColor('chessGood'); },
  get red() { return getCanvasColor('chessBlunder'); },
  get blue() { return getCanvasColor('chessInteresting'); },
  get yellow() { return getCanvasColor('chessDubious'); },
  get orange() { return getCanvasColor('chessMistake'); },
  get purple() { return getCanvasColor('cluster1'); },
  get pink() { return getCanvasColor('cluster7'); },
  get cyan() { return getCanvasColor('canvasComment'); },
};

// Arrow color mappings for chessboard
export const ARROW_COLORS = {
  get green() { return getCanvasColor('chessGood'); },
  get red() { return getCanvasColor('chessBlunder'); },
  get blue() { return getCanvasColor('chessInteresting'); },
  get yellow() { return getCanvasColor('chessDubious'); },
};

// Brush configuration for chessboard drawing
export const BRUSH_COLORS = {
  green: {
    key: 'g',
    get color() { return getCanvasColor('chessGood'); },
    opacity: 0.8,
    lineWidth: 10
  },
  red: {
    key: 'r',
    get color() { return getCanvasColor('chessBlunder'); },
    opacity: 0.8,
    lineWidth: 10
  },
  blue: {
    key: 'b',
    get color() { return getCanvasColor('chessInteresting'); },
    opacity: 0.8,
    lineWidth: 10
  },
  yellow: {
    key: 'y',
    get color() { return getCanvasColor('chessDubious'); },
    opacity: 0.8,
    lineWidth: 10
  },
  purple: {
    key: 'p',
    get color() { return getCanvasColor('cluster1'); },
    opacity: 0.8,
    lineWidth: 10
  },
  orange: {
    key: 'o',
    get color() { return getCanvasColor('chessMistake'); },
    opacity: 0.8,
    lineWidth: 10
  },
  pink: {
    key: 'shift+p',
    get color() { return getCanvasColor('cluster7'); },
    opacity: 0.8,
    lineWidth: 10
  },
  cyan: {
    key: 'c',
    get color() { return getCanvasColor('canvasComment'); },
    opacity: 0.8,
    lineWidth: 10
  }
};

// =============================================================================
// CLUSTER COLORS
// =============================================================================

/**
 * Color palette for opening and position clustering visualizations
 */
export const CLUSTER_COLORS = [
  { get bg() { return getCanvasColor('cluster1'); }, get border() { return getCanvasColor('cluster1', 0.9); }, name: 'Purple' },
  { get bg() { return getCanvasColor('cluster2'); }, get border() { return getCanvasColor('cluster2', 0.9); }, name: 'Blue' },
  { get bg() { return getCanvasColor('cluster3'); }, get border() { return getCanvasColor('cluster3', 0.9); }, name: 'Green' },
  { get bg() { return getCanvasColor('cluster4'); }, get border() { return getCanvasColor('cluster4', 0.9); }, name: 'Amber' },
  { get bg() { return getCanvasColor('cluster5'); }, get border() { return getCanvasColor('cluster5', 0.9); }, name: 'Red' },
  { get bg() { return getCanvasColor('cluster6'); }, get border() { return getCanvasColor('cluster6', 0.9); }, name: 'Magenta' },
  { get bg() { return getCanvasColor('cluster7'); }, get border() { return getCanvasColor('cluster7', 0.9); }, name: 'Cyan' },
  { get bg() { return getCanvasColor('cluster8'); }, get border() { return getCanvasColor('cluster8', 0.9); }, name: 'Dark Green' },
  { get bg() { return getCanvasColor('cluster9'); }, get border() { return getCanvasColor('cluster9', 0.9); }, name: 'Orange' },
  { get bg() { return getCanvasColor('cluster10'); }, get border() { return getCanvasColor('cluster10', 0.9); }, name: 'Dark Purple' },
];

// Single purple cluster for opening analysis
export const SINGLE_CLUSTER_COLOR = {
  get bg() { return getCanvasColor('cluster1'); },
  get border() { return getCanvasColor('cluster1', 0.9); },
  get text() { return getCanvasColor('foreground'); }
};

// Unclustered positions color
export const UNCLUSTERED_COLOR = {
  get bg() { return getCanvasColor('mutedForeground'); },
  get border() { return getCanvasColor('mutedForeground', 0.8); },
  get text() { return getCanvasColor('foreground'); }
};

// =============================================================================
// DEFAULT STUDY TAG COLORS
// =============================================================================

/**
 * Default tag colors for new studies
 */
export const DEFAULT_STUDY_TAGS = [
  { name: 'Opening', get color() { return getCanvasColor('tagColor3'); } },      // Green
  { name: 'Middlegame', get color() { return getCanvasColor('tagColor2'); } },   // Blue (using tag-color-2)
  { name: 'Endgame', get color() { return getCanvasColor('tagColor4'); } },      // Amber
  { name: 'Tactics', get color() { return getCanvasColor('tagColor2'); } },      // Red
  { name: 'Strategy', get color() { return getCanvasColor('tagColor5'); } },     // Purple
  { name: 'Defense', get color() { return getCanvasColor('tagColor6'); } },      // Cyan
];

// =============================================================================
// ENGINE LINE COLORS
// =============================================================================

/**
 * Colors for multi-PV engine analysis lines
 */
export const ENGINE_LINE_COLORS = [
  {
    get color() { return getCanvasColor('info'); },
    thickness: 16,
    label: '#1'
  },
  {
    get color() { return getCanvasColor('success'); },
    thickness: 14,
    label: '#2'
  },
  {
    get color() { return getCanvasColor('warning'); },
    thickness: 12,
    label: '#3'
  }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets a tag color by index (with wrapping)
 * @param {number} index - Color index
 * @returns {string} Color value
 */
export function getTagColorByIndex(index) {
  const colorIndex = index % TAG_COLORS.length;
  return TAG_COLORS[colorIndex].value;
}

/**
 * Gets a cluster color by index (with wrapping)
 * @param {number} index - Cluster index
 * @returns {Object} Color object with bg, border properties
 */
export function getClusterColorByIndex(index) {
  const colorIndex = index % CLUSTER_COLORS.length;
  return {
    bg: CLUSTER_COLORS[colorIndex].bg,
    border: CLUSTER_COLORS[colorIndex].border,
    text: getCanvasColor('foreground')
  };
}

/**
 * Gets performance-based Tailwind className string for win rates
 * Uses theme canvas performance colors for consistency
 * @param {number} winRate - Win rate percentage (0-100)
 * @returns {string} Tailwind className string
 */
export function getPerformanceColorClasses(winRate) {
  if (winRate >= 70) {
    // Excellent performance - green
    return 'bg-[hsl(var(--canvas-excellent))]/20 text-[hsl(var(--canvas-excellent))] border-[hsl(var(--canvas-excellent))]/30';
  }
  if (winRate >= 60) {
    // Good performance - cyan
    return 'bg-[hsl(var(--canvas-good))]/20 text-[hsl(var(--canvas-good))] border-[hsl(var(--canvas-good))]/30';
  }
  if (winRate >= 50) {
    // Solid performance - amber
    return 'bg-[hsl(var(--canvas-solid))]/20 text-[hsl(var(--canvas-solid))] border-[hsl(var(--canvas-solid))]/30';
  }
  if (winRate >= 40) {
    // Challenging performance - orange
    return 'bg-[hsl(var(--canvas-challenging))]/20 text-[hsl(var(--canvas-challenging))] border-[hsl(var(--canvas-challenging))]/30';
  }
  // Difficult performance - red
  return 'bg-[hsl(var(--canvas-difficult))]/20 text-[hsl(var(--canvas-difficult))] border-[hsl(var(--canvas-difficult))]/30';
}

/**
 * Gets performance-based border className for win rates
 * @param {number} winRate - Win rate percentage (0-100)
 * @returns {string} Tailwind border className string
 */
export function getPerformanceBorderClass(winRate) {
  if (winRate >= 70) return 'border-[hsl(var(--canvas-excellent))]/80 hover:bg-[hsl(var(--canvas-excellent))]/10';
  if (winRate >= 60) return 'border-[hsl(var(--canvas-good))]/80 hover:bg-[hsl(var(--canvas-good))]/10';
  if (winRate >= 50) return 'border-[hsl(var(--canvas-solid))]/80 hover:bg-[hsl(var(--canvas-solid))]/10';
  if (winRate >= 40) return 'border-[hsl(var(--canvas-challenging))]/80 hover:bg-[hsl(var(--canvas-challenging))]/10';
  return 'border-[hsl(var(--canvas-difficult))]/80 hover:bg-[hsl(var(--canvas-difficult))]/10';
}

/**
 * Gets performance icon color for win rates
 * @param {number} winRate - Win rate percentage (0-100)
 * @returns {string} Tailwind text color className
 */
export function getPerformanceIconColor(winRate) {
  if (winRate >= 70) return 'text-[hsl(var(--canvas-excellent))]';
  if (winRate >= 60) return 'text-[hsl(var(--canvas-good))]';
  if (winRate >= 50) return 'text-[hsl(var(--canvas-solid))]';
  if (winRate >= 40) return 'text-[hsl(var(--canvas-challenging))]';
  return 'text-[hsl(var(--canvas-difficult))]';
}

/**
 * Converts a hex color to theme color (for migration compatibility)
 * Maps common hardcoded hex values to their theme equivalents
 * @param {string} hexColor - Hex color string
 * @returns {string} Theme color or original hex if no mapping exists
 */
export function hexToThemeColor(hexColor) {
  const mappings = {
    // Tag/folder colors
    '#6366f1': getCanvasColor('tagColor1'),
    '#ef4444': getCanvasColor('tagColor2'),
    '#22c55e': getCanvasColor('tagColor3'),
    '#f59e0b': getCanvasColor('tagColor4'),
    '#8b5cf6': getCanvasColor('tagColor5'),
    '#06b6d4': getCanvasColor('tagColor6'),
    '#ec4899': getCanvasColor('tagColor7'),
    '#84cc16': getCanvasColor('tagColor8'),
    '#f97316': getCanvasColor('tagColor9'),
    '#64748b': getCanvasColor('tagColor10'),

    // Chess annotation colors
    '#3b82f6': getCanvasColor('chessInteresting'),
    '#10b981': getCanvasColor('chessGood'),
    '#eab308': getCanvasColor('chessDubious'),

    // Common UI colors
    '#ffffff': getCanvasColor('card'),
    '#000000': getCanvasColor('foreground'),
    '#6b7280': getCanvasColor('mutedForeground'),
  };

  return mappings[hexColor.toLowerCase()] || hexColor;
}
