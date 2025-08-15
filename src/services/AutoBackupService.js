import { googleAuth } from './GoogleAuth.js';
import { googleDriveSync } from './GoogleDriveSync.js';
import { GOOGLE_API_CONFIG, validateGoogleConfig } from '../config/google.js';

class AutoBackupService {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
    this.lastBackupTime = null;
    this.backupQueue = new Set();
    this.isProcessingQueue = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('📁 AutoBackup: Starting initialization...');
      const validation = validateGoogleConfig();
      if (!validation.valid) {
        console.log('📁 AutoBackup: Skipping initialization due to config error:', validation.error);
        return;
      }

      console.log('📁 AutoBackup: Initializing Google Auth...');
      await googleAuth.initialize(GOOGLE_API_CONFIG);
      
      console.log(`📁 AutoBackup: Google Auth initialized. Signed in: ${googleAuth.isSignedIn}`);
      // Don't auto-enable backup - let user choose to backup or restore

      console.log('📁 AutoBackup: Setting up event listeners...');
      this._setupEventListeners();
      this.isInitialized = true;
      
      console.log('📁 AutoBackup: Service initialized successfully');
    } catch (error) {
      console.error('📁 AutoBackup: Failed to initialize service:', error);
    }
  }

  async _enableSyncIfNeeded() {
    try {
      const currentStatus = googleDriveSync.status;
      if (!currentStatus.isEnabled) {
        await googleDriveSync.enableSync();
        console.log('Auto-enabled sync for signed-in user');
      }
    } catch (error) {
      console.error('Failed to auto-enable sync:', error);
      
      // If it's an authentication error, clear the auth state
      if (error.message.includes('No access token') || 
          error.message.includes('401') || 
          error.message.includes('Unauthorized')) {
        console.log('Authentication expired, clearing auth state');
        try {
          await googleAuth.signOut();
        } catch (signOutError) {
          console.error('Failed to sign out after auth error:', signOutError);
        }
      }
    }
  }

  _setupEventListeners() {
    // Listen for auth state changes
    googleAuth.addEventListener('signIn', this._handleSignIn.bind(this));
    googleAuth.addEventListener('signOut', this._handleSignOut.bind(this));

    // Listen for database changes
    window.addEventListener('databaseChange', this._handleDatabaseChange.bind(this));
    window.addEventListener('studySaved', this._handleStudySaved.bind(this));
  }

  async _handleSignIn(user) {
    try {
      await googleDriveSync.enableSync();
      console.log('Sync enabled after sign in - ready for manual sync');
    } catch (error) {
      console.error('Failed to enable sync after sign in:', error);
    }
  }

  async _handleSignOut() {
    console.log('Sync disabled after sign out');
    // No explicit disable needed for sync service
  }

  _handleDatabaseChange(event) {
    // Sync is now manual only - no automatic syncing
    console.log('📁 AutoSync: Database change detected but auto-sync disabled');
  }

  _handleStudySaved(event) {
    // Sync is now manual only - no automatic syncing  
    console.log('📁 AutoSync: Study saved but auto-sync disabled:', event.detail);
  }

  queueBackup(reason, metadata = {}) {
    // Manual sync only - no automatic queuing
    console.log(`📁 AutoSync: Would queue sync for ${reason}, but auto-sync disabled`);
  }

  _processQueueDebounced = this._debounce(this._processQueue.bind(this), 500); // Reduced debounce time

  async _processQueue() {
    if (this.isProcessingQueue || this.backupQueue.size === 0) {
      console.log(`📁 AutoBackup: Skipping queue processing - isProcessing: ${this.isProcessingQueue}, queueSize: ${this.backupQueue.size}`);
      return;
    }
    
    this.isProcessingQueue = true;
    console.log(`📁 AutoBackup: Processing queue with ${this.backupQueue.size} items`);
    
    try {
      // Only perform one backup for all queued changes
      const reasons = Array.from(this.backupQueue).map(item => item.reason);
      console.log(`📁 AutoBackup: Performing batch backup for reasons: ${reasons.join(',')}`);
      await this.performBackup(`batch_${reasons.join(',')}`);
      this.backupQueue.clear();
    } catch (error) {
      console.error('Failed to process backup queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async performSync(reason = 'manual') {
    console.log(`📁 AutoSync: Manual sync requested - ${reason}. Use GoogleBackupManager UI for sync operations.`);
    // All sync operations now go through the UI for conflict resolution
  }

  async performVisitSync() {
    console.log('📁 AutoSync: Visit sync skipped - use manual sync in UI');
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isSignedIn: googleAuth.isSignedIn,
      syncEnabled: googleDriveSync.status.isEnabled,
      lastSyncTime: this.lastSyncTime,
      queueSize: this.backupQueue.size,
      isProcessingQueue: this.isProcessingQueue
    };
  }

  // Utility function for debouncing
  _debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  destroy() {
    if (this.initPromise) {
      googleAuth.removeEventListener('signIn', this._handleSignIn);
      googleAuth.removeEventListener('signOut', this._handleSignOut);
      window.removeEventListener('databaseChange', this._handleDatabaseChange);
      window.removeEventListener('studySaved', this._handleStudySaved);
    }
  }
}

// Create singleton instance
export const autoBackupService = new AutoBackupService();
export default autoBackupService;