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