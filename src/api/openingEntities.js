import { BaseModel } from './database';

// UserOpening model for managing user's repertoire
export class UserOpening extends BaseModel {
  constructor() {
    super('user_openings', [
      'username', 'name', 'color', 'initial_fen', 
      'initial_moves', 'description', 'tags'
    ]);
  }

  async create(data) {
    // Ensure initial_moves is stored as JSON string
    if (Array.isArray(data.initial_moves)) {
      data.initial_moves = JSON.stringify(data.initial_moves);
    }
    if (Array.isArray(data.tags)) {
      data.tags = JSON.stringify(data.tags);
    }
    return super.create(data);
  }

  async getByUsername(username) {
    return this.filter({ username }, '-updated_at');
  }

  async getByName(username, name) {
    const results = await this.filter({ username, name });
    return results.length > 0 ? results[0] : null;
  }

  transformRow(row) {
    const transformed = super.transformRow(row);
    
    // Parse JSON fields
    if (transformed.initial_moves && typeof transformed.initial_moves === 'string') {
      try {
        transformed.initial_moves = JSON.parse(transformed.initial_moves);
      } catch (e) {
        transformed.initial_moves = [];
      }
    }
    
    if (transformed.tags && typeof transformed.tags === 'string') {
      try {
        transformed.tags = JSON.parse(transformed.tags);
      } catch (e) {
        transformed.tags = [];
      }
    }
    
    return transformed;
  }
}

// UserOpeningMove model for individual moves in an opening
export class UserOpeningMove extends BaseModel {
  constructor() {
    super('user_opening_moves', [
      'opening_id', 'fen', 'san', 'uci', 'move_number',
      'parent_fen', 'is_main_line', 'evaluation', 'comment',
      'arrows', 'highlights'
    ]);
  }

  async create(data) {
    // Ensure JSON fields are stored as strings
    if (Array.isArray(data.arrows)) {
      data.arrows = JSON.stringify(data.arrows);
    }
    if (Array.isArray(data.highlights)) {
      data.highlights = JSON.stringify(data.highlights);
    }
    return super.create(data);
  }

  async getByOpeningId(openingId) {
    return this.filter({ opening_id: openingId }, 'move_number');
  }

  async getByFen(fen) {
    return this.filter({ fen });
  }

  async getChildren(openingId, parentFen) {
    return this.filter({ opening_id: openingId, parent_fen: parentFen }, 'move_number');
  }

  transformRow(row) {
    const transformed = super.transformRow(row);
    
    // Parse JSON fields
    if (transformed.arrows && typeof transformed.arrows === 'string') {
      try {
        transformed.arrows = JSON.parse(transformed.arrows);
      } catch (e) {
        transformed.arrows = [];
      }
    }
    
    if (transformed.highlights && typeof transformed.highlights === 'string') {
      try {
        transformed.highlights = JSON.parse(transformed.highlights);
      } catch (e) {
        transformed.highlights = [];
      }
    }
    
    return transformed;
  }
}

// MoveAnnotation model for links and notes
export class MoveAnnotation extends BaseModel {
  constructor() {
    super('move_annotations', [
      'move_id', 'type', 'content', 'url'
    ]);
  }

  async getByMoveId(moveId) {
    return this.filter({ move_id: moveId }, '-created_at');
  }

  async getByType(moveId, type) {
    return this.filter({ move_id: moveId, type });
  }
}

// Export singleton instances
export const userOpening = new UserOpening();
export const userOpeningMove = new UserOpeningMove();
export const moveAnnotation = new MoveAnnotation();

// Helper function to check if a FEN position exists in user's openings
export const checkPositionInOpenings = async (fen, username) => {
  try {
    // Get all user openings
    const openings = await userOpening.getByUsername(username);
    const openingIds = openings.map(o => o.id);
    
    if (openingIds.length === 0) return [];
    
    // Check each opening for this position
    const matchingOpenings = [];
    
    for (const openingId of openingIds) {
      const moves = await userOpeningMove.filter({ 
        opening_id: openingId, 
        fen: fen 
      });
      
      if (moves.length > 0) {
        const opening = openings.find(o => o.id === openingId);
        if (opening) {
          matchingOpenings.push({
            id: opening.id,
            name: opening.name,
            color: opening.color
          });
        }
      }
    }
    
    return matchingOpenings;
  } catch (error) {
    console.error('Error checking position in openings:', error);
    return [];
  }
};

// Helper to get all positions for a specific opening
export const getOpeningPositions = async (openingId) => {
  try {
    const moves = await userOpeningMove.getByOpeningId(openingId);
    return moves.map(move => move.fen);
  } catch (error) {
    console.error('Error getting opening positions:', error);
    return [];
  }
}; 