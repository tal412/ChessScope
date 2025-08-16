/**
 * Create convex hull for cluster shapes using Graham scan algorithm
 * @param {Array} points - Array of {x, y} points
 * @returns {Array} Convex hull points
 */
export function createConvexHull(points) {
  if (points.length < 3) return points;
  
  // Helper function for cross product
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  
  // Find the bottom-most point (and left-most in case of tie)
  let bottom = points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < bottom.y || (points[i].y === bottom.y && points[i].x < bottom.x)) {
      bottom = points[i];
    }
  }
  
  // Sort points by polar angle with respect to bottom point
  const sorted = points.slice().sort((a, b) => {
    if (a === bottom) return -1;
    if (b === bottom) return 1;
    
    const angleA = Math.atan2(a.y - bottom.y, a.x - bottom.x);
    const angleB = Math.atan2(b.y - bottom.y, b.x - bottom.x);
    
    if (angleA !== angleB) return angleA - angleB;
    
    // If angles are equal, sort by distance
    const distA = Math.pow(a.x - bottom.x, 2) + Math.pow(a.y - bottom.y, 2);
    const distB = Math.pow(b.x - bottom.x, 2) + Math.pow(b.y - bottom.y, 2);
    return distA - distB;
  });
  
  // Build convex hull
  const hull = [];
  for (const point of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
}

/**
 * Create smooth path from convex hull points
 * @param {Array} hullPoints - Convex hull points
 * @param {number} padding - Padding around the hull
 * @returns {Path2D} Canvas path object
 */
export function createSmoothPath(hullPoints, padding = 20) {
  if (hullPoints.length < 3) return new Path2D();
  
  // Add padding to hull points
  const paddedPoints = addPaddingToHull(hullPoints, padding);
  
  const path = new Path2D();
  path.moveTo(paddedPoints[0].x, paddedPoints[0].y);
  
  // Create smooth curves between points
  for (let i = 1; i < paddedPoints.length; i++) {
    const current = paddedPoints[i];
    const next = paddedPoints[(i + 1) % paddedPoints.length];
    const prev = paddedPoints[i - 1];
    
    // Calculate control points for smooth curves
    const tension = 0.3;
    const d1 = Math.sqrt(Math.pow(current.x - prev.x, 2) + Math.pow(current.y - prev.y, 2));
    const d2 = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));
    
    const fa = tension * d1 / (d1 + d2);
    const fb = tension * d2 / (d1 + d2);
    
    const cp1x = current.x - fa * (next.x - prev.x);
    const cp1y = current.y - fa * (next.y - prev.y);
    const cp2x = current.x + fb * (next.x - prev.x);
    const cp2y = current.y + fb * (next.y - prev.y);
    
    path.quadraticCurveTo(cp1x, cp1y, current.x, current.y);
  }
  
  path.closePath();
  return path;
}

/**
 * Add padding to convex hull points
 * @param {Array} hullPoints - Original hull points
 * @param {number} padding - Padding amount
 * @returns {Array} Padded hull points
 */
function addPaddingToHull(hullPoints, padding) {
  if (hullPoints.length < 3) return hullPoints;
  
  const paddedPoints = [];
  
  for (let i = 0; i < hullPoints.length; i++) {
    const current = hullPoints[i];
    const prev = hullPoints[(i - 1 + hullPoints.length) % hullPoints.length];
    const next = hullPoints[(i + 1) % hullPoints.length];
    
    // Calculate normal vectors
    const v1 = { x: current.x - prev.x, y: current.y - prev.y };
    const v2 = { x: next.x - current.x, y: next.y - current.y };
    
    // Normalize vectors
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (len1 > 0) { v1.x /= len1; v1.y /= len1; }
    if (len2 > 0) { v2.x /= len2; v2.y /= len2; }
    
    // Calculate perpendicular vectors (normals)
    const n1 = { x: -v1.y, y: v1.x };
    const n2 = { x: -v2.y, y: v2.x };
    
    // Average the normals
    const avgNormal = { x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 };
    const avgLen = Math.sqrt(avgNormal.x * avgNormal.x + avgNormal.y * avgNormal.y);
    
    if (avgLen > 0) {
      avgNormal.x /= avgLen;
      avgNormal.y /= avgLen;
    }
    
    // Add padding in the direction of the average normal
    paddedPoints.push({
      x: current.x + avgNormal.x * padding,
      y: current.y + avgNormal.y * padding
    });
  }
  
  return paddedPoints;
}

