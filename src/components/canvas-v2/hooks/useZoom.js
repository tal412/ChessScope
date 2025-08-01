import React, { useState, useCallback, useRef } from 'react';
import { ZOOM_CONFIG } from '../constants.js';
import { calculateOptimalTransform } from '../utils/geometry.js';

/**
 * Hook for managing canvas zoom and pan
 * @param {Object} dimensions - Canvas dimensions {width, height}
 * @param {Object} initialTransform - Initial transform to avoid visual jumps
 * @returns {Object} Zoom state and controls
 */
export function useZoom(dimensions = { width: 800, height: 600 }, initialTransform = null) {
  const [transform, setTransform] = useState(
    initialTransform || { scale: 1, translateX: 0, translateY: 0 }
  );
  
  const animationRef = useRef(null);
  const hasAppliedInitialTransform = useRef(false);
  
  // Update transform when initial transform changes (for proper initialization)
  React.useEffect(() => {
    if (initialTransform && !hasAppliedInitialTransform.current && (
      initialTransform.scale !== transform.scale ||
      initialTransform.translateX !== transform.translateX ||
      initialTransform.translateY !== transform.translateY
    )) {
      // Only update if we're not just going from default to default
      const isFromDefault = transform.scale === 1 && transform.translateX === 0 && transform.translateY === 0;
      const isToDefault = initialTransform.scale === 1 && initialTransform.translateX === 0 && initialTransform.translateY === 0;
      
      if (!(isFromDefault && isToDefault)) {
        console.log('🔄 useZoom updating transform (initial only):', { from: transform, to: initialTransform });
        setTransform(initialTransform);
        hasAppliedInitialTransform.current = true;
      }
    }
  }, [initialTransform]);
  
  /**
   * Set zoom level
   * @param {number} scale - New scale value
   */
  const setZoom = useCallback((scale) => {
    const clampedScale = Math.max(ZOOM_CONFIG.MIN, Math.min(ZOOM_CONFIG.MAX, scale));
    setTransform(prev => ({ ...prev, scale: clampedScale }));
  }, []);
  
  /**
   * Set pan position
   * @param {number} x - X translation
   * @param {number} y - Y translation
   */
  const setPan = useCallback((x, y) => {
    setTransform(prev => ({ ...prev, translateX: x, translateY: y }));
  }, []);
  
  /**
   * Zoom in by scale factor
   */
  const zoomIn = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(ZOOM_CONFIG.MAX, prev.scale * ZOOM_CONFIG.SCALE_FACTOR_IN)
    }));
  }, []);
  
  /**
   * Zoom out by scale factor
   */
  const zoomOut = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(ZOOM_CONFIG.MIN, prev.scale * ZOOM_CONFIG.SCALE_FACTOR)
    }));
  }, []);
  
  /**
   * Reset zoom to 1:1
   */
  const resetZoom = useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);
  
  /**
   * Fit nodes to viewport with animation
   * @param {Array} nodes - Array of positioned nodes
   * @param {Object} options - Animation options
   */
  const fitToNodes = useCallback((nodes, options = {}) => {
    if (!nodes || nodes.length === 0) {
      console.warn('🔄 fitToNodes: No nodes provided');
      return;
    }
    
    if (!dimensions.width || !dimensions.height) {
      console.warn('🔄 fitToNodes: Invalid dimensions', dimensions);
      return;
    }
    
    const { animate = true, padding = ZOOM_CONFIG.AUTO_FIT_PADDING, onComplete } = options;
    
    console.log('🔄 fitToNodes called:', {
      nodeCount: nodes.length,
      dimensions,
      padding,
      animate,
      firstNode: nodes[0] ? { x: nodes[0].x, y: nodes[0].y, radius: nodes[0].radius } : null
    });
    
    const optimalTransform = calculateOptimalTransform(nodes, dimensions, padding);
    
    console.log('🔄 Calculated optimal transform:', optimalTransform);
    
    if (animate) {
      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      const startTransform = transform;
      const startTime = performance.now();
      const duration = 300; // ms
      const maxDuration = 1000; // Safety timeout to prevent infinite animations
      
      const animateStep = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Safety check - force stop after max duration
        if (elapsed > maxDuration) {
          console.warn('Animation forced to stop after max duration');
          setTransform(optimalTransform);
          animationRef.current = null;
          if (onComplete) {
            onComplete();
          }
          return;
        }
        
        // Check if animation should stop
        if (progress >= 1) {
          // Animation complete - set final transform and clean up
          setTransform(optimalTransform);
          animationRef.current = null;
          if (onComplete) {
            onComplete();
          }
          return;
        }
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const currentTransform = {
          scale: startTransform.scale + (optimalTransform.scale - startTransform.scale) * easeOut,
          translateX: startTransform.translateX + (optimalTransform.translateX - startTransform.translateX) * easeOut,
          translateY: startTransform.translateY + (optimalTransform.translateY - startTransform.translateY) * easeOut,
        };
        
        setTransform(currentTransform);
        
        // Continue animation
        animationRef.current = requestAnimationFrame(animateStep);
      };
      
      animationRef.current = requestAnimationFrame(animateStep);
    } else {
      setTransform(optimalTransform);
      if (onComplete) {
        onComplete();
      }
    }
  }, [dimensions, transform]);
  
  /**
   * Apply zoom at a specific point (like mouse position)
   * @param {Object} point - Point to zoom around {x, y} (in normalized 0-1 coordinates)
   * @param {number} scaleFactor - Scale multiplier
   */
  const zoomAtPoint = useCallback((point, scaleFactor) => {
    const centerX = point.x * dimensions.width;
    const centerY = point.y * dimensions.height;
    
    setTransform(prev => {
      const newScale = Math.max(ZOOM_CONFIG.MIN, Math.min(ZOOM_CONFIG.MAX, prev.scale * scaleFactor));
      const scaleRatio = newScale / prev.scale;
      
      return {
        scale: newScale,
        translateX: centerX - (centerX - prev.translateX) * scaleRatio,
        translateY: centerY - (centerY - prev.translateY) * scaleRatio,
      };
    });
  }, [dimensions]);
  
  /**
   * Update transform directly (for external control)
   * @param {Object} newTransform - New transform object
   */
  const updateTransform = useCallback((newTransform) => {
    setTransform(newTransform);
  }, []);
  
  /**
   * Check if currently animating
   */
  const isAnimating = useCallback(() => {
    return animationRef.current !== null;
  }, []);
  
  /**
   * Cancel any ongoing animation
   */
  const cancelAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);
  
  return {
    // State
    transform,
    scale: transform.scale,
    translateX: transform.translateX,
    translateY: transform.translateY,
    
    // Basic controls
    setZoom,
    setPan,
    zoomIn,
    zoomOut,
    resetZoom,
    
    // Advanced controls
    fitToNodes,
    zoomAtPoint,
    updateTransform,
    
    // Animation controls
    isAnimating,
    cancelAnimation,
  };
} 