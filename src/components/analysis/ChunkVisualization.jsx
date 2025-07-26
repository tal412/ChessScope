import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { ArrowRight } from 'lucide-react';
import { Chess } from 'chess.js';

// Global mouse position tracker
let globalMouseX = 0;
let globalMouseY = 0;

// Track mouse position globally
if (typeof window !== 'undefined') {
  document.addEventListener('mousemove', (e) => {
    globalMouseX = e.clientX;
    globalMouseY = e.clientY;
  });
}

// Responsive tree layout - no fixed dimensions

const getPerformanceColor = (winRate) => {
  if (winRate >= 70) return "border-green-500/80 hover:bg-green-500/10";
  if (winRate >= 60) return "border-blue-500/80 hover:bg-blue-500/10";
  if (winRate >= 50) return "border-yellow-500/80 hover:bg-yellow-500/10";
  return "border-red-500/80 hover:bg-red-500/10";
};

const getSelectedColor = (winRate) => {
  if (winRate >= 70) return "bg-green-500/20 border-green-400";
  if (winRate >= 60) return "bg-blue-500/20 border-blue-400";
  if (winRate >= 50) return "bg-yellow-500/20 border-yellow-400";
  return "bg-red-500/20 border-red-400";
};

const getArrowColor = (winRate) => {
  if (winRate >= 70) return "#22c55e"; // green-500
  if (winRate >= 60) return "#3b82f6"; // blue-500
  if (winRate >= 50) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
};

