import { useCallback, useEffect, useRef } from 'react';
import { 
  RENDER_CONFIG, 
  CANVAS_CONFIG, 
  OPENING_CLUSTER_COLORS, 
  POSITION_CLUSTER_COLORS,
  SHADOW_CONFIG,
  CLUSTER_CONFIG
} from '../constants.js';
import { 
  getPerformanceData, 
  getOpeningNodeColor, 
  createConvexHull, 
  createSmoothPath,
  hexToRgb,
  drawIcon,
  drawChainLinkIcon
} from '../utils.js';

/**
 * Hook for managing canvas rendering
 */
export const useCanvasRendering = ({
  canvasRef,
  dimensions,
  transform,
  hasValidTransform,
  positionedNodes,
  isInitialPositioningComplete,
  optimalTransformRef,
  currentPositionedNodesRef,
  graphData,
  mode,
  currentNodeId,
  hoveredNextMoveNodeId,
  hoveredNode,
  hoveredCluster,
  openingClusters,
  positionClusters,
  showOpeningClusters,
  showPositionClusters,
  enableOpeningClusters,
}) => {
  const animationRef = useRef();

  // Canvas rendering function - HIGH DPI SUPPORT
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = dimensions;
    
    // Don't render if we don't have valid dimensions yet
    if (width <= 0 || height <= 0) {
      return;
    }
    
    // Don't render until we have a valid transform from initial calculation
    if (!hasValidTransform) {
      return;
    }
    
    // Use refs during initial positioning to prevent flash, then use state for interactions
    const activeTransform = (!isInitialPositioningComplete && optimalTransformRef.current) 
      ? optimalTransformRef.current 
      : transform;
    const activeNodes = (!isInitialPositioningComplete && currentPositionedNodesRef.current.length > 0) 
      ? currentPositionedNodesRef.current 
      : positionedNodes;
    
    // Don't render anything if we don't have a proper transform yet
    if (!activeTransform) {
      return;
    }
    
    const { x: offsetX, y: offsetY, scale } = activeTransform;

    // HIGH DPI SUPPORT - Properly handle device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;

    // Canvas sizing with proper DPI scaling
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
      // Scale the context to match device pixel ratio
      ctx.scale(dpr, dpr);
    }
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = RENDER_CONFIG.HIGH_DPI_QUALITY;

    // Clear canvas
    ctx.fillStyle = RENDER_CONFIG.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Apply transform
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Render position clusters
    if (showPositionClusters && positionClusters.length > 0) {
      positionClusters.forEach((cluster, index) => {
        if (!cluster.allNodes || cluster.allNodes.length === 0) return;

        const clusterNodes = cluster.allNodes.map(n => 
          activeNodes.find(pn => pn.id === n.id)
        ).filter(Boolean);

        if (clusterNodes.length === 0) return;

        // Create node center points for convex hull
        const nodePoints = clusterNodes.map(node => ({
          x: node.x,
          y: node.y
        }));

        const clusterColor = POSITION_CLUSTER_COLORS[index % POSITION_CLUSTER_COLORS.length];
        
        // Create convex hull and render organic shape
        const hull = createConvexHull(nodePoints);
        
        const rgb = hexToRgb(clusterColor.bg);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${CLUSTER_CONFIG.FILL_OPACITY.POSITION})`;
        ctx.strokeStyle = clusterColor.border;
        ctx.lineWidth = CLUSTER_CONFIG.STROKE_WIDTH.NORMAL;
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 10;
        
        createSmoothPath(ctx, hull, CLUSTER_CONFIG.PADDING.TWO_NODES);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Render opening clusters
    if (enableOpeningClusters && showOpeningClusters && openingClusters.length > 0) {
      openingClusters.forEach((cluster, index) => {
        if (!cluster.nodes || cluster.nodes.length === 0) return;

        const clusterNodes = cluster.nodes.map(n => 
          activeNodes.find(pn => pn.id === n.id)
        ).filter(Boolean);

        if (clusterNodes.length === 0) return;

        // Create node center points for convex hull
        const nodePoints = clusterNodes.map(node => ({
          x: node.x,
          y: node.y
        }));

        // Create convex hull and render organic shape
        const hull = createConvexHull(nodePoints);
        
        const isHovered = hoveredCluster && hoveredCluster.id === cluster.id;
        
        const clusterColor = OPENING_CLUSTER_COLORS[cluster.colorIndex % OPENING_CLUSTER_COLORS.length];
        
        const rgb = hexToRgb(clusterColor.bg);
        const fillOpacity = isHovered ? CLUSTER_CONFIG.FILL_OPACITY.HOVERED : CLUSTER_CONFIG.FILL_OPACITY.NORMAL;
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillOpacity})`;
        ctx.strokeStyle = clusterColor.border;
        ctx.lineWidth = isHovered ? CLUSTER_CONFIG.STROKE_WIDTH.HOVERED : CLUSTER_CONFIG.STROKE_WIDTH.NORMAL;
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 10;
        
        createSmoothPath(ctx, hull, CANVAS_CONFIG.CLUSTER_PADDING);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Render edges
    if (graphData.edges) {
      graphData.edges.forEach(edge => {
        const source = activeNodes.find(n => n.id === edge.source);
        const target = activeNodes.find(n => n.id === edge.target);
        
        if (!source || !target) return;

        if (mode === 'opening') {
          // Opening mode edge rendering
          const isMainLine = source.data.isMainLine && target.data.isMainLine;
          
          ctx.strokeStyle = isMainLine ? '#8b5cf6' : '#64748b';
          ctx.lineWidth = isMainLine ? 3 : 2;
          ctx.lineCap = 'round';
          ctx.globalAlpha = isMainLine ? 1 : 0.7;
          ctx.setLineDash(isMainLine ? [] : [5, 5]);
          
          ctx.beginPath();
          ctx.moveTo(source.x, source.y + source.height/2);
          ctx.lineTo(target.x, target.y - target.height/2);
          ctx.stroke();
          
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else {
          // Performance mode edge rendering
          const perfData = getPerformanceData(edge.data?.winRate || 0, edge.data?.gameCount || 0, edge.data?.isMissing);
          const thickness = Math.max(
            RENDER_CONFIG.EDGE_THICKNESS.MIN, 
            Math.min(
              RENDER_CONFIG.EDGE_THICKNESS.MAX, 
              RENDER_CONFIG.EDGE_THICKNESS.BASE + ((edge.data?.gameCount || 0) / RENDER_CONFIG.EDGE_THICKNESS.GAME_COUNT_DIVISOR)
            )
          );

          ctx.strokeStyle = perfData.border;
          ctx.lineWidth = thickness;
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.8;
          
          ctx.beginPath();
          ctx.moveTo(source.x, source.y + source.height/2);
          ctx.lineTo(target.x, target.y - target.height/2);
          ctx.stroke();
          
          ctx.globalAlpha = 1;
        }
      });
    }

    // Render nodes
    if (activeNodes.length > 0) {
      let renderedNodeCount = 0;
      
      activeNodes.forEach(node => {
        // Check if node is potentially visible before expensive rendering
        const screenX = (node.x * activeTransform.scale) + activeTransform.x;
        const screenY = (node.y * activeTransform.scale) + activeTransform.y;
        const nodeSize = 140 * activeTransform.scale;
        
        // Skip rendering nodes that are completely off-screen for performance
        if (screenX < -nodeSize*2 || screenX > width + nodeSize*2 ||
            screenY < -nodeSize*2 || screenY > height + nodeSize*2) {
          return;
        }
        
        renderedNodeCount++;

        // Mode-specific rendering
        if (mode === 'opening') {
          renderOpeningNode(ctx, node, currentNodeId, hoveredNextMoveNodeId, hoveredNode);
        } else {
          renderPerformanceNode(ctx, node, currentNodeId, hoveredNextMoveNodeId, hoveredNode);
        }
      });
    }

    ctx.restore();
  }, [
    canvasRef,
    dimensions,
    transform,
    hasValidTransform,
    positionedNodes,
    isInitialPositioningComplete,
    optimalTransformRef,
    currentPositionedNodesRef,
    graphData,
    mode,
    currentNodeId,
    hoveredNextMoveNodeId,
    hoveredNode,
    hoveredCluster,
    openingClusters,
    positionClusters,
    showOpeningClusters,
    showPositionClusters,
    enableOpeningClusters
  ]);

  // Render opening mode node
  const renderOpeningNode = useCallback((ctx, node, currentNodeId, hoveredNextMoveNodeId, hoveredNode) => {
    const isCurrentNode = node.id === currentNodeId;
    const isHoveredNextMove = node.id === hoveredNextMoveNodeId;
    const isHovered = hoveredNode?.id === node.id;
    const nodeColor = getOpeningNodeColor(node, isCurrentNode);
    
    const x = node.x - node.width/2;
    const y = node.y - node.height/2;

    // Node background with proper styling
    ctx.fillStyle = nodeColor.bg;
    ctx.strokeStyle = nodeColor.border;
    ctx.lineWidth = isCurrentNode || isHoveredNextMove ? 8 : (isHovered ? 6 : 4);
    
    // Apply glow effects
    if (isCurrentNode) {
      const glowColor = node.data.isInitialMove ? SHADOW_CONFIG.INITIAL_MOVE_COLOR : SHADOW_CONFIG.SELECTED_COLOR;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = SHADOW_CONFIG.BLUR;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw multiple layers for intense glow
      for (let i = 0; i < SHADOW_CONFIG.LAYERS; i++) {
        ctx.beginPath();
        ctx.roundRect(x, y, node.width, node.height, CLUSTER_CONFIG.CORNER_RADIUS);
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
        ctx.roundRect(x, y, node.width, node.height, CLUSTER_CONFIG.CORNER_RADIUS);
        ctx.fill();
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (node.data.isInitialMove) {
      ctx.beginPath();
      ctx.roundRect(x, y, node.width, node.height, CLUSTER_CONFIG.CORNER_RADIUS);
      ctx.fill();
      
      ctx.strokeStyle = '#f97316'; // Orange-500
      ctx.lineWidth = 6;
      ctx.stroke();
      
      ctx.strokeStyle = nodeColor.border;
      ctx.lineWidth = 4;
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y, node.width, node.height, CLUSTER_CONFIG.CORNER_RADIUS);
      ctx.fill();
      ctx.stroke();
    }
    
    // Text rendering for opening mode
    renderOpeningNodeText(ctx, node, nodeColor);
  }, []);

  // Render performance mode node
  const renderPerformanceNode = useCallback((ctx, node, currentNodeId, hoveredNextMoveNodeId, hoveredNode) => {
    const perfData = getPerformanceData(node.data.winRate || 0, node.data.gameCount || 0, node.data.isMissing);
    const isCurrentNode = node.id === currentNodeId;
    const isHoveredNextMove = node.id === hoveredNextMoveNodeId;
    const isHovered = hoveredNode?.id === node.id;
    
    const x = node.x - node.width/2;
    const y = node.y - node.height/2;

    ctx.fillStyle = perfData.bg;
    ctx.strokeStyle = perfData.border;
    ctx.lineWidth = isCurrentNode || isHoveredNextMove ? 8 : (isHovered ? 6 : 4);
    
    // Apply glow effects
    if (isCurrentNode) {
      ctx.shadowColor = SHADOW_CONFIG.SELECTED_COLOR;
      ctx.shadowBlur = SHADOW_CONFIG.INTENSE_BLUR;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      for (let i = 0; i < SHADOW_CONFIG.LAYERS; i++) {
        ctx.beginPath();
        ctx.roundRect(x, y, node.width, node.height, CLUSTER_CONFIG.CORNER_RADIUS);
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
        ctx.roundRect(x, y, node.width, node.height, CLUSTER_CONFIG.CORNER_RADIUS);
        ctx.fill();
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y, node.width, node.height, CLUSTER_CONFIG.CORNER_RADIUS);
      ctx.fill();
      ctx.stroke();
    }
    
    // Text rendering for performance mode
    renderPerformanceNodeText(ctx, node, perfData);
  }, []);

  // Render opening node text
  const renderOpeningNodeText = useCallback((ctx, node, nodeColor) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textColor = nodeColor.text;
    
    // Text stroke for better readability
    const isBlackText = textColor === '#000000' || textColor === '#000';
    ctx.strokeStyle = isBlackText ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = isBlackText ? RENDER_CONFIG.TEXT_STROKE_WIDTH.BLACK_TEXT : RENDER_CONFIG.TEXT_STROKE_WIDTH.WHITE_TEXT;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const centerX = node.x;
    const centerY = node.y;
    
    if (node.data.isRoot) {
      ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.ROOT_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
      ctx.fillStyle = textColor;
      ctx.strokeText('START', centerX, centerY);
      ctx.fillText('START', centerX, centerY);
    } else {
      ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.MOVE_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
      ctx.fillStyle = textColor;
      ctx.strokeText(node.data.label || node.data.san || '?', centerX, centerY);
      ctx.fillText(node.data.label || node.data.san || '?', centerX, centerY);
      
      // Show arrow color circles
      renderArrowIndicators(ctx, node, centerX, centerY);
      
      // Show annotation indicators
      renderAnnotationIndicators(ctx, node, nodeColor, centerX, centerY);
    }
  }, []);

  // Render performance node text
  const renderPerformanceNodeText = useCallback((ctx, node, perfData) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    
    const textColor = perfData.text;
    const isBlackText = textColor === '#000000' || textColor === '#000';
    ctx.strokeStyle = isBlackText ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = isBlackText ? RENDER_CONFIG.TEXT_STROKE_WIDTH.BLACK_TEXT : RENDER_CONFIG.TEXT_STROKE_WIDTH.WHITE_TEXT;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const centerX = node.x;
    const centerY = node.y;

    if (node.data.isRoot) {
      ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_ROOT_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
      ctx.fillStyle = textColor;
      ctx.strokeText('START', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_LABEL_Y);
      ctx.fillText('START', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_LABEL_Y);
      
      ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.GAME_COUNT}px ${RENDER_CONFIG.FONT_FAMILY}`;
      const gameCountText = node.data.gameCount === null || node.data.gameCount === undefined 
        ? '0 games' 
        : `${node.data.gameCount} games`;
      ctx.strokeText(gameCountText, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_GAME_COUNT_Y);
      ctx.fillText(gameCountText, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_ROOT_GAME_COUNT_Y);
    } else {
      ctx.font = `bold ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_MOVE_LABEL}px ${RENDER_CONFIG.FONT_FAMILY}`;
      ctx.fillStyle = textColor;
      ctx.strokeText(node.data.san || '?', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_MOVE_LABEL_Y);
      ctx.fillText(node.data.san || '?', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_MOVE_LABEL_Y);
      
      if (node.data.isMissing) {
        ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_NO_DATA}px ${RENDER_CONFIG.FONT_FAMILY}`;
        ctx.strokeText('No Data', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_NO_DATA_Y);
        ctx.fillText('No Data', centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_NO_DATA_Y);
      } else {
        const winRate = Math.round(node.data.winRate || 0);
        ctx.font = `600 ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_WIN_RATE}px ${RENDER_CONFIG.FONT_FAMILY}`;
        ctx.strokeText(`${winRate}%`, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_WIN_RATE_Y);
        ctx.fillText(`${winRate}%`, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_WIN_RATE_Y);
        
        ctx.font = `500 ${RENDER_CONFIG.FONT_SIZES.PERFORMANCE_GAME_COUNT}px ${RENDER_CONFIG.FONT_FAMILY}`;
        const gameCountShort = node.data.gameCount === null || node.data.gameCount === undefined 
          ? '0g' 
          : `${node.data.gameCount}g`;
        ctx.strokeText(gameCountShort, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_GAME_COUNT_Y);
        ctx.fillText(gameCountShort, centerX, centerY + RENDER_CONFIG.OFFSETS.PERFORMANCE_GAME_COUNT_Y);
      }
    }
  }, []);

  // Render arrow indicators
  const renderArrowIndicators = useCallback((ctx, node, centerX, centerY) => {
    const arrows = node.data.arrows || [];
    if (arrows.length === 0) return;

    const uniqueColors = [...new Set(arrows.map(arrow => arrow.color))];
    const circleSize = RENDER_CONFIG.ICON_SIZES.ARROW;
    const circleSpacing = RENDER_CONFIG.SPACING.ARROW_CIRCLE;
    const totalWidth = (uniqueColors.length - 1) * circleSpacing;
    let circleX = centerX - totalWidth / 2;
    const circleY = centerY + RENDER_CONFIG.OFFSETS.ARROW_Y;
    
    uniqueColors.forEach((color, index) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      
      circleX += circleSpacing;
    });
  }, []);

  // Render annotation indicators
  const renderAnnotationIndicators = useCallback((ctx, node, nodeColor, centerX, centerY) => {
    const hasComment = node.data.hasComment;
    const hasLinks = node.data.hasLinks && node.data.linkCount > 0;
    
    if (!hasComment && !hasLinks) return;

    ctx.save();
    
    const iconSize = RENDER_CONFIG.ICON_SIZES.ANNOTATION;
    const iconSpacing = RENDER_CONFIG.SPACING.ANNOTATION_ICON;
    const totalWidth = (hasComment && hasLinks) ? iconSpacing : 0;
    let iconX = centerX - totalWidth / 2;
    const iconY = centerY + RENDER_CONFIG.OFFSETS.ANNOTATION_Y;
    
    const nodeBackgroundColor = nodeColor.bg;
    const iconColor = nodeBackgroundColor === '#ffffff' ? '#000000' : '#ffffff';
    
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;
    
    if (hasComment) {
      const messageSquarePath = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
      drawIcon(ctx, messageSquarePath, iconX, iconY, iconSize, iconColor);
      iconX += iconSpacing;
    }
    
    if (hasLinks) {
      drawChainLinkIcon(ctx, iconX, iconY, iconSize, iconColor);
    }
    
    ctx.restore();
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  return {
    render,
    cleanup,
    animationRef
  };
}; 