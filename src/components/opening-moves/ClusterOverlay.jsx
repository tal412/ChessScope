import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Brain,
  Layers,
  Zap
} from 'lucide-react';

// Convex Hull algorithm (Graham Scan)
const convexHull = (points) => {
  if (points.length < 3) return points;
  
  // Find the bottom-most point (and leftmost in case of tie)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[start].y || 
        (points[i].y === points[start].y && points[i].x < points[start].x)) {
      start = i;
    }
  }
  
  // Sort points by polar angle with respect to start point
  const startPoint = points[start];
  const sortedPoints = points.filter((_, i) => i !== start).sort((a, b) => {
    const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
    const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
    if (angleA === angleB) {
      // If angles are equal, sort by distance
      const distA = Math.sqrt((a.x - startPoint.x) ** 2 + (a.y - startPoint.y) ** 2);
      const distB = Math.sqrt((b.x - startPoint.x) ** 2 + (b.y - startPoint.y) ** 2);
      return distA - distB;
    }
    return angleA - angleB;
  });
  
  const hull = [startPoint];
  
  for (const point of sortedPoints) {
    // Remove points that create clockwise turn
    while (hull.length > 1) {
      const p1 = hull[hull.length - 2];
      const p2 = hull[hull.length - 1];
      const cross = (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
      if (cross > 0) break; // Counter-clockwise turn
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
};

// Create smooth path with SAFE curves that won't self-intersect
// Simple convex hull path without smoothing - just wrap the nodes with padding
const createSimplePath = (points, padding = 50) => {
  if (points.length < 3) return '';
  
  // Calculate centroid for consistent padding
  const centroid = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length
  };
  
  // Expand points outward from centroid to ensure all nodes are wrapped
  const paddedPoints = points.map(point => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: point.x + padding, y: point.y };
    
    const factor = (dist + padding) / dist;
    return {
      x: centroid.x + dx * factor,
      y: centroid.y + dy * factor
    };
  });
  
  // Create simple polygon path - no smoothing
  let path = `M ${paddedPoints[0].x} ${paddedPoints[0].y}`;
  
  for (let i = 1; i < paddedPoints.length; i++) {
    path += ` L ${paddedPoints[i].x} ${paddedPoints[i].y}`;
  }
  
  path += ' Z';
  return path;
};

// Create smooth path with safe quadratic curves
const createSmoothPath = (points, padding = 50) => {
  if (points.length < 3) return '';
  
  // Calculate centroid for consistent padding
  const centroid = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length
  };
  
  // Expand points outward from centroid
  const paddedPoints = points.map(point => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: point.x + padding, y: point.y };
    
    const factor = (dist + padding) / dist;
    return {
      x: centroid.x + dx * factor,
      y: centroid.y + dy * factor
    };
  });
  
  // Create smooth path with quadratic curves
  let path = `M ${paddedPoints[0].x} ${paddedPoints[0].y}`;
  
  for (let i = 1; i < paddedPoints.length; i++) {
    const current = paddedPoints[i];
    const next = paddedPoints[(i + 1) % paddedPoints.length];
    
    // Create control point for smooth curve
    const controlX = current.x + (next.x - current.x) * 0.3;
    const controlY = current.y + (next.y - current.y) * 0.3;
    
    path += ` Q ${controlX} ${controlY} ${next.x} ${next.y}`;
  }
  
  path += ' Z';
  return path;
};

// Color based on performance - ENHANCED VIBRANT COLORS (DBSCAN)
const getDBSCANClusterColor = (avgWinRate) => {
  if (avgWinRate >= 70) return '#10b981'; // Emerald - Good (more vibrant green)
  if (avgWinRate >= 60) return '#06b6d4'; // Cyan - Decent (changed from lime to cyan for better contrast)
  if (avgWinRate >= 50) return '#f59e0b'; // Amber - Average (more vibrant yellow/amber)
  if (avgWinRate >= 40) return '#f97316'; // Orange - Below Average (kept vibrant orange)
  return '#dc2626'; // Red - Poor (more vivid red)
};

// K-means specific colors based on cluster type
const getKMeansClusterColor = (clusterLabel, avgWinRate) => {
  // Predefined colors for common cluster types
  switch (clusterLabel) {
    case 'Win-Focused':
      return '#10b981'; // Emerald green for win-focused positions
    case 'Loss-Prone':
      return '#dc2626'; // Red for loss-prone positions
    case 'Draw-Heavy':
      return '#8b5cf6'; // Purple for draw-heavy positions
    case 'Strong':
      return '#10b981'; // Emerald green for strong positions
    case 'Weak':
      return '#dc2626'; // Red for weak positions
    default:
      // Dynamic colors based on performance for k > 3
      if (clusterLabel.includes('Excellence')) return '#10b981'; // Emerald
      if (clusterLabel.includes('Strong')) return '#06b6d4'; // Cyan
      if (clusterLabel.includes('Average')) return '#f59e0b'; // Amber
      if (clusterLabel.includes('Weak')) return '#dc2626'; // Red
      
      // Fallback: performance-based coloring
      if (avgWinRate >= 70) return '#10b981'; // Emerald
      if (avgWinRate >= 60) return '#06b6d4'; // Cyan
      if (avgWinRate >= 50) return '#f59e0b'; // Amber
      if (avgWinRate >= 40) return '#f97316'; // Orange
      return '#dc2626'; // Red
  }
};

