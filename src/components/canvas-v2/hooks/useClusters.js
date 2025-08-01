import { useState, useCallback, useMemo, useEffect } from 'react';
import { createConvexHull, createSmoothPath } from '../utils/geometry.js';
import { CLUSTER_COLORS, CLUSTER_CONFIG } from '../constants.js';

/**
 * Hook for managing clusters (opening and position clusters)
 * @param {Object} options - Initial cluster options
 * @param {Array} options.openingClusters - Initial opening clusters
 * @param {Array} options.positionClusters - Initial position clusters
 * @returns {Object} Cluster state and controls
 */
export function useClusters(options = {}) {
  const { openingClusters: initialOpeningClusters = [], positionClusters: initialPositionClusters = [] } = options;
  
  const [openingClusters, setOpeningClusters] = useState(initialOpeningClusters);
  const [positionClusters, setPositionClusters] = useState(initialPositionClusters);
  const [showOpeningClusters, setShowOpeningClusters] = useState(true);
  const [showPositionClusters, setShowPositionClusters] = useState(true);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [hoveredOpeningName, setHoveredOpeningName] = useState(null);
  const [hoveredClusterColor, setHoveredClusterColor] = useState(null);
  
  // Sync external cluster data with internal state
  useEffect(() => {
    if (initialOpeningClusters.length > 0) {
      setOpeningClusters(initialOpeningClusters);
    }
  }, [initialOpeningClusters]);
  
  useEffect(() => {
    if (initialPositionClusters.length > 0) {
      setPositionClusters(initialPositionClusters);
    }
  }, [initialPositionClusters]);
  
  /**
   * Update opening clusters
   * @param {Array} clusters - Array of cluster objects
   */
  const updateOpeningClusters = useCallback((clusters) => {
    setOpeningClusters(clusters || []);
  }, []);
  
  /**
   * Update position clusters
   * @param {Array} clusters - Array of cluster objects
   */
  const updatePositionClusters = useCallback((clusters) => {
    setPositionClusters(clusters || []);
  }, []);
  
  /**
   * Toggle opening clusters visibility
   */
  const toggleOpeningClusters = useCallback(() => {
    setShowOpeningClusters(prev => !prev);
  }, []);
  
  /**
   * Toggle position clusters visibility
   */
  const togglePositionClusters = useCallback(() => {
    setShowPositionClusters(prev => !prev);
  }, []);
  
  /**
   * Set hovered cluster
   * @param {Object} cluster - Cluster object or null
   */
  const setHoveredClusterState = useCallback((cluster) => {
    setHoveredCluster(cluster);
  }, []);
  
  /**
   * Clear hovered cluster
   */
  const clearHoveredCluster = useCallback(() => {
    setHoveredCluster(null);
    setHoveredOpeningName(null);
    setHoveredClusterColor(null);
  }, []);
  
  /**
   * Handle cluster hover with name and color
   * @param {string} clusterName - Name of the cluster
   * @param {Object} clusterColor - Color object with bg, border, text
   */
  const handleClusterHover = useCallback((clusterName, clusterColor) => {
    setHoveredOpeningName(clusterName);
    setHoveredClusterColor(clusterColor);
  }, []);
  
  /**
   * Handle cluster hover end
   */
  const handleClusterHoverEnd = useCallback(() => {
    setHoveredOpeningName(null);
    setHoveredClusterColor(null);
  }, []);
  
  /**
   * Generate cluster paths for rendering and hit testing
   */
  const clusterPaths = useMemo(() => {
    const paths = [];
    
    // Process opening clusters
    if (showOpeningClusters) {
      openingClusters.forEach((cluster, index) => {
        if (!cluster.nodes || cluster.nodes.length < CLUSTER_CONFIG.MIN_NODES_FOR_CLUSTER) {
          return;
        }
        
        const points = cluster.nodes.map(node => ({ x: node.x, y: node.y }));
        const hull = createConvexHull(points);
        const path = createSmoothPath(hull, CLUSTER_CONFIG.CONVEX_HULL_PADDING);
        
        const colorIndex = index % CLUSTER_COLORS.opening.length;
        const colors = CLUSTER_COLORS.opening[colorIndex];
        
        paths.push({
          type: 'opening',
          cluster,
          path,
          colors,
          isHovered: hoveredCluster?.type === 'opening' && hoveredCluster?.cluster === cluster
        });
      });
    }
    
    // Process position clusters
    if (showPositionClusters) {
      positionClusters.forEach((cluster, index) => {
        if (!cluster.nodes || cluster.nodes.length < CLUSTER_CONFIG.MIN_NODES_FOR_CLUSTER) {
          return;
        }
        
        const points = cluster.nodes.map(node => ({ x: node.x, y: node.y }));
        const hull = createConvexHull(points);
        const path = createSmoothPath(hull, CLUSTER_CONFIG.CONVEX_HULL_PADDING);
        
        const colorIndex = index % CLUSTER_COLORS.position.length;
        const colors = CLUSTER_COLORS.position[colorIndex];
        
        paths.push({
          type: 'position',
          cluster,
          path,
          colors,
          isHovered: hoveredCluster?.type === 'position' && hoveredCluster?.cluster === cluster
        });
      });
    }
    
    return paths;
  }, [openingClusters, positionClusters, showOpeningClusters, showPositionClusters, hoveredCluster]);
  
  /**
   * Find cluster at point
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {CanvasRenderingContext2D} ctx - Canvas context for hit testing
   * @returns {Object|null} Cluster object or null
   */
  const findClusterAtPoint = useCallback((x, y, ctx) => {
    // Test in reverse order (top clusters first)
    for (let i = clusterPaths.length - 1; i >= 0; i--) {
      const clusterPath = clusterPaths[i];
      if (ctx.isPointInPath(clusterPath.path, x, y)) {
        return {
          type: clusterPath.type,
          cluster: clusterPath.cluster,
          colors: clusterPath.colors
        };
      }
    }
    return null;
  }, [clusterPaths]);
  
  /**
   * Get cluster statistics
   */
  const clusterStats = useMemo(() => {
    return {
      opening: {
        total: openingClusters.length,
        visible: showOpeningClusters ? openingClusters.length : 0,
        nodeCount: openingClusters.reduce((sum, cluster) => sum + (cluster.nodes?.length || 0), 0)
      },
      position: {
        total: positionClusters.length,
        visible: showPositionClusters ? positionClusters.length : 0,
        nodeCount: positionClusters.reduce((sum, cluster) => sum + (cluster.nodes?.length || 0), 0)
      }
    };
  }, [openingClusters, positionClusters, showOpeningClusters, showPositionClusters]);
  
  return {
    // State
    openingClusters,
    positionClusters,
    showOpeningClusters,
    showPositionClusters,
    hoveredCluster,
    hoveredOpeningName,
    hoveredClusterColor,
    clusterPaths,
    clusterStats,
    
    // Update functions
    updateOpeningClusters,
    updatePositionClusters,
    
    // Visibility controls
    toggleOpeningClusters,
    togglePositionClusters,
    
    // Hover controls
    setHoveredCluster: setHoveredClusterState,
    clearHoveredCluster,
    handleClusterHover,
    handleClusterHoverEnd,
    
    // Utility functions
    findClusterAtPoint,
  };
} 