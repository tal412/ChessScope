
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
