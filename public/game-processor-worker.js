/**
 * Web Worker for processing chess games in the background
 * This runs independently of the main thread and won't be throttled when tabs are inactive
 */

// Import required modules (these need to be available in the worker context)
let openingDatabase = null;

// Initialize the worker
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'INIT_OPENING_DATABASE':
        await initializeOpeningDatabase(data.openingData);
        self.postMessage({ type: 'INIT_COMPLETE' });
        break;
        
      case 'PROCESS_GAMES':
        await processGames(data);
        break;
        
      case 'IDENTIFY_OPENING':
        const opening = await identifyOpening(data.moves);
        self.postMessage({
          type: 'OPENING_IDENTIFIED',
          data: { id: data.id, opening }
        });
        break;
        
      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { error: error.message, stack: error.stack }
    });
  }
});

async function initializeOpeningDatabase(openingData) {
  // Store opening database data for use in worker
  openingDatabase = openingData;
}

async function processGames({ games, username, platform, startIndex = 0 }) {
  const totalGames = games.length;
  let processed = startIndex;
  const processedGames = [];
  
  console.log(`🔧 Worker: Starting to process ${totalGames} games from index ${startIndex}`);
  
  for (let i = startIndex; i < totalGames; i++) {
    const game = games[i];
    
    try {
      let gameData;
      
      // Process game based on platform
      if (platform === 'lichess') {
        gameData = game; // Lichess games are already in correct format
      } else {
        gameData = extractGameDataGeneric(game, username, platform);
      }
      
      if (gameData && gameData.moves && gameData.moves.length > 0) {
        // Add opening information
        const opening = await identifyOpening(gameData.moves);
        gameData.opening = opening;
        
        processedGames.push(gameData);
      }
      
      processed++;
      
      // Report progress every 25 games or at completion
      if (processed % 25 === 0 || processed === totalGames) {
        self.postMessage({
          type: 'PROGRESS',
          data: {
            processed,
            total: totalGames,
            percentage: Math.round((processed / totalGames) * 100),
            games: processedGames.splice(0) // Send processed games and clear array
          }
        });
      }
      
      // No need for artificial delays in worker - it runs at full speed regardless of tab state
    } catch (error) {
      console.warn(`Worker: Error processing game ${i}:`, error);
      // Continue with other games
    }
  }
  
  // Send any remaining processed games
  if (processedGames.length > 0) {
    self.postMessage({
      type: 'PROGRESS',
      data: {
        processed,
        total: totalGames,
        percentage: 100,
        games: processedGames
      }
    });
  }
  
  self.postMessage({
    type: 'COMPLETE',
    data: { processed, total: totalGames }
  });
  
  console.log(`🔧 Worker: Completed processing ${processed} games`);
}

// Chess.com game data extraction (copied from main thread)
function extractGameDataGeneric(game, username, platform) {
  if (platform === 'chess.com') {
    if (!game || !game.pgn) {
      return null;
    }
    
    // Parse PGN to extract moves
    const pgn = game.pgn;
    const moves = extractMovesFromPgn(pgn);
    
    if (!moves || moves.length === 0) {
      return null;
    }
    
    // Determine player color
    const whitePlayer = game.white?.username?.toLowerCase();
    const blackPlayer = game.black?.username?.toLowerCase();
    const inputUsername = username.toLowerCase();
    
    let playerColor;
    if (whitePlayer === inputUsername) {
      playerColor = 'white';
    } else if (blackPlayer === inputUsername) {
      playerColor = 'black';
    } else {
      return null;
    }
    
    // Determine result from player's perspective
    let result;
    const whiteResult = game.white?.result;
    const blackResult = game.black?.result;
    
    if (playerColor === 'white') {
      if (whiteResult === 'win') result = 'win';
      else if (whiteResult === 'lose' || blackResult === 'win') result = 'lose';
      else result = 'draw';
    } else {
      if (blackResult === 'win') result = 'win';
      else if (blackResult === 'lose' || whiteResult === 'win') result = 'lose';
      else result = 'draw';
    }
    
    return {
      moves,
      player_color: playerColor,
      result,
      white_username: whitePlayer,
      black_username: blackPlayer,
      date: new Date(game.end_time * 1000).toISOString(),
      time_control: game.time_control,
      time_class: game.time_class
    };
  }
  
  return null;
}

function extractMovesFromPgn(pgn) {
  if (!pgn) return [];
  
  try {
    // Remove comments and annotations
    let cleanPgn = pgn.replace(/\{[^}]*\}/g, '');
    cleanPgn = cleanPgn.replace(/\([^)]*\)/g, '');
    cleanPgn = cleanPgn.replace(/\$\d+/g, '');
    
    // Split by move numbers and filter out metadata
    const parts = cleanPgn.split(/\d+\./).filter(part => part.trim());
    const moves = [];
    
    for (const part of parts) {
      const movePair = part.trim().split(/\s+/);
      for (const move of movePair) {
        const cleanMove = move.trim();
        if (cleanMove && 
            !cleanMove.startsWith('[') && 
            !cleanMove.includes('=') &&
            !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(cleanMove)) {
          moves.push(cleanMove);
        }
      }
    }
    
    return moves;
  } catch (error) {
    console.warn('Error parsing PGN:', error);
    return [];
  }
}

// Simple opening identification (without full database for now)
async function identifyOpening(moves) {
  if (!moves || moves.length < 2) {
    return { name: 'Starting Position', eco: '' };
  }
  
  // For now, return a simple classification
  // In a full implementation, this would use the opening database
  const moveString = moves.slice(0, 10).join(' ');
  
  // Basic opening detection
  if (moveString.includes('e4 e5')) {
    return { name: 'King\'s Pawn Game', eco: 'C20' };
  } else if (moveString.includes('d4 d5')) {
    return { name: 'Queen\'s Pawn Game', eco: 'D00' };
  } else if (moveString.includes('Nf3')) {
    return { name: 'Réti Opening', eco: 'A04' };
  } else if (moveString.includes('c4')) {
    return { name: 'English Opening', eco: 'A10' };
  }
  
  return { name: 'Other Opening', eco: 'A00' };
}

console.log('🔧 Game Processor Worker initialized');