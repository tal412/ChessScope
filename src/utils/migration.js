// Legacy data cleanup utility
export const migrationUtils = {
  // Check if old localStorage data exists
  hasOldData: () => {
    try {
      const oldData = localStorage.getItem('chesscope_db');
      return oldData !== null && oldData.length > 0;
    } catch (error) {
      return false;
    }
  },

  // Get the size of old localStorage data
  getOldDataSize: () => {
    try {
      const oldData = localStorage.getItem('chesscope_db');
      if (!oldData) return 0;
      
      const sizeInBytes = new Blob([oldData]).size;
      return Math.round(sizeInBytes / 1024 / 1024 * 100) / 100; // MB
    } catch (error) {
      return 0;
    }
  },

  // Clear old localStorage data
  clearOldData: () => {
    try {
      localStorage.removeItem('chesscope_db');
      console.log('Old localStorage data cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear old data:', error);
      return false;
    }
  },

  // Clean up legacy data
  cleanupLegacyData: () => {
    try {
      // Clear old localStorage data
      migrationUtils.clearOldData();
      
      // Clear any other legacy keys
      const keysToRemove = [
        'chesscope_db',
        'chesscope_games',
        'chesscope_nodes'
      ];
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors
        }
      });
      
      return { success: true, message: 'Legacy data cleaned up' };
    } catch (error) {
      console.error('Cleanup failed:', error);
      return { success: false, message: `Cleanup failed: ${error.message}` };
    }
  }
};

export default migrationUtils;

// Migration: Remove description and tags columns from user_openings table
export const migrateRemoveDescriptionAndTagsColumns = async () => {
  console.log('Running migration: Remove description and tags columns from user_openings table');
  
  try {
    // Get the database instance using the proper getter
    const { getDb } = await import('../api/database');
    const db = getDb();
    
    if (!db) {
      console.error('Database not initialized');
      return false;
    }
    
    // Check if the description or tags columns exist
    const tableInfoResult = db.exec("PRAGMA table_info(user_openings)");
    
    if (!tableInfoResult || tableInfoResult.length === 0) {
      console.log('user_openings table does not exist, migration not needed');
      return true;
    }
    
    const columns = tableInfoResult[0].values.map(row => row[1]); // column name is at index 1
    
    const hasDescriptionColumn = columns.includes('description');
    const hasTagsColumn = columns.includes('tags');
    
    if (!hasDescriptionColumn && !hasTagsColumn) {
      console.log('Description and tags columns do not exist, migration not needed');
      return true;
    }
    
    console.log('Description/tags columns exist, removing them...');
    
    // SQLite doesn't support DROP COLUMN directly, so we need to:
    // 1. Create a new table without the description column
    // 2. Copy data from old table to new table
    // 3. Drop the old table
    // 4. Rename the new table
    
    // Step 1: Create new table without description and tags columns
    db.exec(`
      CREATE TABLE user_openings_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        initial_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        initial_moves TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, name)
      )
    `);
    
    // Step 2: Copy data from old table to new table (excluding description and tags)
    db.exec(`
      INSERT INTO user_openings_new (
        id, username, name, color, initial_fen, initial_moves, created_at, updated_at
      )
      SELECT 
        id, username, name, color, initial_fen, initial_moves, created_at, updated_at
      FROM user_openings
    `);
    
    // Step 3: Drop the old table
    db.exec('DROP TABLE user_openings');
    
    // Step 4: Rename the new table
    db.exec('ALTER TABLE user_openings_new RENAME TO user_openings');
    
    // Recreate the index
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_openings_username ON user_openings(username)');
    
    console.log('Successfully removed description and tags columns from user_openings table');
    return true;
    
  } catch (error) {
    console.error('Error during migration:', error);
    return false;
  }
};

// Run migration automatically when this module is imported
if (typeof window !== 'undefined') {
  // Only run in browser environment
  // Wait for database to be initialized before running migration
  const runMigration = async () => {
    try {
      // Use the proper waitForDatabase function from the database module
      const { waitForDatabase } = await import('../api/database');
      await waitForDatabase(15000); // Wait up to 15 seconds
      
      // Database is ready, run migration
      const success = await migrateRemoveDescriptionAndTagsColumns();
      if (success) {
        console.log('Migration completed successfully');
      } else {
        console.error('Migration failed');
      }
    } catch (error) {
      if (error.message === 'Database initialization timeout') {
        console.error('Database not ready after maximum wait time, skipping migration');
      } else {
        console.error('Migration error:', error);
      }
    }
  };
  
  // Start migration
  runMigration();
} 