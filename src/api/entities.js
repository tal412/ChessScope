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

// Export instances
export const ChessGame = new ChessGameModel();
export const OpeningNode = new OpeningNodeModel();

// Simple auth mock (since we're now local-only)
export const User = {
  getCurrentUser: () => ({ username: 'local_user' }),
  isAuthenticated: () => true
};