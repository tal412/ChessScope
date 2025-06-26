import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook for managing chessboard synchronization between
 * different chess interfaces (opening tree, performance graph, etc.)
 * 
 * This hook provides a unified interface for:
 * - Managing current move sequences
 * - Handling external move updates (from chessboard)
 * - Bidirectional synchronization between UI components and chessboard
 * - Finding nodes/positions based on move sequences
 */
export const useChessboardSync = ({ 
  nodes = [], 
  onNodeSelect = null,
  setNodes = null 
}) => {
  // State management
  const [currentMoves, setCurrentMoves] = useState([]);
  const [externalMoves, setExternalMoves] = useState([]);
  
  // Refs to track changes and prevent infinite loops
  const prevExternalMovesRef = useRef([]);
  
  /**
   * Handle current moves change - called by chessboard components
   */
  const handleCurrentMovesChange = (moves) => {
    setCurrentMoves(moves);
  };

  /**
   * Handle new move from chessboard - called when user makes a move
   */
  const handleNewMove = (moves) => {
    console.log('🎯 New moves from chessboard:', moves);
    setExternalMoves(moves);
    
    // Find matching node if nodes array is provided
    if (nodes.length > 0) {
      const matchingNode = findMatchingNode(moves, nodes);
      
      if (matchingNode) {
        console.log('🎯 Found matching node for moves:', moves, matchingNode);
        
        // Call node selection callback if provided
        if (onNodeSelect) {
          onNodeSelect(matchingNode);
        }
        
        // Update node selection state if setNodes is provided
        if (setNodes) {
          const updatedNodes = nodes.map(node => ({
            ...node,
            selected: node.id === matchingNode.id
          }));
          setNodes(updatedNodes);
        }
      } else {
        console.log('🔍 No matching node found for moves:', moves);
      }
    }
  };

  /**
   * Handle move selection from chessboard - called when user navigates through moves
   */
  const handleMoveSelect = (moves) => {
    console.log('🎯 Move selected on chessboard:', moves);
    setExternalMoves(moves);
    handleNewMove(moves); // Use same logic
  };

  /**
   * Sync moves to chessboard - called when external component wants to update chessboard
   */
  const syncMovesToChessboard = (moves) => {
    console.log('🎯 Syncing moves to chessboard:', moves);
    setCurrentMoves(moves);
    setExternalMoves(moves);
  };

  /**
   * Find node that matches a move sequence
   */
  const findMatchingNode = (moves, nodeList) => {
    return nodeList.find(node => {
      const nodeSequence = node.data?.moveSequence || [];
      return nodeSequence.length === moves.length && 
             nodeSequence.every((move, index) => move === moves[index]);
    });
  };

  /**
   * Handle external moves change with change detection
   */
  useEffect(() => {
    const prevExternalMoves = prevExternalMovesRef.current;
    const externalMovesChanged = 
      externalMoves.length !== prevExternalMoves.length ||
      externalMoves.some((move, index) => move !== prevExternalMoves[index]);
      
    if (externalMovesChanged) {
      console.log('🎯 External moves changed:', externalMoves);
      prevExternalMovesRef.current = externalMoves;
      setCurrentMoves(externalMoves);
    }
  }, [externalMoves]);

  return {
    // State
    currentMoves,
    externalMoves,
    
    // Methods
    handleCurrentMovesChange,
    handleNewMove,
    handleMoveSelect,
    syncMovesToChessboard,
    findMatchingNode,
    
    // Utility
    setCurrentMoves,
    setExternalMoves
  };
}; 