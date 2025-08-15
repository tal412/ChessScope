import { googleAuth } from './GoogleAuth.js';
import { googleDriveSync } from './GoogleDriveSync.js';
import { conflictDetectionService } from './ConflictDetectionService.js';
import { suppressBackups, enableBackups } from '../api/database.js';

/**
 * Unified Cloud Sync Manager - Single source of truth for all sync operations
 * 
 * States:
 * - IDLE: Ready to sync, no pending operations
 * - SYNCING: Currently syncing to cloud
 * - CONFLICTS: User intervention required
 * 
 * Principles:
 * 1. All data changes trigger auto-sync after brief delay
 * 2. Conflict detection only happens when truly idle
 * 3. User actions are never blocked by background sync operations
 * 4. Clean, predictable API for components
 */

const SYNC_STATES = {
  IDLE: 'idle',
  SYNCING: 'syncing', 
  CONFLICTS: 'conflicts'
};

class CloudSyncManager {
  constructor() {
    this.state = SYNC_STATES.IDLE;
    this.syncQueue = new Set();
    this.pendingSyncTimeout = null;
    this.lastSyncTime = null;
    this.conflictData = null;
    
    // Event listeners
    this.stateListeners = new Set();
    this.syncListeners = new Set();
    
    // Flags
    this.isInitialized = false;
    this.isEnabled = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('☁️ CloudSyncManager: Already initialized, skipping');
      return;
    }
    
