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
  // Load persisted zoom state from localStorage if available
  const getPersistedTransform = useCallback(() => {
    try {
      const saved = localStorage.getItem('chess-canvas-transform');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load persisted zoom state:', e);
    }
    return initialTransform || { scale: 1, translateX: 0, translateY: 0 };
  }, [initialTransform]);

  const [transform, setTransform] = useState(getPersistedTransform);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Persist transform to localStorage whenever it changes
  const persistTransform = useCallback((newTransform) => {
    try {
      localStorage.setItem('chess-canvas-transform', JSON.stringify(newTransform));
    } catch (e) {
      console.warn('Failed to persist zoom state:', e);
    }
  }, []);

  // Wrapped setTransform that also persists to localStorage
  const setTransformWithPersistence = useCallback((newTransform) => {
    const transform = typeof newTransform === 'function' ? newTransform(transformRef.current) : newTransform;
    setTransform(transform);
    persistTransform(transform);
  }, [persistTransform]);
  
  const animationRef = useRef(null);
  
  /**
   * Set zoom level
   * @param {number} scale - New scale value
   */
  const setZoom = useCallback((scale) => {
    const clampedScale = Math.max(ZOOM_CONFIG.MIN, Math.min(ZOOM_CONFIG.MAX, scale));
    setTransformWithPersistence(prev => ({ ...prev, scale: clampedScale }));
  }, [setTransformWithPersistence]);
  
  /**
   * Set pan position
   * @param {number} x - X translation
   * @param {number} y - Y translation
   */
  const setPan = useCallback((x, y) => {
    setTransformWithPersistence(prev => ({ ...prev, translateX: x, translateY: y }));
  }, [setTransformWithPersistence]);
  
  /**
   * Zoom in by scale factor
   */
  const zoomIn = useCallback(() => {
    setTransformWithPersistence(prev => ({
      ...prev,
      scale: Math.min(ZOOM_CONFIG.MAX, prev.scale * ZOOM_CONFIG.SCALE_FACTOR_IN)
    }));
  }, [setTransformWithPersistence]);
  
  /**
   * Zoom out by scale factor
   */
  const zoomOut = useCallback(() => {
    setTransformWithPersistence(prev => ({
      ...prev,
      scale: Math.max(ZOOM_CONFIG.MIN, prev.scale * ZOOM_CONFIG.SCALE_FACTOR)
    }));
  }, [setTransformWithPersistence]);
  
  /**
   * Reset zoom to 1:1
   */
  const resetZoom = useCallback(() => {
    setTransformWithPersistence({ scale: 1, translateX: 0, translateY: 0 });
  }, [setTransformWithPersistence]);
  
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
    
    
    const optimalTransform = calculateOptimalTransform(nodes, dimensions, padding);
    
    
    if (animate) {
      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      const startTransform = transformRef.current; // Use ref here
      const startTime = performance.now();
      const duration = 300; // ms
      const maxDuration = 1000; // Safety timeout to prevent infinite animations
      
      const animateStep = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Safety check - force stop after max duration
        if (elapsed > maxDuration) {
          console.warn('Animation forced to stop after max duration');
          setTransformWithPersistence(optimalTransform);
          animationRef.current = null;
          if (onComplete) {
            onComplete();
          }
          return;
        }
        
        // Check if animation should stop
        if (progress >= 1) {
          // Animation complete - set final transform and clean up
          setTransformWithPersistence(optimalTransform);
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
        
        setTransform(currentTransform); // Don't persist intermediate animation states
        
        // Continue animation
        animationRef.current = requestAnimationFrame(animateStep);
      };
      
      animationRef.current = requestAnimationFrame(animateStep);
    } else {
      setTransformWithPersistence(optimalTransform);
      if (onComplete) {
        onComplete();
      }
    }
  }, [dimensions, setTransformWithPersistence]);
  
  /**
   * Apply zoom at a specific point (like mouse position)
   * @param {Object} point - Point to zoom around {x, y} (in normalized 0-1 coordinates)
   * @param {number} scaleFactor - Scale multiplier
   */
  const zoomAtPoint = useCallback((point, scaleFactor) => {
    const centerX = point.x * dimensions.width;
    const centerY = point.y * dimensions.height;
    
    setTransformWithPersistence(prev => {
      const newScale = Math.max(ZOOM_CONFIG.MIN, Math.min(ZOOM_CONFIG.MAX, prev.scale * scaleFactor));
      const scaleRatio = newScale / prev.scale;
      
      return {
        scale: newScale,
        translateX: centerX - (centerX - prev.translateX) * scaleRatio,
        translateY: centerY - (centerY - prev.translateY) * scaleRatio,
      };
    });
  }, [dimensions, setTransformWithPersistence]);
  
  /**
   * Update transform directly (for external control)
   * @param {Object} newTransform - New transform object
   */
  const updateTransform = useCallback((newTransform) => {
    setTransformWithPersistence(newTransform);
  }, [setTransformWithPersistence]);
  
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