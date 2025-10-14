import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import Chessground from 'react-chessground';
import 'react-chessground/dist/styles/chessground.css';
import { Button } from '@/components/ui/button';
import { NavigationButtons, NavigationPresets } from '@/components/ui/navigation-buttons';
import PanelHeaderWrapper from '@/components/ui/panel-header-wrapper';
import { ChevronLeft, ChevronRight, RotateCcw, GripVertical, ArrowUpDown, Info, Fish, Loader2, AlertTriangle, BookOpen } from 'lucide-react';
import StockfishControls from './StockfishControls';
import { Chess } from 'chess.js';
import PositionInfoDialog from './PositionInfoDialog';
import StudySelector from '../studies/StudySelector';
import { getOpeningFromFen } from '../../utils/StudyDatabase';
import { checkPositionInStudies } from '@/api/hybridEntities';
import { 
  getPositionAfterMoves, 
  getPositionFromFen, 
  makeMove, 
  stringToMoves,
  movesToString,
  getCurrentTurn,
  normalizeFen
} from '@/utils/chessUtils';

// Helper function to get arrow color based on win rate (matching ChunkVisualization colors)
const getArrowColor = (winRate) => {
  if (winRate >= 70) return "green";
  if (winRate >= 60) return "blue";
  if (winRate >= 50) return "yellow";
  return "red";
};

// Helper function to calculate arrow thickness based on game count
const getArrowThickness = (gameCount, maxGameCount) => {
  if (!maxGameCount || maxGameCount === 0) return 12; // Default thickness
  
  // Scale from 8 to 20 pixels based on relative game count (much more visible range)
  const minThickness = 8;
  const maxThickness = 20;
  const ratio = gameCount / maxGameCount;
  
  return Math.max(minThickness, Math.round(minThickness + (maxThickness - minThickness) * ratio));
};

