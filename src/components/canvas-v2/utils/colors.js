import { PERFORMANCE_COLORS, STUDY_NODE_COLORS } from '../constants.js';

/**
 * Get performance-based color scheme for a node
 * @param {Object|number} nodeDataOrWinRate - Node data object or win rate number
 * @param {number} gameCount - Number of games (optional if first param is object)
 * @param {boolean} isMissing - Whether the node has missing data (optional if first param is object)
 * @returns {Object} Color scheme object with bg, border, text properties
 */
export function getPerformanceColors(nodeDataOrWinRate, gameCount, isMissing = false) {
  // Handle both call signatures: getPerformanceColors(nodeData) and getPerformanceColors(winRate, gameCount, isMissing)
  let winRate, actualGameCount, actualIsMissing;
  
  if (typeof nodeDataOrWinRate === 'object' && nodeDataOrWinRate !== null) {
    // Called with node data object
    const nodeData = nodeDataOrWinRate;
    winRate = nodeData.winRate;
    actualGameCount = nodeData.gameCount;
    actualIsMissing = nodeData.isMissing;
  } else {
    // Called with individual parameters
    winRate = nodeDataOrWinRate;
    actualGameCount = gameCount;
    actualIsMissing = isMissing;
  }
  if (actualIsMissing || winRate === null || winRate === undefined) {
    return PERFORMANCE_COLORS.missing;
  }
  
  // Special case: no games but has win rate data
  if ((actualGameCount === 0 || actualGameCount === null) && winRate !== null && winRate !== undefined) {
    return PERFORMANCE_COLORS.solid; // Orange for theoretical positions
  }
  
  // Performance-based coloring
  if (winRate >= 70) return PERFORMANCE_COLORS.excellent;
  if (winRate >= 60) return PERFORMANCE_COLORS.good;
  if (winRate >= 50) return PERFORMANCE_COLORS.solid;
  if (winRate >= 40) return PERFORMANCE_COLORS.challenging;
  return PERFORMANCE_COLORS.difficult;
}

/**
 * Get study-based color scheme for a node
 * @param {Object} node - Node data
 * @param {boolean} isSelected - Whether the node is selected
 * @returns {Object} Color scheme object with bg, border, text properties
 */
export function getStudyNodeColors(node, isSelected = false) {
  const nodeData = node.data || {};

  if (nodeData.isMissing) {
    return STUDY_NODE_COLORS.missing;
  }
  
  if (nodeData.isRoot) {
    return STUDY_NODE_COLORS.startNode;
  }
  
  const moveSequence = nodeData.moveSequence || [];
  const isWhiteMove = moveSequence.length % 2 !== 0;
  
  return isWhiteMove ? STUDY_NODE_COLORS.whiteMove : STUDY_NODE_COLORS.blackMove;
}

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, alpha = 1) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Backward compatibility aliases for original function names
export const getPerformanceData = getPerformanceColors;
// Backward compatibility aliases
export const getOpeningNodeColors = getStudyNodeColors;
export const getOpeningNodeColor = getStudyNodeColors;

// Also export hexToRgb as alias for hexToRgba for compatibility
export const hexToRgb = hexToRgba; 