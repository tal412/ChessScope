import { googleAuth } from './GoogleAuth.js';
import { getDb } from '../api/database.js';

class GoogleDriveBackupService {
  constructor() {
    this.backupFileName = 'chesscope-backup.db';
    this.backupFolderId = null;
    this.isBackupEnabled = false;
    this.lastBackupTime = null;
    this.backupInProgress = false;
    this.pendingChanges = false;
  }

  async enableBackup() {
    if (!googleAuth.isSignedIn) {
      throw new Error('User must be signed in to Google');
    }

    try {
      // Create or find backup folder
      await this.ensureBackupFolder();
      
      this.isBackupEnabled = true;
      
      // Perform initial backup
      await this.performBackup();
      
      // Check for updates from Google Drive on startup
      await this.checkForUpdates();
      
      console.log('Google Drive backup enabled successfully');
      return true;
    } catch (error) {
      console.error('Failed to enable backup:', error);
      throw error;
    }
  }

  async disableBackup() {
    this.isBackupEnabled = false;
    console.log('Google Drive backup disabled');
  }

  async ensureBackupFolder() {
    try {
      // Search for existing ChessScope folder using REST API
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='ChessScope' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&spaces=drive`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for folder: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        this.backupFolderId = searchData.files[0].id;
        console.log('Found existing ChessScope folder:', this.backupFolderId);
      } else {
        // Create new folder using REST API
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAuth.getAccessToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'ChessScope',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        
        if (!createResponse.ok) {
          throw new Error(`Failed to create folder: ${createResponse.statusText}`);
        }
        
        const createData = await createResponse.json();
        this.backupFolderId = createData.id;
        console.log('Created ChessScope folder:', this.backupFolderId);
      }
    } catch (error) {
      console.error('Error ensuring backup folder:', error);
      throw error;
    }
  }

  async performBackup() {
    if (this.backupInProgress) {
      console.log('Backup already in progress, skipping...');
      return false;
    }

    if (!this.isBackupEnabled || !googleAuth.isSignedIn) {
      return false;
    }

    try {
      this.backupInProgress = true;
      console.log('Starting database backup...');

      const db = getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      // Export database to binary data
      const dbData = db.export();
      const blob = new Blob([dbData], { type: 'application/x-sqlite3' });

      // Check if backup file already exists using REST API
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${this.backupFileName}' and parents in '${this.backupFolderId}' and trashed=false`)}&spaces=drive`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for existing backup: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      let fileId = null;
      if (searchData.files && searchData.files.length > 0) {
        fileId = searchData.files[0].id;
      }

      // Upload or update file
      const metadata = {
        name: this.backupFileName,
        parents: [this.backupFolderId],
        description: `ChessScope database backup - ${new Date().toISOString()}`
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const url = fileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const method = fileId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.lastBackupTime = new Date();
      this.pendingChanges = false;

      console.log('Database backup completed successfully:', result.id);
      
      // Dispatch custom event for UI updates
      window.dispatchEvent(new CustomEvent('backupCompleted', { 
        detail: { 
          time: this.lastBackupTime,
          fileId: result.id 
        }
      }));

      return true;
    } catch (error) {
      console.error('Backup failed:', error);
      
      // Dispatch error event
      window.dispatchEvent(new CustomEvent('backupError', { 
        detail: { error: error.message }
      }));
      
      throw error;
    } finally {
      this.backupInProgress = false;
    }
  }

  async restoreFromBackup() {
    if (!googleAuth.isSignedIn) {
      throw new Error('User must be signed in to Google');
    }

    try {
      console.log('Starting database restore...');

      // Find backup file using REST API
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${this.backupFileName}' and parents in '${this.backupFolderId}' and trashed=false`)}&spaces=drive&orderBy=modifiedTime%20desc`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for backup file: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.files || searchData.files.length === 0) {
        throw new Error('No backup file found');
      }

      const backupFile = searchData.files[0];
      console.log('Found backup file:', backupFile.name, 'modified:', backupFile.modifiedTime);

      // Download backup file
      const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${backupFile.id}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!downloadResponse.ok) {
        throw new Error(`Download failed: ${downloadResponse.statusText}`);
      }

      const dbData = await downloadResponse.arrayBuffer();
      
      // Store in localStorage
      const uint8Array = new Uint8Array(dbData);
      const dataString = JSON.stringify(Array.from(uint8Array));
      localStorage.setItem('chesscope_db', dataString);

      console.log('Database restore completed successfully');
      
      // Dispatch restore event
      window.dispatchEvent(new CustomEvent('backupRestored', { 
        detail: { 
          backupTime: backupFile.modifiedTime,
          fileId: backupFile.id
        }
      }));

      // Reload page to reinitialize with restored data
      window.location.reload();
      
      return true;
    } catch (error) {
      console.error('Restore failed:', error);
      
      // Dispatch error event
      window.dispatchEvent(new CustomEvent('restoreError', { 
        detail: { error: error.message }
      }));
      
      throw error;
    }
  }

  async getBackupInfo() {
    if (!this.isBackupEnabled || !googleAuth.isSignedIn || !this.backupFolderId) {
      return null;
    }

    try {
      // Get backup file info using REST API
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${this.backupFileName}' and parents in '${this.backupFolderId}' and trashed=false`)}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime%20desc`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to get backup info: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.files || searchData.files.length === 0) {
        return null;
      }

      const backupFile = searchData.files[0];
      return {
        fileId: backupFile.id,
        lastModified: new Date(backupFile.modifiedTime),
        size: parseInt(backupFile.size) || 0,
        sizeFormatted: this.formatFileSize(parseInt(backupFile.size) || 0)
      };
    } catch (error) {
      console.error('Error getting backup info:', error);
      return null;
    }
  }

  markDataChanged() {
    this.pendingChanges = true;
    // Trigger immediate backup if enabled
    if (this.isBackupEnabled && !this.backupInProgress) {
      this.performBackup().catch(error => {
        console.error('Immediate backup failed:', error);
      });
    }
  }


  async checkForUpdates() {
    if (!this.isBackupEnabled || !googleAuth.isSignedIn || !this.backupFolderId) {
      return false;
    }

    try {
      console.log('Checking for Google Drive backup updates...');
      
      // Get remote backup info
      const remoteBackupInfo = await this.getBackupInfo();
      if (!remoteBackupInfo) {
        console.log('No remote backup found');
        return false;
      }

      // Get local database last modified time from localStorage metadata
      const localDbString = localStorage.getItem('chesscope_db');
      if (!localDbString) {
        console.log('No local database found, remote backup is newer');
        return true;
      }

      // For now, we'll use a simple heuristic: compare sizes
      // A more sophisticated approach would store metadata about last sync time
      const localSize = new Blob([localDbString]).size;
      const sizeDifferencePercent = Math.abs(remoteBackupInfo.size - localSize) / Math.max(remoteBackupInfo.size, localSize) * 100;
      
      // If there's a significant size difference (>5%), prompt user
      if (sizeDifferencePercent > 5) {
        console.log(`Remote backup size differs significantly from local: remote=${remoteBackupInfo.sizeFormatted}, local=${this.formatFileSize(localSize)}`);
        
        const shouldRestore = confirm(
          `A different version of your studies was found in Google Drive backup.\n\n` +
          `Remote backup: ${remoteBackupInfo.sizeFormatted} (modified ${remoteBackupInfo.lastModified.toLocaleString()})\n` +
          `Local database: ${this.formatFileSize(localSize)}\n\n` +
          `Would you like to restore from the remote backup? This will replace your current local data.`
        );
        
        if (shouldRestore) {
          await this.restoreFromBackup();
          return true;
        }
      } else {
        console.log('Local and remote backups appear to be similar in size');
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for backup updates:', error);
      return false;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Getters for component use
  get status() {
    return {
      isEnabled: this.isBackupEnabled,
      isSignedIn: googleAuth.isSignedIn,
      lastBackupTime: this.lastBackupTime,
      backupInProgress: this.backupInProgress,
      pendingChanges: this.pendingChanges
    };
  }
}

// Create singleton instance
export const googleDriveBackup = new GoogleDriveBackupService();
export default googleDriveBackup;