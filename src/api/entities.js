import { BaseModel } from './database.js';

// ChessGame model
class ChessGameModel extends BaseModel {
  constructor() {
    super('chess_games', [
      'username', 'game_id', 'url', 'pgn', 'time_control', 'end_time',
      'rated', 'time_class', 'rules', 'white_player_username', 'white_player_rating',
      'white_player_result', 'black_player_username', 'black_player_rating',
      'black_player_result', 'moves', 'player_color', 'result', 'opening_name',
      'opening_variation', 'opening_eco'
    ]);
  }

  async bulkCreate(dataArray) {
    if (!dataArray || dataArray.length === 0) return [];
    
    // Transform the data to match database schema
    const transformedData = dataArray.map(data => ({
      username: data.username,
      game_id: data.game_id,
      url: data.url,
      pgn: data.pgn,
      time_control: data.time_control,
      end_time: data.end_time,
      rated: data.rated,
      time_class: data.time_class,
      rules: data.rules || 'chess',
      white_player_username: data.white_player?.username,
      white_player_rating: data.white_player?.rating,
      white_player_result: data.white_player?.result,
      black_player_username: data.black_player?.username,
      black_player_rating: data.black_player?.rating,
      black_player_result: data.black_player?.result,
      moves: JSON.stringify(data.moves || []),
      player_color: data.player_color,
      result: data.result,
      opening_name: data.opening?.name,
      opening_variation: data.opening?.variation,
      opening_eco: data.opening?.eco
    }));

    return super.bulkCreate(transformedData);
  }

  async create(data) {
    // Transform the data to match database schema
    const transformedData = {
      username: data.username,
      game_id: data.game_id,
      url: data.url,
      pgn: data.pgn,
      time_control: data.time_control,
      end_time: data.end_time,
      rated: data.rated,
      time_class: data.time_class,
      rules: data.rules || 'chess',
      white_player_username: data.white_player?.username,
      white_player_rating: data.white_player?.rating,
      white_player_result: data.white_player?.result,
      black_player_username: data.black_player?.username,
      black_player_rating: data.black_player?.rating,
      black_player_result: data.black_player?.result,
      moves: JSON.stringify(data.moves || []),
      player_color: data.player_color,
      result: data.result,
      opening_name: data.opening?.name,
      opening_variation: data.opening?.variation,
      opening_eco: data.opening?.eco
    };

    return super.create(transformedData);
  }
}

// OpeningNode model
class OpeningNodeModel extends BaseModel {
  constructor() {
    super('opening_nodes', [
      'username', 'color', 'moves_sequence', 'opening_name', 'variation_name',
      'eco_code', 'total_games', 'wins', 'losses', 'draws', 'win_rate',
      'depth', 'last_move'
    ]);
  }
}

// UserOpening model
class UserOpeningModel extends BaseModel {
  constructor() {
    super('user_openings', [
      'username', 'name', 'color', 'initial_fen', 'initial_moves', 
      'description', 'tags'
    ]);
  }
  
  async create(data) {
    // Transform arrays to JSON strings
    const transformedData = {
      ...data,
      initial_moves: JSON.stringify(data.initial_moves || []),
      tags: JSON.stringify(data.tags || [])
    };
    return super.create(transformedData);
  }
  
  async update(id, data) {
    // Transform arrays to JSON strings
    const transformedData = {
      ...data,
      initial_moves: JSON.stringify(data.initial_moves || []),
      tags: JSON.stringify(data.tags || [])
    };
    return super.update(id, transformedData);
  }
  
  transformRow(row) {
    // Transform JSON strings back to arrays
    return {
      ...row,
      initial_moves: typeof row.initial_moves === 'string' ? JSON.parse(row.initial_moves) : row.initial_moves,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags
    };
  }
}

// UserOpeningMove model
class UserOpeningMoveModel extends BaseModel {
  constructor() {
    super('user_opening_moves', [
      'opening_id', 'fen', 'san', 'uci', 'move_number', 'parent_fen',
      'is_main_line', 'evaluation', 'comment', 'arrows', 'highlights'
    ]);
  }
  
  async getByOpeningId(openingId) {
    return this.filter({ opening_id: openingId });
  }
  
  async create(data) {
    // Transform arrays to JSON strings
    const transformedData = {
      ...data,
      arrows: JSON.stringify(data.arrows || []),
      highlights: JSON.stringify(data.highlights || [])
    };
    return super.create(transformedData);
  }
  
  transformRow(row) {
    // Transform JSON strings back to arrays
    return {
      ...row,
      arrows: typeof row.arrows === 'string' ? JSON.parse(row.arrows) : row.arrows,
      highlights: typeof row.highlights === 'string' ? JSON.parse(row.highlights) : row.highlights
    };
  }
}

// MoveAnnotation model
class MoveAnnotationModel extends BaseModel {
  constructor() {
    super('move_annotations', [
      'move_id', 'type', 'content', 'url'
    ]);
  }
  
  async getByMoveId(moveId) {
    return this.filter({ move_id: moveId });
  }
  
  async deleteByMoveId(moveId) {
    const annotations = await this.getByMoveId(moveId);
    for (const annotation of annotations) {
      await this.delete(annotation.id);
    }
  }
}

// Export instances
export const ChessGame = new ChessGameModel();
export const OpeningNode = new OpeningNodeModel();
export const UserOpening = new UserOpeningModel();
export const UserOpeningMove = new UserOpeningMoveModel();
export const MoveAnnotation = new MoveAnnotationModel();

// Simple auth mock (since we're now local-only)
export const User = {
  getCurrentUser: () => ({ username: 'local_user' }),
  isAuthenticated: () => true
};