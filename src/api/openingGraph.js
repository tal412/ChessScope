// OpeningTree-inspired graph-based storage for chess positions and moves
// This replaces the inefficient approach of storing individual games and separate opening nodes

import { Chess } from 'chess.js';

// Global opening cache shared across all Graph instances for maximum efficiency
const GLOBAL_OPENING_CACHE = new Map();
let GLOBAL_OPENING_DATABASE = null;

// GraphNode represents a chess position (FEN) with statistics
class GraphNode {
  constructor(fen) {
    this.fen = fen;
    this.gameResults = []; // Array of game indices that reached this position
    this.details = {
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      averageOpponentRating: 0,
      openingInfo: null // ECO, name, variation
    };
    this.playedByMax = 0; // Most frequent move from this position
  }

  // Add a game result to this position
  addGameResult(gameIndex, result, opponentRating = 0, openingInfo = null) {
    this.gameResults.push(gameIndex);
    this.details.totalGames++;
    
    switch (result) {
      case 'win':
        this.details.wins++;
        break;
      case 'lose':
        this.details.losses++;
        break;
      case 'draw':
        this.details.draws++;
        break;
    }
    
    // Update win rate
    this.details.winRate = this.details.totalGames > 0 
      ? (this.details.wins / this.details.totalGames) * 100 
      : 0;
    
    // Update average opponent rating
    if (opponentRating > 0) {
      const totalRating = (this.details.averageOpponentRating * (this.details.totalGames - 1)) + opponentRating;
      this.details.averageOpponentRating = Math.round(totalRating / this.details.totalGames);
    }
    
    // Store opening info (usually from the root positions)
    if (openingInfo && !this.details.openingInfo) {
      this.details.openingInfo = openingInfo;
    }
  }
}

// Graph represents the complete opening tree
class Graph {
  constructor(username, playerColor) {
    this.nodes = new Map(); // FEN -> GraphNode
    this.moves = new Map(); // `${fromFen}:${toFen}` -> moveData
    this.pgnStats = []; // Game-level metadata (minimal, just for reference)
    this.username = username;
    this.playerColor = playerColor; // 'white' or 'black'

  }

  // Get or create a node for a FEN position
  getOrCreateNode(fen) {
    if (!this.nodes.has(fen)) {
      this.nodes.set(fen, new GraphNode(fen));
    }
    return this.nodes.get(fen);
  }

  // Add a move edge between two positions
  addMove(fromFen, toFen, moveSan, pgnStatsIndex) {
    const moveKey = `${fromFen}:${toFen}`;
    
    if (!this.moves.has(moveKey)) {
      this.moves.set(moveKey, {
        san: moveSan,
        fromFen,
        toFen,
        gameIndices: []
      });
    }
    
    this.moves.get(moveKey).gameIndices.push(pgnStatsIndex);
  }

