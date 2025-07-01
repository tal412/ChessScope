import React, { useState, useMemo, useRef, useEffect } from 'react';
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
const MoveButton = ({ moveData, onSelect, isSelected, onHover, onHoverEnd, isInLastCard }) => {
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
  
  return (
    <button
      ref={buttonRef}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 relative ${
        isSelected ? getSelectedColor(winRate) : `bg-slate-700/30 ${getPerformanceColor(winRate)}`
      }`}
    >
      {/* Percentage badge in top-right corner */}
      <div className="absolute top-2 right-2">
        <Badge
          variant="outline"
          className={`text-xs font-semibold ${isSelected ? 'text-white border-white/30' : 'text-slate-300 border-slate-500/50'}`}
        >
          {winRate.toFixed(0)}%
        </Badge>
      </div>
      
      {/* Main content */}
      <div className="pr-16"> {/* Add right padding to avoid overlap with percentage */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-white text-lg">{moveData.san}</span>
        </div>
        <p className="text-sm text-slate-400 mb-2 line-clamp-2" title={
          moveData.openingInfo?.eco && moveData.openingInfo?.name 
            ? `${moveData.openingInfo.eco} ${moveData.openingInfo.name}` 
            : (moveData.openingInfo?.name || 'Unknown Opening')
        }>
          {moveData.openingInfo?.eco && moveData.openingInfo?.name 
            ? `${moveData.openingInfo.eco} ${moveData.openingInfo.name}` 
            : (moveData.openingInfo?.name || 'Unknown Opening')}
        </p>
        <div className="text-left text-xs text-slate-500">
          {moveData.gameCount}g
        </div>
      </div>
    </button>
  );
};

// Chunk component for displaying moves at a specific depth with simple list layout
const GraphChunk = ({ title, moves, onMoveSelect, selectedMove, depth, onMoveHover, onMoveHoverEnd, isLastCard }) => {
  // Sort moves by game count (descending) - most played moves first
  const sortedMoves = [...moves].sort((a, b) => b.gameCount - a.gameCount);

  return (
    <div className="w-full h-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl rounded-xl flex flex-col overflow-hidden"> {/* Simple flex container */}
      {/* Header - Fixed height */}
      <div className="p-4 pb-3 border-b border-slate-700/50">
        <div className="text-slate-200 text-base flex items-center justify-between font-semibold leading-none tracking-tight">
          <span>{title}</span>
          <Badge variant="outline" className="text-xs bg-slate-700/50 text-slate-400">
            {sortedMoves.length} moves
          </Badge>
        </div>
      </div>
      {/* Content with scrollable move list */}
      <div className="flex-1 overflow-y-auto relative">
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
  isWhiteTree = true,
  onCurrentMovesChange,
  externalMoves = [],
  onMoveHover,
  onMoveHoverEnd,
  onDirectScroll, // NEW: Direct scroll callback for external control
  initialPath = [], // NEW: Initial path to restore tree state
  // NEW: Filtering parameters to sync with performance graph
  maxDepth = 20,
  minGameCount = 20,
  winRateFilter = [0, 100]
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
        // Instead of scrolling, we update the path state to trigger chunk change
        
        // Update all path states to trigger the correct chunk display
        setPath(moves);
        setDisplayPath(moves);
        setChessboardPath(moves);
      };
      
      onDirectScrollRef.current(directScrollTo);
    }
  }, [openingGraph]); // Only run when openingGraph changes

  // Calculate current moves sequence based on chessboard path (not regular path)
  const currentMoves = useMemo(() => {
    return chessboardPath;
  }, [chessboardPath]);

  // Notify parent of current moves changes
  useEffect(() => {
    if (onCurrentMovesChangeRef.current) {
      onCurrentMovesChangeRef.current(currentMoves);
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
      
      // Force a re-render to ensure the selection is visible
      setTimeout(() => {
        setDisplayPath([...externalMoves]); // Force re-render with fresh array
      }, 10);
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
    
    // Fallback logic for game count only (respect win rate filter)
    if (validMoves.length === 0 && moves.length > 0) {
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
    }
    
    // Limit breadth at deeper levels
    const maxMovesAtLevel = Math.max(3, Math.floor(8 / Math.sqrt(currentLevel + 1)));
    if (validMoves.length > maxMovesAtLevel) {
      validMoves = [...validMoves].sort((a, b) => (b.gameCount || 0) - (a.gameCount || 0))
                                   .slice(0, maxMovesAtLevel);
    }
    
    return validMoves;
  };

  // Calculate chunks to display and global max game count
  const { chunks, globalMaxGameCount, currentChunkIndex } = useMemo(() => {
    if (!openingGraph) return { chunks: [], globalMaxGameCount: 0, currentChunkIndex: 0 };
    
    const result = [];
    let allMoves = []; // Collect all moves to find global maximum
    
    // Get root moves (starting position)
    const rootMoves = openingGraph.getRootMoves(isWhiteTree);
    
    // Apply filtering to root moves
    const filteredRootMoves = applyMoveFiltering(rootMoves, 0);
    
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
      const filteredMoves = applyMoveFiltering(availableMoves, i + 1);
      
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
  }, [openingGraph, isWhiteTree, displayPath, maxDepth, minGameCount, winRateFilter]);

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

  if (!openingGraph) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">No opening graph available</p>
      </div>
    );
  }

  return (
    <div 
      ref={(el) => {
        containerRef.current = el;
        scrollContainerRef.current = el;
      }}
      className="w-full h-full min-h-0 max-h-full flex flex-col overflow-hidden"
    >


      {/* Chunk Content */}
      <div className="flex-1 min-h-0 max-h-full overflow-hidden">
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
              className="flex-1 min-h-0 max-h-full flex flex-col w-full h-full overflow-hidden"
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
                      maxGameCount: globalMaxGameCount
                    };
                    onMoveHover(enhancedMoveData);
                  }
                }}
                onMoveHoverEnd={onMoveHoverEnd}
                isLastCard={currentChunkIndex === chunks.length - 1}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 