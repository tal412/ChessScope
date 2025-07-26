import { PERFORMANCE_COLORS, OPENING_NODE_COLORS, CLUSTER_CONFIG } from './constants.js';

/**
 * Get performance data color scheme based on win rate and game count
 */
export const getPerformanceData = (winRate, gameCount, isMissing = false) => {
  if (isMissing || winRate === null || winRate === undefined) return PERFORMANCE_COLORS.missing;
  // Special case: if gameCount is 0 or null, use orange color instead of red
  if ((gameCount === 0 || gameCount === null) && winRate !== null && winRate !== undefined) {
    return PERFORMANCE_COLORS.solid; // Orange color for no games
  }
  if (winRate >= 70) return PERFORMANCE_COLORS.excellent;
  if (winRate >= 60) return PERFORMANCE_COLORS.good;
  if (winRate >= 50) return PERFORMANCE_COLORS.solid;
  if (winRate >= 40) return PERFORMANCE_COLORS.challenging;
  return PERFORMANCE_COLORS.difficult;
};

/**
 * Get opening node color based on node state
 */
export const getOpeningNodeColor = (node, isSelected) => {
  if (node.data.isMissing) return OPENING_NODE_COLORS.missing;
  // Remove selected node color change - we'll handle selection with glow only
  // if (isSelected) return OPENING_NODE_COLORS.selected;
  
  // For root node, use gray start node styling
  if (node.data.isRoot) {
    return OPENING_NODE_COLORS.startNode;
  }
  
  // Get move sequence to determine if this is a white or black move
  const moveSequence = node.data.moveSequence || [];
  const isWhiteMove = moveSequence.length % 2 === 1; // Odd move number = white move
  
  return isWhiteMove ? OPENING_NODE_COLORS.whiteMove : OPENING_NODE_COLORS.blackMove;
};

/**
 * Function to create convex hull for organic cluster shapes
 */
export const createConvexHull = (points) => {
  if (points.length < 3) return points;
  
  // Graham scan algorithm for convex hull
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  
  // Find the bottom-most point (and left-most in case of tie)
  let bottom = points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < bottom.y || (points[i].y === bottom.y && points[i].x < bottom.x)) {
      bottom = points[i];
    }
  }
  
  // Sort points by polar angle with respect to bottom point
  const sorted = points.filter(p => p !== bottom).sort((a, b) => {
    const angleA = Math.atan2(a.y - bottom.y, a.x - bottom.x);
    const angleB = Math.atan2(b.y - bottom.y, b.x - bottom.x);
    return angleA - angleB;
  });
  
  const hull = [bottom];
  
  for (const point of sorted) {
    while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
};

/**
 * Function to create smooth path through hull points
 */
export const createSmoothPath = (ctx, hull, padding = 50) => {
  if (hull.length < 3) {
    // Fallback to rounded rectangle for small clusters
    // For single nodes, use extra generous padding (150% more)
    const singleNodePadding = hull.length === 1 ? padding * 1.5 : padding;
    const minX = Math.min(...hull.map(p => p.x)) - singleNodePadding;
    const maxX = Math.max(...hull.map(p => p.x)) + singleNodePadding;
    const minY = Math.min(...hull.map(p => p.y)) - singleNodePadding;
    const maxY = Math.max(...hull.map(p => p.y)) + singleNodePadding;
    
    ctx.beginPath();
    ctx.roundRect(minX, minY, maxX - minX, maxY - minY, CLUSTER_CONFIG.CORNER_RADIUS_CLUSTER);
    return;
  }
  
  // Add CONSERVATIVE padding to hull points for accurate positioning
  const centroid = {
    x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
    y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length
  };
  
  const paddedHull = hull.map(point => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: point.x + padding * CLUSTER_CONFIG.CONSERVATIVE_PADDING_FACTOR, y: point.y + padding * CLUSTER_CONFIG.CONSERVATIVE_PADDING_FACTOR };
    
    // Much more conservative padding - just 30% of the specified padding
    const factor = (dist + padding * CLUSTER_CONFIG.CONSERVATIVE_PADDING_FACTOR) / dist;
    return {
      x: centroid.x + dx * factor,
      y: centroid.y + dy * factor
    };
  });
  
  // MATCH ReactFlow EXACTLY: Use quadratic curves (Q commands equivalent)
  ctx.beginPath();
  ctx.moveTo(paddedHull[0].x, paddedHull[0].y);
  
  // Replicate ReactFlow's exact path creation logic
  for (let i = 1; i < paddedHull.length; i++) {
    const curr = paddedHull[i];
    const next = paddedHull[(i + 1) % paddedHull.length];
    const prev = paddedHull[i - 1];
    
    // EXACT ReactFlow control point calculation
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    const cp1x = curr.x - dx1 * CLUSTER_CONFIG.CURVE_CONTROL_FACTOR;
    const cp1y = curr.y - dy1 * CLUSTER_CONFIG.CURVE_CONTROL_FACTOR;
    
    // Use quadratic curves (matches ReactFlow Q commands)
    ctx.quadraticCurveTo(cp1x, cp1y, curr.x, curr.y);
  }
  
  // Close path smoothly like ReactFlow
  const first = paddedHull[0];
  const last = paddedHull[paddedHull.length - 1];
  const cp2x = first.x - (first.x - last.x) * CLUSTER_CONFIG.CURVE_CONTROL_FACTOR;
  const cp2y = first.y - (first.y - last.y) * CLUSTER_CONFIG.CURVE_CONTROL_FACTOR;
  ctx.quadraticCurveTo(cp2x, cp2y, first.x, first.y);
  
  ctx.closePath();
};

