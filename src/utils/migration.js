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

// Migration: Check for legacy user_openings table and remove if exists
export const migrateRemoveDescriptionAndTagsColumns = async () => {
  console.log('Running migration: Check for legacy user_openings table');
  
  try {
    // Get the database instance using the proper getter
    const { getDb } = await import('../api/database');
    const db = getDb();
    
    if (!db) {
      console.error('Database not initialized');
      return false;
    }
    
    // Check if the legacy user_openings table exists
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='user_openings'");
    
    if (!tablesResult || tablesResult.length === 0 || tablesResult[0].values.length === 0) {
      console.log('Legacy user_openings table does not exist, migration not needed');
      return true;
    }
    
    console.log('Legacy user_openings table found, removing it...');
    
    // Drop the legacy table - the current schema uses user_studies
    db.exec('DROP TABLE user_openings');
    
    console.log('Successfully removed legacy user_openings table');
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