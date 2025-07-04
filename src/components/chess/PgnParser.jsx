export function parsePgn(pgnString) {
  if (!pgnString) return [];

  try {
    // Isolate the moves section of the PGN by removing headers
    const movesString = (pgnString.split(/\[.*\]\s*\n/).pop() || '').trim();
    
    // Remove comments and variations
    let cleanMoves = movesString.replace(/\{[^}]*\}/g, '');
    cleanMoves = cleanMoves.replace(/\([^)]*\)/g, '');
    
    // Remove result indicators like 1-0, 0-1, etc.
    cleanMoves = cleanMoves.replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, '');
    
    // Remove move numbers (e.g., 1., 2., 1... )
    cleanMoves = cleanMoves.replace(/\d+\.{1,3}/g, '');
    
    // Remove annotations (!, ?, +, #) from the moves
    cleanMoves = cleanMoves.replace(/[+#!?]/g, '');

    // Split into moves and filter out any empty strings that might result from the cleaning
    const moves = cleanMoves.trim().split(/\s+/).filter(Boolean);
    
    // Return moves for the opening tree (no artificial limits)
    return moves;
  } catch (error) {
    console.error("Error parsing PGN:", error);
    return [];
  }
}

// OPTIMIZED: Extract moves directly from PGN without storing the full PGN
export function extractMovesFromPgn(pgnString) {
  if (!pgnString) return [];
  
  try {
    // Find the moves section after headers
    const lines = pgnString.split('\n');
    let moveSection = '';
    let foundMoves = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('[')) continue; // Skip headers
      if (line.trim() === '') continue; // Skip empty lines
      foundMoves = true;
      moveSection += line + ' ';
    }
    
    if (!foundMoves) return [];
    
    // Clean the moves section
    let cleanMoves = moveSection
      .replace(/\{[^}]*\}/g, '') // Remove comments
      .replace(/\([^)]*\)/g, '') // Remove variations
      .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, '') // Remove result
      .replace(/\d+\.{1,3}/g, '') // Remove move numbers
      .replace(/[+#!?]/g, '') // Remove annotations
      .trim();
    
    return cleanMoves.split(/\s+/).filter(Boolean);
  } catch (error) {
    console.error("Error extracting moves from PGN:", error);
    return [];
  }
}

export function extractGameData(chessComGame, username) {
  try {
    // Extract game ID from URL
    const gameId = chessComGame.url ? chessComGame.url.split('/').pop() : `${Date.now()}_${Math.random()}`;
    
    // OPTIMIZED: Extract moves directly without storing full PGN
    const moves = extractMovesFromPgn(chessComGame.pgn);
    
    // Determine player color and result
    const isWhite = chessComGame.white?.username?.toLowerCase() === username.toLowerCase();
    const playerColor = isWhite ? "white" : "black";
    
    let result = "draw";
    if (chessComGame.white?.result === "win" && isWhite) result = "win";
    else if (chessComGame.black?.result === "win" && !isWhite) result = "win";
    else if ((chessComGame.white?.result === "checkmated" || chessComGame.white?.result === "resigned" || chessComGame.white?.result === "timeout") && isWhite) result = "lose";
    else if ((chessComGame.black?.result === "checkmated" || chessComGame.black?.result === "resigned" || chessComGame.black?.result === "timeout") && !isWhite) result = "lose";

    // OPTIMIZED: Store only essential data, skip storing full PGN
    return {
      username,
      game_id: gameId,
      url: chessComGame.url,
      // pgn: chessComGame.pgn, // REMOVED: Saves ~2-3KB per game
      time_control: chessComGame.time_control,
      end_time: chessComGame.end_time,
      rated: chessComGame.rated,
      time_class: chessComGame.time_class,
      rules: chessComGame.rules || "chess",
      white_rating: chessComGame.white?.rating,
      black_rating: chessComGame.black?.rating,
      white_username: chessComGame.white?.username,
      black_username: chessComGame.black?.username,
      moves, // Just the moves array (most compact format)
      player_color: playerColor,
      result
    };
  } catch (error) {
    console.error("Error extracting game data:", error);
    return null;
  }
}