    try {
      console.log('☁️ CloudSyncManager: Initializing...');
      
      // Initialize Google Auth if needed
      if (!googleAuth.isInitialized) {
        const { GOOGLE_API_CONFIG } = await import('../config/google.js');
        await googleAuth.initialize(GOOGLE_API_CONFIG);
      }
      
      this.isInitialized = true;
      console.log('☁️ CloudSyncManager: Initialized');
      
      // Enable sync if user is signed in
      if (googleAuth.isSignedIn) {
        await this.enableSync();
      }
      
    } catch (error) {
      console.error('☁️ CloudSyncManager: Failed to initialize:', error);
      this.isInitialized = false; // Reset on error
      throw error;
    }
  }

  async enableSync() {
    if (!googleAuth.isSignedIn) {
      console.log('☁️ CloudSyncManager: Cannot enable sync - user not signed in');
      return false;
    }

    try {
      await googleDriveSync.enableSync();
      this.isEnabled = true;
      console.log('☁️ CloudSyncManager: Sync enabled');
      
      // Perform initial sync to get in sync with remote
      await this.performInitialSync();
      
      return true;
    } catch (error) {
      console.error('☁️ CloudSyncManager: Failed to enable sync:', error);
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * Perform initial sync when enabling sync
   */
  async performInitialSync() {
    console.log('☁️ CloudSyncManager: Performing initial sync...');
    
    try {
      this.setState(SYNC_STATES.SYNCING);
      
      // Suppress backup notifications during initial sync to avoid recursive sync
      suppressBackups();
      
      // Sync local changes to remote first
      await googleDriveSync.syncToRemote('merge');
      this.lastSyncTime = new Date();
      
      console.log('☁️ CloudSyncManager: Initial sync completed');
      this.setState(SYNC_STATES.IDLE);
      
      // Now check for any remaining conflicts
      await this.checkForConflicts();
      
    } catch (error) {
      console.error('☁️ CloudSyncManager: Initial sync failed:', error);
      this.setState(SYNC_STATES.IDLE);
      
      // Check if it's a conflict
      if (this.isConflictError(error)) {
        await this.handleConflictDetected(error);
      }
    } finally {
      // Re-enable backups after initial sync
      enableBackups();
    }
  }

  /**
   * Queue a data change for syncing
   * This is the main entry point for all data changes
   */
  queueChange(operation, data = {}) {
    if (!this.isEnabled) {
      console.log(`☁️ CloudSyncManager: Sync disabled, skipping ${operation}`);
      return;
    }

    console.log(`☁️ CloudSyncManager: Queuing ${operation}`);
    
    // Add to queue
    this.syncQueue.add({
      operation,
      data,
      timestamp: Date.now()
    });

    // Clear existing timeout
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
    }

    // Schedule sync with debounce
    this.pendingSyncTimeout = setTimeout(() => {
      this.pendingSyncTimeout = null;
      this.processSyncQueue();
    }, 2000); // 2 second debounce for better batching
  }

  /**
   * Process all queued changes
   */
  async processSyncQueue() {
    if (this.state === SYNC_STATES.CONFLICTS) {
      console.log('☁️ CloudSyncManager: Skipping sync - conflicts exist');
      return;
    }

    if (this.syncQueue.size === 0) {
      return;
    }

    const operations = Array.from(this.syncQueue);
    this.syncQueue.clear();

    console.log(`☁️ CloudSyncManager: Processing ${operations.length} queued operations`);
    
    try {
      this.setState(SYNC_STATES.SYNCING);
      
      // Suppress backup notifications during sync to avoid recursion
      suppressBackups();
      
      // Perform the sync
      await googleDriveSync.syncToRemote('merge');
      this.lastSyncTime = new Date();
      
      console.log('☁️ CloudSyncManager: Sync completed successfully');
      
      // Notify sync listeners
      this.notifySyncListeners({
        success: true,
        operations,
        syncTime: this.lastSyncTime
      });
      
      this.setState(SYNC_STATES.IDLE);
      
    } catch (error) {
      console.error('☁️ CloudSyncManager: Sync failed:', error);
      
      if (this.isConflictError(error)) {
        await this.handleConflictDetected(error);
      } else {
        // Other error - stay idle but notify
        this.setState(SYNC_STATES.IDLE);
        this.notifySyncListeners({
          success: false,
          error: error.message,
          operations
        });
      }
      
    } finally {
      enableBackups();
    }
  }

  /**
   * Check for conflicts - only when truly idle
   */
  async checkForConflicts() {
    if (this.state !== SYNC_STATES.IDLE) {
      console.log('☁️ CloudSyncManager: Cannot check conflicts - not idle');
      return false;
    }

    if (!this.isEnabled) {
      return false;
    }

    try {
      console.log('☁️ CloudSyncManager: Checking for conflicts...');
      
      const localData = await googleDriveSync.getLocalStudies();
      const remoteData = await googleDriveSync.getRemoteStudies();
      
      const conflictAnalysis = await conflictDetectionService.detectConflicts(
        this.prepareDataForComparison(localData),
        this.prepareDataForComparison(remoteData),
        this.lastSyncTime
      );
      
      if (conflictAnalysis.hasConflicts) {
        await this.handleConflictDetected(null, conflictAnalysis);
        return true;
      }
      
      // No conflicts
      this.conflictData = null;
      return false;
      
    } catch (error) {
      console.error('☁️ CloudSyncManager: Error checking conflicts:', error);
      return false;
    }
  }

  /**
   * Handle conflict detection
   */
  async handleConflictDetected(error, conflictAnalysis = null) {
    console.warn('☁️ CloudSyncManager: Conflicts detected');
    
    this.setState(SYNC_STATES.CONFLICTS);
    
    if (conflictAnalysis) {
      this.conflictData = conflictAnalysis;
    } else {
      // Try to analyze the error
      this.conflictData = {
        hasConflicts: true,
        level: 'unknown',
        details: [{ message: error?.message || 'Sync conflict detected' }]
      };
    }
  }

  /**
   * Resolve conflicts and retry sync
   */
  async resolveConflicts() {
    if (this.state !== SYNC_STATES.CONFLICTS) {
      console.log('☁️ CloudSyncManager: No conflicts to resolve');
      return true;
    }

    try {
      console.log('☁️ CloudSyncManager: Resolving conflicts...');
      
      this.setState(SYNC_STATES.SYNCING);
      
      // Attempt sync again
      await googleDriveSync.syncToRemote('merge');
      this.lastSyncTime = new Date();
      
      console.log('☁️ CloudSyncManager: Conflicts resolved successfully');
      
      this.conflictData = null;
      this.setState(SYNC_STATES.IDLE);
      
      return true;
      
    } catch (error) {
      console.error('☁️ CloudSyncManager: Failed to resolve conflicts:', error);
      
      if (this.isConflictError(error)) {
        // Still conflicts
        this.setState(SYNC_STATES.CONFLICTS);
        return false;
      } else {
        // Different error - back to idle
        this.setState(SYNC_STATES.IDLE);
        throw error;
      }
    }
  }

  /**
   * Force immediate sync (for manual sync operations)
   */
  async forceSyncNow() {
    if (this.state === SYNC_STATES.CONFLICTS) {
      throw new Error('Cannot sync while conflicts exist');
    }

    // Clear pending operations
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
      this.pendingSyncTimeout = null;
    }

    await this.processSyncQueue();
  }

  /**
   * Check if an error indicates a conflict
   */
  isConflictError(error) {
    if (!error) return false;
    const message = error.message.toLowerCase();
    return message.includes('conflict') || 
           message.includes('deletion_warning') ||
           message.includes('concurrent');
  }

  /**
   * Prepare data for conflict comparison
   */
  prepareDataForComparison(syncData) {
    return {
      studies: syncData.studies || [],
      folders: syncData.folders || [],
      tags: syncData.tags || []
    };
  }

  /**
   * Set sync state and notify listeners
   */
  setState(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    
    console.log(`☁️ CloudSyncManager: State changed ${oldState} → ${newState}`);
    
    this.notifyStateListeners({
      oldState,
      newState,
      timestamp: new Date()
    });
  }

  // Public API

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      state: this.state,
      isEnabled: this.isEnabled,
      canEdit: this.state !== SYNC_STATES.CONFLICTS,
      hasConflicts: this.state === SYNC_STATES.CONFLICTS,
      isSyncing: this.state === SYNC_STATES.SYNCING,
      isIdle: this.state === SYNC_STATES.IDLE,
      lastSyncTime: this.lastSyncTime,
      queueSize: this.syncQueue.size,
      conflictData: this.conflictData
    };
  }

  /**
   * Add state change listener
   */
  onStateChange(callback) {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  /**
   * Add sync completion listener
   */
  onSyncComplete(callback) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Notify state listeners
   */
  notifyStateListeners(data) {
    this.stateListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('☁️ CloudSyncManager: Error in state listener:', error);
      }
    });
  }

  /**
   * Notify sync listeners
   */
  notifySyncListeners(data) {
    this.syncListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('☁️ CloudSyncManager: Error in sync listener:', error);
      }
    });
  }

  /**
   * Wait for current sync operations to complete
   */
  async waitForIdle(timeout = 10000) {
    const startTime = Date.now();
    
    while (this.state === SYNC_STATES.SYNCING && 
           (Date.now() - startTime < timeout)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.state === SYNC_STATES.SYNCING) {
      throw new Error('Timeout waiting for sync to complete');
    }
    
    return this.state === SYNC_STATES.IDLE;
  }
}

// Export singleton instance
export const cloudSyncManager = new CloudSyncManager();
export default cloudSyncManager;