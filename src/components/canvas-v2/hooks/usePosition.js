import { useState, useCallback } from 'react';

/**
 * Hook for managing current position and node selection
 * @returns {Object} Position state and controls
 */
export function usePosition() {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [currentFen, setCurrentFen] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hoveredNextMoveNodeId, setHoveredNextMoveNodeId] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  
  /**
   * Update current position
   * @param {string} nodeId - Node ID
   * @param {string} fen - FEN string
   * @param {Object} options - Additional options
   */
  const updateCurrentPosition = useCallback((nodeId, fen, options = {}) => {
    setCurrentNodeId(nodeId);
    setCurrentFen(fen);
    
    // Call callback if provided
    if (options.onPositionChange) {
      options.onPositionChange(nodeId, fen);
    }
  }, []);
  
  /**
   * Clear current position
   */
  const clearCurrentPosition = useCallback(() => {
    setCurrentNodeId(null);
    setCurrentFen(null);
  }, []);
  
  /**
   * Set hovered node
   * @param {string} nodeId - Node ID to hover
   */
  const setHoveredNode = useCallback((nodeId) => {
    setHoveredNodeId(nodeId);
  }, []);
  
  /**
   * Clear hovered node
   */
  const clearHoveredNode = useCallback(() => {
    setHoveredNodeId(null);
  }, []);
  
  /**
   * Set hovered next move node
   * @param {string} nodeId - Node ID to hover as next move
   */
  const setHoveredNextMoveNode = useCallback((nodeId) => {
    setHoveredNextMoveNodeId(nodeId);
  }, []);
  
  /**
   * Clear hovered next move node
   */
  const clearHoveredNextMoveNode = useCallback(() => {
    setHoveredNextMoveNodeId(null);
  }, []);
  
  /**
   * Select a node
   * @param {string} nodeId - Node ID to select
   * @param {boolean} multiSelect - Whether to add to selection or replace
   */
  const selectNode = useCallback((nodeId, multiSelect = false) => {
    setSelectedNodeIds(prev => {
      const newSelection = new Set(multiSelect ? prev : []);
      if (newSelection.has(nodeId)) {
        newSelection.delete(nodeId);
      } else {
        newSelection.add(nodeId);
      }
      return newSelection;
    });
  }, []);
  
  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);
  
  /**
   * Check if a node is selected
   * @param {string} nodeId - Node ID to check
   * @returns {boolean} True if selected
   */
  const isNodeSelected = useCallback((nodeId) => {
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);
  
  /**
   * Check if a node is current
   * @param {string} nodeId - Node ID to check
   * @returns {boolean} True if current
   */
  const isNodeCurrent = useCallback((nodeId) => {
    return currentNodeId === nodeId;
  }, [currentNodeId]);
  
  /**
   * Check if a node is hovered
   * @param {string} nodeId - Node ID to check
   * @returns {boolean} True if hovered
   */
  const isNodeHovered = useCallback((nodeId) => {
    return hoveredNodeId === nodeId;
  }, [hoveredNodeId]);
  
  /**
   * Check if a node is hovered as next move
   * @param {string} nodeId - Node ID to check
   * @returns {boolean} True if hovered as next move
   */
  const isNodeHoveredNextMove = useCallback((nodeId) => {
    return hoveredNextMoveNodeId === nodeId;
  }, [hoveredNextMoveNodeId]);
  
  return {
    // State
    currentNodeId,
    currentFen,
    hoveredNodeId,
    hoveredNextMoveNodeId,
    selectedNodeIds: Array.from(selectedNodeIds),
    selectedNodeIdsSet: selectedNodeIds,
    
    // Current position controls
    updateCurrentPosition,
    clearCurrentPosition,
    
    // Hover controls
    setHoveredNode,
    clearHoveredNode,
    setHoveredNextMoveNode,
    clearHoveredNextMoveNode,
    
    // Selection controls
    selectNode,
    clearSelection,
    
    // Query functions
    isNodeSelected,
    isNodeCurrent,
    isNodeHovered,
    isNodeHoveredNextMove,
  };
} 