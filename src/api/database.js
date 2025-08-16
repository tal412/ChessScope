import initSqlJs from 'sql.js';

// Import backup service (but avoid circular imports by lazy loading)
let googleDriveBackup = null;
const getBackupService = async () => {
  if (!googleDriveBackup) {
    try {
      const { googleDriveBackup: service } = await import('../services/GoogleDriveBackup.js');
      googleDriveBackup = service;
    } catch (error) {
      return null;
    }
  }
  return googleDriveBackup;
};

// Global database instance
let db = null;
let SQL = null;
let isInitializing = false;
let isInitialized = false;
let initializationPromise = null;
let isSyncOperation = false;

// Export the database instance getter
export const getDb = () => db;

// Check if database is ready
export const isDatabaseReady = () => {
  return isInitialized && db !== null;
};

// Mark sync operation
export const setSyncOperation = (inSync) => {
  isSyncOperation = inSync;
};

// Wait for database to be ready
export const waitForDatabase = async (maxWaitTime = 10000) => {
  // If already ready, return immediately
  if (isDatabaseReady()) {
    return true;
  }
  
  console.log('Database not ready, initializing...', { isInitializing, isInitialized, hasPromise: !!initializationPromise });
  
  // If there's an ongoing initialization, wait for it
  if (initializationPromise) {
    try {
      await Promise.race([
        initializationPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database initialization timeout')), maxWaitTime)
        )
      ]);
      
      if (!isDatabaseReady()) {
        throw new Error('Database initialization failed');
      }
      
      return true;
    } catch (error) {
      // If initialization failed, clear the promise so we can retry
      if (initializationPromise) {
        initializationPromise = null;
      }
      throw error;
    }
  }
  
  // If not initializing and not ready, try to initialize
  if (!isInitializing && !isInitialized) {
    try {
      await initDatabase();
    } catch (error) {
      console.error('Initial database initialization failed, will retry with fallback:', error);
    }
  }
  
  // Fallback to polling if needed
  const startTime = Date.now();
  while (!isDatabaseReady() && (Date.now() - startTime) < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // If still not ready after some time, try one more initialization attempt
    if (!isDatabaseReady() && !isInitializing && (Date.now() - startTime) > maxWaitTime / 2) {
      try {
        await initDatabase();
      } catch (error) {
        console.error('Retry database initialization failed:', error);
      }
    }
  }
  
  if (!isDatabaseReady()) {
    throw new Error('Database initialization timeout');
  }
  
  return true;
};

// Initialize SQL.js and database
export const initDatabase = async () => {
  if (isInitialized) {
    return;
  }
  
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }
  
  isInitializing = true;
  
  initializationPromise = (async () => {
  
  try {
    // Initialize SQL.js
    SQL = await initSqlJs({
      // Use CDN for the wasm file
      locateFile: file => `https://sql.js.org/dist/${file}`
    });

    // Check if we should attempt Google Drive restore first (but not during sync operations)
    const shouldAttemptRestore = !isSyncOperation && await checkForGoogleDriveRestore();
    
    if (shouldAttemptRestore) {
      try {
        const backupService = await getBackupService();
        if (backupService) {
          await backupService.restoreFromBackup();
          // If successful, the page will reload and we'll end up here again
          return;
        }
      } catch (error) {
      }
    }

    // Try to load existing database from localStorage
    const existingDb = localStorage.getItem('chesscope_db');
    if (existingDb) {
      // Load existing database
      const uint8Array = new Uint8Array(JSON.parse(existingDb));
      db = new SQL.Database(uint8Array);
      
    } else {
      // Create new database
      db = new SQL.Database();
    }

    // Create tables
    await createTables();
    
    isInitialized = true;
    isInitializing = false;
  } catch (error) {
    console.error('Error initializing database:', error);
    // Fallback: create new database even if loading fails
    try {
      if (SQL && !db) {
        db = new SQL.Database();
        await createTables();
        isInitialized = true;
      } else if (SQL && db) {
        // Database exists but initialization failed - ensure tables exist
        await createTables();
        isInitialized = true;
      }
    } catch (fallbackError) {
      console.error('Fallback database creation also failed:', fallbackError);
      isInitialized = false;
    }
    isInitializing = false;
    initializationPromise = null;
    
    // Only throw if we couldn't recover
    if (!isInitialized) {
      throw error;
    }
  }
  })();
  
  return initializationPromise;
};