// Unified cluster color function
const getClusterColor = (cluster) => {
  if (cluster.type === 'kmeans') {
    return getKMeansClusterColor(cluster.label, cluster.stats.avgWinRate);
  } else {
    return getDBSCANClusterColor(cluster.stats.avgWinRate);
  }
};

// Add secondary colors for enhanced effects
const getClusterSecondaryColor = (cluster) => {
  const primaryColor = getClusterColor(cluster);
  
  if (cluster.type === 'kmeans') {
    switch (cluster.label) {
      case 'Win-Focused':
        return '#065f46'; // Darker emerald
      case 'Loss-Prone':
        return '#991b1b'; // Darker red
      case 'Draw-Heavy':
        return '#5b21b6'; // Darker purple
      case 'Strong':
        return '#065f46'; // Darker emerald
      case 'Weak':
        return '#991b1b'; // Darker red
      default:
        // Dynamic secondary colors
        if (cluster.label.includes('Excellence')) return '#065f46'; // Darker emerald
        if (cluster.label.includes('Strong')) return '#164e63'; // Darker cyan
        if (cluster.label.includes('Average')) return '#92400e'; // Darker amber
        if (cluster.label.includes('Weak')) return '#991b1b'; // Darker red
        
        // Fallback based on performance
        if (cluster.stats.avgWinRate >= 70) return '#065f46';
        if (cluster.stats.avgWinRate >= 60) return '#164e63';
        if (cluster.stats.avgWinRate >= 50) return '#92400e';
        if (cluster.stats.avgWinRate >= 40) return '#9a3412';
        return '#991b1b';
    }
  } else {
    // DBSCAN secondary colors
    if (cluster.stats.avgWinRate >= 70) return '#065f46'; // Darker emerald
    if (cluster.stats.avgWinRate >= 60) return '#164e63'; // Darker cyan  
    if (cluster.stats.avgWinRate >= 50) return '#92400e'; // Darker amber
    if (cluster.stats.avgWinRate >= 40) return '#9a3412'; // Darker orange
    return '#991b1b'; // Darker red
  }
};