// Generic game data extraction that works for both Chess.com and Lichess
export function extractGameDataGeneric(gameData, username, platform = 'chess.com') {
  try {
    let moves = [];
    let gameId, url, timeControl, endTime, rated, timeClass, rules;
    let whiteRating, blackRating, whiteUsername, blackUsername;
    
    if (platform === 'lichess' && gameData.pgn) {
      // Parse Lichess PGN headers
      const pgnString = gameData.pgn;
      moves = extractMovesFromPgn(pgnString);
      
      // Extract data from PGN headers
      const headers = {};
      const headerLines = pgnString.split('\n').filter(line => line.trim().startsWith('['));
      
      for (const line of headerLines) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          headers[match[1]] = match[2];
        }
      }
      
      // Map Lichess PGN headers to our format
      gameId = headers.Site ? headers.Site.split('/').pop() : `${Date.now()}_${Math.random()}`;
      url = headers.Site || `https://lichess.org/${gameId}`;
      timeControl = headers.TimeControl || "unknown";
      endTime = headers.UTCDate && headers.UTCTime ? 
        new Date(`${headers.UTCDate} ${headers.UTCTime}`).toISOString() : 
        new Date().toISOString();
      rated = headers.Rated ? headers.Rated.toLowerCase() === 'true' : true;
      
      // Determine time class from time control
      if (headers.TimeControl && headers.TimeControl !== '-') {
        const [base, increment] = headers.TimeControl.split('+').map(x => parseInt(x) || 0);
        const totalMinutes = base / 60;
        if (totalMinutes < 3) timeClass = 'bullet';
        else if (totalMinutes <= 10) timeClass = 'blitz';
        else if (totalMinutes <= 30) timeClass = 'rapid';
        else timeClass = 'classical';
      } else {
        timeClass = 'correspondence';
      }
      
      rules = headers.Variant || "standard";
      whiteRating = headers.WhiteElo ? parseInt(headers.WhiteElo) : null;
      blackRating = headers.BlackElo ? parseInt(headers.BlackElo) : null;
      whiteUsername = headers.White;
      blackUsername = headers.Black;
    } else if (platform === 'lichess') {
      // Lichess structured format (fallback)
      gameId = gameData.id;
      url = gameData.url || `https://lichess.org/${gameData.id}`;
      timeControl = gameData.timeControl || `${gameData.clock?.initial || 0}+${gameData.clock?.increment || 0}`;
      endTime = gameData.createdAt || gameData.lastMoveAt;
      rated = gameData.rated !== false;
      timeClass = gameData.speed; // bullet, blitz, rapid, classical, correspondence
      rules = gameData.variant || "standard";
      whiteRating = gameData.players?.white?.rating;
      blackRating = gameData.players?.black?.rating;
      whiteUsername = gameData.players?.white?.user?.name || gameData.players?.white?.userId;
      blackUsername = gameData.players?.black?.user?.name || gameData.players?.black?.userId;
      
      // Extract moves
      if (gameData.pgn) {
        moves = extractMovesFromPgn(gameData.pgn);
      } else if (gameData.moves) {
        moves = gameData.moves;
      }
    } else {
      // Chess.com format
      gameId = gameData.url ? gameData.url.split('/').pop() : `${Date.now()}_${Math.random()}`;
      url = gameData.url;
      timeControl = gameData.time_control;
      endTime = gameData.end_time;
      rated = gameData.rated;
      timeClass = gameData.time_class;
      rules = gameData.rules || "chess";
      whiteRating = gameData.white?.rating;
      blackRating = gameData.black?.rating;
      whiteUsername = gameData.white?.username;
      blackUsername = gameData.black?.username;
      
      // Extract moves
      if (gameData.pgn) {
        moves = extractMovesFromPgn(gameData.pgn);
      } else if (gameData.moves) {
        moves = gameData.moves;
      }
    }
    
    // Determine player color and result
    const isWhite = whiteUsername?.toLowerCase() === username?.toLowerCase();
    const playerColor = isWhite ? "white" : "black";
    
    let result = "draw";
    if (platform === 'lichess' && gameData.pgn) {
      // Parse result from PGN headers
      const headers = {};
      const headerLines = gameData.pgn.split('\n').filter(line => line.trim().startsWith('['));
      
      for (const line of headerLines) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          headers[match[1]] = match[2];
        }
      }
      
      const gameResult = headers.Result;
      if (gameResult === '1-0' && isWhite) result = "win";
      else if (gameResult === '0-1' && !isWhite) result = "win";
      else if (gameResult === '1-0' && !isWhite) result = "lose";
      else if (gameResult === '0-1' && isWhite) result = "lose";
      else if (gameResult === '1/2-1/2' || gameResult === '*') result = "draw";
    } else if (platform === 'lichess') {
      // Lichess structured format (fallback)
      if (gameData.winner === 'white' && isWhite) result = "win";
      else if (gameData.winner === 'black' && !isWhite) result = "win";
      else if (gameData.winner === 'white' && !isWhite) result = "lose";
      else if (gameData.winner === 'black' && isWhite) result = "lose";
      else if (gameData.status === 'draw') result = "draw";
    } else {
      // Chess.com result format
      if (gameData.white?.result === "win" && isWhite) result = "win";
      else if (gameData.black?.result === "win" && !isWhite) result = "win";
      else if ((gameData.white?.result === "checkmated" || gameData.white?.result === "resigned" || gameData.white?.result === "timeout") && isWhite) result = "lose";
      else if ((gameData.black?.result === "checkmated" || gameData.black?.result === "resigned" || gameData.black?.result === "timeout") && !isWhite) result = "lose";
    }

    return {
      username,
      game_id: gameId,
      url,
      time_control: timeControl,
      end_time: endTime,
      rated,
      time_class: timeClass,
      rules,
      white_rating: whiteRating,
      black_rating: blackRating,
      white_username: whiteUsername,
      black_username: blackUsername,
      moves,
      player_color: playerColor,
      result,
      platform
    };
  } catch (error) {
    console.error("Error extracting generic game data:", error);
    return null;
  }
}