// Move button component
const MoveButton = ({ moveData, onSelect, isSelected, onHover, onHoverEnd, isInLastCard, displayMode = 'performance' }) => {
  // Safely access winRate from details object with fallback
  const winRate = moveData.details?.winRate ?? moveData.winRate ?? 0;
  const buttonRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Handle mouse enter with proper cleanup
  const handleMouseEnter = () => {
    if (isInLastCard && onHover) {
      setIsHovered(true);
      onHover();
    }
  };
  
  // Handle mouse leave with proper cleanup
  const handleMouseLeave = () => {
    if (isHovered && onHoverEnd) {
      setIsHovered(false);
      onHoverEnd();
    }
  };
  
  // Force re-trigger hover events after chunk transitions
  useEffect(() => {
    if (isInLastCard && buttonRef.current) {
      const checkMousePosition = () => {
        if (!buttonRef.current) return;
        
        const rect = buttonRef.current.getBoundingClientRect();
        const isMouseOver = globalMouseX >= rect.left && globalMouseX <= rect.right &&
                          globalMouseY >= rect.top && globalMouseY <= rect.bottom;
        
        if (isMouseOver && !isHovered && onHover) {
          setIsHovered(true);
          onHover();
        }
      };
      
      // Check mouse position after animation completes
      const timeoutId = setTimeout(checkMousePosition, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [isInLastCard, onHover, isHovered, moveData.san]);
  
  // Reset hover state when isInLastCard changes (chunk transition)
  useEffect(() => {
    if (!isInLastCard && isHovered) {
      setIsHovered(false);
      if (onHoverEnd) onHoverEnd();
    }
  }, [isInLastCard, isHovered, onHoverEnd]);
  
  // Opening mode styling (pink theme)
  const openingModeStyle = displayMode === 'opening' ? {
    base: 'bg-slate-700/30 border-pink-500/60 hover:bg-pink-500/10',
    selected: 'bg-pink-500/20 border-pink-400'
  } : null;
  
  return (
    <button
      ref={buttonRef}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 relative ${
        isSelected 
          ? (openingModeStyle ? openingModeStyle.selected : getSelectedColor(winRate))
          : (openingModeStyle ? openingModeStyle.base : `bg-slate-700/30 ${getPerformanceColor(winRate)}`)
      }`}
    >
      {/* Percentage badge in top-right corner - only show in performance mode */}
      {displayMode === 'performance' && (
        <div className="absolute top-2 right-2">
          <Badge
            variant="outline"
            className={`text-xs font-semibold ${isSelected ? 'text-white border-white/30' : 'text-slate-300 border-slate-500/50'}`}
          >
            {winRate.toFixed(0)}%
          </Badge>
        </div>
      )}
      
      {/* Main content */}
      <div className={displayMode === 'performance' ? "pr-16" : "pr-2"}> {/* Adjust padding based on mode */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-white text-lg">{moveData.san}</span>
        </div>
        
        {/* Opening info - only show in performance mode */}
        {displayMode === 'performance' && (
          <p className="text-sm text-slate-400 mb-2 line-clamp-2" title={
            moveData.openingInfo?.eco && moveData.openingInfo?.name 
              ? `${moveData.openingInfo.eco} ${moveData.openingInfo.name}` 
              : (moveData.openingInfo?.name || 'Unknown Opening')
          }>
            {moveData.openingInfo?.eco && moveData.openingInfo?.name 
              ? `${moveData.openingInfo.eco} ${moveData.openingInfo.name}` 
              : (moveData.openingInfo?.name || 'Unknown Opening')}
          </p>
        )}
        
        {/* Opening info for opening mode - show opening name as subtitle */}
        {displayMode === 'opening' && (
          <p className="text-sm text-slate-400 mb-2 line-clamp-2">
            {moveData.openingInfo?.eco && moveData.openingInfo?.name 
              ? `${moveData.openingInfo.eco} ${moveData.openingInfo.name}`
              : (moveData.openingInfo?.name || 'User Opening Move')}
          </p>
        )}
        
        {/* Game count - only show in performance mode */}
        {displayMode === 'performance' && (
          <div className="text-left text-xs text-slate-500">
            {moveData.gameCount}g
          </div>
        )}
      </div>
    </button>
  );
};

// Chunk component for displaying moves at a specific depth with simple list layout
const GraphChunk = ({ title, moves, onMoveSelect, selectedMove, depth, onMoveHover, onMoveHoverEnd, isLastCard, displayMode = 'performance' }) => {
  // Sort moves by game count (descending) - most played moves first
  const sortedMoves = [...moves].sort((a, b) => b.gameCount - a.gameCount);

  return (
    <div 
      className="w-full h-full bg-slate-800/95 border border-slate-700/50 backdrop-blur-optimized rounded-xl overflow-hidden flex flex-col"
    >
      {/* Header - Fixed height */}
      <div className="p-4 pb-3 border-b border-slate-700/50 flex-shrink-0" style={{ minHeight: '80px', maxHeight: '80px' }}>
        <div className="text-slate-200 text-base flex items-center justify-between font-semibold leading-none tracking-tight">
          <span>{title}</span>
          <Badge variant="outline" className="text-xs bg-slate-700/50 text-slate-400">
            {sortedMoves.length} moves
          </Badge>
        </div>
      </div>
      {/* Content with scrollable move list */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ minHeight: 0 }}
      >
        {sortedMoves.length === 0 ? (
          <p className="text-slate-500 text-center py-4 text-sm">No moves available</p>
        ) : (
          <div className="space-y-3 p-4">
            {sortedMoves.map((moveData, index) => (
              <MoveButton
                key={`list-${moveData.san}-${index}-${moveData.gameCount}`}
                moveData={moveData}
                onSelect={() => onMoveSelect(moveData)}
                isSelected={selectedMove && selectedMove.san === moveData.san && selectedMove.toFen === moveData.toFen}
                onHover={() => onMoveHover && onMoveHover(moveData)}
                onHoverEnd={() => onMoveHoverEnd && onMoveHoverEnd()}
                isInLastCard={isLastCard}
                displayMode={displayMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function ChunkVisualization({ 
  openingGraph,
  customMoveTree = null, // NEW: Custom move tree for opening mode
  isWhiteTree = true,
  onCurrentMovesChange,
  externalMoves = [],
  onMoveHover,
  onMoveHoverEnd,
  onDirectScroll, // NEW: Direct scroll callback for external control
  initialPath = [], // NEW: Initial path to restore tree state
  // NEW: Filtering parameters to sync with performance graph
  maxDepth = 20,
  minGameCount = 1,
  winRateFilter = [0, 100],
  displayMode = 'performance', // NEW: 'opening' | 'performance'
  readOnly = false // NEW: Read-only mode for view-only scenarios
}) {
  const [path, setPath] = useState(initialPath); // Array of selected moves (SAN notation)
  const [displayPath, setDisplayPath] = useState(initialPath); // Delayed path for display
  const [chessboardPath, setChessboardPath] = useState(initialPath); // Path for chessboard (delayed during back navigation)
  const [hoveredMove, setHoveredMove] = useState(null); // Track hovered move
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  
  // Use refs to store the latest callback functions to avoid dependency issues
  const onCurrentMovesChangeRef = useRef(onCurrentMovesChange);
  const onDirectScrollRef = useRef(onDirectScroll);
  const prevExternalMovesRef = useRef([]);
  const isInitialMountRef = useRef(true); // Track if this is the first render
  
  // Update refs when callbacks change
  useEffect(() => {
    onCurrentMovesChangeRef.current = onCurrentMovesChange;
  }, [onCurrentMovesChange]);
  
  useEffect(() => {
    onDirectScrollRef.current = onDirectScroll;
  }, [onDirectScroll]);

  // Expose direct scroll function to parent via callback
  useEffect(() => {
    if (onDirectScrollRef.current) {
      const directScrollTo = (moves) => {
        // Only update if moves are actually different to prevent loops
        if (moves.length !== path.length || moves.some((move, index) => move !== path[index])) {
          // Update all path states to trigger the correct chunk display
          setPath(moves);
          setDisplayPath(moves);
          setChessboardPath(moves);
        }
      };
      
      onDirectScrollRef.current(directScrollTo);
    }
  }, [openingGraph, path]); // Include path to ensure we have the current path when checking

  // Calculate current moves sequence based on chessboard path (not regular path)
  const currentMoves = useMemo(() => {
    return chessboardPath;
  }, [chessboardPath]);

  // Notify parent of current moves changes
  const prevCurrentMovesRef = useRef([]);
  useEffect(() => {
    if (onCurrentMovesChangeRef.current) {
      // Only notify if moves have actually changed to prevent circular updates
      const prevMoves = prevCurrentMovesRef.current;
      const movesChanged = currentMoves.length !== prevMoves.length ||
                          currentMoves.some((move, index) => move !== prevMoves[index]);
      
      if (movesChanged) {
        prevCurrentMovesRef.current = [...currentMoves];
        onCurrentMovesChangeRef.current(currentMoves);
      }
    }
  }, [currentMoves]); // Use ref to avoid infinite loops

  // Handle external moves (from chessboard)
  useEffect(() => {
    // Skip external moves sync on initial mount - let tree maintain its own state
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevExternalMovesRef.current = externalMoves;
      return;
    }
    
    // Only update if externalMoves is actually different from previous external moves
    const prevExternalMoves = prevExternalMovesRef.current;
    const externalMovesChanged = 
      externalMoves.length !== prevExternalMoves.length ||
      externalMoves.some((move, index) => move !== prevExternalMoves[index]);
      
    if (externalMovesChanged) {
      prevExternalMovesRef.current = externalMoves;
      
      // Update all paths immediately to ensure selection state is correct
      setPath(externalMoves);
      setDisplayPath(externalMoves);
      setChessboardPath(externalMoves);
    }
  }, [externalMoves]); // Only depend on externalMoves

  // Helper function to apply filtering (same logic as PerformanceGraph)
  const applyMoveFiltering = (moves, currentLevel) => {
    if (!moves || moves.length === 0) return [];
    
    // Apply game count and win rate filtering
    const levelAdjustedMinGames = Math.max(1, Math.floor(minGameCount / Math.pow(1.5, currentLevel)));
    
    let validMoves = moves.filter(move => {
      const gameCount = move.gameCount || 0;
      const winRate = move.details?.winRate || move.winRate || 0;
      return gameCount >= levelAdjustedMinGames && 
             winRate >= winRateFilter[0] && 
             winRate <= winRateFilter[1];
    });
    
    // Fallback logic - but only when appropriate
    if (validMoves.length === 0 && moves.length > 0) {
      // Calculate total games in the dataset to determine if fallback should apply
      const totalGames = moves.reduce((sum, move) => sum + (move.gameCount || 0), 0);
      const maxGamesInAnyMove = Math.max(...moves.map(m => m.gameCount || 0));
      
      // Apply different logic based on filter level:
      // - Low filters (1-5 games): Always show moves that meet win rate criteria
      // - High filters (10+ games): Only show if dataset is reasonable
      let shouldApplyFallback = false;
      
      if (minGameCount <= 5) {
        // Low filter - always apply fallback for game count (user wants to see data)
        shouldApplyFallback = true;
      } else if (minGameCount <= 20) {
        // Medium filter - apply fallback if there's reasonable data
        shouldApplyFallback = totalGames >= 30 || maxGamesInAnyMove >= 8;
      } else {
        // High filter - only apply fallback if there's substantial data
        shouldApplyFallback = totalGames >= 100 || maxGamesInAnyMove >= 20;
      }
      
      if (shouldApplyFallback) {
        const winRateFilteredMoves = moves.filter(move => {
          const winRate = move.details?.winRate || move.winRate || 0;
          return winRate >= winRateFilter[0] && winRate <= winRateFilter[1];
        });
        
        if (winRateFilteredMoves.length === 0) {
          // No moves meet win rate criteria - respect the filter
          validMoves = [];
        } else {
          // Some moves meet win rate but not game count - apply fallback for game count only
          const sortedMoves = [...winRateFilteredMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0));
          validMoves = sortedMoves.slice(0, Math.min(5, winRateFilteredMoves.length));
        }
      } else {
        // High filter on small dataset - respect the user's explicit filter choice
        console.log(`🔍 Small dataset (${totalGames} total games, max ${maxGamesInAnyMove} per move) - respecting ${minGameCount}+ games filter`);
        validMoves = [];
      }
    }
    
    // Optional: Limit breadth at deeper levels (disabled to match performance graph)
    // const maxMovesAtLevel = Math.max(3, Math.floor(8 / Math.sqrt(currentLevel + 1)));
    // if (validMoves.length > maxMovesAtLevel) {
    //   validMoves = [...validMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0))
    //                                .slice(0, maxMovesAtLevel);
    // }
    
    return validMoves;
  };

  // Helper function to generate better opening information based on move and context
  const generateOpeningInfo = useCallback((move, currentPath) => {
    // If we have an openingGraph, try to get actual ECO information
    if (openingGraph) {
      try {
        // Build the complete move sequence including this move
        const fullPath = [...currentPath, move];
        
        // Try to get moves from the position to see if this move exists
        const parentMoves = openingGraph.getMovesFromPosition(currentPath, isWhiteTree);
        const matchingMove = parentMoves?.find(m => m.san === move);
        
        if (matchingMove && matchingMove.openingInfo) {
          // Use the actual ECO information from the opening graph
          const { eco, name } = matchingMove.openingInfo;
          return {
            eco: eco || '',
            name: name || 'Unknown Opening'
          };
        }
      } catch (error) {
        // Fall through to custom fallback logic
      }
    }
    
    // Fallback to custom opening names when ECO data is not available
    const fullPath = [...currentPath, move];
    const moveNumber = Math.ceil(fullPath.length / 2);
    
    // Generate descriptive names based on common opening patterns
    if (fullPath.length === 1) {
      // First moves
      const openingNames = {
        'e4': { eco: 'C20', name: "King's Pawn Game" },
        'd4': { eco: 'D00', name: "Queen's Pawn Game" }, 
        'Nf3': { eco: 'A04', name: "Reti Opening" },
        'c4': { eco: 'A10', name: "English Opening" },
        'f4': { eco: 'A02', name: "Bird's Opening" },
        'b3': { eco: 'A01', name: "Nimzo-Larsen Attack" },
        'g3': { eco: 'A00', name: "Benko's Opening" },
        'Nc3': { eco: 'A00', name: "Van't Kruijs Opening" }
      };
      return openingNames[move] || { eco: '', name: 'User Opening' };
    } else if (fullPath.length === 2) {
      // Second moves - respond to first move
      const [firstMove, secondMove] = fullPath;
      if (firstMove === 'e4') {
        const responses = {
          'e5': { eco: 'C20', name: "King's Pawn Game" },
          'c5': { eco: 'B20', name: "Sicilian Defense" },
          'e6': { eco: 'C00', name: "French Defense" },
          'c6': { eco: 'B10', name: "Caro-Kann Defense" },
          'd6': { eco: 'B00', name: "Pirc Defense" },
          'Nc6': { eco: 'B00', name: "Nimzowitsch Defense" },
          'Nf6': { eco: 'B00', name: "Alekhine Defense" }
        };
        return responses[secondMove] || { eco: 'C20', name: "King's Pawn Opening" };
      } else if (firstMove === 'd4') {
        const responses = {
          'd5': { eco: 'D00', name: "Queen's Gambit" },
          'Nf6': { eco: 'A40', name: "Indian Defense" },
          'f5': { eco: 'A80', name: "Dutch Defense" },
          'c5': { eco: 'A40', name: "Benoni Defense" },
          'e6': { eco: 'D00', name: "Queen's Pawn Game" }
        };
        return responses[secondMove] || { eco: 'D00', name: "Queen's Pawn Opening" };
      }
      return { eco: '', name: 'Opening Development' };
    } else {
      // Later moves - more generic descriptions
      return { 
        eco: '', 
        name: moveNumber <= 6 ? `Opening Move ${moveNumber}` : 'Middle Game' 
      };
    }
  }, [openingGraph, isWhiteTree]);

  // Helper function to get moves from custom move tree
  const getMovesFromCustomTree = (path, isWhiteTree) => {
    if (!customMoveTree) return [];
    
    // Start from root and follow the path
    let currentNode = customMoveTree;
    
    // Navigate to the current position
    for (const move of path) {
      const childNode = currentNode.children.find(child => child.san === move);
      if (childNode) {
        currentNode = childNode;
      } else {
        return []; // Path doesn't exist in tree
      }
    }
    
    // Return available moves from current position with better opening info
    return currentNode.children.map(child => ({
      san: child.san,
      toFen: child.fen,
      gameCount: 1, // Default count for opening mode
      details: { winRate: 50 }, // Default neutral win rate
      winRate: 50,
      openingInfo: generateOpeningInfo(child.san, path)
    }));
  };

  // Helper function to filter performance moves to only show those that exist in the opening tree
  const filterPerformanceMovesToOpeningTree = (performanceMoves, currentPath) => {
    if (!customMoveTree || !performanceMoves || performanceMoves.length === 0) {
      return performanceMoves;
    }
    
    // Navigate to the current position in the custom tree
    let currentNode = customMoveTree;
    for (const move of currentPath) {
      const childNode = currentNode.children.find(child => child.san === move);
      if (childNode) {
        currentNode = childNode;
      } else {
        // Path doesn't exist in opening tree, return empty
        return [];
      }
    }
    
    // Get the available moves from the opening tree at this position
    const availableMovesInTree = currentNode.children.map(child => child.san);
    
    // Filter performance moves to only include those that exist in the opening tree
    return performanceMoves.filter(move => availableMovesInTree.includes(move.san));
  };

  // Calculate chunks to display and global max game count
  const { chunks, globalMaxGameCount, currentChunkIndex } = useMemo(() => {
    // Handle custom move tree mode (opening edit/view) - only when displayMode is 'opening'
    if (customMoveTree && displayMode === 'opening') {
      const result = [];
      
      // Get root moves from custom tree with improved opening info
      const rootMoves = customMoveTree.children.map(child => ({
        san: child.san,
        toFen: child.fen,
        gameCount: 1, // Default count for opening mode
        details: { winRate: 50 }, // Default neutral win rate
        winRate: 50,
        openingInfo: generateOpeningInfo(child.san, [])
      }));
      
      if (rootMoves.length > 0) {
        const title = isWhiteTree ? "Your First Moves" : "Opponent's First Moves";
        result.push({
          title,
          moves: rootMoves,
          depth: 0
        });
      }
      
      // Get moves for each position in the path
      let currentPath = [];
      for (let i = 0; i < displayPath.length && i < maxDepth - 1; i++) {
        currentPath = [...currentPath, displayPath[i]];
        const availableMoves = getMovesFromCustomTree(currentPath, isWhiteTree);
        
        if (availableMoves.length > 0) {
          // Determine whose turn it is to move
          const moveNumber = currentPath.length + 1;
          const isWhiteToMove = moveNumber % 2 === 1;
          
          let title;
          if (isWhiteTree) {
            title = isWhiteToMove ? "Your Replies" : "Opponent's Replies";
          } else {
            title = isWhiteToMove ? "Opponent's Replies" : "Your Replies";
          }
          
          result.push({
            title,
            moves: availableMoves,
            depth: i + 1
          });
        }
      }
      
      // For opening mode, global max is always 1
      const globalMaxGameCount = 1;
      const currentChunkIndex = Math.min(displayPath.length, result.length - 1);
      
      return { chunks: result, globalMaxGameCount, currentChunkIndex };
    }
    
    // Original logic for openingGraph
    if (!openingGraph) return { chunks: [], globalMaxGameCount: 0, currentChunkIndex: 0 };
    
    const result = [];
    let allMoves = []; // Collect all moves to find global maximum
    
    // Get root moves (starting position)
    const rootMoves = openingGraph.getRootMoves(isWhiteTree);
    
    // Apply filtering to root moves
    let filteredRootMoves = applyMoveFiltering(rootMoves, 0);
    
    // IMPORTANT: When in opening editor context, filter to only show moves that exist in the opening tree
    if (customMoveTree) {
      filteredRootMoves = filterPerformanceMovesToOpeningTree(filteredRootMoves, []);
    }
    
    if (filteredRootMoves.length > 0) {
      const title = isWhiteTree ? "Your First Moves" : "Opponent's First Moves";
      result.push({
        title,
        moves: filteredRootMoves,
        depth: 0
      });
      allMoves.push(...filteredRootMoves);
    }

    // Get moves for each position in the path (respect maxDepth)
    let currentMoves = [];
    for (let i = 0; i < displayPath.length && i < maxDepth - 1; i++) {
      currentMoves = [...currentMoves, displayPath[i]];
      const availableMoves = openingGraph.getMovesFromPosition(currentMoves, isWhiteTree);
      
      // Apply filtering to available moves
      let filteredMoves = applyMoveFiltering(availableMoves, i + 1);
      
      // IMPORTANT: When in opening editor context, filter to only show moves that exist in the opening tree
      if (customMoveTree) {
        filteredMoves = filterPerformanceMovesToOpeningTree(filteredMoves, currentMoves);
      }
      
      if (filteredMoves.length > 0) {
        // Determine whose turn it is to move
        const moveNumber = currentMoves.length + 1;
        const isWhiteToMove = moveNumber % 2 === 1;
        
        let title;
        if (isWhiteTree) {
          title = isWhiteToMove ? "Your Replies" : "Opponent's Replies";
        } else {
          title = isWhiteToMove ? "Opponent's Replies" : "Your Replies";
        }
        
        result.push({
          title,
          moves: filteredMoves,
          depth: i + 1
        });
        allMoves.push(...filteredMoves);
      }
    }
    
    // Calculate global maximum game count across all visible moves
    const globalMaxGameCount = allMoves.length > 0 ? Math.max(...allMoves.map(m => m.gameCount)) : 0;
    
    // Determine which chunk should be currently displayed
    // Show the chunk corresponding to the next move to be made
    const currentChunkIndex = Math.min(displayPath.length, result.length - 1);
    
    return { chunks: result, globalMaxGameCount, currentChunkIndex };
  }, [openingGraph, customMoveTree, isWhiteTree, displayPath, maxDepth, minGameCount, winRateFilter, generateOpeningInfo]);

  const handleMoveSelect = (moveData, depth) => {
    // Create new path immediately with the selected move
    const newPath = [...path.slice(0, depth), moveData.san];
    
    // Update all paths immediately for forward navigation
    setPath(newPath);
    setDisplayPath(newPath);
    setChessboardPath(newPath);
    
    // No need for actual scrolling since we only show one chunk at a time
    // The chunk change will be handled by the state update and re-render
  };

  // Navigation handlers for back/forward buttons
  const handlePrevious = () => {
    if (displayPath.length > 0) {
      const newPath = displayPath.slice(0, -1);
      setPath(newPath);
      setDisplayPath(newPath);
      setChessboardPath(newPath);
    }
  };

  const handleNext = () => {
    // For next, we need to check if there are available moves in the current chunk
    // This is more complex since we need to know which move to advance to
    // For now, we'll disable this functionality since the tree is move-selection driven
    // The user should click on moves to advance
  };

  const handleReset = () => {
    setPath([]);
    setDisplayPath([]);
    setChessboardPath([]);
  };

  if (!openingGraph && !customMoveTree) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">
          {displayMode === 'opening' 
            ? "No opening moves available" 
            : "No opening graph available"}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={(el) => {
        containerRef.current = el;
        scrollContainerRef.current = el;
      }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
      {/* Chunk Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {chunks.length > 0 && chunks[currentChunkIndex] && (
            <motion.div
              key={`chunk_${chunks[currentChunkIndex].depth}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ 
                type: 'tween',
                duration: 0.08,
                ease: 'easeInOut'
              }}
              className="h-full w-full overflow-hidden"
            >
              <GraphChunk
                title={chunks[currentChunkIndex].title}
                moves={chunks[currentChunkIndex].moves}
                onMoveSelect={(moveData) => handleMoveSelect(moveData, chunks[currentChunkIndex].depth)}
                selectedMove={(() => {
                  const selectedSan = displayPath.length > chunks[currentChunkIndex].depth ? displayPath[chunks[currentChunkIndex].depth] : null;
                  const foundMove = selectedSan ? chunks[currentChunkIndex].moves.find(m => m.san === selectedSan) : null;
                  
                  return foundMove;
                })()}
                depth={chunks[currentChunkIndex].depth}
                onMoveHover={(moveData) => {
                  if (onMoveHover) {
                    // Use global max game count for relative thickness calculation
                    const enhancedMoveData = {
                      ...moveData,
                      maxGameCount: globalMaxGameCount,
                      // Add arrow color for opening mode
                      arrowColor: displayMode === 'opening' ? '#ec4899' : undefined,
                      // For pink arrows, use consistent thickness since it's not performance data
                      fixedThickness: displayMode === 'opening' ? 14 : undefined
                    };
                    onMoveHover(enhancedMoveData);
                  }
                }}
                onMoveHoverEnd={onMoveHoverEnd}
                isLastCard={currentChunkIndex === chunks.length - 1}
                displayMode={displayMode}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 