// Cluster Zone Visual Component
const ClusterZone = ({ cluster, isVisible, viewport }) => {
  if (!isVisible || !cluster.nodes || cluster.nodes.length === 0) return null;

  // Approximate half of node width/height for centering (node rectangles ~140px)
  const NODE_HALF_DIM = 70; // px

  // Get actual node positions transformed by viewport (use node center)
  const transformedPositions = cluster.nodes.map(node => ({
    x: (node.position.x + NODE_HALF_DIM) * viewport.zoom + viewport.x,
    y: (node.position.y + NODE_HALF_DIM) * viewport.zoom + viewport.y
  }));

  // For single nodes, create a small circle
  if (transformedPositions.length === 1) {
    const pos = transformedPositions[0];
    const radius = 80 * viewport.zoom;
    
    const clusterColor = getClusterColor(cluster);
    
    return (
      <g className="cluster-zone">
        <circle
          cx={pos.x}
          cy={pos.y}
          r={radius}
          fill={clusterColor}
          fillOpacity={0.15}
          stroke={clusterColor}
          strokeWidth={3 * viewport.zoom}
          strokeOpacity={0.8}
          strokeDasharray={`${8 * viewport.zoom},${4 * viewport.zoom}`}
        />
      </g>
    );
  }

  // For pairs, create a connecting shape
  if (transformedPositions.length === 2) {
    const [pos1, pos2] = transformedPositions;
    const padding = 60 * viewport.zoom;
    
    // Create capsule shape connecting the two nodes
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const clusterColor = getClusterColor(cluster);
    
    return (
      <g className="cluster-zone">
        <ellipse
          cx={(pos1.x + pos2.x) / 2}
          cy={(pos1.y + pos2.y) / 2}
          rx={(length / 2) + padding}
          ry={padding}
          transform={`rotate(${(angle * 180) / Math.PI} ${(pos1.x + pos2.x) / 2} ${(pos1.y + pos2.y) / 2})`}
          fill={clusterColor}
          fillOpacity={0.2}
          stroke={clusterColor}
          strokeWidth={3 * viewport.zoom}
          strokeOpacity={0.85}
          strokeDasharray={`${10 * viewport.zoom},${3 * viewport.zoom}`}
        />
      </g>
    );
  }

  // For 3+ nodes, create tightly fitting ellipses using principal axes
  // Calculate true centroid
  const centerX = transformedPositions.reduce((sum, p) => sum + p.x, 0) / transformedPositions.length;
  const centerY = transformedPositions.reduce((sum, p) => sum + p.y, 0) / transformedPositions.length;

  // Covariance matrix
  let sumXX = 0, sumYY = 0, sumXY = 0;
  transformedPositions.forEach(p => {
    const dx = p.x - centerX;
    const dy = p.y - centerY;
    sumXX += dx * dx;
    sumYY += dy * dy;
    sumXY += dx * dy;
  });
  const n = transformedPositions.length;
  const covXX = sumXX / n;
  const covYY = sumYY / n;
  const covXY = sumXY / n;

  // Eigen decomposition
  const trace = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;
  const discriminant = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const eigenVal1 = trace / 2 + discriminant;
  const eigenVal2 = trace / 2 - discriminant;

  // Principal axes (eigenvectors)
  let axis1 = [1, 0], axis2 = [0, 1];
  if (Math.abs(covXY) > 1e-6) {
    axis1 = [eigenVal1 - covYY, covXY];
    const norm1 = Math.hypot(axis1[0], axis1[1]);
    axis1 = [axis1[0] / norm1, axis1[1] / norm1];
    axis2 = [-axis1[1], axis1[0]]; // Perpendicular
  }

  // Project all points onto principal axes and find max projection (for tight fit)
  let maxProj1 = 0, maxProj2 = 0;
  transformedPositions.forEach(p => {
    const dx = p.x - centerX;
    const dy = p.y - centerY;
    const proj1 = Math.abs(dx * axis1[0] + dy * axis1[1]);
    const proj2 = Math.abs(dx * axis2[0] + dy * axis2[1]);
    if (proj1 > maxProj1) maxProj1 = proj1;
    if (proj2 > maxProj2) maxProj2 = proj2;
  });
  const padding = 60 * viewport.zoom;
  const NODE_HALF_SIZE = 80 * viewport.zoom; // half of node diagonal (~140px) plus margin
  const minRadius = 30 * viewport.zoom;
  const radiusX = Math.max(minRadius, maxProj1 + padding + NODE_HALF_SIZE);
  const radiusY = Math.max(minRadius, maxProj2 + padding + NODE_HALF_SIZE);
  // Rotation angle in degrees
  const rotation = Math.atan2(axis1[1], axis1[0]) * (180 / Math.PI);

  const clusterColor = getClusterColor(cluster);
  const clusterSecondaryColor = getClusterSecondaryColor(cluster);

  return (
    <g className="cluster-zone">
      {/* Outer glow effect */}
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={radiusX + 20 * viewport.zoom}
        ry={radiusY + 20 * viewport.zoom}
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
        fill={clusterColor}
        fillOpacity={0.08}
        stroke="none"
        filter={`blur(${4 * viewport.zoom}px)`}
      />
      {/* Main ellipse */}
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={radiusX}
        ry={radiusY}
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
        fill={clusterColor}
        fillOpacity={0.25}
        stroke={clusterColor}
        strokeWidth={3 * viewport.zoom}
        strokeOpacity={0.85}
        strokeDasharray={`${10 * viewport.zoom},${3 * viewport.zoom}`}
        strokeLinecap="round"
      />
      {/* Inner highlight ellipse */}
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={radiusX - 15 * viewport.zoom}
        ry={radiusY - 15 * viewport.zoom}
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
        fill="none"
        stroke={clusterSecondaryColor}
        strokeWidth={1.5 * viewport.zoom}
        strokeOpacity={0.6}
        strokeDasharray={`${6 * viewport.zoom},${2 * viewport.zoom}`}
      />
      {/* Enhanced inner glow */}
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={radiusX}
        ry={radiusY}
        transform={`rotate(${rotation} ${centerX} ${centerY})`}
        fill="none"
        stroke={clusterColor}
        strokeWidth={2 * viewport.zoom}
        strokeOpacity={0.4}
        filter={`blur(${3 * viewport.zoom}px)`}
      />
    </g>
  );
};

