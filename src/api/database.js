import initSqlJs from 'sql.js';

// Global database instance
let db = null;
let SQL = null;

// Initialize SQL.js and database
export const initDatabase = async () => {
  try {
    // Initialize SQL.js
    SQL = await initSqlJs({
      // Use CDN for the wasm file
      locateFile: file => `https://sql.js.org/dist/${file}`
    });

    // Try to load existing database from localStorage
    const existingDb = localStorage.getItem('chesscope_db');
    if (existingDb) {
      // Load existing database
      const uint8Array = new Uint8Array(JSON.parse(existingDb));
      db = new SQL.Database(uint8Array);
      console.log('Loaded existing ChessScope database from localStorage');
    } else {
      // Create new database
      db = new SQL.Database();
      console.log('Created new ChessScope database');
    }

    // Create tables
    await createTables();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    // Fallback: create new database even if loading fails
    if (SQL && !db) {
      db = new SQL.Database();
      await createTables();
      console.log('Created fallback database');
    }
    throw error;
  }
};

// Create database tables
const createTables = async () => {
  try {
    // Create ChessGame table
    db.run(`
      CREATE TABLE IF NOT EXISTS chess_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        game_id TEXT UNIQUE NOT NULL,
        url TEXT,
        pgn TEXT,
        time_control TEXT,
        end_time INTEGER,
        rated INTEGER,
        time_class TEXT,
        rules TEXT DEFAULT 'chess',
        white_player_username TEXT,
        white_player_rating INTEGER,
        white_player_result TEXT,
        black_player_username TEXT,
        black_player_rating INTEGER,
        black_player_result TEXT,
        moves TEXT,
        player_color TEXT,
        result TEXT,
        opening_name TEXT,
        opening_variation TEXT,
        opening_eco TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create OpeningNode table
    db.run(`
      CREATE TABLE IF NOT EXISTS opening_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        color TEXT NOT NULL,
        moves_sequence TEXT NOT NULL,
        opening_name TEXT,
        variation_name TEXT,
        eco_code TEXT,
        total_games INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        win_rate REAL DEFAULT 0,
        depth INTEGER,
        last_move TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, color, moves_sequence)
      )
    `);

    // Create indexes for better performance
    db.run('CREATE INDEX IF NOT EXISTS idx_chess_games_username ON chess_games(username)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chess_games_end_time ON chess_games(end_time)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chess_games_player_color ON chess_games(player_color)');
    db.run('CREATE INDEX IF NOT EXISTS idx_opening_nodes_username ON opening_nodes(username)');
    db.run('CREATE INDEX IF NOT EXISTS idx_opening_nodes_color ON opening_nodes(color)');
    db.run('CREATE INDEX IF NOT EXISTS idx_opening_nodes_total_games ON opening_nodes(total_games)');

    // Save to localStorage
    saveDatabase();
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

// Save database to localStorage with compression and error handling
const saveDatabase = () => {
  try {
    const data = db.export();
    const dataString = JSON.stringify(Array.from(data));
    
    // Check if data is too large for localStorage
    const sizeInMB = new Blob([dataString]).size / 1024 / 1024;
    if (sizeInMB > 4) { // Conservative 4MB limit
      console.warn(`Database size (${sizeInMB.toFixed(2)}MB) approaching localStorage limit. Consider cleaning up old data.`);
    }
    
    localStorage.setItem('chesscope_db', dataString);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded. Database is too large to save.');
      // Try to clear some space by removing the database and alerting user
      localStorage.removeItem('chesscope_db');
      alert('Database has grown too large for browser storage. Please consider exporting your data and refreshing the page.');
    } else {
      console.error('Error saving database to localStorage:', error);
    }
  }
};

// Generic database operations
export class BaseModel {
  constructor(tableName, fields) {
    this.tableName = tableName;
    this.fields = fields;
  }

  async create(data) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(key => data[key]);
    
    const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    try {
      const stmt = db.prepare(query);
      stmt.run(values);
      const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      stmt.free();
      
      saveDatabase();
      return { id: lastId, ...data };
    } catch (error) {
      console.error(`Error creating record in ${this.tableName}:`, error);
      throw error;
    }
  }

  async bulkCreate(dataArray) {
    if (!dataArray || dataArray.length === 0) return [];
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const keys = Object.keys(dataArray[0]);
    const placeholders = keys.map(() => '?').join(', ');
    const query = `INSERT OR REPLACE INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    try {
      // Use transaction for better performance
      db.exec('BEGIN TRANSACTION');
      
      const stmt = db.prepare(query);
      const results = [];
      
      for (const data of dataArray) {
        const values = keys.map(key => data[key]);
        stmt.run(values);
        const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
        results.push({ id: lastId, ...data });
      }
      
      stmt.free();
      db.exec('COMMIT');
      
      // Only save once after all operations
      saveDatabase();
      return results;
    } catch (error) {
      // Rollback on error
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
      console.error(`Error bulk creating records in ${this.tableName}:`, error);
      throw error;
    }
  }

  async list(orderBy = 'id', limit = null) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    let query = `SELECT * FROM ${this.tableName}`;
    
    if (orderBy) {
      if (orderBy.startsWith('-')) {
        query += ` ORDER BY ${orderBy.substring(1)} DESC`;
      } else {
        query += ` ORDER BY ${orderBy} ASC`;
      }
    }
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    try {
      const result = db.exec(query);
      if (result.length === 0) return [];
      
      const columns = result[0].columns;
      const rows = result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return this.transformRow(obj);
      });
      
      return rows;
    } catch (error) {
      console.error(`Error listing records from ${this.tableName}:`, error);
      throw error;
    }
  }

  async filter(conditions = {}, orderBy = 'id', limit = null) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(conditions);
    
    let query = `SELECT * FROM ${this.tableName}`;
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    if (orderBy) {
      if (orderBy.startsWith('-')) {
        query += ` ORDER BY ${orderBy.substring(1)} DESC`;
      } else {
        query += ` ORDER BY ${orderBy} ASC`;
      }
    }
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    try {
      const stmt = db.prepare(query);
      stmt.bind(values);
      const rows = [];
      
      while (stmt.step()) {
        rows.push(this.transformRow(stmt.getAsObject()));
      }
      
      stmt.free();
      return rows;
    } catch (error) {
      console.error(`Error filtering records from ${this.tableName}:`, error);
      throw error;
    }
  }

  async delete(id) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
    
    try {
      const stmt = db.prepare(query);
      stmt.run([id]);
      stmt.free();
      
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error(`Error deleting record from ${this.tableName}:`, error);
      throw error;
    }
  }

  transformRow(row) {
    // Convert moves back to array if it's a string
    if (row.moves && typeof row.moves === 'string') {
      try {
        row.moves = JSON.parse(row.moves);
      } catch (e) {
        // If parsing fails, treat as string
      }
    }
    
    // Transform nested objects back
    if (row.white_player_username) {
      row.white_player = {
        username: row.white_player_username,
        rating: row.white_player_rating,
        result: row.white_player_result
      };
    }
    
    if (row.black_player_username) {
      row.black_player = {
        username: row.black_player_username,
        rating: row.black_player_rating,
        result: row.black_player_result
      };
    }
    
    if (row.opening_name) {
      row.opening = {
        name: row.opening_name,
        variation: row.opening_variation,
        eco: row.opening_eco
      };
    }
    
    return row;
  }
}