/**
 * Convert hex color to RGB
 */
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Point-in-polygon test using ray casting algorithm
 */
export const isPointInPath = (x, y, path) => {
  if (!path || path.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    if (((path[i].y > y) !== (path[j].y > y)) &&
        (x < (path[j].x - path[i].x) * (y - path[i].y) / (path[j].y - path[i].y) + path[i].x)) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Calculate optimal transform for given nodes and dimensions
 */
export const calculateOptimalTransform = (nodes, canvasDimensions, customPadding = 50) => {
  if (nodes.length === 0 || canvasDimensions.width <= 0 || canvasDimensions.height <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  const bounds = nodes.reduce((acc, node) => ({
    minX: Math.min(acc.minX, node.x - node.width/2),
    maxX: Math.max(acc.maxX, node.x + node.width/2),
    minY: Math.min(acc.minY, node.y - node.height/2),
    maxY: Math.max(acc.maxY, node.y + node.height/2)
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  
  if (contentWidth <= 0 || contentHeight <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  const padding = customPadding;
  const rawScale = Math.min(
    (canvasDimensions.width - padding * 2) / contentWidth,
    (canvasDimensions.height - padding * 2) / contentHeight
  );
  
  // For auto-fit, allow unlimited zoom-out to ensure content always fits
  // Don't clamp to max 2.0 - let it use whatever scale fits the content
  const scale = Math.max(rawScale, 0.001);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  let optimalTransform = {
    x: canvasDimensions.width / 2 - centerX * scale,
    y: canvasDimensions.height / 2 - centerY * scale,
    scale
  };
  
  // Safety check: ensure ALL nodes are visible on screen
  const topNodeY = bounds.minY * scale + optimalTransform.y;
  const bottomNodeY = bounds.maxY * scale + optimalTransform.y;
  const leftNodeX = bounds.minX * scale + optimalTransform.x;
  const rightNodeX = bounds.maxX * scale + optimalTransform.x;
  
  // Fix Y positioning
  if (topNodeY < padding) {
    optimalTransform.y = padding - bounds.minY * scale;
  } else if (bottomNodeY > canvasDimensions.height - padding) {
    optimalTransform.y = canvasDimensions.height - padding - bounds.maxY * scale;
  }
  
  // Fix X positioning
  if (leftNodeX < padding) {
    optimalTransform.x = padding - bounds.minX * scale;
  } else if (rightNodeX > canvasDimensions.width - padding) {
    optimalTransform.x = canvasDimensions.width - padding - bounds.maxX * scale;
  }

  return optimalTransform;
};

/**
 * Helper function to draw SVG icon paths on canvas
 */
export const drawIcon = (ctx, iconPath, x, y, size, color) => {
  ctx.save();
  ctx.translate(x - size/2, y - size/2);
  ctx.scale(size/24, size/24); // Scale from 24x24 to desired size
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Parse and draw the path
  const path = new Path2D(iconPath);
  ctx.fill(path);
  ctx.stroke(path);
  
  ctx.restore();
};

/**
 * Helper function to draw a chain link icon
 */
export const drawChainLinkIcon = (ctx, x, y, size, color) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Draw left circle
  ctx.beginPath();
  ctx.arc(x - 5, y - 2, 5, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Draw right circle
  ctx.beginPath();
  ctx.arc(x + 5, y - 2, 5, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Draw connecting bar
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 2);
  ctx.lineTo(x + 2, y - 2);
  ctx.stroke();
  
  ctx.restore();
}; 