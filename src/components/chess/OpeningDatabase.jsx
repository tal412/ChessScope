import { Chess } from 'chess.js';

// This will be populated with the Lichess chess-openings database
let LICHESS_OPENINGS_DATABASE = null;
let DATABASE_LOADING_PROMISE = null;

// Initialize the database - we'll load it from a JSON file
const initializeDatabase = async () => {
  if (LICHESS_OPENINGS_DATABASE) return LICHESS_OPENINGS_DATABASE;
  
  try {
    // Load the Lichess openings database
    const response = await fetch('/data/lichess-openings.json');
    const openings = await response.json();
    
    // Convert to a map for faster lookups by EPD (FEN without move numbers)
    LICHESS_OPENINGS_DATABASE = new Map();
    
    openings.forEach(opening => {
      // Convert EPD to full FEN for compatibility
      const fen = epdToFen(opening.epd);
      LICHESS_OPENINGS_DATABASE.set(fen, opening);
      
      // Also index by EPD for direct lookups
      LICHESS_OPENINGS_DATABASE.set(opening.epd, opening);
    });
    
    console.log(`✅ Loaded ${openings.length} openings from Lichess database`);
    console.log(`🔍 Database size:`, LICHESS_OPENINGS_DATABASE.size);
    
    // Test Sicilian Defense lookup
    const sicilianEpd = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -";
    const sicilianOpening = LICHESS_OPENINGS_DATABASE.get(sicilianEpd);
    console.log(`🔍 Sicilian Defense test:`, sicilianOpening ? sicilianOpening.name : 'Not found');
    
    // Test 1.e4 lookup
    const e4Epd = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";
    const e4Opening = LICHESS_OPENINGS_DATABASE.get(e4Epd);
    console.log(`🔍 1.e4 test:`, e4Opening ? e4Opening.name : 'Not found');
    
    // Check for conflicts by looking at all entries with this EPD
    let e4Count = 0;
    LICHESS_OPENINGS_DATABASE.forEach((opening, key) => {
      if (key === e4Epd) {
        e4Count++;
        console.log(`🔍 Found entry for e4 EPD:`, opening.name);
      }
    });
    console.log(`🔍 Total entries for e4 EPD:`, e4Count);
    return LICHESS_OPENINGS_DATABASE;
  } catch (error) {
    console.warn('Failed to load Lichess openings database, using fallback data:', error);
    
    // Fallback to a minimal set of common openings
    const fallbackOpenings = [
      { eco: "B00", name: "King's Pawn", pgn: "1. e4", epd: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -" },
      { eco: "D00", name: "Queen's Pawn", pgn: "1. d4", epd: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -" },
      { eco: "A00", name: "Uncommon Opening", pgn: "1. Nf3", epd: "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -" },
      { eco: "C00", name: "French Defense", pgn: "1. e4 e6", epd: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -" },
      { eco: "B10", name: "Caro-Kann Defense", pgn: "1. e4 c6", epd: "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -" },
    ];
    
    LICHESS_OPENINGS_DATABASE = new Map();
    fallbackOpenings.forEach(opening => {
      const fen = epdToFen(opening.epd);
      LICHESS_OPENINGS_DATABASE.set(fen, opening);
      LICHESS_OPENINGS_DATABASE.set(opening.epd, opening);
    });
    
    return LICHESS_OPENINGS_DATABASE;
  }
};

// Start loading the database immediately
DATABASE_LOADING_PROMISE = initializeDatabase();

// Convert EPD (FEN without move numbers) to full FEN
const epdToFen = (epd) => {
  // EPD format: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
  // FEN format: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
  
  if (epd.includes(' 0 ')) return epd; // Already a full FEN
  
  // Add halfmove and fullmove counters
  const parts = epd.split(' ');
  if (parts.length === 4) {
    // Determine move number based on active color
    const activeColor = parts[1];
    const fullmoveNumber = activeColor === 'w' ? 1 : 1;
    return `${epd} 0 ${fullmoveNumber}`;
  }
  
  return epd; // Return as-is if format is unexpected
};

// Convert full FEN to EPD for lookups
const fenToEpd = (fen) => {
  const parts = fen.split(' ');
  if (parts.length >= 4) {
    return parts.slice(0, 4).join(' ');
  }
  return fen;
};

// Internal async function
const _identifyOpeningAsync = async (moves) => {
  await DATABASE_LOADING_PROMISE;
  
  if (!moves || moves.length === 0) {
    return { eco: "", name: "Starting Position", variation: "", pgn: "" };
  }

  try {
    // Create a new chess game
    const game = new Chess();
    
    // Play through the moves to get the current position
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      
      // Clean up the move notation (remove move numbers like "1.", "2.", etc.)
      const cleanMove = move.replace(/^\d+\.+\s*/, '').trim();
      
      if (!cleanMove) continue;
      
      try {
        // Attempt to make the move
        const result = game.move(cleanMove);
        if (!result) {
          // If move is invalid, try to handle common variations
          const alternativeMove = cleanMove.replace(/[+#]$/, ''); // Remove check/mate indicators
          const alternativeResult = game.move(alternativeMove);
          if (!alternativeResult) {
            console.warn(`Invalid move: ${cleanMove} at position ${i}`);
            break; // Stop processing invalid moves
          }
        }
      } catch (error) {
        console.warn(`Error making move ${cleanMove}:`, error.message);
        break; // Stop on error
      }
    }

    // Get the current FEN position and convert to EPD for lookup
    const currentFen = game.fen();
    const epd = fenToEpd(currentFen);
    
    // Try to find opening with the EPD
    let opening = LICHESS_OPENINGS_DATABASE.get(epd) || LICHESS_OPENINGS_DATABASE.get(currentFen);
    
    // Debug logging for first few lookups
    if (moves.length <= 4) {
      console.log(`🔍 Opening lookup:`, {
        moves: moves.slice(0, 4),
        epd: epd,
        found: opening ? opening.name : 'Not found',
        databaseSize: LICHESS_OPENINGS_DATABASE?.size || 0
      });
    }
    
    if (opening) {
      return {
        eco: opening.eco,
        name: opening.name,
        variation: "",
        pgn: opening.pgn || "",
        moves: opening.pgn || ""
      };
    }

    // If no exact match, try working backwards through the game history
    const gameHistory = game.history();
    if (gameHistory.length > 0) {
      // Try with fewer moves to find a known opening
      const shorterGame = new Chess();
      const maxMovesToCheck = Math.min(gameHistory.length, 20); // Check up to 20 moves
      
      for (let moveCount = maxMovesToCheck; moveCount > 0; moveCount--) {
        shorterGame.reset();
        for (let j = 0; j < moveCount; j++) {
          shorterGame.move(gameHistory[j]);
        }
        
        const shorterFen = shorterGame.fen();
        const shorterEpd = fenToEpd(shorterFen);
        const shorterOpening = LICHESS_OPENINGS_DATABASE.get(shorterEpd) || LICHESS_OPENINGS_DATABASE.get(shorterFen);
        
        if (shorterOpening) {
          return {
            eco: shorterOpening.eco,
            name: shorterOpening.name,
            variation: moveCount < gameHistory.length ? "Transposition" : "",
            pgn: shorterOpening.pgn || "",
            moves: shorterOpening.pgn || ""
          };
        }
      }
    }

    // If still no opening found, return generic response
    return {
      eco: "",
      name: game.history().length > 0 ? "Unknown Opening" : "Starting Position",
      variation: "",
      pgn: "",
      moves: ""
    };

  } catch (error) {
    console.error("Error identifying opening:", error);
    return {
      eco: "",
      name: "Error - Invalid Position",
      variation: "",
      pgn: "",
      moves: ""
    };
  }
};

// Internal async function
const _getOpeningFromFenAsync = async (fen) => {
  await DATABASE_LOADING_PROMISE;
  
  try {
    const epd = fenToEpd(fen);
    const opening = LICHESS_OPENINGS_DATABASE.get(epd) || LICHESS_OPENINGS_DATABASE.get(fen);
    
    if (opening) {
      return {
        eco: opening.eco,
        name: opening.name,
        variation: "",
        pgn: opening.pgn || "",
        moves: opening.pgn || ""
      };
    }

    return {
      eco: "",
      name: "Unknown Position",
      variation: "",
      pgn: "",
      moves: ""
    };
  } catch (error) {
    console.error("Error getting opening from FEN:", error);
    return {
      eco: "",
      name: "Error - Invalid FEN",
      variation: "",
      pgn: "",
      moves: ""
    };
  }
};

/**
 * Identifies chess opening from a sequence of moves using Lichess database
 * @param {string[]} moves - Array of moves in algebraic notation
 * @returns {Object} Opening information with eco, name, and pgn
 */
export function identifyOpening(moves) {
  // For backward compatibility, return a promise that resolves to the result
  return _identifyOpeningAsync(moves);
}

/**
 * Get opening information for a specific FEN position
 * @param {string} fen - FEN string of the position
 * @returns {Object} Opening information
 */
export function getOpeningFromFen(fen) {
  // For backward compatibility, return a promise that resolves to the result
  return _getOpeningFromFenAsync(fen);
}

/**
 * Search for openings by name (partial match)
 * @param {string} searchTerm - Term to search for in opening names
 * @returns {Array} Array of matching opening objects
 */
export async function searchOpeningsByName(searchTerm) {
  await DATABASE_LOADING_PROMISE;
  
  if (!searchTerm || searchTerm.length < 2) return [];
  
  const searchLower = searchTerm.toLowerCase();
  const results = [];
  
  LICHESS_OPENINGS_DATABASE.forEach((opening, key) => {
    // Skip EPD-only entries (we want full FEN entries)
    if (!key.includes(' 0 ')) return;
    
    if (opening.name && opening.name.toLowerCase().includes(searchLower)) {
      results.push({
        fen: key,
        eco: opening.eco,
        name: opening.name,
        pgn: opening.pgn,
        moves: opening.pgn,
        variation: ""
      });
    }
  });
  
  // Sort by ECO code and limit results
  return results
    .sort((a, b) => a.eco.localeCompare(b.eco))
    .slice(0, 50); // Limit to 50 results
}

/**
 * Get all openings with a specific ECO code
 * @param {string} ecoCode - ECO code (e.g. "C60")
 * @returns {Array} Array of opening objects with that ECO code
 */
export async function getOpeningsByEcoCode(ecoCode) {
  await DATABASE_LOADING_PROMISE;
  
  if (!ecoCode) return [];
  
  const results = [];
  
  LICHESS_OPENINGS_DATABASE.forEach((opening, key) => {
    // Skip EPD-only entries (we want full FEN entries)
    if (!key.includes(' 0 ')) return;
    
    if (opening.eco === ecoCode.toUpperCase()) {
      results.push({
        fen: key,
        eco: opening.eco,
        name: opening.name,
        pgn: opening.pgn,
        moves: opening.pgn,
        variation: ""
      });
    }
  });
  
  return results.sort((a, b) => (a.pgn || "").localeCompare(b.pgn || ""));
}

// Export database and loading promise for direct access
export { DATABASE_LOADING_PROMISE, LICHESS_OPENINGS_DATABASE };

// Compatibility functions for existing Dashboard usage
export const OPENING_DATABASE = {};
export const ECO_CODES = {};

// Initialize compatibility objects
DATABASE_LOADING_PROMISE.then(() => {
  // Populate OPENING_DATABASE for backward compatibility
  LICHESS_OPENINGS_DATABASE.forEach((opening, key) => {
    if (key.includes(' 0 ')) { // Only full FEN entries
      OPENING_DATABASE[opening.pgn || key] = {
        eco: opening.eco,
        name: opening.name,
        variation: "",
        moves: opening.pgn || ""
      };
    }
  });
  
  // Populate ECO_CODES for backward compatibility
  const uniqueEcoCodes = new Set();
  LICHESS_OPENINGS_DATABASE.forEach(opening => {
    if (opening.eco) uniqueEcoCodes.add(opening.eco);
  });
  
  uniqueEcoCodes.forEach(eco => {
    ECO_CODES[eco] = { code: eco, description: eco };
  });
  
  console.log(`🔧 Initialized compatibility objects with ${Object.keys(OPENING_DATABASE).length} openings and ${Object.keys(ECO_CODES).length} ECO codes`);
});