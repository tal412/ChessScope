import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook to manage canvas loading states
 * Handles initialization, auto-fit pending, and canvas opacity transitions
 */
export function useLoadingStates({
  enableAutoFit = true,
  autoFitDelay = 200,
}) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAutoFitPending, setIsAutoFitPending] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [hasValidTransform, setHasValidTransform] = useState(false);
  const [positionedNodes, setPositionedNodes] = useState([]);
  const [isInitialPositioningComplete, setIsInitialPositioningComplete] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const autoFitTimeoutRef = useRef(null);

  /**
   * Set initializing state
   * @param {boolean} initializing - Whether canvas is initializing
   */
  const setInitializingState = useCallback((initializing) => {
    setIsInitializing(initializing);
  }, []);

  /**
   * Set resizing state
   * @param {boolean} resizing - Whether canvas is resizing
   */
  const setResizingState = useCallback((resizing) => {
    setIsResizing(resizing);
  }, []);

  /**
   * Set valid transform state
   * @param {boolean} valid - Whether transform is valid
   */
  const setValidTransform = useCallback((valid) => {
    setHasValidTransform(valid);
  }, []);

  /**
   * Update positioned nodes
   * @param {Array} nodes - Array of positioned nodes
   */
  const updatePositionedNodes = useCallback((nodes) => {
    setPositionedNodes(nodes || []);
  }, []);

  /**
   * Set initial positioning complete
   * @param {boolean} complete - Whether initial positioning is complete
   */
  const setInitialPositioningComplete = useCallback((complete) => {
    setIsInitialPositioningComplete(complete);
  }, []);

  /**
   * Set user interacted state
   * @param {boolean} interacted - Whether user has interacted with canvas
   */
  const setUserInteracted = useCallback((interacted) => {
    setHasUserInteracted(interacted);
  }, []);

  /**
   * Schedule auto-fit with pending state management
   * @param {string} reason - Reason for auto-fit
   * @param {number} delay - Delay in milliseconds
   * @param {Function} fitFunction - Function to call for fitting
   */
  const scheduleAutoFit = useCallback((reason = 'unknown', delay = autoFitDelay, fitFunction = null) => {
    if (!enableAutoFit || !fitFunction) return;

    // Clear existing timeout
    if (autoFitTimeoutRef.current) {
      clearTimeout(autoFitTimeoutRef.current);
      autoFitTimeoutRef.current = null;
    }

    // Set pending state
    setIsAutoFitPending(true);

    // Schedule auto-fit
    autoFitTimeoutRef.current = setTimeout(() => {
      try {
        fitFunction({ bypassInteractionBlocking: true });
        
        // Clear pending state after animation completes
        setTimeout(() => {
          setIsAutoFitPending(false);
        }, 350); // 300ms animation + 50ms buffer
      } catch (error) {
        console.error('Error executing auto-fit:', error);
        setIsAutoFitPending(false);
      }
      
      autoFitTimeoutRef.current = null;
    }, delay);
  }, [enableAutoFit, autoFitDelay]);

  /**
   * Cancel any pending auto-fit
   */
  const cancelAutoFit = useCallback(() => {
    if (autoFitTimeoutRef.current) {
      clearTimeout(autoFitTimeoutRef.current);
      autoFitTimeoutRef.current = null;
    }
    setIsAutoFitPending(false);
  }, []);

  /**
   * Check if canvas should be visible (opacity > 0)
   * @param {Object} dimensions - Canvas dimensions
   * @param {Object} transform - Canvas transform
   * @param {Object} initialTransform - Initial calculated transform
   * @returns {boolean} True if canvas should be visible
   */
  const shouldShowCanvas = useCallback(({ width = 0, height = 0 } = {}, transform = null, initialTransform = null) => {
    // Basic visibility requirements
    const basicRequirements = !(
      isInitializing ||
      positionedNodes.length === 0 ||
      (!isInitialPositioningComplete && positionedNodes.length > 0) ||
      width === 0 ||
      height === 0 ||
      !transform ||
      !hasValidTransform
    );
    
    if (!basicRequirements) {
      return false;
    }
    
    // If user has interacted, always show canvas (no transform matching required)
    if (hasUserInteracted) {
      return true;
    }
    
    // For initial load, check if we have an optimal initial transform
    const hasOptimalInitialTransform = initialTransform && (
      initialTransform.scale !== 1 || 
      initialTransform.translateX !== 0 || 
      initialTransform.translateY !== 0
    );
    
    // If we don't expect an optimal transform, show canvas
    if (!hasOptimalInitialTransform) {
      return true;
    }
    
    // Wait for optimal transform to be applied on initial load
    const transformMatches = transform && (
      Math.abs(transform.scale - initialTransform.scale) < 0.001 &&
      Math.abs(transform.translateX - initialTransform.translateX) < 1 &&
      Math.abs(transform.translateY - initialTransform.translateY) < 1
    );
    
    return transformMatches;
  }, [isInitializing, positionedNodes.length, isInitialPositioningComplete, hasValidTransform, hasUserInteracted]);

  /**
   * Check if initialization overlay should be shown
   * @param {Object} dimensions - Canvas dimensions
   * @param {Object} transform - Canvas transform
   * @param {boolean} isGenerating - Whether currently generating
   * @param {Object} initialTransform - Initial calculated transform
   * @returns {boolean} True if initialization overlay should be shown
   */
  const shouldShowInitializationOverlay = useCallback(({ width = 0, height = 0 } = {}, transform = null, isGenerating = false, initialTransform = null) => {
    return !shouldShowCanvas({ width, height }, transform, initialTransform) && !isGenerating;
  }, [shouldShowCanvas]);

  /**
   * Check if auto-fit overlay should be shown
   * @returns {boolean} True if auto-fit overlay should be shown
   */
  const shouldShowAutoFitOverlay = useCallback(() => {
    return isAutoFitPending && !isInitializing && positionedNodes.length > 0;
  }, [isAutoFitPending, isInitializing, positionedNodes.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoFitTimeoutRef.current) {
        clearTimeout(autoFitTimeoutRef.current);
      }
    };
  }, []);

  // Calculate canvas opacity based on loading states
  // Note: This will be overridden by the actual calculation in ChessCanvas
  const canvasOpacity = 0.3;

  return {
    // State
    isInitializing,
    isAutoFitPending,
    isResizing,
    hasValidTransform,
    positionedNodes,
    isInitialPositioningComplete,

    // Derived state
    canvasOpacity,

    // Setters
    setInitializingState,
    setResizingState,
    setValidTransform,
    updatePositionedNodes,
    setInitialPositioningComplete,
    setUserInteracted,

    // Auto-fit management
    scheduleAutoFit,
    cancelAutoFit,

    // Visibility checks
    shouldShowCanvas,
    shouldShowInitializationOverlay,
    shouldShowAutoFitOverlay,
  };
} 