// Check if we should attempt Google Drive restore
const checkForGoogleDriveRestore = async () => {
  // Only attempt restore if:
  // 1. No local database exists
  // 2. User was previously signed in to Google
  // 3. This isn't a restore attempt already (prevent infinite loops)
  
  const existingDb = localStorage.getItem('chesscope_db');
  const wasSignedIn = localStorage.getItem('google_was_signed_in');
  const restoreAttempted = sessionStorage.getItem('restore_attempted');
  
  if (!existingDb && wasSignedIn && !restoreAttempted) {
    sessionStorage.setItem('restore_attempted', 'true');
    return true;
  }
  
  return false;
};

// Run database migrations
const runMigrations = async () => {
  try {
    // Check if tables need to be migrated from opening to study terminology
    const tablesList = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const existingTables = tablesList.length > 0 ? tablesList[0].values.map(row => row[0]) : [];
    
    // Migrate user_openings to user_studies
    if (existingTables.includes('user_openings') && !existingTables.includes('user_studies')) {
      
      // Create new user_studies table with enhanced schema
      db.run(`
        CREATE TABLE user_studies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          initial_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          initial_moves TEXT DEFAULT '[]',
          initial_view_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          starting_pgn TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(username, name)
        )
      `);
      
      // Copy data from old table to new table
      db.run(`
        INSERT INTO user_studies (id, username, name, color, initial_fen, initial_moves, initial_view_fen, created_at, updated_at)
        SELECT id, username, name, color, initial_fen, initial_moves, 
               COALESCE(initial_view_fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
               created_at, updated_at
        FROM user_openings
      `);
      
      // Drop old table
      db.run('DROP TABLE user_openings');
    }
    
    // Migrate user_opening_moves to user_study_moves
    if (existingTables.includes('user_opening_moves') && !existingTables.includes('user_study_moves')) {
      
      // Create new user_study_moves table
      db.run(`
        CREATE TABLE user_study_moves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          study_id INTEGER NOT NULL,
          fen TEXT NOT NULL,
          san TEXT NOT NULL,
          uci TEXT,
          move_number INTEGER NOT NULL,
          parent_fen TEXT,
          is_main_line BOOLEAN DEFAULT 1,
          is_initial_move BOOLEAN DEFAULT 0,
          evaluation TEXT,
          comment TEXT,
          arrows TEXT,
          highlights TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (study_id) REFERENCES user_studies(id) ON DELETE CASCADE,
          UNIQUE(study_id, fen, parent_fen)
        )
      `);
      
      // Copy data from old table to new table
      db.run(`
        INSERT INTO user_study_moves (id, study_id, fen, san, uci, move_number, parent_fen, is_main_line, is_initial_move, evaluation, comment, arrows, highlights, created_at)
        SELECT id, opening_id, fen, san, uci, move_number, parent_fen, is_main_line, 
               COALESCE(is_initial_move, 0), evaluation, comment, arrows, highlights, created_at
        FROM user_opening_moves
      `);
      
      // Drop old table
      db.run('DROP TABLE user_opening_moves');
    }
    
    // Create study_tags table if it doesn't exist
    if (!existingTables.includes('study_tags')) {
      db.run(`
        CREATE TABLE study_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#6366f1',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Insert default tags
      const defaultTags = [
        { name: 'Opening', color: '#22c55e' },
        { name: 'Middlegame', color: '#3b82f6' },
        { name: 'Endgame', color: '#f59e0b' },
        { name: 'Tactics', color: '#ef4444' },
        { name: 'Strategy', color: '#8b5cf6' },
        { name: 'Defense', color: '#06b6d4' }
      ];
      
      const stmt = db.prepare('INSERT OR IGNORE INTO study_tags (name, color) VALUES (?, ?)');
      defaultTags.forEach(tag => {
        stmt.run([tag.name, tag.color]);
      });
      stmt.free();
    }
    
    // Create study_tags_mapping table if it doesn't exist
    if (!existingTables.includes('study_tags_mapping')) {
      db.run(`
        CREATE TABLE study_tags_mapping (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          study_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (study_id) REFERENCES user_studies(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES study_tags(id) ON DELETE CASCADE,
          UNIQUE(study_id, tag_id)
        )
      `);
    }
    
    // Add folder support to user_studies table
    const columnsResult = db.exec("PRAGMA table_info(user_studies)");
    const existingColumns = columnsResult.length > 0 ? columnsResult[0].values.map(row => row[1]) : [];
    
    if (existingTables.includes('user_studies') && !existingColumns.includes('folder_id')) {
      db.run('ALTER TABLE user_studies ADD COLUMN folder_id INTEGER');
      db.run('ALTER TABLE user_studies ADD COLUMN position INTEGER DEFAULT 0');
    }
    
    // Create study_folders table if it doesn't exist
    if (!existingTables.includes('study_folders')) {
      db.run(`
        CREATE TABLE study_folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT DEFAULT 'folder',
          color TEXT DEFAULT '#6366f1',
          position INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(username, name)
        )
      `);
    }
  } catch (error) {
    console.error('Error running migrations:', error);
    // Don't throw error to prevent breaking the app
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

    // Create tables for Studies Book feature
    db.run(`
      CREATE TABLE IF NOT EXISTS user_studies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        initial_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        initial_moves TEXT DEFAULT '[]',
        initial_view_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        starting_pgn TEXT DEFAULT '',
        folder_id INTEGER,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES study_folders(id) ON DELETE SET NULL,
        UNIQUE(username, name)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS user_study_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        study_id INTEGER NOT NULL,
        fen TEXT NOT NULL,
        san TEXT NOT NULL,
        uci TEXT,
        move_number INTEGER NOT NULL,
        parent_fen TEXT,
        is_main_line BOOLEAN DEFAULT 1,
        is_initial_move BOOLEAN DEFAULT 0,
        evaluation TEXT,
        comment TEXT,
        arrows TEXT,
        highlights TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (study_id) REFERENCES user_studies(id) ON DELETE CASCADE,
        UNIQUE(study_id, fen, parent_fen)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS study_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6366f1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert default tags if they don't exist
    const defaultTags = [
      { name: 'Opening', color: '#22c55e' },
      { name: 'Middlegame', color: '#3b82f6' },
      { name: 'Endgame', color: '#f59e0b' },
      { name: 'Tactics', color: '#ef4444' },
      { name: 'Strategy', color: '#8b5cf6' },
      { name: 'Defense', color: '#06b6d4' }
    ];
    
    const stmt = db.prepare('INSERT OR IGNORE INTO study_tags (name, color) VALUES (?, ?)');
    defaultTags.forEach(tag => {
      stmt.run([tag.name, tag.color]);
    });
    stmt.free();
    
    db.run(`
      CREATE TABLE IF NOT EXISTS study_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'folder',
        color TEXT DEFAULT '#6366f1',
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, name)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS study_tags_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        study_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (study_id) REFERENCES user_studies(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES study_tags(id) ON DELETE CASCADE,
        UNIQUE(study_id, tag_id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS move_annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        move_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (move_id) REFERENCES user_study_moves(id) ON DELETE CASCADE
      )
    `);



    // Create indexes for better performance
    db.run('CREATE INDEX IF NOT EXISTS idx_chess_games_username ON chess_games(username)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chess_games_end_time ON chess_games(end_time)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chess_games_player_color ON chess_games(player_color)');
    db.run('CREATE INDEX IF NOT EXISTS idx_opening_nodes_username ON opening_nodes(username)');
    db.run('CREATE INDEX IF NOT EXISTS idx_opening_nodes_color ON opening_nodes(color)');
    db.run('CREATE INDEX IF NOT EXISTS idx_opening_nodes_total_games ON opening_nodes(total_games)');
    
    // Create indexes for Studies Book feature
    db.run('CREATE INDEX IF NOT EXISTS idx_user_studies_username ON user_studies(username)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_study_moves_study_id ON user_study_moves(study_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_study_moves_fen ON user_study_moves(fen)');
    db.run('CREATE INDEX IF NOT EXISTS idx_move_annotations_move_id ON move_annotations(move_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_study_tags_mapping_study_id ON study_tags_mapping(study_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_study_tags_mapping_tag_id ON study_tags_mapping(tag_id)');

    // Run database migrations
    await runMigrations();

    // Save to localStorage
    saveDatabase();
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

// Flag to prevent automatic backups during sync operations
let backupSuppressed = false;

// Suppress automatic backups during critical operations
export const suppressBackups = () => {
  backupSuppressed = true;
};

// Re-enable automatic backups
export const enableBackups = () => {
  backupSuppressed = false;
};

// Save database to localStorage with compression and error handling
export const saveDatabase = async () => {
  try {
    // Check if database is initialized
    if (!db) {
      console.warn('Database not initialized yet, skipping save');
      return;
    }
    
    const data = db.export();
    const dataString = JSON.stringify(Array.from(data));
    
    // Check if data is too large for localStorage
    const sizeInMB = new Blob([dataString]).size / 1024 / 1024;
    if (sizeInMB > 4) { // Conservative 4MB limit
      console.warn(`Database size (${sizeInMB.toFixed(2)}MB) approaching localStorage limit. Consider cleaning up old data.`);
    }
    
    localStorage.setItem('chesscope_db', dataString);
    
    // Notify cloud sync manager of data changes
    if (!backupSuppressed) {
      try {
        const { cloudSyncManager } = await import('../services/CloudSyncManager.js');
        cloudSyncManager.queueChange('database_save');
      } catch (error) {
      }
    } else {
    }
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

  async update(id, data) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const keys = Object.keys(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const values = [...keys.map(key => data[key]), id];
    
    const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    
    try {
      const stmt = db.prepare(query);
      stmt.run(values);
      stmt.free();
      
      saveDatabase();
      return { id, ...data };
    } catch (error) {
      console.error(`Error updating record in ${this.tableName}:`, error);
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
      const result = stmt.run([id]);
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

export const resetDatabaseInstance = () => {
  try {
    
    // Close existing database connection if it exists
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        console.warn('⚠️ Error closing database:', closeError);
      }
    }
    
    // Reset all state
    db = null;
    isInitialized = false;
    isInitializing = false;
    
    // Clear localStorage
    localStorage.removeItem('chesscope_db');
    
    return true;
  } catch (error) {
    console.error('Error resetting database instance:', error);
    return false;
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
    // TODO: Rebuild opening trees functionality needs to be re-implemented
    // since Import.jsx no longer exists
    /*
    if (remainingGames.length > 0) {
      const { buildOpeningTree } = await import('../pages/Import.jsx');
      const username = remainingGames[0].username;
      await buildOpeningTree(remainingGames, username);
    }
    */
    
    return { deleted: gamesToDelete.length, kept: keepRecentCount };
  } catch (error) {
    console.error('Error deleting old games:', error);
    throw error;
  }
};

// Initialize database on module load with better error handling
initDatabase().catch(error => {
  console.error('Failed to initialize database on startup:', error);
  // Set a flag so components know initialization failed
  isInitializing = false;
  isInitialized = false;
});

// Retry database initialization after a delay if it failed
setTimeout(() => {
  if (!isInitialized && !isInitializing) {
    initDatabase().catch(error => {
      console.error('Retry database initialization failed:', error);
    });
  }
}, 2000); // Retry after 2 seconds 