import { useCallback, useEffect } from 'react';
import { CANVAS_CONFIG, KEYBOARD_SHORTCUTS, MOUSE_BUTTONS } from '../constants.js';
import { isPointInPath } from '../utils.js';

/**
 * Hook for managing canvas events (mouse, keyboard, touch)
 */
export const useCanvasEvents = ({
  canvasRef,
  dimensions,
  transform,
  positionedNodes,
  isInitialPositioningComplete,
  optimalTransformRef,
  currentPositionedNodesRef,
  clusterPathsData,
  enableOpeningClusters,
  showOpeningClusters,
  contextMenuActions,
  isDraggingRef,
  lastMouse,
  
  // State setters
  setMousePressed,
  setLastMouse,
  setHoveredNode,
  setHoveredCluster,
  setContextMenu,
  
  // Callbacks
  onNodeClick,
  onNodeHover,
  onNodeHoverEnd,
  onClusterHover,
  onClusterHoverEnd,
  onNodeRightClick,
  isCanvasInteractionBlocked,
  updateTransform,
  applyZoom,
  zoomTo,
}) => {
  
  // Hit testing for mouse events
  const getNodeAtPosition = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Use the same active transform as the render function
    const activeTransform = (!isInitialPositioningComplete && optimalTransformRef.current) 
      ? optimalTransformRef.current 
      : transform;

    // Don't process clicks if we don't have a proper transform yet
    if (!activeTransform) {
      return null;
    }

    // Transform to world coordinates
    const worldX = (canvasX - activeTransform.x) / activeTransform.scale;
    const worldY = (canvasY - activeTransform.y) / activeTransform.scale;

    // Use active nodes (refs during initial positioning, state during interactions)
    const activeNodes = (!isInitialPositioningComplete && currentPositionedNodesRef.current.length > 0) 
      ? currentPositionedNodesRef.current 
      : positionedNodes;
    
    return activeNodes.find(node => {
      const nodeLeft = node.x - node.width/2;
      const nodeRight = node.x + node.width/2;
      const nodeTop = node.y - node.height/2;
      const nodeBottom = node.y + node.height/2;

      return worldX >= nodeLeft && worldX <= nodeRight && worldY >= nodeTop && worldY <= nodeBottom;
    });
  }, [canvasRef, dimensions, transform, positionedNodes, isInitialPositioningComplete, optimalTransformRef, currentPositionedNodesRef]);

  // Hit testing for clusters
  const getClusterAtPosition = useCallback((clientX, clientY) => {
    if (!enableOpeningClusters || !showOpeningClusters || clusterPathsData.length === 0) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Use the same active transform as the render function
    const activeTransform = (!isInitialPositioningComplete && optimalTransformRef.current) 
      ? optimalTransformRef.current 
      : transform;

    // Don't process clicks if we don't have a proper transform yet
    if (!activeTransform) {
      return null;
    }

    // Transform to world coordinates
    const worldX = (canvasX - activeTransform.x) / activeTransform.scale;
    const worldY = (canvasY - activeTransform.y) / activeTransform.scale;

    // Check clusters in reverse order (top to bottom in rendering)
    for (let i = clusterPathsData.length - 1; i >= 0; i--) {
      const { cluster, path } = clusterPathsData[i];
      
      // Use point-in-polygon test for the cluster path
      if (isPointInPath(worldX, worldY, path)) {
        return cluster;
      }
    }

    return null;
  }, [canvasRef, enableOpeningClusters, showOpeningClusters, clusterPathsData, transform, isInitialPositioningComplete, optimalTransformRef]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    // Block all mouse interactions during initialization
    if (isCanvasInteractionBlocked()) {
      e.preventDefault();
      return;
    }
    
    // Handle middle mouse button click for reset
    if (e.button === MOUSE_BUTTONS.MIDDLE) {
      e.preventDefault();
      zoomTo('all', { isAutoFit: false });
      return;
    }
    
    // Only handle left mouse button for dragging
    if (e.button !== MOUSE_BUTTONS.LEFT) return;
    
    setMousePressed(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
    // Reset drag flag at the beginning of a new interaction
    isDraggingRef.current = false;
  }, [isCanvasInteractionBlocked, zoomTo, setMousePressed, setLastMouse, isDraggingRef]);

  const handleMouseMove = useCallback((e) => {
    if (e.buttons & 1 && (e.buttons & 1)) { // Check if left mouse button is pressed
      // Block panning during initialization
      if (isCanvasInteractionBlocked()) {
        return;
      }
    
      const deltaX = e.clientX - lastMouse?.x || 0;
      const deltaY = e.clientY - lastMouse?.y || 0;
      
      // Mark as dragging if movement exceeds threshold
      if (!isDraggingRef.current && (Math.abs(deltaX) + Math.abs(deltaY) > CANVAS_CONFIG.DRAG_THRESHOLD)) {
        isDraggingRef.current = true;
      }

      if (transform) {
        updateTransform({
          x: transform.x + deltaX,
          y: transform.y + deltaY
        });
      }
      
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else {
      // Clear mouse pressed state if button isn't pressed
      setMousePressed(false);
      
      // Handle node hover first (nodes take priority over clusters)
      const node = getNodeAtPosition(e.clientX, e.clientY);
      setHoveredNode(node);
      
      if (node && onNodeHover) {
        onNodeHover(e, node);
      } else if (!node && onNodeHoverEnd) {
        onNodeHoverEnd(e, null);
      }

      // Handle cluster hover only if no node is hovered
      if (!node) {
        const cluster = getClusterAtPosition(e.clientX, e.clientY);
        setHoveredCluster(cluster);
        
        if (cluster && onClusterHover) {
          const clusterColor = { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' };
          onClusterHover(cluster.name, clusterColor);
        } else if (!cluster && onClusterHoverEnd) {
          onClusterHoverEnd();
        }
      } else {
        // Clear cluster hover when hovering over a node
        setHoveredCluster(null);
        if (onClusterHoverEnd) {
          onClusterHoverEnd();
        }
      }
    }
  }, [
    isCanvasInteractionBlocked, 
    transform, 
    updateTransform,
    lastMouse,
    setLastMouse, 
    setMousePressed, 
    getNodeAtPosition, 
    getClusterAtPosition,
    setHoveredNode,
    setHoveredCluster,
    onNodeHover,
    onNodeHoverEnd,
    onClusterHover,
    onClusterHoverEnd,
    isDraggingRef
  ]);

  const handleMouseUp = useCallback(() => {
    setMousePressed(false);
  }, [setMousePressed]);

  const handleMouseLeave = useCallback(() => {
    setMousePressed(false);
    setHoveredNode(null);
    setHoveredCluster(null);
    
    if (onNodeHoverEnd) onNodeHoverEnd(null, null);
    if (onClusterHoverEnd) onClusterHoverEnd();
  }, [setMousePressed, setHoveredNode, setHoveredCluster, onNodeHoverEnd, onClusterHoverEnd]);

  const handleClick = useCallback((e) => {
    // Block clicks during initialization
    if (isCanvasInteractionBlocked()) {
      e.preventDefault();
      return;
    }
    
    // Suppress clicks that immediately follow a drag
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }

    const node = getNodeAtPosition(e.clientX, e.clientY);
    if (node && onNodeClick) {
      onNodeClick(e, node);
    }
    
    // Close context menu when clicking on canvas (but not on nodes)
    if (!node) {
      setContextMenu(null);
    }
  }, [isCanvasInteractionBlocked, getNodeAtPosition, onNodeClick, setContextMenu, isDraggingRef]);

  const handleRightClick = useCallback((e) => {
    e.preventDefault(); // Prevent default context menu
    
    // Block right-clicks during initialization
    if (isCanvasInteractionBlocked()) {
      return;
    }
    
    // Only show context menu if we have actions defined
    if (!contextMenuActions || contextMenuActions.length === 0) {
      return;
    }
    
    const node = getNodeAtPosition(e.clientX, e.clientY);
    
    if (node) {
      // Get canvas position for context menu
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const menuX = e.clientX - rect.left;
      const menuY = e.clientY - rect.top;
      
      setContextMenu({
        x: menuX,
        y: menuY,
        node: node
      });
      
      // Call optional callback
      if (onNodeRightClick) {
        onNodeRightClick(e, node);
      }
    } else {
      // Close context menu if right-clicking on empty space
      setContextMenu(null);
    }
  }, [isCanvasInteractionBlocked, contextMenuActions, getNodeAtPosition, canvasRef, setContextMenu, onNodeRightClick]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    // Block wheel zoom during initialization
    if (isCanvasInteractionBlocked()) {
      return;
    }
    
    // Don't process wheel events if we don't have a proper transform yet
    if (!transform) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = e.deltaY > 0 ? CANVAS_CONFIG.ZOOM_LIMITS.SCALE_FACTOR : CANVAS_CONFIG.ZOOM_LIMITS.SCALE_FACTOR_IN;
    applyZoom(scaleFactor, mouseX, mouseY, transform);
  }, [isCanvasInteractionBlocked, transform, canvasRef, applyZoom]);

  // Keyboard event handlers
  const handleKeyPress = useCallback((event) => {
    // Block keyboard shortcuts during initialization
    if (isCanvasInteractionBlocked()) {
      return;
    }
    
    // Don't handle keyboard events if focused on input elements
    if (event.target.matches('input, textarea, select')) {
      return;
    }
    
    if (KEYBOARD_SHORTCUTS.FIT_VIEW.includes(event.key)) {
      event.preventDefault();
      zoomTo('all', { isAutoFit: false });
    } else if (KEYBOARD_SHORTCUTS.EMERGENCY_RESET.includes(event.key)) {
      event.preventDefault();
      // Emergency reset - force a basic centered view
      updateTransform({ x: 0, y: 0, scale: 0.5 });
    }
  }, [isCanvasInteractionBlocked, zoomTo, updateTransform]);

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', handleRightClick);
    
    // Wheel event with passive: false to allow preventDefault
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', handleRightClick);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [
    canvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleClick,
    handleRightClick,
    handleWheel
  ]);

  // Keyboard events
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return {
    getNodeAtPosition,
    getClusterAtPosition,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleClick,
    handleRightClick,
    handleWheel,
    handleKeyPress,
  };
}; 