/**
 * Theme Color Resolution Utility
 *
 * Provides runtime access to CSS variable-based theme colors for use in:
 * - Canvas rendering contexts (ctx.fillStyle, ctx.strokeStyle)
 * - Dynamic color calculations
 * - JavaScript-based styling
 *
 * All colors are resolved from the active theme (light/dark) at runtime.
 */

/**
 * Resolves a CSS variable to its computed HSL color value
 * @param {string} variableName - CSS variable name (e.g., '--background')
 * @returns {string} HSL color string (e.g., 'hsl(0 0% 98%)')
 */
export function getThemeColor(variableName) {
  if (typeof window === 'undefined') {
    return 'hsl(0 0% 50%)'; // Fallback for SSR
  }

  const root = document.documentElement;
  const hslValue = getComputedStyle(root).getPropertyValue(variableName).trim();

  if (!hslValue) {
    console.warn(`Theme color variable ${variableName} not found`);
    return 'hsl(0 0% 50%)'; // Fallback gray
  }

  return `hsl(${hslValue})`;
}

/**
 * Resolves a CSS variable with opacity
 * @param {string} variableName - CSS variable name
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} HSL color string with alpha
 */
export function getThemeColorWithOpacity(variableName, opacity = 1) {
  if (typeof window === 'undefined') {
    return `hsla(0 0% 50% / ${opacity})`;
  }

  const root = document.documentElement;
  const hslValue = getComputedStyle(root).getPropertyValue(variableName).trim();

  if (!hslValue) {
    console.warn(`Theme color variable ${variableName} not found`);
    return `hsla(0 0% 50% / ${opacity})`;
  }

  return `hsl(${hslValue} / ${opacity})`;
}

/**
 * Pre-defined theme color mappings for common use cases
 */
export const THEME_COLORS = {
  // Base colors
  background: '--background',
  foreground: '--foreground',

  // UI elements
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',

  // Borders & inputs
  border: '--border',
  input: '--input',
  ring: '--ring',

  // Card components
  card: '--card',
  cardForeground: '--card-foreground',

  // Status colors
  success: '--success',
  successForeground: '--success-foreground',
  warning: '--warning',
  warningForeground: '--warning-foreground',
  info: '--info',
  infoForeground: '--info-foreground',
  error: '--error',
  errorForeground: '--error-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',

  // Canvas-specific colors
  canvasExcellent: '--canvas-excellent',
  canvasGood: '--canvas-good',
  canvasSolid: '--canvas-solid',
  canvasChallenging: '--canvas-challenging',
  canvasDifficult: '--canvas-difficult',
  canvasMissing: '--canvas-missing',

  // Move type colors
  canvasWhiteMove: '--canvas-white-move',
  canvasBlackMove: '--canvas-black-move',
  canvasSelected: '--canvas-selected',
  canvasComment: '--canvas-comment',
  canvasLink: '--canvas-link',

  // Cluster colors
  cluster1: '--cluster-1',
  cluster2: '--cluster-2',
  cluster3: '--cluster-3',
  cluster4: '--cluster-4',
  cluster5: '--cluster-5',
  cluster6: '--cluster-6',
  cluster7: '--cluster-7',
  cluster8: '--cluster-8',
  cluster9: '--cluster-9',
  cluster10: '--cluster-10',

  // Chess annotation colors (semantic)
  chessGood: '--chess-good',
  chessExcellent: '--chess-excellent',
  chessInteresting: '--chess-interesting',
  chessDubious: '--chess-dubious',
  chessMistake: '--chess-mistake',
  chessBlunder: '--chess-blunder',

  // Folder/tag colors
  tagColor1: '--tag-color-1',
  tagColor2: '--tag-color-2',
  tagColor3: '--tag-color-3',
  tagColor4: '--tag-color-4',
  tagColor5: '--tag-color-5',
  tagColor6: '--tag-color-6',
  tagColor7: '--tag-color-7',
  tagColor8: '--tag-color-8',
  tagColor9: '--tag-color-9',
  tagColor10: '--tag-color-10',

  // Chess piece colors (semantic)
  chessWhitePiece: '--chess-white-piece',
  chessWhitePieceText: '--chess-white-piece-text',
  chessBlackPiece: '--chess-black-piece',
  chessBlackPieceText: '--chess-black-piece-text',
  chessPieceBorder: '--chess-piece-border',
};