/**
 * Test if a point is inside a path
 * @param {Path2D} path - Canvas path
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @returns {boolean} True if point is inside path
 */
export function isPointInPath(path, x, y, ctx) {
  return ctx.isPointInPath(path, x, y);
}

/**
 * Calculate optimal transform to fit nodes in viewport
 * @param {Array} nodes - Array of positioned nodes
 * @param {Object} dimensions - Viewport dimensions {width, height}
 * @param {number} padding - Padding around content
 * @returns {Object} Transform object {scale, translateX, translateY}
 */
export function calculateOptimalTransform(nodes, dimensions, padding = 50) {
  if (!nodes || nodes.length === 0) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }


  // Calculate bounds with node sizes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const node of nodes) {
    const nodeRadius = node.radius || 25; // Default radius if not specified
    minX = Math.min(minX, node.x - nodeRadius);
    minY = Math.min(minY, node.y - nodeRadius);
    maxX = Math.max(maxX, node.x + nodeRadius);
    maxY = Math.max(maxY, node.y + nodeRadius);
  }

  const bounds = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };


  // If bounds are too small, add minimum size
  const MIN_BOUNDS_SIZE = 100;
  if (bounds.width < MIN_BOUNDS_SIZE) {
    const expand = (MIN_BOUNDS_SIZE - bounds.width) / 2;
    bounds.minX -= expand;
    bounds.maxX += expand;
    bounds.width = MIN_BOUNDS_SIZE;
  }
  if (bounds.height < MIN_BOUNDS_SIZE) {
    const expand = (MIN_BOUNDS_SIZE - bounds.height) / 2;
    bounds.minY -= expand;
    bounds.maxY += expand;
    bounds.height = MIN_BOUNDS_SIZE;
  }


  // Calculate scale to fit with padding
  const availableWidth = dimensions.width - 2 * padding;
  const availableHeight = dimensions.height - 2 * padding;
  
  const rawScale = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height
  );
  
  
  // For auto-fit, allow unlimited zoom-out to ensure content always fits
  // Don't clamp to max - let it use whatever scale fits the content
  const scale = Math.max(rawScale, 0.001);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  let optimalTransform = {
    scale,
    translateX: dimensions.width / 2 - centerX * scale,
    translateY: dimensions.height / 2 - centerY * scale,
  };
  
  
  // Safety check: ensure ALL nodes are visible on screen
  const topNodeY = bounds.minY * scale + optimalTransform.translateY;
  const bottomNodeY = bounds.maxY * scale + optimalTransform.translateY;
  const leftNodeX = bounds.minX * scale + optimalTransform.translateX;
  const rightNodeX = bounds.maxX * scale + optimalTransform.translateX;
  
  
  // Fix Y positioning
  if (topNodeY < padding) {
    optimalTransform.translateY = padding - bounds.minY * scale;
  } else if (bottomNodeY > dimensions.height - padding) {
    optimalTransform.translateY = dimensions.height - padding - bounds.maxY * scale;
  }
  
  // Fix X positioning
  if (leftNodeX < padding) {
    optimalTransform.translateX = padding - bounds.minX * scale;
  } else if (rightNodeX > dimensions.width - padding) {
    optimalTransform.translateX = dimensions.width - padding - bounds.maxX * scale;
  }


  return optimalTransform;
}

/**
 * Calculate bounding box of nodes
 * @param {Array} nodes - Array of positioned nodes
 * @returns {Object} Bounds {minX, minY, maxX, maxY, width, height}
 */
export function calculateNodeBounds(nodes) {
  if (!nodes || nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Helper function to draw SVG icon paths on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} iconPath - SVG path string
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Icon size
 * @param {string} color - Icon color
 */
export function drawIcon(ctx, iconPath, x, y, size, color) {
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
}

/**
 * Helper function to draw a chain link icon
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Icon size
 * @param {string} color - Icon color
 */
export function drawChainLinkIcon(ctx, x, y, size, color) {
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
} 