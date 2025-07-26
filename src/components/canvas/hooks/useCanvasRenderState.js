import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { CANVAS_CONFIG, RENDER_CONFIG } from '../constants.js';
import { calculateOptimalTransform } from '../utils.js';

/**
 * Hook for managing canvas rendering state, dimensions, and positioning
 */
export const useCanvasRenderState = (graphData, dimensions, mode) => {
  const [transform, setTransform] = useState(null);
  const [hasValidTransform, setHasValidTransform] = useState(false);
  const [mousePressed, setMousePressed] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [positionedNodes, setPositionedNodes] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [hasAutoFitted, setHasAutoFitted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isInitialPositioningComplete, setIsInitialPositioningComplete] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [cursorStyle, setCursorStyle] = useState('grab');
  
  // Track whether the current mouse interaction involved dragging
  const isDraggingRef = useRef(false);
  const positionedNodesRef = useRef([]);
  const resizeOnlyRef = useRef(false);
  const coreGraphDataRef = useRef(null);
  const optimalTransformRef = useRef(null);
  const currentTransformRef = useRef(null);
  const currentPositionedNodesRef = useRef([]);
  const resizeTimeoutRef = useRef(null);
  
  // Update ref when positioned nodes change
  useEffect(() => {
    positionedNodesRef.current = positionedNodes;
  }, [positionedNodes]);
  
  // Update ref when transform changes
  useEffect(() => {
    currentTransformRef.current = transform;
  }, [transform]);
  
  // Helper function to check if canvas interactions should be blocked
  const isCanvasInteractionBlocked = () => {
    const blocked = isInitializing || 
           positionedNodes.length === 0 ||
           (!isInitialPositioningComplete && positionedNodes.length > 0) ||
           dimensions.width === 0 || 
           dimensions.height === 0 || 
           !transform || 
           !hasValidTransform;
    
    return blocked;
  };

  // Helper function to check if canvas cursor should show "not-allowed" (excludes auto-fit)
  const isCanvasCursorBlocked = () => {
    const blocked = isInitializing || 
           positionedNodes.length === 0 ||
           (!isInitialPositioningComplete && positionedNodes.length > 0) ||
           dimensions.width === 0 || 
           dimensions.height === 0 || 
           !transform || 
           !hasValidTransform;
    
    return blocked;
  };
  
  // Update cursor style when states change
  useEffect(() => {
    const isCursorBlocked = isCanvasCursorBlocked();
    setCursorStyle(isCursorBlocked ? 'not-allowed' : (hoveredNode || hoveredCluster ? 'pointer' : 'grab'));
  }, [hoveredNode, hoveredCluster, isInitializing, isInitialPositioningComplete, positionedNodes.length, dimensions.width, dimensions.height, transform, hasValidTransform]);

  // Process graph data and calculate positions with immediate optimal transform
  useEffect(() => {
    // Don't process anything until we have valid dimensions from the DOM
    if (dimensions.width === 0 || dimensions.height === 0) {
      return;
    }
    
    if (!graphData.nodes || graphData.nodes.length === 0) {
      // Complete initialization with empty state
      requestAnimationFrame(() => {
        setPositionedNodes([]);
        setHasAutoFitted(true);
        setIsInitializing(false);
        setIsInitialPositioningComplete(true);
        setHasValidTransform(true);
        const defaultTransform = { x: 0, y: 0, scale: 1 };
        setTransform(defaultTransform);
        optimalTransformRef.current = defaultTransform;
        currentTransformRef.current = defaultTransform;
        currentPositionedNodesRef.current = [];
        coreGraphDataRef.current = JSON.stringify({ nodeCount: 0, edgeCount: 0, nodeIds: [], edgeIds: [] });
      });
      return;
    }
    
    // Keep initialization true until we've calculated AND applied the transform
    if (!isInitializing && !isInitialPositioningComplete) {
      setIsInitializing(true);
    }

    // Calculate positioned nodes
    const nodes = graphData.nodes.filter(n => n.type !== 'clusterBackground');
    const positioned = nodes.map(node => ({
      ...node,
      x: node.position.x + CANVAS_CONFIG.NODE_HALF_SIZE,
      y: node.position.y + CANVAS_CONFIG.NODE_HALF_SIZE,
      width: CANVAS_CONFIG.NODE_SIZE,
      height: CANVAS_CONFIG.NODE_SIZE
    }));

    // Check if this is a real graph change
    const currentCoreData = JSON.stringify({
      nodeCount: nodes.length,
      edgeCount: graphData.edges?.length || 0,
      nodeIds: nodes.map(n => n.id).sort(),
      edgeIds: graphData.edges?.map(e => e.id).sort() || []
    });
    
    const isRealGraphChange = currentCoreData !== coreGraphDataRef.current;
    
    if (isRealGraphChange) {
      setIsInitialPositioningComplete(false);
      setHasAutoFitted(false);
    }
    
    // Special case: transition from empty to nodes
    const wasEmpty = coreGraphDataRef.current === JSON.stringify({ nodeCount: 0, edgeCount: 0, nodeIds: [], edgeIds: [] });
    const hasNodesNow = nodes.length > 0;
    const isEmptyToNodesTransition = wasEmpty && hasNodesNow;
    
    coreGraphDataRef.current = currentCoreData;

    // Calculate and apply optimal transform
    const shouldCalculateTransform = dimensions.width > 0 && dimensions.height > 0 && 
      (!isInitialPositioningComplete || (isRealGraphChange && !resizeOnlyRef.current) || isEmptyToNodesTransition);
    
    if (shouldCalculateTransform) {
      const optimalTransform = calculateOptimalTransform(positioned, dimensions);
      
      // Store in refs for immediate access
      optimalTransformRef.current = optimalTransform;
      currentTransformRef.current = optimalTransform;
      currentPositionedNodesRef.current = positioned;
      
      // Set both nodes and transform atomically
      setTransform(optimalTransform);
      setPositionedNodes(positioned);
      setHasAutoFitted(true);
      setHasValidTransform(true);
      
      // Mark initialization complete
      if (positioned.length > 1 || (mode === 'opening' && positioned.length >= 1)) {
        setIsInitializing(false);
        setIsInitialPositioningComplete(true);
      } else {
        setIsInitializing(true);
        setIsInitialPositioningComplete(false);
      }
    } else {
      // Just update positioned nodes without changing transform
      currentPositionedNodesRef.current = positioned;
      setPositionedNodes(positioned);
    }
    
    // Reset resize flag after processing
    resizeOnlyRef.current = false;
    
  }, [graphData, dimensions, mode, isInitialPositioningComplete]);

  // Fallback timeout to prevent initialization from getting stuck
  useEffect(() => {
    if (isInitializing) {
      const checkAndMaybeForceComplete = () => {
        if (positionedNodesRef.current.length <= 1) {
          fallbackId = setTimeout(checkAndMaybeForceComplete, 3000);
          return;
        }

        console.warn('Canvas initialization timeout - forcing completion');
        setIsInitializing(false);
        setIsInitialPositioningComplete(true);
        setHasValidTransform(true);
        if (!transform) {
          const defaultTransform = { x: 0, y: 0, scale: 1 };
          setTransform(defaultTransform);
        }
      };

      let fallbackId = setTimeout(checkAndMaybeForceComplete, CANVAS_CONFIG.INITIALIZATION_TIMEOUT);
      
      return () => clearTimeout(fallbackId);
    }
  }, [isInitializing, transform]);

  // Resize detection with proper handling
  useEffect(() => {
    // Skip if dimensions are not valid yet
    if (dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    // Set resize state when dimensions change (but not on first mount)
    if (isInitialPositioningComplete) {
      resizeOnlyRef.current = true;
      setIsResizing(true);
      
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      resizeTimeoutRef.current = setTimeout(() => {
        setIsResizing(false);
      }, CANVAS_CONFIG.RESIZE_DEBOUNCE);
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [dimensions.width, dimensions.height, isInitialPositioningComplete]);

  return {
    // State
    transform,
    hasValidTransform,
    mousePressed,
    lastMouse,
    positionedNodes,
    hoveredNode,
    hoveredCluster,
    hasAutoFitted,
    isInitializing,
    isInitialPositioningComplete,
    isResizing,
    contextMenu,
    cursorStyle,
    
    // Refs
    isDraggingRef,
    positionedNodesRef,
    resizeOnlyRef,
    coreGraphDataRef,
    optimalTransformRef,
    currentTransformRef,
    currentPositionedNodesRef,
    
    // Setters
    setTransform,
    setHasValidTransform,
    setMousePressed,
    setLastMouse,
    setPositionedNodes,
    setHoveredNode,
    setHoveredCluster,
    setHasAutoFitted,
    setIsInitializing,
    setIsInitialPositioningComplete,
    setIsResizing,
    setContextMenu,
    setCursorStyle,
    
    // Helpers
    isCanvasInteractionBlocked,
    isCanvasCursorBlocked,
  };
}; 