/**
 * Gets a theme color using the pre-defined mappings
 * @param {keyof THEME_COLORS} colorName - Color name from THEME_COLORS
 * @param {number} [opacity] - Optional opacity (0-1)
 * @returns {string} Resolved color string
 */
export function getColor(colorName, opacity) {
  const variableName = THEME_COLORS[colorName];

  if (!variableName) {
    console.warn(`Color name ${colorName} not found in THEME_COLORS`);
    return opacity !== undefined
      ? `hsla(0 0% 50% / ${opacity})`
      : 'hsl(0 0% 50%)';
  }

  return opacity !== undefined
    ? getThemeColorWithOpacity(variableName, opacity)
    : getThemeColor(variableName);
}

/**
 * Canvas-specific color resolver with caching for performance
 */
class CanvasColorCache {
  constructor() {
    this.cache = new Map();
    this.isDark = false;

    // Listen for theme changes
    if (typeof window !== 'undefined') {
      const observer = new MutationObserver(() => {
        const newIsDark = document.documentElement.classList.contains('dark');
        if (newIsDark !== this.isDark) {
          this.isDark = newIsDark;
          this.clearCache();
        }
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  clearCache() {
    this.cache.clear();
  }

  get(variableName, opacity) {
    const key = `${variableName}-${opacity || 'none'}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const color = opacity !== undefined
      ? getThemeColorWithOpacity(variableName, opacity)
      : getThemeColor(variableName);

    this.cache.set(key, color);
    return color;
  }
}

// Singleton instance
export const canvasColorCache = new CanvasColorCache();

/**
 * Optimized color getter for canvas rendering (uses cache)
 * @param {keyof THEME_COLORS} colorName - Color name
 * @param {number} [opacity] - Optional opacity
 * @returns {string} Resolved color string
 */
export function getCanvasColor(colorName, opacity) {
  const variableName = THEME_COLORS[colorName];

  if (!variableName) {
    console.warn(`Color name ${colorName} not found in THEME_COLORS`);
    return opacity !== undefined
      ? `hsla(0 0% 50% / ${opacity})`
      : 'hsl(0 0% 50%)';
  }

  return canvasColorCache.get(variableName, opacity);
}

/**
 * Converts HSL to RGB (useful for certain canvas operations)
 * @param {string} hslString - HSL color string
 * @returns {{r: number, g: number, b: number}} RGB object
 */
export function hslToRgb(hslString) {
  // Parse HSL string (e.g., "hsl(0 0% 98%)" or "hsl(0 0% 98% / 0.5)")
  const match = hslString.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);

  if (!match) {
    console.warn(`Invalid HSL string: ${hslString}`);
    return { r: 128, g: 128, b: 128 };
  }

  let h = parseFloat(match[1]) / 360;
  let s = parseFloat(match[2]) / 100;
  let l = parseFloat(match[3]) / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Determines if a color is dark (for text contrast calculations)
 * @param {string} colorString - HSL or RGB color string
 * @returns {boolean} True if color is dark
 */
export function isColorDark(colorString) {
  let r, g, b;

  if (colorString.startsWith('hsl')) {
    const rgb = hslToRgb(colorString);
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;
  } else if (colorString.startsWith('rgb')) {
    const match = colorString.match(/\d+/g);
    if (match) {
      [r, g, b] = match.map(Number);
    }
  } else {
    return false;
  }

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Gets contrasting text color (white or black) for a given background
 * @param {string} backgroundColor - Background color string
 * @returns {string} Either white or black color from theme
 */
export function getContrastingTextColor(backgroundColor) {
  const isDark = isColorDark(backgroundColor);
  return isDark
    ? getColor('foreground')
    : getThemeColor('--primary');
}