// Database management utilities
export const getDatabaseSize = () => {
  try {
    const data = db.export();
    const dataString = JSON.stringify(Array.from(data));
    const sizeInBytes = new Blob([dataString]).size;
    const sizeInMB = sizeInBytes / 1024 / 1024;
    return {
      bytes: sizeInBytes,
      mb: parseFloat(sizeInMB.toFixed(2)),
      percentage: parseFloat(((sizeInMB / 5) * 100).toFixed(1)) // Assume 5MB localStorage limit
    };
  } catch (error) {
    console.error('Error calculating database size:', error);
    return { bytes: 0, mb: 0, percentage: 0 };
  }
};

export const clearDatabase = () => {
  try {
    localStorage.removeItem('chesscope_db');
    window.location.reload(); // Reload to reinitialize empty database
  } catch (error) {
    console.error('Error clearing database:', error);
  }
};

// Export database data as JSON
export const exportDatabase = async () => {
  try {
    const { ChessGame, OpeningNode } = await import('./entities.js');
    const games = await ChessGame.list();
    const openingNodes = await OpeningNode.list();
    
    const exportData = {
      exportDate: new Date().toISOString(),
      games: games,
      openingNodes: openingNodes,
      metadata: {
        totalGames: games.length,
        totalNodes: openingNodes.length,
        appVersion: "1.0.0"
      }
    };
    
    const dataString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `chesscope-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
};

// Delete old games to free up space
export const deleteOldGames = async (keepRecentCount = 1000) => {
  try {
    const ChessGame = (await import('./entities.js')).ChessGame;
    const OpeningNode = (await import('./entities.js')).OpeningNode;
    
    // Get all games sorted by end_time (oldest first)
    const allGames = await ChessGame.list('end_time');
    
    if (allGames.length <= keepRecentCount) {
      return { deleted: 0, kept: allGames.length };
    }
    
    const gamesToDelete = allGames.slice(0, allGames.length - keepRecentCount);
    
    // Delete old games
    for (const game of gamesToDelete) {
      await ChessGame.delete(game.id);
    }
    
    // Rebuild opening trees with remaining games
    const remainingGames = allGames.slice(-keepRecentCount);
    
    // Clear existing opening nodes
    const allNodes = await OpeningNode.list();
    for (const node of allNodes) {
      await OpeningNode.delete(node.id);
    }
    
    // Rebuild opening trees
    if (remainingGames.length > 0) {
      const { buildOpeningTree } = await import('../pages/Import.jsx');
      const username = remainingGames[0].username;
      await buildOpeningTree(remainingGames, username);
    }
    
    return { deleted: gamesToDelete.length, kept: keepRecentCount };
  } catch (error) {
    console.error('Error deleting old games:', error);
    throw error;
  }
};

// Initialize database on module load
initDatabase().catch(console.error); 