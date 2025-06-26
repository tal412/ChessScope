import { Chess } from 'chess.js';

// Create a new chess game instance
export const createChessGame = () => {
  return new Chess();
};

// Apply a sequence of moves to a chess game
export const applyMovesToGame = (moves) => {
  const game = new Chess();
  
  try {
    for (const move of moves) {
      // Clean the move notation
      const cleanMove = cleanMoveNotation(move);
      if (cleanMove) {
        const result = game.move(cleanMove);
        if (!result) {
          console.warn(`Invalid move: ${cleanMove}`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error applying moves:', error);
  }
  
  return game;
};

// Clean move notation to work with chess.js
export const cleanMoveNotation = (move) => {
  if (!move || typeof move !== 'string') return null;
  
  // Remove move numbers and dots
  let cleanMove = move.replace(/^\d+\.+\s*/, '').trim();
  
  // Remove annotations like +, #, !, ?
  cleanMove = cleanMove.replace(/[+#!?]+$/, '');
  
  // Handle special cases
  if (cleanMove === 'O-O') return 'O-O';
  if (cleanMove === 'O-O-O') return 'O-O-O';
  
  return cleanMove || null;
};

// Get FEN position after applying moves
export const getPositionAfterMoves = (moves) => {
  const game = applyMovesToGame(moves);
  return game.fen();
};

// Get all legal moves from a position
export const getLegalMoves = (fen) => {
  const game = new Chess(fen);
  return game.moves();
};

// Check if a move is legal in the current position
export const isMoveLegal = (fen, move) => {
  const game = new Chess(fen);
  try {
    const result = game.move(move);
    return !!result;
  } catch {
    return false;
  }
};

// Make a move and return the new FEN
export const makeMove = (fen, move) => {
  const game = new Chess(fen);
  try {
    const result = game.move(move);
    if (result) {
      return {
        success: true,
        fen: game.fen(),
        move: result,
        san: result.san
      };
    }
  } catch (error) {
    console.error('Error making move:', error);
  }
  
  return {
    success: false,
    fen: fen,
    move: null,
    san: null
  };
};

// Convert moves array to a move sequence string
export const movesToString = (moves) => {
  return moves.filter(move => move && move.trim()).join(' ');
};

// Parse a move sequence string to moves array
export const stringToMoves = (moveString) => {
  if (!moveString) return [];
  return moveString.split(' ').filter(move => move && move.trim());
};

// Get the current turn from FEN
export const getCurrentTurn = (fen) => {
  const game = new Chess(fen);
  return game.turn(); // 'w' for white, 'b' for black
};

// Convert chess.js square notation to chessboard format
export const convertSquareNotation = (square) => {
  return square; // They use the same format (e.g., 'e4')
};

// Get piece positions from FEN in chessboard position object format
export const getPositionFromFen = (fen) => {
  const game = new Chess(fen);
  const board = game.board();
  const position = {};
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = String.fromCharCode(97 + file) + (8 - rank);
      const piece = board[rank][file];
      
      if (piece) {
        const color = piece.color === 'w' ? 'w' : 'b';
        const type = piece.type.toUpperCase();
        position[square] = color + type;
      }
    }
  }
  
  return position;
}; 