  // Add a complete PGN game to the graph
  async addPGN(moves, gameResult, opponentRating = 0, gameOpeningInfo = null, gameMetadata = {}) {
    if (!moves || moves.length === 0) return;
    
    // Add this game to pgnStats for reference with full metadata
    const gameIndex = this.pgnStats.length;
    this.pgnStats.push({
      result: gameResult,
      opponentRating,
      openingInfo: gameOpeningInfo, // Store the full game opening info
      moveCount: moves.length,
      // Store complete game metadata for position analysis (use consistent field names)
      url: gameMetadata.url,
      end_time: gameMetadata.end_time,
      time_control: gameMetadata.time_control,
      time_class: gameMetadata.time_class,
      rated: gameMetadata.rated,
      white_username: gameMetadata.white_username,
      black_username: gameMetadata.black_username,
      white_rating: gameMetadata.white_rating,
      black_rating: gameMetadata.black_rating,
      player_color: gameMetadata.player_color,
      game_id: gameMetadata.game_id
    });

    const chess = new Chess();
    let currentFen = chess.fen();
    
    // Add starting position - use a basic opening info for the starting position
    const startNode = this.getOrCreateNode(currentFen);
    const startingOpeningInfo = { name: 'Starting Position', eco: '' };
    startNode.addGameResult(gameIndex, gameResult, opponentRating, startingOpeningInfo);
    
    // Load the opening database once globally for super fast FEN-based lookups
    if (!GLOBAL_OPENING_DATABASE) {
      console.log('🚀 Loading opening database for fast FEN lookups...');
      try {
        const openingModule = await import('../components/chess/OpeningDatabase.jsx');
        await openingModule.DATABASE_LOADING_PROMISE; // Wait for database to load
        GLOBAL_OPENING_DATABASE = openingModule.LICHESS_OPENINGS_DATABASE;
        console.log(`✅ Opening database loaded: ${GLOBAL_OPENING_DATABASE?.size || 0} positions`);
      } catch (error) {
        console.warn('Could not load opening database:', error);
        GLOBAL_OPENING_DATABASE = new Map(); // Empty map as fallback
      }
    }
    
    // Process each move - use direct FEN lookup for blazing fast opening identification
    for (let i = 0; i < moves.length; i++) {
      try {
        const move = chess.move(moves[i]);
        if (!move) break; // Invalid move
        
        const newFen = chess.fen();
        
        // Add the move edge
        this.addMove(currentFen, newFen, move.san, gameIndex);
        
        // Fast opening identification using direct FEN lookup
        let positionOpeningInfo = null;
        
        // Check global cache first
        if (GLOBAL_OPENING_CACHE.has(newFen)) {
          positionOpeningInfo = GLOBAL_OPENING_CACHE.get(newFen);
        } else {
          // Direct FEN lookup - much faster than identifyOpening()
          const fenToEpd = (fen) => {
            const parts = fen.split(' ');
            return parts.slice(0, 4).join(' ');
          };
          
          const epd = fenToEpd(newFen);
          const opening = GLOBAL_OPENING_DATABASE?.get(epd) || GLOBAL_OPENING_DATABASE?.get(newFen);
          
          if (opening) {
            positionOpeningInfo = {
              eco: opening.eco,
              name: opening.name,
              variation: "",
              pgn: opening.pgn || "",
              moves: opening.pgn || ""
            };
          } else {
            // Instead of "Unknown Opening", inherit from previous position or use smart fallbacks
            let inheritedOpeningInfo = { eco: "", name: "Unknown Opening", variation: "", pgn: "", moves: "" };
            
            // Get the previous position's opening info to inherit from (INCLUDING ECO CODE)
            const previousNode = this.nodes.get(currentFen);
            if (previousNode && previousNode.details.openingInfo) {
              // Inherit the COMPLETE opening info from the previous position (ECO + name)
              inheritedOpeningInfo = {
                eco: previousNode.details.openingInfo.eco || "",
                name: previousNode.details.openingInfo.name || "Unknown Opening",
                variation: previousNode.details.openingInfo.variation || "",
                pgn: previousNode.details.openingInfo.pgn || "",
                moves: previousNode.details.openingInfo.moves || ""
              };
            } else if (i === 0) {
              // First move fallbacks - use well-known opening names (no ECO for starting moves)
              let fallbackName = "Unknown Opening";
              switch (move.san) {
                case 'e4':
                  fallbackName = "King's Pawn Game";
                  break;
                case 'd4':
                  fallbackName = "Queen's Pawn Game";
                  break;
                case 'Nf3':
                  fallbackName = "Réti Opening";
                  break;
                case 'c4':
                  fallbackName = "English Opening";
                  break;
                case 'f4':
                  fallbackName = "Bird's Opening";
                  break;
                case 'Nc3':
                  fallbackName = "Van't Kruijs Opening";
                  break;
                case 'g3':
                  fallbackName = "Benko's Opening";
                  break;
                case 'b3':
                  fallbackName = "Nimzowitsch-Larsen Attack";
                  break;
                default:
                  fallbackName = "Uncommon Opening";
              }
              inheritedOpeningInfo.name = fallbackName;
            }
            
            positionOpeningInfo = inheritedOpeningInfo;
          }
          
          // Cache the result for future use
          GLOBAL_OPENING_CACHE.set(newFen, positionOpeningInfo);
          
          // Debug logging for first move e4
          if (i === 0 && move.san === 'e4') {
            console.log(`🎯 Fast e4 identification:`, {
              move: move.san,
              fen: newFen,
              epd: epd,
              opening: positionOpeningInfo
            });
          }
        }
        
        // Add or update the target position node with position-specific opening info
        const targetNode = this.getOrCreateNode(newFen);
        targetNode.addGameResult(gameIndex, gameResult, opponentRating, positionOpeningInfo);
        
        currentFen = newFen;
      } catch (error) {
        console.warn(`Invalid move in game ${gameIndex}:`, moves[i]);
        break;
      }
    }
  }

  // Get details for a specific FEN position
  getDetailsForFen(fen) {
    const node = this.nodes.get(fen);
    if (!node) return null;
    
    return {
      ...node.details,
      position: fen,
      gameCount: node.gameResults.length
    };
  }

