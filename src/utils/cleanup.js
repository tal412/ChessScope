// Cleanup utility to remove old localStorage SQLite data
export const cleanupOldStorage = () => {
  try {
    const oldData = localStorage.getItem('chesscope_db');
    if (oldData) {
      const sizeInMB = Math.round(new Blob([oldData]).size / 1024 / 1024 * 100) / 100;
      console.log(`Cleaning up old localStorage data (${sizeInMB}MB)...`);
      
      localStorage.removeItem('chesscope_db');
      console.log('✅ Old localStorage data cleaned up successfully!');
      
      return { success: true, freedMB: sizeInMB };
    }
    
    return { success: true, freedMB: 0 };
  } catch (error) {
    console.error('Error cleaning up old storage:', error);
    return { success: false, error: error.message };
  }
};

// Auto-cleanup on app load
if (typeof window !== 'undefined') {
  // Only run cleanup once per session
  const hasCleanedThisSession = sessionStorage.getItem('indexeddb_migration_cleanup');
  
  if (!hasCleanedThisSession) {
    const result = cleanupOldStorage();
    if (result.success && result.freedMB > 0) {
      sessionStorage.setItem('indexeddb_migration_cleanup', 'true');
      console.log(`🚀 Migration complete! Freed ${result.freedMB}MB from localStorage`);
    }
  }
} 