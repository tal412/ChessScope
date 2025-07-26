import { useCallback, useRef } from 'react';
import { CANVAS_CONFIG } from '../constants.js';
import { calculateOptimalTransform } from '../utils.js';

/**
 * Hook for managing canvas transform and zoom functionality
 */
export const useCanvasTransform = (
  dimensions, 
  positionClusters, 
  isCanvasInteractionBlocked, 
  isResizing, 
  isInitializing,
  setTransform,
  currentTransformRef,
  positionedNodesRef
) => {
  const animationStateRef = useRef(null);

  // Unified zoom function that can handle different targets
  const zoomTo = useCallback((target = 'all', options = {}) => {
    // Block zoom during initialization, but allow autofit to bypass interaction blocking
    if (isCanvasInteractionBlocked() && !options.bypassInteractionBlocking) {
      return;
    }
    
    // Prevent zoom during resize transitions or initialization, but allow autofit to bypass
    if ((isResizing || isInitializing) && !options.bypassInteractionBlocking) {
      return;
    }
    
    // Cancel any existing animation
    if (animationStateRef.current) {
      cancelAnimationFrame(animationStateRef.current);
      animationStateRef.current = null;
    }
    
    // Determine if this is an autofit operation (from resize) or manual zoom
    const isAutoFitOperation = options.isAutoFit === true;

    let targetNodes = [];
    let logMessage = '';

    // Use refs to access current state without causing dependency issues
    const currentPositionedNodes = positionedNodesRef.current;
    const currentPositionClusters = positionClusters;

    switch (target) {
      case 'all':
        targetNodes = currentPositionedNodes;
        logMessage = 'ZOOM TO ALL NODES';
        break;
      
      case 'clusters':
        // Get all nodes that are part of position clusters
        if (currentPositionClusters && currentPositionClusters.length > 0) {
          currentPositionClusters.forEach(cluster => {
            if (cluster.allNodes) {
              cluster.allNodes.forEach(node => {
                const positionedNode = currentPositionedNodes.find(pn => pn.id === node.id);
                if (positionedNode) {
                  targetNodes.push(positionedNode);
                }
              });
            }
          });
        }
        
        // If no cluster nodes, fall back to all nodes
        if (targetNodes.length === 0) {
          targetNodes = currentPositionedNodes;
          logMessage = 'ZOOM TO ALL NODES (FALLBACK)';
        } else {
          logMessage = 'ZOOM TO POSITION CLUSTERS';
        }
        break;
      
      case 'reset':
        // Reset to default position with animation
        targetNodes = currentPositionedNodes;
        logMessage = 'ZOOM RESET TO DEFAULT';
        // Use a special transform for reset
        const resetOptimalTransform = { x: 0, y: 0, scale: 1 };
        
        // Apply reset transform with smooth animation
        const resetStartTransform = { ...(currentTransformRef.current || { x: 0, y: 0, scale: 1 }) };
        const resetStartTime = Date.now();
        const resetDuration = CANVAS_CONFIG.ANIMATION_DURATION;
        
        const resetAnimate = () => {
          const elapsed = Date.now() - resetStartTime;
          const progress = Math.min(elapsed / resetDuration, 1);
          
          // Use easing function for smoother animation
          const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          
          const newTransform = {
            x: resetStartTransform.x + (resetOptimalTransform.x - resetStartTransform.x) * easeProgress,
            y: resetStartTransform.y + (resetOptimalTransform.y - resetStartTransform.y) * easeProgress,
            scale: resetStartTransform.scale + (resetOptimalTransform.scale - resetStartTransform.scale) * easeProgress
          };
          
          setTransform(newTransform);
          
          if (progress < 1) {
            animationStateRef.current = requestAnimationFrame(resetAnimate);
          } else {
            animationStateRef.current = null;
          }
        };
        
        // Start reset animation immediately
        animationStateRef.current = requestAnimationFrame(resetAnimate);
        return;
      
      default:
        // If target is an array of nodes, use it directly
        if (Array.isArray(target)) {
          if (target.length > 0 && typeof target[0] === 'string') {
            targetNodes = currentPositionedNodes.filter(pn => target.includes(pn.id));
            logMessage = `ZOOM TO ${targetNodes.length} TARGET NODES BY ID`;
          } else {
            targetNodes = target;
            logMessage = `ZOOM TO ${target.length} CUSTOM NODES`;
          }
        } else {
          targetNodes = currentPositionedNodes;
          logMessage = 'ZOOM TO ALL NODES (DEFAULT)';
        }
    }

    // Handle empty target nodes
    if (targetNodes.length === 0) {
      // Defer state updates to prevent setState during render
      requestAnimationFrame(() => {
        setTransform({ x: 0, y: 0, scale: 1 });
      });
      return;
    }

    // Calculate optimal transform for target nodes
    const clusterPadding = (target === 'clusters' && currentPositionClusters.length > 0) ? 120 : CANVAS_CONFIG.DEFAULT_PADDING;
    const optimalTransform = calculateOptimalTransform(targetNodes, dimensions, clusterPadding);

    // Apply transform with smooth animation
    const startTransform = { ...(currentTransformRef.current || { x: 0, y: 0, scale: 1 }) };
    const startTime = Date.now();
    const duration = CANVAS_CONFIG.ANIMATION_DURATION;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easing function for smoother animation
      const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      
      const newTransform = {
        x: startTransform.x + (optimalTransform.x - startTransform.x) * easeProgress,
        y: startTransform.y + (optimalTransform.y - startTransform.y) * easeProgress,
        scale: startTransform.scale + (optimalTransform.scale - startTransform.scale) * easeProgress
      };
      
      setTransform(newTransform);
      
      if (progress < 1) {
        animationStateRef.current = requestAnimationFrame(animate);
      } else {
        animationStateRef.current = null;
      }
    };
    
    // Start animation immediately
    animationStateRef.current = requestAnimationFrame(animate);
  }, [dimensions, isResizing, isInitializing, positionClusters, isCanvasInteractionBlocked, setTransform, currentTransformRef, positionedNodesRef]);

  // Convenience functions for backward compatibility and cleaner API
  const fitView = useCallback((options = {}) => zoomTo('all', { ...options, isAutoFit: options.isAutoFit === true }), [zoomTo]);
  const zoomToClusters = useCallback((options = {}) => zoomTo('clusters', { ...options, isAutoFit: false }), [zoomTo]);

  // Update transform with manual pan/zoom
  const updateTransform = useCallback((updates) => {
    setTransform(prev => {
      const newTransform = { ...prev, ...updates };
      return newTransform;
    });
  }, [setTransform]);

  // Apply zoom at specific point
  const applyZoom = useCallback((scaleFactor, mouseX, mouseY, currentTransform) => {
    const newScale = Math.min(Math.max(currentTransform.scale * scaleFactor, CANVAS_CONFIG.ZOOM_LIMITS.MIN), CANVAS_CONFIG.ZOOM_LIMITS.MAX);
    
    const newTransform = {
      x: mouseX - (mouseX - currentTransform.x) * (newScale / currentTransform.scale),
      y: mouseY - (mouseY - currentTransform.y) * (newScale / currentTransform.scale),
      scale: newScale
    };
    
    setTransform(newTransform);
  }, [setTransform]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationStateRef.current) {
      cancelAnimationFrame(animationStateRef.current);
      animationStateRef.current = null;
    }
  }, []);

  return {
    zoomTo,
    fitView,
    zoomToClusters,
    updateTransform,
    applyZoom,
    cleanup,
    animationStateRef
  };
}; 