  // Get all possible moves from a FEN position
  getMovesFromFen(fen) {
    const moves = [];
    
    for (const [moveKey, moveData] of this.moves.entries()) {
      if (moveData.fromFen === fen) {
        const targetNode = this.nodes.get(moveData.toFen);
        
        // Get opening info from the target position
        let openingInfo = targetNode.details.openingInfo;
        
        // Use stored opening info from when the game was imported
        // No need to look up again since we store it during import
        
        moves.push({
          san: moveData.san,
          toFen: moveData.toFen,
          gameCount: moveData.gameIndices.length,
          details: targetNode.details,
          openingInfo
        });
      }
    }
    
    return moves.sort((a, b) => b.gameCount - a.gameCount);
  }

  // Get position after applying a sequence of moves from starting position
  getPositionAfterMoves(moves) {
    if (!moves || moves.length === 0) return this.getStartingPosition();
    
    const chess = new Chess();
    
    for (const move of moves) {
      try {
        chess.move(move);
      } catch (error) {
        console.warn('Invalid move sequence:', moves);
        return null;
      }
    }
    
    return chess.fen();
  }

  // Get the starting position FEN
  getStartingPosition() {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  // Get statistics summary
  getStatsSummary() {
    const totalGames = this.pgnStats.length;
    const wins = this.pgnStats.filter(g => g.result === 'win').length;
    const losses = this.pgnStats.filter(g => g.result === 'lose').length;
    const draws = this.pgnStats.filter(g => g.result === 'draw').length;
    
    return {
      totalGames,
      wins,
      losses,
      draws,
      winRate: totalGames > 0 ? (wins / totalGames) * 100 : 0,
      totalPositions: this.nodes.size,
      totalMoves: this.moves.size
    };
  }

  // Get all games that reached a specific position
  getGamesForPosition(fen) {
    const node = this.nodes.get(fen);
    if (!node) return [];
    
    return node.gameResults.map(gameIndex => ({
      ...this.pgnStats[gameIndex],
      gameIndex
    }));
  }

  // Serialize the graph for storage (like OpeningTree's compression)
  serialize() {
    const data = {
      username: this.username,
      playerColor: this.playerColor,
      nodes: Array.from(this.nodes.entries()).map(([fen, node]) => ({
        fen,
        gameResults: node.gameResults,
        details: node.details
      })),
      moves: Array.from(this.moves.entries()).map(([key, moveData]) => ({
        key,
        ...moveData
      })),
      pgnStats: this.pgnStats,
      metadata: {
        created: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    return JSON.stringify(data);
  }

  // Deserialize the graph from storage
  static deserialize(jsonString) {
    const data = JSON.parse(jsonString);
    const graph = new Graph(data.username, data.playerColor);
    
    // Restore pgnStats
    graph.pgnStats = data.pgnStats || [];
    
    // Restore nodes
    data.nodes.forEach(nodeData => {
      const node = new GraphNode(nodeData.fen);
      node.gameResults = nodeData.gameResults;
      node.details = nodeData.details;
      graph.nodes.set(nodeData.fen, node);
    });
    
    // Restore moves
    data.moves.forEach(moveData => {
      graph.moves.set(moveData.key, {
        san: moveData.san,
        fromFen: moveData.fromFen,
        toFen: moveData.toFen,
        gameIndices: moveData.gameIndices
      });
    });
    
    return graph;
  }
}

// OpeningGraph - Main class that manages white and black trees (like OpeningTree)
export class OpeningGraph {
  constructor(username) {
    this.username = username;
    this.whiteGraph = new Graph(username, 'white');
    this.blackGraph = new Graph(username, 'black');
  }

  // Add a PGN game to the appropriate graph
  async addGame(gameData) {
    const { moves, player_color, result, opening } = gameData;
    
    // Determine opponent rating
    const opponentRating = player_color === 'white' 
      ? gameData.black_rating || 0
      : gameData.white_rating || 0;
    
    // Prepare game metadata for storage (keep same field names as source)
    const gameMetadata = {
      url: gameData.url,
      end_time: gameData.end_time,
      time_control: gameData.time_control,
      time_class: gameData.time_class,
      rated: gameData.rated,
      white_username: gameData.white_username,
      black_username: gameData.black_username,
      white_rating: gameData.white_rating,
      black_rating: gameData.black_rating,
      player_color: gameData.player_color,
      game_id: gameData.game_id
    };
    
    // Add to the appropriate graph
    const targetGraph = player_color === 'white' ? this.whiteGraph : this.blackGraph;
    await targetGraph.addPGN(moves, result, opponentRating, opening, gameMetadata);
  }

  // Get moves from a position for a specific color
  getMovesFromPosition(moves, isWhite) {
    const graph = isWhite ? this.whiteGraph : this.blackGraph;
    const fen = graph.getPositionAfterMoves(moves);
    
    if (!fen) return [];
    
    return graph.getMovesFromFen(fen);
  }

  // Get child positions from a move sequence (compatible with Dashboard)
  getChildPositions(moves) {
    const moveArray = typeof moves === 'string' && moves.length > 0 ? moves.split(' ') : (Array.isArray(moves) ? moves : []);
    
    // For empty moves, get root moves for both colors
    if (moveArray.length === 0) {
      const whiteRootMoves = this.whiteGraph.getMovesFromFen(this.whiteGraph.getStartingPosition());
      const blackRootMoves = this.blackGraph.getMovesFromFen(this.blackGraph.getStartingPosition());
      
      const allMoves = [];
      
      // Add white moves
      whiteRootMoves.forEach(move => {
        allMoves.push({
          fen: move.toFen,
          moves: move.san,
          playerColor: 'white'
        });
      });
      
      // Add black moves (opponent's responses)
      blackRootMoves.forEach(move => {
        allMoves.push({
          fen: move.toFen,
          moves: move.san,
          playerColor: 'black'
        });
      });
      
      return allMoves;
    }
    
    // For existing moves, get continuations from both graphs
    const whitePositions = this.getMovesFromPosition(moveArray, true);
    const blackPositions = this.getMovesFromPosition(moveArray, false);
    
    const positions = [];
    
    whitePositions.forEach(move => {
      positions.push({
        fen: move.toFen,
        moves: [...moveArray, move.san].join(' '),
        playerColor: 'white'
      });
    });
    
    blackPositions.forEach(move => {
      positions.push({
        fen: move.toFen,
        moves: [...moveArray, move.san].join(' '),
        playerColor: 'black'
      });
    });
    
    return positions;
  }

  // Get a node with stats for both colors (compatible with Dashboard)
  getNode(fen) {
    const whiteNode = this.whiteGraph.nodes.get(fen);
    const blackNode = this.blackGraph.nodes.get(fen);
    
    if (!whiteNode && !blackNode) return null;
    
    // Create a unified node structure
    const unifiedNode = {
      fen: fen,
      stats: {
        white: whiteNode ? {
          totalGames: whiteNode.details.totalGames,
          wins: whiteNode.details.wins,
          losses: whiteNode.details.losses,
          draws: whiteNode.details.draws,
          winRate: whiteNode.details.winRate
        } : { totalGames: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
        black: blackNode ? {
          totalGames: blackNode.details.totalGames,
          wins: blackNode.details.wins,
          losses: blackNode.details.losses,
          draws: blackNode.details.draws,
          winRate: blackNode.details.winRate
        } : { totalGames: 0, wins: 0, losses: 0, draws: 0, winRate: 0 }
      },
      // Use the opening name from whichever node has it, prefer white
      openingName: (whiteNode?.details?.openingInfo?.name) || 
                   (blackNode?.details?.openingInfo?.name) || 
                   'Unknown Opening',
      openingInfo: (whiteNode?.details?.openingInfo) || 
                   (blackNode?.details?.openingInfo) || 
                   null
    };
    
    return unifiedNode;
  }

  // Get position details
  getPositionDetails(moves, isWhite) {
    const graph = isWhite ? this.whiteGraph : this.blackGraph;
    const fen = graph.getPositionAfterMoves(moves);
    
    if (!fen) return null;
    
    return graph.getDetailsForFen(fen);
  }

  // Get all games that reached a specific position
  getGamesForPosition(moves, isWhite) {
    const graph = isWhite ? this.whiteGraph : this.blackGraph;
    const fen = graph.getPositionAfterMoves(moves);
    
    if (!fen) return [];
    
    return graph.getGamesForPosition(fen);
  }

  // Get root moves (first moves in the opening)
  getRootMoves(isWhite) {
    const graph = isWhite ? this.whiteGraph : this.blackGraph;
    const startingFen = graph.getStartingPosition();
    return graph.getMovesFromFen(startingFen);
  }

  // Get statistics for both colors
  getOverallStats() {
    return {
      white: this.whiteGraph.getStatsSummary(),
      black: this.blackGraph.getStatsSummary(),
      username: this.username
    };
  }

  // Serialize both graphs
  serialize() {
    return {
      username: this.username,
      whiteGraph: this.whiteGraph.serialize(),
      blackGraph: this.blackGraph.serialize(),
      metadata: {
        created: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  // Deserialize both graphs
  static deserialize(data) {
    const openingGraph = new OpeningGraph(data.username);
    openingGraph.whiteGraph = Graph.deserialize(data.whiteGraph);
    openingGraph.blackGraph = Graph.deserialize(data.blackGraph);
    return openingGraph;
  }
}

export default OpeningGraph; 