export default function InteractiveChessboard({ 
  currentMoves = [], 
  onMoveSelect, 
  onNewMove,
  isWhiteTree = true,
  className = "",
  hoveredMove = null,
  openingGraph = null, // Add openingGraph prop for position info
  graphNodes = [], // Performance graph nodes to check position existence
  onFlip = null, // External flip handler (optional)
  showPositionMessage = true, // Control whether to show "Position not in performance graph" message
  showOpeningGraphMessage = false, // Control whether to show "Position not in opening graph" message
  performanceGraphMessage = "Position not in opening graph", // Customizable message for opening graph
  customArrows = [], // Array of {from, to, color} for custom arrows
  onArrowDraw = null, // Callback for when user draws an arrow
  drawingMode = false, // Whether drawing mode is active
  onDrawingModeChange = null, // Callback when drawing mode changes
  showStudySelector = true, // Control whether to show the opening selector book icon
  moveTree = null, // Opening tree (for opening editor/viewer modes)
  mode = 'performance', // 'performance' | 'opening-editor' | 'opening-viewer'
  positionStatus = 'normal', // 'normal' | 'extended_game' | 'not_in_repertoire'
  nodeOpeningsMap = new Map(), // Pre-loaded FEN to openings mapping
  startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position FEN
  containerClassName = "", // Additional class for the container
  boardClassName = "", // Additional class for the board wrapper
  hideMovesHistory = false, // Hide the moves history section (separate from navigation)
  useStyledHeader = false, // Use the styled header matching moves panel
  onStockfishControlsRequest = null // Callback to provide Stockfish controls to external components
}) {
  const containerRef = useRef(null);
  const isInternalMoveRef = useRef(false); // Track if move change is internal
  const chessgroundRef = useRef(null); // Reference to chessground component
  const [currentMoveIndex, setCurrentMoveIndex] = useState(currentMoves.length);
  const [orientation, setOrientation] = useState(isWhiteTree ? 'white' : 'black');
  
  // Track the previous starting FEN to avoid unnecessary resets
  const prevStartingFenRef = useRef(startingFen);
  
  // Handle starting FEN changes - reset the game when starting FEN changes
  useEffect(() => {
    if (prevStartingFenRef.current !== startingFen) {
      console.log('🔄 Starting FEN changed, resetting game to:', startingFen);
      prevStartingFenRef.current = startingFen;
      
      const newGame = new Chess(startingFen);
      // Apply current moves to the new starting position
      for (let i = 0; i < Math.min(currentMoveIndex, currentMoves.length); i++) {
        try {
          newGame.move(currentMoves[i]);
        } catch (e) {
          console.warn('Invalid move when changing starting FEN:', currentMoves[i]);
          break;
        }
      }
      setGame(newGame);
    }
  }, [startingFen, currentMoves, currentMoveIndex]);
  
  // Debug prop changes
  useEffect(() => {
    // Debug logging removed
  }, [currentMoves, showOpeningGraphMessage, openingGraph, graphNodes.length]);
  
  // Sync orientation with isWhiteTree when using external flip control
  useEffect(() => {
    if (onFlip) {
      // When external flip handler is provided, sync orientation with isWhiteTree
      setOrientation(isWhiteTree ? 'white' : 'black');
    }
  }, [isWhiteTree, onFlip]);
  const [boardSize, setBoardSize] = useState(350); // Start with a reasonable default
  
  // Chess game state - single source of truth
  const [game, setGame] = useState(() => {
    const initialGame = new Chess(startingFen);
    // Apply current moves to initial game
    for (let i = 0; i < Math.min(currentMoveIndex, currentMoves.length); i++) {
      try {
        initialGame.move(currentMoves[i]);
      } catch (e) {
        console.warn('Invalid move in initial setup:', currentMoves[i]);
        break;
      }
    }
    return initialGame;
  });
  
  // State for move selection and promotion
  const [pendingMove, setPendingMove] = useState(null);
  const [selectVisible, setSelectVisible] = useState(false);
  const [lastMove, setLastMove] = useState([]);
  const [selected, setSelected] = useState(null);

  // State for arrow drawing
  const [drawingArrows, setDrawingArrows] = useState([]);
  const [currentModifiers, setCurrentModifiers] = useState({ shift: false, alt: false });

  // Stockfish state
  const [stockfish, setStockfish] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [topMoves, setTopMoves] = useState([]); // Array of {move, san, eval, confidence}
  const [stockfishEnabled, setStockfishEnabled] = useState(false); // Track if Stockfish analysis is enabled/shown
  
  // Opening and position tracking state
  const [currentOpeningInfo, setCurrentOpeningInfo] = useState({ eco: "", name: "Starting Position" });
  const [positionExistsInGraph, setPositionExistsInGraph] = useState(true);
  const [positionExistsInOpeningGraph, setPositionExistsInOpeningGraph] = useState(true);
  const [openingLoadingCache, setOpeningLoadingCache] = useState(new Map()); // Cache for opening lookups
  const [positionInOpenings, setPositionInOpenings] = useState([]); // Track which openings contain this position
  
  // Create stable reference for currentMoves to prevent infinite re-renders
  const stableCurrentMoves = useMemo(() => currentMoves, [currentMoves.length, currentMoves.join(',')]);
  const stableGraphNodes = useMemo(() => graphNodes, [graphNodes.length, graphNodes.map(n => n.data?.fen || '').join(',')]);

  // Calculate valid moves in chessground format
  const calculateDests = useCallback((game) => {
    const moves = game.moves({ verbose: true });
    const dests = new Map();
    
    for (const move of moves) {
      if (!dests.has(move.from)) {
        dests.set(move.from, []);
      }
      dests.get(move.from).push(move.to);
    }
    
    return dests;
  }, []);

  // Handle drawing mode toggle
  const handleDrawingModeToggle = () => {
    const newMode = !drawingMode;
    if (onDrawingModeChange) {
      onDrawingModeChange(newMode);
    }
  };

  // Calculate arrow shapes for both hovered moves and top stockfish moves
  const arrowShapes = useMemo(() => {
    const arrows = [];

    // Add drawing arrows (temporary arrows being drawn)
    if (drawingArrows && drawingArrows.length > 0) {
      drawingArrows.forEach((arrow, index) => {
        try {
          const brushKey = `drawing_arrow_${arrow.color.replace('#', '')}_${index}`;
          arrows.push({
            orig: arrow.from.toLowerCase(),
            dest: arrow.to.toLowerCase(),
            brush: brushKey
          });
        } catch (error) {
          console.warn('Error creating drawing arrow:', error);
        }
      });
    }

    // Add custom arrows from move annotations (always show saved arrows)
    if (customArrows && customArrows.length > 0) {
      customArrows.forEach((arrow, index) => {
        try {
          // Use a stable identifier based on arrow properties instead of array index
          const stableId = `${arrow.from}_${arrow.to}_${arrow.color.replace('#', '')}`;
          const brushKey = `custom_arrow_${stableId}`;
          arrows.push({
            orig: arrow.from.toLowerCase(),
            dest: arrow.to.toLowerCase(),
            brush: brushKey
          });
        } catch (error) {
          console.warn('Error creating custom arrow:', error);
        }
      });
    }

    // Add hovered move arrow (from tree) - only if no custom arrows
    if (!customArrows.length && hoveredMove && hoveredMove.san) {
      try {
        const tempGame = new Chess(game.fen());
        const move = tempGame.move(hoveredMove.san);
        
        if (move) {
          const winRate = Math.round(hoveredMove.details?.winRate ?? hoveredMove.winRate ?? 0);
          const gameCount = hoveredMove.gameCount ?? 0;
          // Check for custom arrow color first, otherwise use win rate-based color
          let arrowColor, brushKey;
          // Use fixed thickness if provided, otherwise calculate based on game count
          const thickness = hoveredMove.fixedThickness || getArrowThickness(gameCount, hoveredMove.maxGameCount || gameCount);
          
          if (hoveredMove.arrowColor) {
            // Use custom color - create a special brush key
            arrowColor = hoveredMove.arrowColor;
            brushKey = `custom_${arrowColor.replace('#', '')}_${thickness}`;
          } else {
            // Use win rate-based color
            arrowColor = getArrowColor(winRate);
            brushKey = `${arrowColor}_${thickness}`;
          }
          
          arrows.push({
            orig: move.from,
            dest: move.to,
            brush: brushKey
          });
        }
      } catch (error) {
        // Try fallback approach
        const validMoves = game.moves({ verbose: true });
        const matchingMove = validMoves.find(m => m.san === hoveredMove.san);
        
        if (matchingMove) {
          const winRate = Math.round(hoveredMove.details?.winRate ?? hoveredMove.winRate ?? 0);
          const gameCount = hoveredMove.gameCount ?? 0;
          // Check for custom arrow color first, otherwise use win rate-based color
          let arrowColor, brushKey;
          // Use fixed thickness if provided, otherwise calculate based on game count
          const thickness = hoveredMove.fixedThickness || getArrowThickness(gameCount, hoveredMove.maxGameCount || gameCount);
          
          if (hoveredMove.arrowColor) {
            // Use custom color - create a special brush key
            arrowColor = hoveredMove.arrowColor;
            brushKey = `custom_${arrowColor.replace('#', '')}_${thickness}`;
          } else {
            // Use win rate-based color
            arrowColor = getArrowColor(winRate);
            brushKey = `${arrowColor}_${thickness}`;
          }
          
          arrows.push({
            orig: matchingMove.from,
            dest: matchingMove.to,
            brush: brushKey
          });
        }
      }
    }

    // Add Stockfish top moves arrows (only if enabled, no custom arrows, no hovered move, and has moves)
    if (!customArrows.length && stockfishEnabled && !hoveredMove && topMoves.length > 0) {
      topMoves.forEach((moveData, index) => {
        try {
          // Different colors for ranking: blue for #1, green for #2, yellow for #3
          const colors = ['blue', 'green', 'yellow'];
          const colorHex = colors[index] === 'blue' ? '#3b82f6' : 
                           colors[index] === 'green' ? '#22c55e' : '#eab308';
          
          // Different thickness for ranking
          const thickness = 16 - (index * 2); // 16, 14, 12
          const brushKey = `stockfish_${index + 1}_${thickness}`;
          
          arrows.push({
            orig: moveData.from,
            dest: moveData.to,
            brush: brushKey
          });
        } catch (error) {
          console.warn('Error creating arrow for Stockfish move:', error);
        }
      });
    }

    return arrows;
  }, [hoveredMove, game, topMoves, stockfishEnabled, customArrows, drawingArrows]);

  // Handle piece selection
  const onSelect = useCallback((key) => {
    setSelected(key);
  }, []);

  // Handle move from chessground
  const onMove = useCallback((from, to) => {
    const moves = game.moves({ verbose: true });
    const move = moves.find(m => m.from === from && m.to === to);
    
    if (!move) return; // Invalid move
    
    // Check if it's a promotion move
    if ((move.piece === 'p' && move.color === 'w' && to[1] === '8') ||
        (move.piece === 'p' && move.color === 'b' && to[1] === '1')) {
      setPendingMove([from, to]);
      setSelectVisible(true);
      return;
    }
    
    // Make the move
    const newGame = new Chess(game.fen());
    const madeMove = newGame.move({ from, to, promotion: 'q' });
    
    if (madeMove) {
      // Mark as internal move to prevent useEffect from recreating game state
      isInternalMoveRef.current = true;
      
      setGame(newGame);
      setLastMove([from, to]);
      setSelected(null); // Clear selection after move
      
      // Update moves
      const newMoves = [...currentMoves.slice(0, currentMoveIndex), madeMove.san];
      setCurrentMoveIndex(newMoves.length);
      
      // Clear Stockfish state after move
      setTopMoves([]);
      setStockfishEnabled(false);
      
      if (onNewMove) {
        onNewMove(newMoves);
      }
    }
  }, [game, currentMoves, currentMoveIndex, onNewMove]);

  // Handle promotion piece selection
  const promotion = useCallback((piece) => {
    if (!pendingMove) return;
    
    const [from, to] = pendingMove;
    const newGame = new Chess(game.fen());
    const move = newGame.move({ from, to, promotion: piece.toLowerCase() });
    
    if (move) {
      // Mark as internal move to prevent useEffect from recreating game state
      isInternalMoveRef.current = true;
      
      setGame(newGame);
      setLastMove([from, to]);
      setSelected(null); // Clear selection after move
      
      // Update moves
      const newMoves = [...currentMoves.slice(0, currentMoveIndex), move.san];
      setCurrentMoveIndex(newMoves.length);
      
      // Clear Stockfish state after move
      setTopMoves([]);
      setStockfishEnabled(false);
      
      if (onNewMove) {
        onNewMove(newMoves);
      }
    }
    
    setPendingMove(null);
    setSelectVisible(false);
  }, [game, pendingMove, currentMoves, currentMoveIndex, onNewMove]);

  // Reset function for chessground
  const reset = useCallback(() => {
    navigateToMove(0);
  }, []);

  // Undo function for chessground
  const undo = useCallback(() => {
    if (currentMoveIndex > 0) {
      navigateToMove(currentMoveIndex - 1);
    }
  }, [currentMoveIndex]);

  // Update game state when external moves change
  useEffect(() => {
    // Skip if this is an internal move to prevent animation restart
    if (isInternalMoveRef.current) {
      isInternalMoveRef.current = false;
      return;
    }
    
    const newGame = new Chess(startingFen);
    
    // Apply moves up to current index
    for (let i = 0; i < Math.min(currentMoveIndex, currentMoves.length); i++) {
      try {
        const move = newGame.move(currentMoves[i]);
        if (i === currentMoveIndex - 1 && move) {
          setLastMove([move.from, move.to]);
        }
      } catch (e) {
        console.warn('Invalid move:', currentMoves[i]);
        break;
      }
    }
    
    setGame(newGame);
    
    // Clear selection state and Stockfish data on external position changes
    setPendingMove(null);
    setSelectVisible(false);
    setSelected(null);
    setTopMoves([]); // Clear Stockfish arrows when position changes externally
    setStockfishEnabled(false); // Disable Stockfish on position changes
  }, [stableCurrentMoves, currentMoveIndex, startingFen]);

  // Update move index when current moves change from external source
  useEffect(() => {
    if (currentMoves.length !== currentMoveIndex) {
      setCurrentMoveIndex(currentMoves.length);
    }
  }, [currentMoves.length]);

  // Update opening info and graph position existence when position changes
  useEffect(() => {
    const updatePositionInfo = async () => {
      const currentFen = game.fen();
      
      
      // Create cache key that includes both normalized FEN and move sequence for opening modes
      const normalizedFenForCache = normalizeFen(currentFen);
      const cacheKey = (mode === 'opening-editor' || mode === 'opening-viewer') 
        ? `${normalizedFenForCache}_${currentMoves.join('')}` 
        : normalizedFenForCache;
      
        // Check if we already have this position cached
  if (openingLoadingCache.has(cacheKey)) {
    const cached = openingLoadingCache.get(cacheKey);
    if (cached.openingInfo) {
      setCurrentOpeningInfo(cached.openingInfo);
    }
    setPositionExistsInGraph(cached.existsInGraph);
    // Default to true if not cached to avoid false positives
    setPositionExistsInOpeningGraph(cached.existsInOpeningGraph ?? true);
    setPositionInOpenings(cached.inOpenings || []);
    return;
  }
  
  // FIRST: Check if we have opening info in the graph nodes (no async lookup needed)
  const graphNode = graphNodes.find(node => node.data && node.data.fen === currentFen);
  if (graphNode && graphNode.data.openingEco && graphNode.data.openingName) {
    const openingInfo = {
      eco: graphNode.data.openingEco,
      name: graphNode.data.openingName
    };
    
    // Check if position exists in user's saved openings using pre-loaded map
    const normalizedFen = normalizeFen(currentFen);
    const inOpenings = nodeOpeningsMap.has(normalizedFen) ? nodeOpeningsMap.get(normalizedFen) : [];
    
    setCurrentOpeningInfo(openingInfo);
    setPositionExistsInGraph(true);
    setPositionExistsInOpeningGraph(true);
    setPositionInOpenings(inOpenings);
    
    // Cache the result
    const cacheEntry = {
      openingInfo: openingInfo,
      existsInGraph: true,
      existsInOpeningGraph: true,
      inOpenings: inOpenings
    };
    setOpeningLoadingCache(prev => new Map(prev.set(cacheKey, cacheEntry)));
    return;
  }
  
     // FALLBACK: Get opening info from database using efficient FEN lookup
   try {
     const openingInfo = await getOpeningFromFen(currentFen);
         
                // Check if current position exists in performance graph nodes
       const positionExists = graphNodes.some(node => 
         node.data && node.data.fen === currentFen
       );
       
                       // Check if position exists in the OPENING GRAPH (performance statistics)
         let positionExistsInOpening = true; // Default to true when no opening graph
         
         // For opening editor/viewer modes, check if position exists in the opening tree first
         if ((mode === 'opening-editor' || mode === 'opening-viewer') && moveTree) {
           try {
             // Use the external currentMoves prop instead of game.history() for accurate sequence
             const moveSequenceToCheck = currentMoves.length > 0 ? currentMoves : game.history();
             
             // Check if this position exists in the opening tree
             const findNodeByMoves = (node, targetMoves, currentMoves = []) => {
               if (currentMoves.length === targetMoves.length) {
                 return node;
               }
               
               if (currentMoves.length < targetMoves.length) {
                 const nextMove = targetMoves[currentMoves.length];
                 for (const child of node.children) {
                   if (child.san === nextMove) {
                     const result = findNodeByMoves(child, targetMoves, [...currentMoves, nextMove]);
                     if (result) return result;
                   }
                 }
               }
               return null;
             };
             
             const nodeInTree = findNodeByMoves(moveTree, moveSequenceToCheck);
             if (nodeInTree) {
               positionExistsInOpening = true; // Position is in the opening tree
             } else {
               // Fall back to performance graph check
               positionExistsInOpening = false;
             }
           } catch (error) {
             console.error('🚨 Error checking position in opening tree (error path):', error);
             positionExistsInOpening = true; // Default to true on error
           }
         }
         
         // Only check performance graph if not in opening mode or not found in opening tree
         if (openingGraph && (!moveTree || (mode !== 'opening-editor' && mode !== 'opening-viewer') || !positionExistsInOpening)) {
           try {
             // Use actual game history instead of currentMoves prop for position checking
             const actualMoves = game.history();
             
             // Get the move sequence to reach this position
             const moveSequence = actualMoves; // Use actual game history directly
             
             
             // Check if this position exists in the opening graph (from selected player's perspective)
             if (moveSequence.length > 0) {
               const parentSequence = moveSequence.slice(0, -1);
               
               // Only check moves from the selected player's perspective
               const moves = openingGraph.getMovesFromPosition(parentSequence, isWhiteTree);
               
               const lastMove = moveSequence[moveSequence.length - 1];
               const hasMove = moves && moves.some(m => m.san === lastMove);
               
               positionExistsInOpening = hasMove;
               
             } else {
               // Root position - check if selected player has any games in opening graph
               const playerMoves = openingGraph.getMovesFromPosition([], isWhiteTree);
               positionExistsInOpening = playerMoves && playerMoves.length > 0;
               
             }
           } catch (error) {
             console.warn('🚨 Error checking position in opening graph (error path):', error);
             positionExistsInOpening = true; // Default to true on error
           }
         }
       
       // Check if position exists in user's saved openings using pre-loaded map
       const normalizedFen = normalizeFen(currentFen);
       const inOpenings = nodeOpeningsMap.has(normalizedFen) ? nodeOpeningsMap.get(normalizedFen) : [];
       
       // Only update opening info if we found a valid opening in the database
       if (openingInfo && openingInfo.name) {
         const formattedOpening = {
           eco: openingInfo.eco || "",
           name: openingInfo.name
         };
         
         // Cache the result
         const cacheEntry = {
           openingInfo: formattedOpening,
           existsInGraph: positionExists,
           existsInOpeningGraph: positionExistsInOpening,
           inOpenings: inOpenings
         };
         setOpeningLoadingCache(prev => new Map(prev.set(cacheKey, cacheEntry)));
         
         // Update state with found opening
         setCurrentOpeningInfo(formattedOpening);
       } else {
         // No opening found, just update graph existence but keep current opening name
         const cacheEntry = {
           openingInfo: null, // Don't cache incomplete info
           existsInGraph: positionExists,
           existsInOpeningGraph: positionExistsInOpening,
           inOpenings: inOpenings
         };
         setOpeningLoadingCache(prev => new Map(prev.set(cacheKey, cacheEntry)));
       }
       
       // Always update position existence and openings
       setPositionExistsInGraph(positionExists);
       setPositionExistsInOpeningGraph(positionExistsInOpening);
       setPositionInOpenings(inOpenings);
         
       } catch (error) {
         console.error('🚨 Error in main try block - getting opening info from database:', error);
         console.error('🚨 Main try block error stack:', error.stack);
         
         // On error, just check graph existence but don't change opening name
         const positionExists = graphNodes.some(node => 
           node.data && node.data.fen === currentFen
         );
         
                         // Check if position exists in the OPENING GRAPH (performance statistics)
       let positionExistsInOpening = true; // Default to true when no opening graph
       
       // For opening editor/viewer modes, check if position exists in the opening tree first
       if ((mode === 'opening-editor' || mode === 'opening-viewer') && moveTree) {
         try {
           // Use the external currentMoves prop instead of game.history() for accurate sequence
           const moveSequenceToCheck = currentMoves.length > 0 ? currentMoves : game.history();
           
           // Check if this position exists in the opening tree
           const findNodeByMoves = (node, targetMoves, currentMoves = []) => {
             if (currentMoves.length === targetMoves.length) {
               return node;
             }
             
             if (currentMoves.length < targetMoves.length) {
               const nextMove = targetMoves[currentMoves.length];
               for (const child of node.children) {
                 if (child.san === nextMove) {
                   const result = findNodeByMoves(child, targetMoves, [...currentMoves, nextMove]);
                   if (result) return result;
                 }
               }
             }
             return null;
           };
           
           const nodeInTree = findNodeByMoves(moveTree, moveSequenceToCheck);
           if (nodeInTree) {
             positionExistsInOpening = true; // Position is in the opening tree
           } else {
             // Fall back to performance graph check
             positionExistsInOpening = false;
           }
         } catch (error) {
           console.error('🚨 Error checking position in opening tree:', error);
           positionExistsInOpening = true; // Default to true on error
         }
       }
       
       // Only check performance graph if not in opening mode or not found in opening tree
       if (openingGraph && (!moveTree || (mode !== 'opening-editor' && mode !== 'opening-viewer') || !positionExistsInOpening)) {
         try {
           // Use actual game history instead of currentMoves prop for position checking
           const actualMoves = game.history();
           
           // Get the move sequence to reach this position
           const moveSequence = actualMoves; // Use actual game history directly
           
           
           // Check if this position exists in the opening graph (from selected player's perspective)
           if (moveSequence.length > 0) {
             const parentSequence = moveSequence.slice(0, -1);
             
             // Only check moves from the selected player's perspective
             const moves = openingGraph.getMovesFromPosition(parentSequence, isWhiteTree);
             
             const lastMove = moveSequence[moveSequence.length - 1];
             const hasMove = moves && moves.some(m => m.san === lastMove);
             
             positionExistsInOpening = hasMove;
             
           } else {
             // Root position - check if selected player has any games in opening graph
             const playerMoves = openingGraph.getMovesFromPosition([], isWhiteTree);
             positionExistsInOpening = playerMoves && playerMoves.length > 0;
             
           }
         } catch (error) {
           console.error('🚨 Error checking position in opening graph:', error);
           console.error('🚨 Error stack:', error.stack);
           positionExistsInOpening = true; // Default to true on error
         }
       }
         
         setPositionExistsInGraph(positionExists);
         setPositionExistsInOpeningGraph(positionExistsInOpening);
         setPositionInOpenings([]);
       }
    };
    
    updatePositionInfo();
  }, [game.fen(), stableGraphNodes, stableCurrentMoves, moveTree, mode, currentMoves]); // Use stable dependencies to prevent infinite loop

  // Helper function to update opening info synchronously from graph nodes
  const updateOpeningInfoFromGraph = useCallback((moves) => {
    try {
      // Create a temporary game to get the FEN for these moves
      const tempGame = new Chess(startingFen);
      for (const move of moves) {
        tempGame.move(move);
      }
      const targetFen = tempGame.fen();
      
      // Find the graph node with this FEN
      const graphNode = graphNodes.find(node => node.data && node.data.fen === targetFen);
      
      if (graphNode && graphNode.data.openingEco && graphNode.data.openingName) {
        const openingInfo = {
          eco: graphNode.data.openingEco,
          name: graphNode.data.openingName
        };
        setCurrentOpeningInfo(openingInfo);
        return true; // Successfully updated
      }
      
      // If no graph node found, set appropriate default
      if (moves.length === 0) {
        setCurrentOpeningInfo({ eco: "", name: "Starting Position" });
        return true;
      }
    } catch (error) {
      console.warn('Error updating opening info from graph:', error);
    }
    
    return false; // Could not update synchronously
  }, [graphNodes, startingFen]);

  // Synchronously update opening info when currentMoves changes (from external node clicks)
  useEffect(() => {
    updateOpeningInfoFromGraph(currentMoves);
  }, [currentMoves, updateOpeningInfoFromGraph]);

  // Helper function to get formatted opening name for display
  const getFormattedOpeningName = () => {
    // For starting position, always show just "Starting Position" without ECO
    if (stableCurrentMoves.length === 0) {
      return "Starting Position";
    }
    
    if (currentOpeningInfo.eco) {
      return `${currentOpeningInfo.eco} ${currentOpeningInfo.name}`;
    }
    return currentOpeningInfo.name;
  };

  // Responsive board sizing using ResizeObserver and viewport-based calculations
  useLayoutEffect(() => {
    const updateBoardSize = () => {
      if (containerRef.current) {
        // Get the chessboard container element
        const boardContainer = containerRef.current.querySelector('[data-board-container]');
        if (boardContainer) {
          const rect = boardContainer.getBoundingClientRect();
          // Only update if container has meaningful dimensions
          if (rect.width > 0 && rect.height > 0) {
            // Use 95% of the smaller dimension for the board size to fill more space
            const size = Math.min(rect.width, rect.height) * 0.95;
            const newSize = Math.max(320, Math.min(800, size));
            
            // Only update if size changed significantly to prevent excessive re-renders
            if (Math.abs(newSize - boardSize) > 5) {
              setBoardSize(newSize);
            }
          }
        }
      }
    };

    // Immediate calculation - no timeout
    updateBoardSize();
    
    // Add ResizeObserver for better container size tracking
    let resizeObserver;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        // Direct update, no debouncing
        updateBoardSize();
      });
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateBoardSize);
    
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateBoardSize);
    };
  }, [boardSize]);

  // Trigger board size recalculation when Stockfish state changes
  useLayoutEffect(() => {
    if (containerRef.current) {
      const boardContainer = containerRef.current.querySelector('[data-board-container]');
      if (boardContainer) {
        const rect = boardContainer.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const size = Math.min(rect.width, rect.height) * 0.85;
          const newSize = Math.max(280, Math.min(600, size));
          setBoardSize(newSize);
        }
      }
    }
  }, [isAnalyzing, topMoves.length]); // Recalculate when Stockfish state changes

  // Track container dimensions to detect layout changes
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  
  // Force chessground re-mount when container dimensions change significantly
  const [chessgroundKey, setChessgroundKey] = useState(0);
  
  // Proper chessground resize handler
  const handleChessgroundResize = useCallback(() => {
    if (chessgroundRef.current && chessgroundRef.current.cg) {
      // Use chessground's built-in redrawAll method which properly recalculates coordinates
      const cg = chessgroundRef.current.cg;
      if (cg.redrawAll) {
        cg.redrawAll();
      }
    }
  }, []);

  // Track container size changes and trigger chessground updates
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Only update if dimensions changed significantly
        if (Math.abs(width - containerDimensions.width) > 10 || 
            Math.abs(height - containerDimensions.height) > 10) {
          
          setContainerDimensions({ width, height });
          
          // Force chessground re-mount for significant changes
          setChessgroundKey(prev => prev + 1);
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [containerDimensions.width, containerDimensions.height]);

  const navigateToMove = (moveIndex) => {
    const clampedIndex = Math.max(0, Math.min(moveIndex, currentMoves.length));
    const movesToApply = currentMoves.slice(0, clampedIndex);
    
    // FIRST: Update opening info synchronously from graph nodes (prevents blink)
    updateOpeningInfoFromGraph(movesToApply);
    
    // SECOND: Trigger tree update IMMEDIATELY before any state changes
    if (onMoveSelect) {
      onMoveSelect(movesToApply);
    }
    
    // THIRD: Update chessboard state
    setCurrentMoveIndex(clampedIndex);
  };

  const handlePrevMove = () => {
    const newIndex = currentMoveIndex - 1;
    const clampedIndex = Math.max(0, Math.min(newIndex, currentMoves.length));
    const movesToApply = currentMoves.slice(0, clampedIndex);
    
    // FIRST: Update opening info synchronously from graph nodes (prevents blink)
    updateOpeningInfoFromGraph(movesToApply);
    
    // SECOND: Trigger tree scroll/update ONLY (no chessboard update yet)
    if (onMoveSelect) {
      onMoveSelect(movesToApply);
    }
    
    // THIRD: Update the chessboard position immediately – remove the previous 200 ms delay
    setCurrentMoveIndex(clampedIndex);
  };

  const handleNextMove = () => {
    navigateToMove(currentMoveIndex + 1);
  };

  const handleReset = () => {
    // FIRST: Update opening info synchronously for starting position
    updateOpeningInfoFromGraph([]);
    
    // SECOND: Clear the moves completely, not just reset the index
    if (onNewMove) {
      onNewMove([]);
    }
    
    // THIRD: Navigate to starting position
    navigateToMove(0);
  };

  const toggleOrientation = () => {
    if (onFlip) {
      // Use external flip handler (from PerformanceGraph)
      onFlip();
    } else {
      // Fall back to internal flip logic for standalone use
      const newOrientation = orientation === 'white' ? 'black' : 'white';
      setOrientation(newOrientation);
    }
  };

  // Initialize Stockfish
  useEffect(() => {
    let engine = null;
    
    // Add a simple test that users can run in console
    window.testStockfish = () => {
      if (typeof window.stockfish === 'function') {
        try {
          const sf = eval('stockfish');
          const engine = sf();
          engine.postMessage('quit');
        } catch (e) {
          console.error('❌ Stockfish failed:', e.message);
        }
      } else {
        console.error('❌ window.stockfish is not a function');
      }
    };
    
    const initEngine = () => {
      try {
        // Use eval approach like in chess-master project
        // The stockfish.js file exposes STOCKFISH (uppercase)
        let sf;
        if (typeof window.STOCKFISH === 'function') {
          sf = window.STOCKFISH;
        } else if (typeof window.stockfish === 'function') {
          sf = window.stockfish;
        } else {
          // Try eval as fallback
          try {
            sf = eval('STOCKFISH') || eval('stockfish');
          } catch (e) {
            throw new Error('Neither STOCKFISH nor stockfish function found');
          }
        }
        
        engine = sf();
        
        setStockfish(engine);
        
        // Set up a default message handler to prevent warnings
        engine.onmessage = (message) => {
          // Just log initialization messages, actual analysis will override this
        };
        
        // Initialize engine
        engine.postMessage('uci');
        engine.postMessage('isready');
        
        return engine;
      } catch (error) {
        console.error('❌ Failed to initialize Stockfish:', error);
        console.error('Error details:', error.message);
        console.error('Make sure stockfish.js is loaded in public folder');
        return null;
      }
    };
    
    // Wait for stockfish to load with timeout
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    
    const checkStockfish = () => {
      attempts++;
      
      if (typeof window !== 'undefined' && (typeof window.STOCKFISH === 'function' || typeof window.stockfish === 'function')) {
        initEngine();
      } else if (attempts >= maxAttempts) {
        console.error('❌ Stockfish script failed to load after 5 seconds');
        console.error('Please check if /stockfish.js is accessible in your browser');
      } else {
        setTimeout(checkStockfish, 100);
      }
    };
    
    // Also listen for script load events
    const handleScriptLoad = () => {
      if (typeof window.STOCKFISH === 'function' || typeof window.stockfish === 'function') {
        initEngine();
      }
    };
    
    // Listen for custom events if the script loads
    window.addEventListener('stockfish-loaded', handleScriptLoad);
    
    checkStockfish();
    
    return () => {
      window.removeEventListener('stockfish-loaded', handleScriptLoad);
      if (engine) {
        try {
          engine.postMessage('quit');
        } catch (e) {
          // Engine cleanup completed
        }
      }
    };
  }, []);

  // Toggle Stockfish analysis function - turns analysis on/off
  const toggleStockfishAnalysis = useCallback(() => {
    if (!stockfish) {
      console.error('❌ Stockfish not initialized yet');
      alert('Stockfish engine not ready yet. Please try again in a moment.');
      return;
    }
    
    // If currently enabled, disable and clear
    if (stockfishEnabled) {
      setStockfishEnabled(false);
      setIsAnalyzing(false);
      setTopMoves([]);
      
      // Stop any ongoing analysis
      if (stockfish.onmessage) {
        stockfish.onmessage = null;
      }
      try {
        stockfish.postMessage('stop');
      } catch (e) {
        // Stop command sent
      }
      return;
    }
    
    // If disabled, enable and start analysis
    if (isAnalyzing) {
      return;
    }
    
    setStockfishEnabled(true);
    setIsAnalyzing(true);
    setTopMoves([]);
    
    const fen = game.fen();
    
    const candidateMoves = [];
    
    const handleMessage = (event) => {
      const message = event.data ? event.data : event;
      
      // Parse MultiPV info lines
      if (message.includes('info depth') && message.includes('multipv') && message.includes('pv')) {
        const depthMatch = message.match(/depth (\d+)/);
        const multipvMatch = message.match(/multipv (\d+)/);
        const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
        const pvMatch = message.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbnQRBN]?)/); // Get first UCI move from PV
        
        if (depthMatch && multipvMatch && pvMatch) {
          const depth = parseInt(depthMatch[1]);
          const multipv = parseInt(multipvMatch[1]);
          const uciMove = pvMatch[1];
          
          let evaluation = 0;
          if (scoreMatch) {
            const [, type, value] = scoreMatch;
            if (type === 'cp') {
              evaluation = parseInt(value) / 100;
            } else if (type === 'mate') {
              evaluation = `M${value}`;
            }
          }
          
          // Convert UCI to SAN
          try {
            const tempGame = new Chess(fen);
            const move = tempGame.move(uciMove, { sloppy: true });
            
            if (move) {
              const moveData = {
                multipv: multipv,
                uci: uciMove,
                san: move.san,
                from: move.from,
                to: move.to,
                evaluation: evaluation,
                confidence: Math.min(95, Math.max(50, depth * 4)),
                depth: depth
              };
              
              // Update or add move
              const existingIndex = candidateMoves.findIndex(m => m.multipv === multipv);
              if (existingIndex >= 0) {
                candidateMoves[existingIndex] = moveData;
              } else {
                candidateMoves.push(moveData);
              }
              
              // Sort by multipv and update state
              const sortedMoves = candidateMoves
                .sort((a, b) => a.multipv - b.multipv)
                .slice(0, 3);
              
              setTopMoves([...sortedMoves]);
            }
          } catch (error) {
            console.warn('Error converting UCI move:', uciMove, error);
          }
        }
      }
      
      // Analysis complete
      if (message.startsWith('bestmove')) {
        setIsAnalyzing(false);
        stockfish.onmessage = null;
      }
    };
    
    stockfish.onmessage = handleMessage;
    
    // Send commands to Stockfish with MultiPV enabled
    stockfish.postMessage('setoption name MultiPV value 3');
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage('go depth 12');
  }, [stockfish, isAnalyzing, game, stockfishEnabled]);

  // Calculate current turn and valid moves
  const currentTurn = game.turn() === 'w' ? 'white' : 'black';
  const dests = calculateDests(game);

  // Generate dynamic brushes for all thickness and color combinations
  const dynamicBrushes = useMemo(() => {
    const brushes = {};
    const colors = {
      green: '#22c55e',
      blue: '#3b82f6',
      yellow: '#eab308', 
      red: '#ef4444'
    };
    
    // Generate brushes for tree move arrows (thickness range 8-20)
    for (let thickness = 8; thickness <= 20; thickness++) {
      Object.entries(colors).forEach(([colorName, colorHex]) => {
        const brushKey = `${colorName}_${thickness}`;
        brushes[brushKey] = {
          key: brushKey.charAt(0) + thickness, // Unique key like 'g4', 'g5', etc.
          color: colorHex,
          opacity: 0.8,
          lineWidth: thickness
        };
      });
    }
    
    // Generate brushes for Stockfish arrows (ranking-based)
    const stockfishColors = {
      1: { color: '#3b82f6', thickness: 16 }, // Blue for #1
      2: { color: '#22c55e', thickness: 14 }, // Green for #2  
      3: { color: '#eab308', thickness: 12 }  // Yellow for #3
    };
    
    Object.entries(stockfishColors).forEach(([rank, { color, thickness }]) => {
      const brushKey = `stockfish_${rank}_${thickness}`;
      brushes[brushKey] = {
        key: `sf${rank}`, // Unique key like 'sf1', 'sf2', 'sf3'
        color: color,
        opacity: 0.9,
        lineWidth: thickness
      };
    });

    // Generate brushes for custom arrows
    if (customArrows && customArrows.length > 0) {
      customArrows.forEach((arrow, index) => {
        // Use a stable identifier based on arrow properties instead of array index
        const stableId = `${arrow.from}_${arrow.to}_${arrow.color.replace('#', '')}`;
        const brushKey = `custom_arrow_${stableId}`;
        brushes[brushKey] = {
          key: `ca_${stableId}`, // Unique key for custom arrows using stable ID
          color: arrow.color,
          opacity: 0.9,
          lineWidth: 14 // Standard thickness for custom arrows
        };
      });
    }

    // Generate brushes for drawing arrows
    if (drawingArrows && drawingArrows.length > 0) {
      drawingArrows.forEach((arrow, index) => {
        const brushKey = `drawing_arrow_${arrow.color.replace('#', '')}_${index}`;
        brushes[brushKey] = {
          key: `da${index}`, // Unique key for drawing arrows
          color: arrow.color,
          opacity: 0.7, // Slightly transparent for drawing mode
          lineWidth: 16 // Slightly thicker for visibility while drawing
        };
      });
    }
    
    return brushes;
  }, [customArrows, drawingArrows]);

  // Dynamic brush generation for custom colors (like pink arrows)
  const generateCustomBrush = useCallback((color, thickness) => {
    const colorKey = color.replace('#', '');
    const brushKey = `custom_${colorKey}_${thickness}`;
    return {
      [brushKey]: {
        key: `c_${colorKey}_${thickness}`, // Make the internal key unique
        color: color,
        opacity: 0.8,
        lineWidth: thickness
      }
    };
  }, []);

  // Handle drawable changes - this is called when arrows are drawn/removed
  const handleDrawableChange = useCallback((shapes) => {
    // Only save arrows when in drawing mode
    if (!drawingMode || !onArrowDraw) return;
    
    // Find the most recent arrow (last one in the array)
    const newArrows = shapes.filter(shape => 
      shape.orig && shape.dest && shape.brush &&
      !customArrows.find(arrow => arrow.from === shape.orig && arrow.to === shape.dest)
    );
    
    if (newArrows.length > 0) {
      const latestArrow = newArrows[newArrows.length - 1];
      
      // Map brush names to colors
      const brushColorMap = {
        'green': '#22c55e',
        'red': '#ef4444', 
        'blue': '#3b82f6',
        'yellow': '#eab308',
        'purple': '#a855f7',
        'orange': '#f97316',
        'pink': '#ec4899',
        'cyan': '#06b6d4'
      };
      
      // Get color from brush or default to green
      let color = brushColorMap[latestArrow.brush] || '#22c55e';
      
      onArrowDraw(latestArrow.orig, latestArrow.dest, color);
    }
  }, [drawingMode, onArrowDraw, customArrows]);

  // Keyboard event listeners for drawing mode
  useEffect(() => {
    if (!drawingMode) {
      setCurrentModifiers({ shift: false, alt: false });
      return;
    }

    const handleKeyDown = (e) => {
      // Prevent default browser behavior for modifier keys when in drawing mode
      if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') {
        e.preventDefault();
      }
      
      setCurrentModifiers({
        shift: e.shiftKey,
        alt: e.altKey || e.metaKey // Alt on Windows/Linux, Cmd on Mac
      });
    };

    const handleKeyUp = (e) => {
      // Prevent default browser behavior for modifier keys when in drawing mode
      if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') {
        e.preventDefault();
      }
      
      setCurrentModifiers({
        shift: e.shiftKey,
        alt: e.altKey || e.metaKey
      });
    };

    const handleBlur = () => {
      setCurrentModifiers({ shift: false, alt: false });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [drawingMode]);

  // Get current arrow color based on modifiers
  const getCurrentArrowColor = () => {
    if (currentModifiers.shift && currentModifiers.alt) return 'yellow';
    if (currentModifiers.shift) return 'red';
    if (currentModifiers.alt) return 'blue';
    return 'green';
  };

  // Function to get Stockfish controls component for external headers
  const getStockfishControls = () => {
    return (
      <StockfishControls
        stockfishEnabled={stockfishEnabled}
        isAnalyzing={isAnalyzing}
        onToggle={toggleStockfishAnalysis}
        topMoves={topMoves}
      />
    );
  };

  // Provide Stockfish controls to external components when requested
  useEffect(() => {
    if (onStockfishControlsRequest) {
      onStockfishControlsRequest(getStockfishControls());
    }
  }, [stockfishEnabled, isAnalyzing, topMoves, onStockfishControlsRequest]);

  return (
    <div ref={containerRef} className={`w-full h-full ${containerClassName} ${className}`}>
      <div 
        className={`w-full h-full flex flex-col ${boardClassName}`}
      >
        {!useStyledHeader && (
            <div className="bg-card/30 backdrop-blur-sm border-b border-border/20 pb-2 px-4 pt-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* Fixed height container for opening title - always reserves space for 2 lines */}
                  <div className="h-14 flex items-start">
                    <div className="text-card-foreground text-lg leading-tight line-clamp-2 font-semibold leading-none tracking-tight" title={getFormattedOpeningName()}>
                      {getFormattedOpeningName()}
                    </div>
                  </div>
                  {/* Reserved space for Position Status Indicator - prevents layout shifts */}
                  <div className="h-8 flex flex-col justify-start">
                    {positionStatus !== 'normal' && currentMoves.length > 0 && showPositionMessage && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                        <span className="text-xs text-orange-400">
                          {positionStatus === 'extended_game' 
                            ? 'Extended beyond performance graph'
                            : 'Position not in performance graph'
                          }
                        </span>
                      </div>
                    )}
                    {!positionExistsInOpeningGraph && game.fen() !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' && showOpeningGraphMessage && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                        <span className="text-xs text-orange-400">{performanceGraphMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Stockfish Analysis Toggle Button - Top Right (hidden when drawing) */}
                {!drawingMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      toggleStockfishAnalysis();
                    }}
                    disabled={isAnalyzing && !stockfishEnabled}
                    className={`transition-all duration-200 flex-shrink-0 ${
                      stockfishEnabled || isAnalyzing
                        ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90 hover:border-primary/90' // Active when enabled
                        : 'bg-secondary/50 border-border text-muted-foreground hover:bg-accent/60 hover:border-border hover:text-foreground' // Default inactive state
                    }`}
                    title={stockfishEnabled ? "Disable Stockfish analysis" : "Enable Stockfish analysis"}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Fish className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
        )}
        <div className={`flex-1 flex flex-col min-h-0 p-4`}>
          {/* Chessboard using react-chessground */}
          <div 
            data-board-container 
            className="flex-1 flex items-center justify-center min-h-0 w-full"
            style={{ 
              minHeight: '300px'
            }}
          >
            <div 
              style={{ 
                width: boardSize, 
                height: boardSize, 
                minWidth: '320px',
                minHeight: '320px'
              }}
              className="relative"
            >
              <Chessground
                ref={chessgroundRef}
                key={chessgroundKey} // Force re-mount when layout changes significantly
                fen={game.fen()}
                orientation={orientation}
                turnColor={currentTurn}
                movable={{
                  free: false,
                  color: currentTurn,
                  dests: dests,
                  showDests: true,
                  events: {
                    after: onMove
                  }
                }}
                draggable={{
                  enabled: true, // Enable drag and drop
                  distance: 3, // Minimum distance to initiate drag
                  autoDistance: false, // Don't auto-adjust distance
                  showGhost: true, // Show ghost piece while dragging
                  deleteOnDropOff: false // Don't delete pieces when dropped off board
                }}
                selectable={{
                  enabled: true // Enable click-to-move
                }}
                drawable={{
                  enabled: true, // Always enable for right-click drawing
                  visible: true,
                  autoShapes: arrowShapes,
                  shapes: [], // Always clear chessground's own shapes to avoid duplicates
                  brushes: {
                    // Standard chessground brushes for right-click drawing
                    green: { key: 'g', color: '#22c55e', opacity: 0.8, lineWidth: 10 },
                    red: { key: 'r', color: '#ef4444', opacity: 0.8, lineWidth: 10 },
                    blue: { key: 'b', color: '#3b82f6', opacity: 0.8, lineWidth: 10 },
                    yellow: { key: 'y', color: '#eab308', opacity: 0.8, lineWidth: 10 },
                    purple: { key: 'p', color: '#a855f7', opacity: 0.8, lineWidth: 10 },
                    orange: { key: 'o', color: '#f97316', opacity: 0.8, lineWidth: 10 },
                    pink: { key: 'k', color: '#ec4899', opacity: 0.8, lineWidth: 10 },
                    cyan: { key: 'c', color: '#06b6d4', opacity: 0.8, lineWidth: 10 },
                    ...dynamicBrushes,
                        // Add custom brushes for pink arrows if needed
    ...(hoveredMove?.arrowColor ? generateCustomBrush(hoveredMove.arrowColor, hoveredMove.fixedThickness || getArrowThickness(hoveredMove.gameCount || 0, hoveredMove.maxGameCount || 0)) : {})
                  },
                  // Use onChange to capture arrow drawing
                  onChange: handleDrawableChange
                }}
                promotion={promotion}
                reset={reset}
                undo={undo}
                lastMove={lastMove}
                selected={selected}
                onSelect={onSelect}
                selectVisible={selectVisible}
                check={game.inCheck() ? currentTurn : undefined}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                }}
              />
            </div>
          </div>

        {/* Stockfish Status Area - Fixed height to prevent layout shifts (invisible when drawing) */}
        <div className={`flex-shrink-0 px-2 py-1 h-8 flex items-center justify-center min-h-[32px] ${drawingMode ? 'invisible' : ''}`}>
          {stockfishEnabled ? (
            isAnalyzing ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Stockfish analyzing...</span>
              </div>
            ) : topMoves.length > 0 ? (
              <div className="text-xs text-muted-foreground text-center">
                Engine suggests: {topMoves.map((move, i) => 
                  <span key={i} className="text-foreground font-mono">
                    {move.san}{typeof move.evaluation === 'number' ? ` (${move.evaluation > 0 ? '+' : ''}${move.evaluation.toFixed(1)})` : ''}
                    {i < topMoves.length - 1 ? ', ' : ''}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground opacity-50">
                Stockfish analysis enabled
              </div>
            )
          ) : (
            <div className="text-xs text-slate-500 opacity-50">
              Click 🐟 to enable Stockfish analysis
            </div>
          )}
        </div>

        {/* Move Navigation */}
        {(
        <div data-nav-section className="flex-shrink-0 bg-card/20 backdrop-blur-sm border-t border-border/20 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Left spacer for balance */}
            <div className="w-8"></div>
            
            {/* Centered Navigation */}
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-sm">
                <NavigationButtons
                currentIndex={currentMoveIndex}
                totalCount={currentMoves.length}
                onPrevious={handlePrevMove}
                onNext={handleNextMove}
                onReset={handleReset}
                onFlip={toggleOrientation}
                features={NavigationPresets.chessboard.features}
                labels={NavigationPresets.chessboard.labels}
                disabled={false}
                styling={{
                  className: "max-w-full"
                }}
                />
              </div>
            </div>

            {/* Right side - Position Info Button and Book Icon */}
          <div className="flex items-center gap-1">
            {showStudySelector && (
              <StudySelector fen={game.fen()} openings={positionInOpenings}>
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    positionInOpenings.length > 0
                      ? "bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30 hover:border-amber-400 hover:text-amber-300 transition-all duration-200"
                      : "bg-secondary/50 border-border text-muted-foreground hover:bg-accent/70 hover:border-border cursor-pointer transition-all duration-200"
                  }
                  title={
                    positionInOpenings.length > 0
                      ? `In ${positionInOpenings.length} saved opening${positionInOpenings.length > 1 ? 's' : ''}`
                      : "No saved openings contain this position"
                  }
                >
                  <BookOpen className="w-4 h-4" />
                  {positionInOpenings.length > 1 && (
                    <span className="ml-1 text-xs">{positionInOpenings.length}</span>
                  )}
                </Button>
              </StudySelector>
            )}
            {openingGraph && currentMoves.length > 0 && startingFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' && (
              <PositionInfoDialog
                openingGraph={openingGraph}
                currentMoves={currentMoves}
                isWhite={isWhiteTree}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-secondary/50 border-border text-muted-foreground hover:bg-accent/60 hover:border-border hover:text-foreground transition-all duration-200"
                  title="Position information"
                >
                  <Info className="w-4 h-4" />
                </Button>
              </PositionInfoDialog>
            )}
            </div>
          </div>
        </div>
        )}

        {/* Move List or Drawing Mode UI - Minimalist design */}
        {!hideMovesHistory && (
        <div data-move-list className="flex-shrink-0 bg-background/80 backdrop-blur-sm border-t border-border/20 px-4 py-3 min-h-[80px] max-h-[100px] overflow-hidden">
          {drawingMode ? (
            /* Drawing Mode UI */
            <div className="h-full flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-success animate-pulse rounded-full"></div>
                <span className="text-xs font-medium text-foreground">Drawing Mode Active</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="mb-1">Right-click drag for arrows:</div>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1 px-1 py-0.5 rounded transition-colors ${getCurrentArrowColor() === 'green' ? 'bg-success/10' : ''}`}>
                    <div className="w-2 h-0.5 bg-success rounded-full"></div>
                    <span className="text-xs">None</span>
                  </div>
                  <div className={`flex items-center gap-1 px-1 py-0.5 rounded transition-colors ${getCurrentArrowColor() === 'red' ? 'bg-error/10' : ''}`}>
                    <div className="w-2 h-0.5 bg-error rounded-full"></div>
                    <span className="text-xs">SHIFT</span>
                  </div>
                  <div className={`flex items-center gap-1 px-1 py-0.5 rounded transition-colors ${getCurrentArrowColor() === 'blue' ? 'bg-info/10' : ''}`}>
                    <div className="w-2 h-0.5 bg-info rounded-full"></div>
                    <span className="text-xs">ALT/CMD</span>
                  </div>
                  <div className={`flex items-center gap-1 px-1 py-0.5 rounded transition-colors ${getCurrentArrowColor() === 'yellow' ? 'bg-warning/10' : ''}`}>
                    <div className="w-2 h-0.5 bg-warning rounded-full"></div>
                    <span className="text-xs">SHIFT+ALT/CMD</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Minimalist Move History */
            <div className="h-full flex flex-col">
              {currentMoves.length > 0 ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-1 leading-relaxed">
                    {currentMoves.map((move, index) => {
                      const moveNumber = Math.floor(index / 2) + 1;
                      const isWhiteMove = index % 2 === 0;
                      const isCurrentMove = index === currentMoveIndex - 1;
                      
                      return (
                        <React.Fragment key={index}>
                          {isWhiteMove && (
                            <span className="text-xs text-muted-foreground/70 font-mono select-none">
                              {moveNumber}.
                            </span>
                          )}
                          <button
                            onClick={() => navigateToMove(index + 1)}
                            className={`inline-flex items-center px-1.5 py-0.5 text-sm font-mono transition-all duration-200 hover:scale-105 ${
                              isCurrentMove 
                                ? 'text-primary font-semibold bg-primary/10 rounded-sm' 
                                : 'text-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-sm'
                            }`}
                          >
                            {move}
                          </button>
                          {!isWhiteMove && index < currentMoves.length - 1 && (
                            <span className="text-muted-foreground/40 select-none mx-0.5">•</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <div className="w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40"></div>
                    </div>
                    <span className="text-xs text-muted-foreground/60">No moves yet</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
    </div>
  );
}