// Cluster Insights Panel
const ClusterInsightsPanel = ({ clusterAnalysis, position = 'top-right' }) => {
  if (!clusterAnalysis || clusterAnalysis.clusters.length === 0) {
    return null;
  }

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const getPerformanceIcon = (avgWinRate) => {
    if (avgWinRate >= 70) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (avgWinRate >= 50) return <BarChart3 className="w-4 h-4 text-yellow-400" />;
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50 max-w-md`}>
      <Card className="bg-slate-800/95 border-slate-700 backdrop-blur-lg shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">AI Pattern Analysis</h3>
          </div>
          
          {/* Overall insights */}
          <div className="space-y-1 mb-4">
            {clusterAnalysis.insights.slice(0, 2).map((insight, i) => (
              <div key={i} className="text-xs text-slate-300">
                {insight}
              </div>
            ))}
          </div>
          
          {/* Cluster summary */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Patterns Found:</span>
              <Badge variant="secondary" className="bg-slate-700">
                {clusterAnalysis.clusters.length}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Positions Analyzed:</span>
              <Badge variant="secondary" className="bg-slate-700">
                {clusterAnalysis.metadata.totalNodes}
              </Badge>
            </div>
          </div>
          
          {/* Top clusters */}
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Key Patterns
            </h4>
            
            {clusterAnalysis.clusters
              .sort((a, b) => b.stats.totalGames - a.stats.totalGames)
              .slice(0, 3)
              .map((cluster, i) => (
                <div key={cluster.id} className="flex items-center gap-3 p-2 rounded bg-slate-700/50">
                  <div className="flex items-center gap-2">
                    {getPerformanceIcon(cluster.stats.avgWinRate)}
                    <span className="text-xs font-medium text-white">
                      {cluster.type === 'kmeans' && cluster.label ? cluster.label : `Pattern ${cluster.id + 1}`}
                    </span>
                  </div>
                  
                  <div className="flex-1 text-xs text-slate-300">
                    {cluster.stats.avgWinRate.toFixed(0)}% • {cluster.stats.totalGames}g
                  </div>
                  
                  <Badge 
                    variant="outline" 
                    className="text-xs border-slate-600"
                  >
                    {cluster.nodes.length} pos
                  </Badge>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Cluster Overlay Component
const ClusterOverlay = ({ 
  clusterAnalysis, 
  zoom, 
  showClusters = true, 
  showInsights = true,
  zoomThreshold = 0.5,
  insightsPosition = 'top-right',
  viewport
}) => {
  // Show clusters with consistent high opacity at all zoom levels
  const overlayOpacity = useMemo(() => {
    if (!showClusters || !clusterAnalysis) return 0;
    
    // Always maintain MAXIMUM visibility regardless of zoom level
    return 1.0; // MAXIMUM opacity at all zoom levels
  }, [showClusters, clusterAnalysis]);
  
  if (!clusterAnalysis || !showClusters || overlayOpacity === 0) {
    return showInsights && zoom < zoomThreshold ? (
      <ClusterInsightsPanel 
        clusterAnalysis={clusterAnalysis} 
        position={insightsPosition}
      />
    ) : null;
  }

  // Show all clusters (including single-node clusters)
  const visibleClusters = clusterAnalysis.clusters;

  return (
    <>
      {/* SVG Overlay for cluster zones */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        {/* Clean cluster zones without labels */}
        {visibleClusters.map(cluster => (
          <ClusterZone
            key={cluster.id}
            cluster={cluster}
            isVisible={showClusters}
            viewport={viewport}
          />
        ))}
        
        {/* Subtle connection lines between related clusters (only when zoomed out) */}
        {zoom < zoomThreshold && clusterAnalysis.clusters.map((cluster, i) => 
          clusterAnalysis.clusters.slice(i + 1).map((otherCluster, j) => {
            // Only connect clusters with similar opening families
            const isSimilar = cluster.stats.topOpeningFamily === otherCluster.stats.topOpeningFamily &&
                             Math.abs(cluster.stats.avgWinRate - otherCluster.stats.avgWinRate) < 15;
            
            if (!isSimilar) return null;
            
            // Transform line coordinates
            const x1 = cluster.centroid.x * viewport.zoom + viewport.x;
            const y1 = cluster.centroid.y * viewport.zoom + viewport.y;
            const x2 = otherCluster.centroid.x * viewport.zoom + viewport.x;
            const y2 = otherCluster.centroid.y * viewport.zoom + viewport.y;
            
            return (
              <line
                key={`connection-${i}-${j}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#64748b"
                strokeWidth={2.5 * viewport.zoom}
                strokeOpacity={overlayOpacity * 0.7}
                strokeDasharray={`${6 * viewport.zoom},${4 * viewport.zoom}`}
              />
            );
          })
        )}
      </svg>
      
      {/* Insights Panel - only when zoomed out */}
      {showInsights && zoom < zoomThreshold && (
        <ClusterInsightsPanel 
          clusterAnalysis={clusterAnalysis} 
          position={insightsPosition}
        />
      )}
    </>
  );
};

export default ClusterOverlay; 