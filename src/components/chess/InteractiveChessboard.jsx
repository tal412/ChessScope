import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import Chessground from 'react-chessground';
import 'react-chessground/dist/styles/chessground.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NavigationButtons, NavigationPresets } from '@/components/ui/navigation-buttons';
import { ChevronLeft, ChevronRight, RotateCcw, GripVertical, ArrowUpDown, Info, Fish, Loader2, AlertTriangle, BookOpen } from 'lucide-react';
import { Chess } from 'chess.js';
import PositionInfoDialog from '../opening-moves/PositionInfoDialog';
import OpeningSelector from '../opening-moves/OpeningSelector';
import { getOpeningFromFen } from '../chess/OpeningDatabase';
import { checkPositionInOpenings } from '@/api/openingEntities';
import { 
  getPositionAfterMoves, 
  getPositionFromFen, 
  makeMove, 
  stringToMoves,
  movesToString,
  getCurrentTurn
} from '@/utils/chessUtils';

// Helper function to get arrow color based on win rate (matching ChunkVisualization colors)
const getArrowColor = (winRate) => {
  if (winRate > 60) return "green"; // green brush
  if (winRate >= 50) return "yellow"; // yellow brush
  return "red"; // red brush
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
  onFlip = null // External flip handler (optional)
}) {
  const containerRef = useRef(null);
  const isInternalMoveRef = useRef(false); // Track if move change is internal
  const [currentMoveIndex, setCurrentMoveIndex] = useState(currentMoves.length);
  const [orientation, setOrientation] = useState(isWhiteTree ? 'white' : 'black');
  
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
    const initialGame = new Chess();
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

  // Stockfish state
  const [stockfish, setStockfish] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [topMoves, setTopMoves] = useState([]); // Array of {move, san, eval, confidence}
  const [stockfishEnabled, setStockfishEnabled] = useState(false); // Track if Stockfish analysis is enabled/shown
  
  // Opening and position tracking state
  const [currentOpeningInfo, setCurrentOpeningInfo] = useState({ eco: "", name: "Starting Position" });
  const [positionExistsInGraph, setPositionExistsInGraph] = useState(true);
  const [openingLoadingCache, setOpeningLoadingCache] = useState(new Map()); // Cache for opening lookups
  const [positionInOpenings, setPositionInOpenings] = useState([]); // Track which openings contain this position

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

  // Calculate arrow shapes for both hovered moves and top stockfish moves
  const arrowShapes = useMemo(() => {
    const arrows = [];

    // Add hovered move arrow (from tree)
    if (hoveredMove && hoveredMove.san) {
      try {
        const tempGame = new Chess(game.fen());
        const move = tempGame.move(hoveredMove.san);
        
        if (move) {
          const winRate = hoveredMove.details?.winRate ?? hoveredMove.winRate ?? 0;
          const gameCount = hoveredMove.gameCount ?? 0;
          const arrowColor = getArrowColor(winRate);
          const thickness = getArrowThickness(gameCount, hoveredMove.maxGameCount || gameCount);
          const brushKey = `${arrowColor}_${thickness}`;
          
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
          const winRate = hoveredMove.details?.winRate ?? hoveredMove.winRate ?? 0;
          const gameCount = hoveredMove.gameCount ?? 0;
          const arrowColor = getArrowColor(winRate);
          const thickness = getArrowThickness(gameCount, hoveredMove.maxGameCount || gameCount);
          const brushKey = `${arrowColor}_${thickness}`;
          
          arrows.push({
            orig: matchingMove.from,
            dest: matchingMove.to,
            brush: brushKey
          });
        }
      }
    }

    // Add Stockfish top moves arrows (only if enabled, no hovered move, and has moves)
    if (stockfishEnabled && !hoveredMove && topMoves.length > 0) {
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
  }, [hoveredMove, game, topMoves, stockfishEnabled]);

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
    
    const newGame = new Chess();
    
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
  }, [currentMoves, currentMoveIndex]);

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
      
      // Check if we already have this FEN cached
      if (openingLoadingCache.has(currentFen)) {
        const cached = openingLoadingCache.get(currentFen);
        setCurrentOpeningInfo(cached.openingInfo);
        setPositionExistsInGraph(cached.existsInGraph);
        setPositionInOpenings(cached.inOpenings || []);
        return;
      }
      
             // Get opening info from database using efficient FEN lookup
       try {
         const openingInfo = await getOpeningFromFen(currentFen);
         
         // Check if current position exists in performance graph nodes
         const positionExists = graphNodes.some(node => 
           node.data && node.data.fen === currentFen
         );
         
         // Check if position exists in user's saved openings
         const username = localStorage.getItem('chesscope_username');
         const inOpenings = username ? await checkPositionInOpenings(currentFen, username) : [];
         
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
             inOpenings: inOpenings
           };
           setOpeningLoadingCache(prev => new Map(prev.set(currentFen, cacheEntry)));
           
           // Update state with found opening
           setCurrentOpeningInfo(formattedOpening);
         } else {
           // No opening found, just update graph existence but keep current opening name
           const cacheEntry = {
             openingInfo: currentOpeningInfo, // Keep current opening info
             existsInGraph: positionExists,
             inOpenings: inOpenings
           };
           setOpeningLoadingCache(prev => new Map(prev.set(currentFen, cacheEntry)));
         }
         
         // Always update position existence and openings
         setPositionExistsInGraph(positionExists);
         setPositionInOpenings(inOpenings);
         
       } catch (error) {
         console.warn('Error getting opening info from database:', error);
         
         // On error, just check graph existence but don't change opening name
         const positionExists = graphNodes.some(node => 
           node.data && node.data.fen === currentFen
         );
         
         setPositionExistsInGraph(positionExists);
         setPositionInOpenings([]);
       }
    };
    
    updatePositionInfo();
  }, [game.fen(), graphNodes, currentMoves, openingLoadingCache]);

  // Helper function to get formatted opening name for display
  const getFormattedOpeningName = () => {
    // For starting position, always show just "Starting Position" without ECO
    if (currentMoves.length === 0) {
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
            // Use 85% of the smaller dimension for the board size
            const size = Math.min(rect.width, rect.height) * 0.85;
            const newSize = Math.max(280, Math.min(600, size));
            
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

  const navigateToMove = (moveIndex) => {
    const clampedIndex = Math.max(0, Math.min(moveIndex, currentMoves.length));
    
    // Trigger tree update IMMEDIATELY before any state changes
    if (onMoveSelect) {
      const movesToApply = currentMoves.slice(0, clampedIndex);
      onMoveSelect(movesToApply);
    }
    
    // Then update chessboard state
    setCurrentMoveIndex(clampedIndex);
  };

  const handlePrevMove = () => {
    const newIndex = currentMoveIndex - 1;
    const clampedIndex = Math.max(0, Math.min(newIndex, currentMoves.length));
    
    // FIRST: Trigger tree scroll/update ONLY (no chessboard update yet)
    if (onMoveSelect) {
      const movesToApply = currentMoves.slice(0, clampedIndex);
      onMoveSelect(movesToApply);
    }
    
    // THEN: Update chessboard AFTER scroll animation completes
    setTimeout(() => {
      setCurrentMoveIndex(clampedIndex);
    }, 200); // Faster timing for snappier animation
  };

  const handleNextMove = () => {
    navigateToMove(currentMoveIndex + 1);
  };

  const handleReset = () => {
    // Clear the moves completely, not just reset the index
    if (onNewMove) {
      onNewMove([]);
    }
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
    
    // Debug: Check if script is loading
    console.log('🔍 Component mounted, checking window.stockfish...');
    console.log('Current window.stockfish:', typeof window.stockfish);
    
    // Add a simple test that users can run in console
    window.testStockfish = () => {
      console.log('🧪 Testing Stockfish availability...');
      console.log('window.stockfish:', typeof window.stockfish);
      if (typeof window.stockfish === 'function') {
        try {
          const sf = eval('stockfish');
          const engine = sf();
          console.log('✅ Stockfish works! Engine created:', !!engine);
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
        console.log('🛠️ Attempting to initialize Stockfish...');
        console.log('window.stockfish type:', typeof window.stockfish);
        
        // Use eval approach like in chess-master project
        // The stockfish.js file exposes STOCKFISH (uppercase)
        let sf;
        if (typeof window.STOCKFISH === 'function') {
          sf = window.STOCKFISH;
          console.log('✅ Using window.STOCKFISH');
        } else if (typeof window.stockfish === 'function') {
          sf = window.stockfish;
          console.log('✅ Using window.stockfish');
        } else {
          // Try eval as fallback
          try {
            sf = eval('STOCKFISH') || eval('stockfish');
            console.log('✅ Using eval approach');
          } catch (e) {
            throw new Error('Neither STOCKFISH nor stockfish function found');
          }
        }
        console.log('sf function:', typeof sf);
        
        engine = sf();
        console.log('engine created:', !!engine);
        
        setStockfish(engine);
        
        // Set up a default message handler to prevent warnings
        engine.onmessage = (message) => {
          // Just log initialization messages, actual analysis will override this
          console.log('🔧 Stockfish init:', message);
        };
        
        // Initialize engine
        engine.postMessage('uci');
        engine.postMessage('isready');
        
        console.log('✅ Stockfish initialized successfully');
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
      console.log(`🔄 Checking for Stockfish... (attempt ${attempts}/${maxAttempts})`, {
        windowExists: typeof window !== 'undefined',
        STOCKFISHExists: typeof window !== 'undefined' && typeof window.STOCKFISH !== 'undefined',
        stockfishExists: typeof window !== 'undefined' && typeof window.stockfish !== 'undefined',
        STOCKFISHType: typeof window !== 'undefined' ? typeof window.STOCKFISH : 'window undefined',
        stockfishType: typeof window !== 'undefined' ? typeof window.stockfish : 'window undefined'
      });
      
      if (typeof window !== 'undefined' && (typeof window.STOCKFISH === 'function' || typeof window.stockfish === 'function')) {
        console.log('✅ Stockfish found! Initializing...');
        initEngine();
      } else if (attempts >= maxAttempts) {
        console.error('❌ Stockfish script failed to load after 5 seconds');
        console.error('Please check if /stockfish.js is accessible in your browser');
        console.log('💡 Try opening http://localhost:5187/stockfish.js in a new tab to test');
      } else {
        setTimeout(checkStockfish, 100);
      }
    };
    
    // Start checking
    console.log('🚀 Starting Stockfish initialization check...');
    
    // Also listen for script load events
    const handleScriptLoad = () => {
      console.log('📡 Script load event detected, checking Stockfish...');
      if (typeof window.STOCKFISH === 'function' || typeof window.stockfish === 'function') {
        console.log('✅ Stockfish available after script load!');
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
          console.log('Engine cleanup completed');
        }
      }
    };
  }, []);

  // Toggle Stockfish analysis function - turns analysis on/off
  const toggleStockfishAnalysis = useCallback(() => {
    console.log('🔍 Stockfish toggle clicked!');
    
    if (!stockfish) {
      console.error('❌ Stockfish not initialized yet');
      alert('Stockfish engine not ready yet. Please try again in a moment.');
      return;
    }
    
    // If currently enabled, disable and clear
    if (stockfishEnabled) {
      console.log('🚫 Disabling Stockfish analysis');
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
        console.log('Stop command sent');
      }
      return;
    }
    
    // If disabled, enable and start analysis
    if (isAnalyzing) {
      console.log('⏳ Already analyzing...');
      return;
    }
    
    console.log('🚀 Enabling Stockfish - Starting MultiPV analysis for top 3 moves...');
    setStockfishEnabled(true);
    setIsAnalyzing(true);
    setTopMoves([]);
    
    const fen = game.fen();
    console.log('📋 FEN position:', fen);
    
    const candidateMoves = [];
    
    const handleMessage = (event) => {
      const message = event.data ? event.data : event;
      console.log('📨 Stockfish:', message);
      
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
          
          console.log('🔍 Parsing MultiPV move:', { multipv, uciMove, evaluation, depth });
          
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
              console.log('📊 Updated moves:', sortedMoves.map(m => `${m.multipv}. ${m.san} (${m.evaluation})`));
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
        console.log('✅ MultiPV analysis complete with', candidateMoves.length, 'moves');
      }
    };
    
    stockfish.onmessage = handleMessage;
    
    // Send commands to Stockfish with MultiPV enabled
    console.log('📤 Sending MultiPV commands to Stockfish...');
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
    
    return brushes;
  }, []);

  return (
    <div ref={containerRef} className={`w-full h-full flex items-center justify-center ${className}`}>
      <Card 
        className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl w-full h-full flex flex-col"
      >
        <CardHeader className="card-header pb-2 px-3 pt-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {/* Fixed height container for opening title - always reserves space for 2 lines */}
              <div className="h-14 flex items-start">
                <CardTitle className="text-slate-200 text-lg leading-tight line-clamp-2" title={getFormattedOpeningName()}>
                  {getFormattedOpeningName()}
                </CardTitle>
              </div>
              {/* Reserved space for Position Status Indicator - prevents layout shifts */}
              <div className="h-4">
                {!positionExistsInGraph && currentMoves.length > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-amber-400">Position not in performance graph</span>
                  </div>
                )}
              </div>
            </div>
            {/* Stockfish Analysis Toggle Button - Top Right */}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                console.log('🖱️ Stockfish toggle clicked!', e);
                toggleStockfishAnalysis();
              }}
              disabled={isAnalyzing && !stockfishEnabled}
              className={`transition-all duration-200 flex-shrink-0 ${
                stockfishEnabled || isAnalyzing
                  ? 'bg-white border-white text-slate-800 hover:bg-slate-100 hover:border-slate-200' // White/active when enabled
                  : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/60 hover:border-slate-500 hover:text-slate-200' // Default inactive state
              }`}
              title={stockfishEnabled ? "Disable Stockfish analysis" : "Enable Stockfish analysis"}
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Fish className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-2 min-h-0 p-3">
          {/* Chessboard using react-chessground */}
          <div 
            data-board-container 
            className="flex-1 flex items-center justify-center min-h-0 w-full"
            style={{ 
              minHeight: '300px',
              maxHeight: 'calc(100% - 140px)'
            }}
          >
            <div style={{ 
              width: boardSize, 
              height: boardSize, 
              minWidth: '280px',
              minHeight: '280px',
              maxWidth: '600px',
              maxHeight: '600px'
            }}>
              <Chessground
                fen={game.fen()}
                orientation={orientation}
                turnColor={currentTurn}
                movable={{
                  free: false,
                  color: currentTurn,
                  dests: dests,
                  showDests: true, // Show move destination dots
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
                  enabled: true,
                  visible: true,
                  autoShapes: arrowShapes,
                  brushes: dynamicBrushes
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

        {/* Stockfish Status Area - Fixed height to prevent layout shifts */}
        <div className="flex-shrink-0 px-2 py-1 h-8 flex items-center justify-center min-h-[32px]">
          {stockfishEnabled ? (
            isAnalyzing ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Stockfish analyzing...</span>
              </div>
            ) : topMoves.length > 0 ? (
              <div className="text-xs text-slate-400 text-center">
                Engine suggests: {topMoves.map((move, i) => 
                  <span key={i} className="text-slate-300 font-mono">
                    {move.san}{typeof move.evaluation === 'number' ? ` (${move.evaluation > 0 ? '+' : ''}${move.evaluation.toFixed(1)})` : ''}
                    {i < topMoves.length - 1 ? ', ' : ''}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 opacity-50">
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
        <div data-nav-section className="flex-shrink-0 flex items-center justify-between gap-2">
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
            {positionInOpenings.length > 0 && (
              <OpeningSelector fen={game.fen()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30 hover:border-amber-400 hover:text-amber-300 transition-all duration-200"
                  title={`In ${positionInOpenings.length} saved opening${positionInOpenings.length > 1 ? 's' : ''}`}
                >
                  <BookOpen className="w-4 h-4" />
                  {positionInOpenings.length > 1 && (
                    <span className="ml-1 text-xs">{positionInOpenings.length}</span>
                  )}
                </Button>
              </OpeningSelector>
            )}
            {openingGraph && currentMoves.length > 0 && (
              <PositionInfoDialog
                openingGraph={openingGraph}
                currentMoves={currentMoves}
                isWhite={isWhiteTree}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/60 hover:border-slate-500 hover:text-slate-200 transition-all duration-200"
                  title="Position information"
                >
                  <Info className="w-4 h-4" />
                </Button>
              </PositionInfoDialog>
            )}
          </div>
        </div>

        {/* Move List - Fixed height container */}
        <div data-move-list className="flex-shrink-0 bg-slate-900/50 rounded-lg p-2 h-[80px] overflow-y-auto">
          <div className="text-xs text-slate-400 mb-1">Move History</div>
          {currentMoves.length > 0 ? (
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
              {currentMoves.map((move, index) => {
                const moveNumber = Math.floor(index / 2) + 1;
                const isWhiteMove = index % 2 === 0;
                const isCurrentMove = index === currentMoveIndex - 1;
                
                return (
                  <div
                    key={index}
                    className={`cursor-pointer hover:bg-slate-700/50 px-1 py-0.5 rounded text-center ${
                      isCurrentMove ? 'bg-slate-700 text-white' : 'text-slate-300'
                    }`}
                    onClick={() => navigateToMove(index + 1)}
                  >
                    {isWhiteMove && (
                      <span className="text-slate-500 mr-1">{moveNumber}.</span>
                    )}
                    {move}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic text-center py-2">
              No moves played yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
} 