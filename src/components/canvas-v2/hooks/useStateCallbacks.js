import { useCallback, useRef, useEffect } from 'react';

/**
 * Hook to manage state change callbacks
 * Provides callbacks to notify parent components about canvas state changes
 */
export function useStateCallbacks({
  onResizeStateChange = null,
  onInitializingStateChange = null,
  onAutoFitComplete = null,
}) {
  const resizeStateRef = useRef(null);
  const initializingStateRef = useRef(null);

  /**
   * Handle resize state change
   * @param {boolean} isResizing - Whether canvas is currently resizing
   * @param {string} resizeSource - Source of the resize (optional)
   */
  const handleResizeStateChange = useCallback((isResizing, resizeSource = 'unknown') => {
    if (resizeStateRef.current !== isResizing) {
      resizeStateRef.current = isResizing;
      if (onResizeStateChange) {
        onResizeStateChange(isResizing, resizeSource);
      }
    }
  }, [onResizeStateChange]);

  /**
   * Handle initializing state change
   * @param {boolean} isInitializing - Whether canvas is currently initializing
   */
  const handleInitializingStateChange = useCallback((isInitializing) => {
    if (initializingStateRef.current !== isInitializing) {
      initializingStateRef.current = isInitializing;
      if (onInitializingStateChange) {
        onInitializingStateChange(isInitializing);
      }
    }
  }, [onInitializingStateChange]);

  /**
   * Handle auto-fit completion
   */
  const handleAutoFitComplete = useCallback(() => {
    if (onAutoFitComplete) {
      onAutoFitComplete();
    }
  }, [onAutoFitComplete]);

  /**
   * Trigger auto-fit completion after a delay (for animations)
   * @param {number} delay - Delay in milliseconds
   */
  const triggerAutoFitComplete = useCallback((delay = 350) => {
    setTimeout(() => {
      handleAutoFitComplete();
    }, delay);
  }, [handleAutoFitComplete]);

  return {
    handleResizeStateChange,
    handleInitializingStateChange,
    handleAutoFitComplete,
    triggerAutoFitComplete,
  };
} 