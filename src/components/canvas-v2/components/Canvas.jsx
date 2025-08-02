import React, { useRef, useEffect, useCallback } from 'react';
import { CANVAS_CONFIG, RENDER_CONFIG, CLUSTER_CONFIG, SHADOW_CONFIG } from '../constants.js';
import { getPerformanceColors, getOpeningNodeColors, hexToRgba } from '../utils/colors.js';
import { drawIcon, drawChainLinkIcon, createConvexHull } from '../utils/geometry.js';

/**
 * Render performance node text with proper fonts and positioning
 */
function renderPerformanceNodeText(ctx, node, centerX, centerY) {
  const colors = getPerformanceColors(node.data || {});
  const textColor = colors.text;
  
  // Set up text stroke for readability (matching v1)
  const isBlackText = textColor === '#000000' || textColor === '#000';
  ctx.strokeStyle = isBlackText ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = isBlackText ? RENDER_CONFIG.TEXT_STROKE_WIDTH.BLACK_TEXT : RENDER_CONFIG.TEXT_STROKE_WIDTH.WHITE_TEXT;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (node.data?.isRoot) {
    // Root node rendering
    ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_ROOT_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
    ctx.fillStyle = textColor;
    ctx.strokeText('START', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_LABEL_Y);
    ctx.fillText('START', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_LABEL_Y);
    
    // Game count
    ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.GAME_COUNT}px ${RENDER_CONFIG.FONT_FAMILY}`;
    const gameCountText = node.data?.gameCount ? `${node.data.gameCount} games` : '';
    if (gameCountText) {
      ctx.strokeText(gameCountText, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_GAME_COUNT_Y);
      ctx.fillText(gameCountText, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_GAME_COUNT_Y);
    }
  } else if (node.data?.isMissing) {
    // Missing data node
    ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_MOVE_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
    ctx.fillStyle = '#6b7280'; // gray-500
    ctx.strokeText(node.data.san || '?', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_MOVE_LABEL_Y);
    ctx.fillText(node.data.san || '?', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_MOVE_LABEL_Y);
    
    ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_NO_DATA}px ${RENDER_CONFIG.FONT_FAMILY}`;
    ctx.strokeText('No Data', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_NO_DATA_Y);
    ctx.fillText('No Data', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_NO_DATA_Y);
  } else {
    // Regular performance node
    ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_MOVE_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
    ctx.fillStyle = textColor;
    ctx.strokeText(node.data.san || '?', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_MOVE_LABEL_Y);
    ctx.fillText(node.data.san || '?', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_MOVE_LABEL_Y);
    
    // Win rate
    if (typeof node.data?.winRate === 'number') {
      const winRate = Math.round(node.data.winRate);
      ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_WIN_RATE}px ${RENDER_CONFIG.FONT_FAMILY}`;
      ctx.strokeText(`${winRate}%`, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_WIN_RATE_Y);
      ctx.fillText(`${winRate}%`, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_WIN_RATE_Y);
    }
    
    // Game count
    if (node.data?.gameCount) {
      ctx.font = `500 ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_GAME_COUNT}px ${RENDER_CONFIG.FONT_FAMILY}`;
      const gameCountShort = node.data.gameCount >= 1000 
        ? `${Math.round(node.data.gameCount / 1000)}k` 
        : node.data.gameCount.toString();
      ctx.strokeText(gameCountShort, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_GAME_COUNT_Y);
      ctx.fillText(gameCountShort, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_GAME_COUNT_Y);
    }
  }
}

/**
 * Render opening node text
 */
function renderOpeningNodeText(ctx, node, centerX, centerY) {
  const colors = getOpeningNodeColors(node.data || {});
  const textColor = colors.text;
  
  // Set up text stroke for readability (matching v1)
  const isBlackText = textColor === '#000000' || textColor === '#000';
  ctx.strokeStyle = isBlackText ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = isBlackText ? RENDER_CONFIG.TEXT_STROKE_WIDTH.BLACK_TEXT : RENDER_CONFIG.TEXT_STROKE_WIDTH.WHITE_TEXT;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (node.data?.isRoot) {
    ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.ROOT_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
    ctx.fillStyle = textColor;
    ctx.strokeText('START', centerX, centerY);
    ctx.fillText('START', centerX, centerY);
    
    if (node.data?.gameCount) {
      ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.GAME_COUNT}px ${RENDER_CONFIG.FONT_FAMILY}`;
      const gameCountText = `${node.data.gameCount} games`;
      ctx.strokeText(gameCountText, centerX, centerY + RENDER_CONFIG.OFFSETS.ROOT_GAME_COUNT_Y);
      ctx.fillText(gameCountText, centerX, centerY + RENDER_CONFIG.OFFSETS.ROOT_GAME_COUNT_Y);
    }
  } else {
    ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.MOVE_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
    ctx.fillStyle = textColor;
    ctx.strokeText(node.data?.san || '?', centerX, centerY);
    ctx.fillText(node.data?.san || '?', centerX, centerY);
    
    if (node.data?.gameCount) {
      ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.GAME_COUNT}px ${RENDER_CONFIG.FONT_FAMILY}`;
      const gameCountShort = node.data.gameCount >= 1000 
        ? `${Math.round(node.data.gameCount / 1000)}k` 
        : node.data.gameCount.toString();
      ctx.strokeText(gameCountShort, centerX, centerY + RENDER_CONFIG.OFFSETS.GAME_COUNT_Y);
      ctx.fillText(gameCountShort, centerX, centerY + RENDER_CONFIG.OFFSETS.GAME_COUNT_Y);
    }
  }
}

/**
 * Draw arrow icons for nodes with arrows
 */
function drawArrowIcons(ctx, centerX, centerY, arrows) {
  const circleSize = RENDER_CONFIG.ICON_SIZES.ARROW;
  const circleSpacing = RENDER_CONFIG.SPACING.ARROW_CIRCLE;
  const startX = centerX - ((arrows.length - 1) * circleSpacing) / 2;
  const circleY = centerY + RENDER_CONFIG.OFFSETS.ARROW_Y;
  
  arrows.forEach((arrow, index) => {
    const circleX = startX + index * circleSpacing;
    
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleSize / 2, 0, 2 * Math.PI);
    ctx.fillStyle = arrow.color || '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/**
 * Draw annotation icons for nodes with annotations
 */
function drawAnnotationIcons(ctx, centerX, centerY, annotations) {
  const iconSize = RENDER_CONFIG.ICON_SIZES.ANNOTATION;
  const iconSpacing = RENDER_CONFIG.SPACING.ANNOTATION_ICON;
  const startX = centerX - ((annotations.length - 1) * iconSpacing) / 2;
  const iconY = centerY + RENDER_CONFIG.OFFSETS.ANNOTATION_Y;
  
  annotations.forEach((annotation, index) => {
    const iconX = startX + index * iconSpacing;
    
    // Draw icon based on annotation type
    if (annotation.type === 'link') {
      drawChainLinkIcon(ctx, iconX, iconY, iconSize, '#60a5fa');
    } else {
      drawIcon(ctx, annotation.icon, iconX, iconY, iconSize, '#60a5fa');
    }
  });
}

/**
 * Core Canvas component - handles only rendering
 * @param {Object} props - Component props
 */
export function Canvas({
  // Data
  graphData = { nodes: [], edges: [] },
  
  // Transform
  transform = { scale: 1, translateX: 0, translateY: 0 },
  
  // Current state
  currentNodeId = null,
  hoveredNodeId = null,
  hoveredNextMoveNodeId = null,
  selectedNodeId = null,
  
  // Clusters
  openingClusters = [],
  positionClusters = [],
  showOpeningClusters = false,
  showPositionClusters = false,
  hoveredOpeningName = null,
  hoveredClusterColor = null,
  
  // Mode
  mode = 'performance', // 'performance' | 'opening'
  
  // Dimensions
  width = 800,
  height = 600,
  
  // Event handlers
  onCanvasReady = null,
  
  // Additional props
  className = '',
}) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  
  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    contextRef.current = ctx;
    
    // Set up high-DPI support
    const devicePixelRatio = RENDER_CONFIG.DEVICE_PIXEL_RATIO;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    // Notify parent that canvas is ready
    if (onCanvasReady) {
      onCanvasReady(canvas, ctx);
    }
  }, [width, height, onCanvasReady]);
  
    // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    // Debug logging
    // if (graphData.nodes.length > 0) {
    //   console.log('🎨 Canvas render called:', {
    //     nodeCount: graphData.nodes.length,
    //     width,
    //     height,
    //     transform: `scale: ${transform.scale}, translate: (${transform.translateX}, ${transform.translateY})`,
    //     firstNode: {
    //       id: graphData.nodes[0]?.id,
    //       x: graphData.nodes[0]?.x,
    //       y: graphData.nodes[0]?.y,
    //       radius: graphData.nodes[0]?.radius
    //     }
    //   });
    // }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Save context and apply transform (translate first, then scale - order matters!)
    ctx.save();
    ctx.translate(transform.translateX, transform.translateY);
    ctx.scale(transform.scale, transform.scale);
    
    // Render clusters first (behind nodes)
    renderClusters(ctx);
    
    // Render edges
    renderEdges(ctx);
    
    // Render nodes
    renderNodes(ctx);
    
    // Restore context
    ctx.restore();
  }, [transform, graphData.nodes, graphData.edges, currentNodeId, hoveredNodeId, hoveredNextMoveNodeId, selectedNodeId, mode, width, height, showOpeningClusters, showPositionClusters, openingClusters, positionClusters]);
  
  // Render clusters
  const renderClusters = useCallback((ctx) => {
    // Render opening clusters
    if (showOpeningClusters && openingClusters.length > 0) {
      openingClusters.forEach((cluster, index) => {
        if (!cluster.nodes || cluster.nodes.length === 0) return;

        const clusterNodes = cluster.nodes.map(n => 
          graphData.nodes.find(pn => pn.id === n.id)
        ).filter(Boolean);

        if (clusterNodes.length === 0) return;

        const nodePoints = clusterNodes.map(node => ({ x: node.x, y: node.y }));
        
                 // Opening clusters are all purple
         const colors = { bg: '#8b5cf650', border: '#8b5cf6', text: '#8b5cf6' };

        // Create cluster path
        let clusterPath = new Path2D();
        if (nodePoints.length === 1) {
          // Single node cluster - draw a circle around it
          const node = nodePoints[0];
          const padding = 30;
          clusterPath.arc(node.x, node.y, padding, 0, 2 * Math.PI);
        } else if (nodePoints.length === 2) {
          // Two node cluster - draw rectangle around them
          const padding = 25;
          const minX = Math.min(nodePoints[0].x, nodePoints[1].x) - padding;
          const maxX = Math.max(nodePoints[0].x, nodePoints[1].x) + padding;
          const minY = Math.min(nodePoints[0].y, nodePoints[1].y) - padding;
          const maxY = Math.max(nodePoints[0].y, nodePoints[1].y) + padding;
          
          clusterPath.rect(minX, minY, maxX - minX, maxY - minY);
        } else {
          // Multiple nodes - create convex hull
          const hull = createConvexHull(nodePoints);
          const centroid = {
            x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
            y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length
          };
          
          const padding = 40;
          const expandedHull = hull.map(point => {
            const dx = point.x - centroid.x;
            const dy = point.y - centroid.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist === 0) {
              return { x: point.x + padding, y: point.y + padding };
            }
            
            const factor = (dist + padding) / dist;
            return {
              x: centroid.x + dx * factor,
              y: centroid.y + dy * factor
            };
          });

          if (expandedHull.length > 0) {
            clusterPath.moveTo(expandedHull[0].x, expandedHull[0].y);
            for (let i = 1; i < expandedHull.length; i++) {
              clusterPath.lineTo(expandedHull[i].x, expandedHull[i].y);
            }
            clusterPath.closePath();
          }
        }

        // Draw cluster background
        ctx.save();
        ctx.fillStyle = colors.bg;
        ctx.fill(clusterPath);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        ctx.stroke(clusterPath);
        ctx.restore();

        // Draw cluster label if available
        if (cluster.name) {
          const centerX = nodePoints.reduce((sum, p) => sum + p.x, 0) / nodePoints.length;
          const centerY = nodePoints.reduce((sum, p) => sum + p.y, 0) / nodePoints.length;
          
          ctx.save();
          ctx.fillStyle = colors.text;
          ctx.font = `bold 14px ${RENDER_CONFIG.FONT_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cluster.name, centerX, centerY - 60);
          ctx.restore();
        }
      });
    }

         // Render position clusters
     if (showPositionClusters && positionClusters.length > 0) {
       positionClusters.forEach((cluster, index) => {
         // Position clusters use 'allNodes' property from createPositionClusters
         const nodeArray = cluster.allNodes || cluster.nodes || [];
         if (nodeArray.length === 0) return;

         const clusterNodes = nodeArray.map(n => 
           graphData.nodes.find(pn => pn.id === n.id)
         ).filter(Boolean);

        if (clusterNodes.length === 0) return;

        const nodePoints = clusterNodes.map(node => ({ x: node.x, y: node.y }));
        
                 // Position clusters are all orange
         const colors = { bg: '#f59e0b50', border: '#f59e0b', text: '#f59e0b' };

                 // Create cluster path (same tight logic as opening clusters)
         let clusterPath = new Path2D();
         if (nodePoints.length === 1) {
           // Single node cluster - draw a circle around it
           const node = nodePoints[0];
           const padding = 30;
           clusterPath.arc(node.x, node.y, padding, 0, 2 * Math.PI);
         } else if (nodePoints.length === 2) {
           // Two node cluster - draw rectangle around them
           const padding = 25;
           const minX = Math.min(nodePoints[0].x, nodePoints[1].x) - padding;
           const maxX = Math.max(nodePoints[0].x, nodePoints[1].x) + padding;
           const minY = Math.min(nodePoints[0].y, nodePoints[1].y) - padding;
           const maxY = Math.max(nodePoints[0].y, nodePoints[1].y) + padding;
           
           clusterPath.rect(minX, minY, maxX - minX, maxY - minY);
         } else {
           // Multiple nodes - create convex hull (same as opening clusters)
           const hull = createConvexHull(nodePoints);
           const centroid = {
             x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
             y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length
           };
           
           const padding = 40;
           const expandedHull = hull.map(point => {
             const dx = point.x - centroid.x;
             const dy = point.y - centroid.y;
             const dist = Math.sqrt(dx * dx + dy * dy);
             
             if (dist === 0) {
               return { x: point.x + padding, y: point.y + padding };
             }
             
             const factor = (dist + padding) / dist;
             return {
               x: centroid.x + dx * factor,
               y: centroid.y + dy * factor
             };
           });

           if (expandedHull.length > 0) {
             clusterPath.moveTo(expandedHull[0].x, expandedHull[0].y);
             for (let i = 1; i < expandedHull.length; i++) {
               clusterPath.lineTo(expandedHull[i].x, expandedHull[i].y);
             }
             clusterPath.closePath();
           }
         }

        // Draw position cluster background
        ctx.save();
        ctx.fillStyle = colors.bg;
        ctx.fill(clusterPath);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]); // Dashed line for position clusters
        ctx.stroke(clusterPath);
        ctx.restore();

      });
    }
  }, [openingClusters, positionClusters, showOpeningClusters, showPositionClusters, graphData.nodes]);
  
  // Render edges
  const renderEdges = useCallback((ctx) => {
    graphData.edges.forEach(edge => {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;
      
      if (mode === 'opening') {
        // Opening mode edge rendering
        const isMainLine = edge.data?.isMainLine || false;
        
        ctx.strokeStyle = isMainLine ? '#ffffff' : '#6b7280';
        ctx.lineWidth = isMainLine ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.globalAlpha = isMainLine ? 1 : 0.7;
        ctx.setLineDash(isMainLine ? [] : [5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else {
        // Performance mode edge rendering
        const perfData = getPerformanceColors(edge.data?.winRate || 0, edge.data?.gameCount || 0, edge.data?.isMissing);
        const thickness = Math.max(
          RENDER_CONFIG.EDGE_THICKNESS.MIN, 
          Math.min(
            RENDER_CONFIG.EDGE_THICKNESS.MAX, 
            RENDER_CONFIG.EDGE_THICKNESS.BASE + ((edge.data?.gameCount || 0) / RENDER_CONFIG.EDGE_THICKNESS.GAME_COUNT_DIVISOR)
          )
        );

        ctx.strokeStyle = perfData.border || perfData.stroke || '#374151';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.8;
        
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.stroke();
        
        ctx.globalAlpha = 1;
      }
    });
  }, [graphData.nodes, graphData.edges, mode]);
  
  // Render nodes
  const renderNodes = useCallback((ctx) => {
    // console.log('🔵 renderNodes called with', graphData.nodes.length, 'nodes');
    graphData.nodes.forEach((node, index) => {
      const { x, y, radius } = node;
      
      // if (index === 0) {
      //   console.log('🔵 First node render:', { x, y, radius, id: node.id });
      // }
      
      if (x === undefined || y === undefined || radius === undefined) {
        console.warn('🔵 Node missing coordinates:', { id: node.id, x, y, radius });
        return;
      }
      
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeId === node.id;
      const isHoveredNextMove = hoveredNextMoveNodeId === node.id;
      const isCurrent = currentNodeId === node.id;

      // Get colors
      const colors = mode === 'performance' 
        ? getPerformanceColors(node.data || {})
        : getOpeningNodeColors(node.data || {});

      // Calculate node rectangle bounds (matching v1)
      const nodeX = x - CANVAS_CONFIG.NODE_HALF_SIZE;
      const nodeY = y - CANVAS_CONFIG.NODE_HALF_SIZE;
      const nodeWidth = CANVAS_CONFIG.NODE_SIZE;
      const nodeHeight = CANVAS_CONFIG.NODE_SIZE;

      ctx.fillStyle = colors.fill || colors.bg;
      ctx.strokeStyle = colors.stroke || colors.border;
      ctx.lineWidth = isSelected || isCurrent || isHoveredNextMove ? 8 : (isHovered ? 6 : 4);
      
      // Apply glow effects (matching v1)
      if (isSelected || isCurrent) {
        const glowColor = node.data?.isInitialMove ? SHADOW_CONFIG.INITIAL_MOVE_COLOR : SHADOW_CONFIG.SELECTED_COLOR;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = SHADOW_CONFIG.BLUR;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw multiple layers for intense glow
        for (let i = 0; i < SHADOW_CONFIG.LAYERS; i++) {
          ctx.beginPath();
          ctx.roundRect(nodeX, nodeY, nodeWidth, nodeHeight, CLUSTER_CONFIG.CORNER_RADIUS);
          ctx.fill();
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (isHoveredNextMove) {
        ctx.shadowColor = SHADOW_CONFIG.HOVERED_NEXT_MOVE_COLOR;
        ctx.shadowBlur = SHADOW_CONFIG.BLUR;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        for (let i = 0; i < SHADOW_CONFIG.LAYERS; i++) {
          ctx.beginPath();
          ctx.roundRect(nodeX, nodeY, nodeWidth, nodeHeight, CLUSTER_CONFIG.CORNER_RADIUS);
          ctx.fill();
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (node.data?.isInitialMove) {
        ctx.beginPath();
        ctx.roundRect(nodeX, nodeY, nodeWidth, nodeHeight, CLUSTER_CONFIG.CORNER_RADIUS);
        ctx.fill();
        
        ctx.strokeStyle = '#f97316'; // Orange-500
        ctx.lineWidth = 6;
        ctx.stroke();
        
        ctx.strokeStyle = colors.stroke || colors.border;
        ctx.lineWidth = 4;
      } else {
        ctx.beginPath();
        ctx.roundRect(nodeX, nodeY, nodeWidth, nodeHeight, CLUSTER_CONFIG.CORNER_RADIUS);
        ctx.fill();
        ctx.stroke();
      }

      // Advanced text rendering based on node type and mode
      ctx.save();
      const centerX = x;
      const centerY = y;
      
      if (mode === 'performance') {
        renderPerformanceNodeText(ctx, node, centerX, centerY);
      } else {
        renderOpeningNodeText(ctx, node, centerX, centerY);
      }
      
      // Draw icons if present
      if (node.data?.arrows && node.data.arrows.length > 0) {
        drawArrowIcons(ctx, centerX, centerY, node.data.arrows);
      }
      
      if (node.data?.annotations && node.data.annotations.length > 0) {
        drawAnnotationIcons(ctx, centerX, centerY, node.data.annotations);
      }
      
      ctx.restore();
    });
  }, [graphData.nodes, currentNodeId, hoveredNodeId, hoveredNextMoveNodeId, selectedNodeId, mode]);
  
  // Re-render when dependencies change
  useEffect(() => {
    render();
  }, [render]);
  
  return (
    <canvas
      ref={canvasRef}
      className={`block ${className}`}
    />
  );
} 