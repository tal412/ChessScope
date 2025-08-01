import { useState, useCallback, useRef } from 'react';

/**
 * Hook to manage canvas interaction blocking
 * Prevents user interactions during loading, resizing, or other operations
 */
export function useInteractionBlocking({
  isInitializing = false,
  isResizing = false,
  isAutoFitPending = false,
  isResizeProcessActive = false,
  isGenerating = false,
}) {
  const [mousePressed, setMousePressed] = useState(false);
  const [cursorStyle, setCursorStyle] = useState('default');
  const isDraggingRef = useRef(false);

  /**
   * Check if canvas interactions should be blocked
   * @returns {boolean} True if interactions should be blocked
   */
  const isCanvasInteractionBlocked = useCallback(() => {
    return isInitializing || isResizing || isAutoFitPending || isResizeProcessActive || isGenerating;
  }, [isInitializing, isResizing, isAutoFitPending, isResizeProcessActive, isGenerating]);

  /**
   * Check if canvas cursor should be blocked (not-allowed)
   * @returns {boolean} True if cursor should show as blocked
   */
  const isCanvasCursorBlocked = useCallback(() => {
    return isCanvasInteractionBlocked();
  }, [isCanvasInteractionBlocked]);

  /**
   * Get the current cursor style
   * @returns {string} CSS cursor style
   */
  const getCurrentCursor = useCallback(() => {
    if (isCanvasCursorBlocked()) {
      return 'not-allowed';
    }
    if (mousePressed || isDraggingRef.current) {
      return 'grabbing';
    }
    return cursorStyle;
  }, [isCanvasCursorBlocked, mousePressed, cursorStyle]);

  /**
   * Set mouse pressed state
   * @param {boolean} pressed - Whether mouse is pressed
   */
  const setMousePressedState = useCallback((pressed) => {
    setMousePressed(pressed);
  }, []);

  /**
   * Set cursor style
   * @param {string} style - CSS cursor style
   */
  const setCursorStyleState = useCallback((style) => {
    setCursorStyle(style);
  }, []);

  /**
   * Set dragging state
   * @param {boolean} dragging - Whether currently dragging
   */
  const setDragging = useCallback((dragging) => {
    isDraggingRef.current = dragging;
  }, []);

  return {
    // State
    mousePressed,
    cursorStyle,
    isDraggingRef,

    // Functions
    isCanvasInteractionBlocked,
    isCanvasCursorBlocked,
    getCurrentCursor,
    setMousePressed: setMousePressedState,
    setCursorStyle: setCursorStyleState,
    setDragging,
  };
} 