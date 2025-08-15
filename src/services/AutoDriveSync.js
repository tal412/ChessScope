import { googleAuth } from './GoogleAuth.js';
import { googleDriveSync } from './GoogleDriveSync.js';
import { GOOGLE_API_CONFIG, validateGoogleConfig } from '../config/google.js';
import { conflictDetectionService } from './ConflictDetectionService.js';
import { databaseHashService } from './DatabaseHashService.js';

/**
 * Service for handling automatic Google Drive synchronization
 * Performs conflict-free sync operations on study changes
 */
class AutoDriveSyncService {
  constructor() {
    this.isInitialized = false;
    this.conflictsExist = false;
    this.lastSyncTime = null;
    this.syncQueue = new Set();
    this.isProcessingSyncQueue = false;
    this.syncListeners = new Set();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 AutoDriveSync: Initializing service...');
      
      // Validate configuration
      const validation = validateGoogleConfig();
      if (!validation.valid) {
        console.log('🔄 AutoDriveSync: Skipping - invalid configuration');
        return;
      }

      // Initialize Google Auth if not already done
      if (!googleAuth.isInitialized) {
        await googleAuth.initialize(GOOGLE_API_CONFIG);
      }

      this.isInitialized = true;
      console.log('🔄 AutoDriveSync: Service initialized');
      
      // Check for conflicts on startup if signed in
      if (googleAuth.isSignedIn) {
        await this.checkForConflicts();
      }
      
    } catch (error) {
      console.error('🔄 AutoDriveSync: Failed to initialize:', error);
    }
  }

  /**
   * Check if user has conflicts that prevent editing - with advanced detection
   */
  async checkForConflicts() {
    if (!this.isInitialized || !googleAuth.isSignedIn) {
      this.conflictsExist = false;
      return false;
    }

    try {
      await googleDriveSync.enableSync();
      
      // Get local and remote data
      const localData = await googleDriveSync.getLocalStudies();
      const remoteData = await googleDriveSync.getRemoteStudies();
      
      // Use advanced conflict detection
      const conflictAnalysis = await conflictDetectionService.detectConflicts(
        this.prepareDataForComparison(localData),
        this.prepareDataForComparison(remoteData),
        this.lastSyncTime
      );
      
      this.conflictsExist = conflictAnalysis.hasConflicts;
      
      if (this.conflictsExist) {
        console.warn(`🔄 AutoDriveSync: ${conflictAnalysis.level} level conflicts detected, editing disabled`);
        console.log('🔍 Conflict details:', conflictAnalysis.details);
        
        // Store detailed conflict information
        this.lastConflictAnalysis = conflictAnalysis;
        this.notifyConflictListeners(conflictAnalysis);
      } else {
        this.lastConflictAnalysis = null;
      }
      
      return this.conflictsExist;
    } catch (error) {
      console.error('🔄 AutoDriveSync: Error checking conflicts:', error);
      return false;
    }
  }

  /**
   * Prepare data for advanced conflict comparison
   */
  prepareDataForComparison(syncData) {
    return {
      studies: syncData.studies || [],
      folders: syncData.folders || [],
      tags: syncData.tags || [],
      moves: [], // Would need to be populated from database if needed
      annotations: [] // Would need to be populated from database if needed
    };
  }

  /**
   * Get detailed conflict analysis
   */
  getConflictAnalysis() {
    return this.lastConflictAnalysis;
  }

  /**
   * Automatically sync after study operations if no conflicts exist
   */
  async autoSync(operation, studyData = {}) {
    if (!this.canPerformAutoSync()) {
      console.log(`🔄 AutoDriveSync: Skipping auto-sync for ${operation} - conditions not met`);
      return false;
    }

    try {
      console.log(`🔄 AutoDriveSync: Performing auto-sync for ${operation}`);
      
      // Add to sync queue to batch operations
      this.syncQueue.add({
        operation,
        studyData,
        timestamp: Date.now()
      });

      // Process queue after a short delay to batch multiple rapid operations
      setTimeout(() => this.processSyncQueue(), 1000);
      
      return true;
    } catch (error) {
      console.error(`🔄 AutoDriveSync: Auto-sync failed for ${operation}:`, error);
      return false;
    }
  }

  /**
   * Check if auto-sync can be performed
   */
  canPerformAutoSync() {
    if (!this.isInitialized) {
      console.log('🔄 AutoDriveSync: Not initialized');
      return false;
    }
    
    if (!googleAuth.isSignedIn) {
      console.log('🔄 AutoDriveSync: User not signed in');
      return false;
    }
    
    if (this.conflictsExist) {
      console.log('🔄 AutoDriveSync: Conflicts exist, auto-sync disabled');
      return false;
    }
    
    if (!googleDriveSync.status.isEnabled) {
      console.log('🔄 AutoDriveSync: Drive sync not enabled');
      return false;
    }
    
    return true;
  }

  /**
   * Check if user can edit studies (no conflicts)
   */
  canEditStudies() {
    if (!googleAuth.isSignedIn) {
      return true; // Allow editing when not signed in
    }
    
    return !this.conflictsExist;
  }

  /**
   * Process queued sync operations
   */
  async processSyncQueue() {
    if (this.isProcessingSyncQueue || this.syncQueue.size === 0) {
      return;
    }

    this.isProcessingSyncQueue = true;
    
    // Show syncing status immediately
    this.showSyncStatus('syncing');
    
    try {
      const operations = Array.from(this.syncQueue);
      this.syncQueue.clear();

      console.log(`🔄 AutoDriveSync: Processing ${operations.length} queued operations`);

      // Perform the actual sync
      await googleDriveSync.syncToRemote('merge');
      
      this.lastSyncTime = new Date();
      console.log('🔄 AutoDriveSync: Batch sync completed successfully');
      
      // Notify listeners about successful sync
      this.notifySyncListeners({
        success: true,
        operations,
        syncTime: this.lastSyncTime
      });

      // Show sync indicator in sidebar
      this.showSyncStatus('synced');

    } catch (error) {
      console.error('🔄 AutoDriveSync: Batch sync failed:', error);
      
      // Check if it's a conflict error
      if (error.message.includes('DELETION_WARNING') || error.message.includes('conflicts')) {
        await this.checkForConflicts();
        this.showSyncStatus('conflicts');
      } else {
        this.showSyncStatus('error');
      }
      
      this.notifySyncListeners({
        success: false,
        error: error.message,
        operations: Array.from(this.syncQueue)
      });

    } finally {
      this.isProcessingSyncQueue = false;
    }
  }

  /**
   * Show sync status in sidebar/UI
   */
  showSyncStatus(status) {
    const event = new CustomEvent('syncStatusChange', {
      detail: {
        status, // 'syncing', 'synced', 'error'
        timestamp: new Date(),
        service: 'auto-drive-sync'
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Force a manual sync (for resolving conflicts)
   */
  async forceSyncAfterConflictResolution() {
    try {
      console.log('🔄 AutoDriveSync: Force sync after conflict resolution');
      
      await googleDriveSync.syncToRemote('merge');
      
      // Recheck for conflicts
      await this.checkForConflicts();
      
      this.lastSyncTime = new Date();
      console.log('🔄 AutoDriveSync: Force sync completed');
      
      this.showSyncStatus('synced');
      return true;
      
    } catch (error) {
      console.error('🔄 AutoDriveSync: Force sync failed:', error);
      this.showSyncStatus('error');
      return false;
    }
  }

  /**
   * Add listener for sync events
   */
  addSyncListener(callback) {
    this.syncListeners.add(callback);
  }

  /**
   * Remove sync listener
   */
  removeSyncListener(callback) {
    this.syncListeners.delete(callback);
  }

  /**
   * Notify sync listeners
   */
  notifySyncListeners(data) {
    this.syncListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('🔄 AutoDriveSync: Error in sync listener:', error);
      }
    });
  }

  /**
   * Add listener for conflict events
   */
  conflictListeners = new Set();

  addConflictListener(callback) {
    this.conflictListeners.add(callback);
  }

  removeConflictListener(callback) {
    this.conflictListeners.delete(callback);
  }

  notifyConflictListeners(conflicts) {
    this.conflictListeners.forEach(callback => {
      try {
        callback(conflicts);
      } catch (error) {
        console.error('🔄 AutoDriveSync: Error in conflict listener:', error);
      }
    });
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      canAutoSync: this.canPerformAutoSync(),
      canEdit: this.canEditStudies(),
      conflictsExist: this.conflictsExist,
      lastSyncTime: this.lastSyncTime,
      queueSize: this.syncQueue.size,
      isProcessingQueue: this.isProcessingSyncQueue
    };
  }
}

// Export singleton instance
export const autoDriveSync = new AutoDriveSyncService();
export default autoDriveSync;