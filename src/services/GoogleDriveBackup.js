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
    // Track if we've already asked about restore this session
    // Use localStorage to persist across page reloads
    const sessionData = this.getSessionData();
    this.hasAskedAboutRestore = sessionData.hasAskedAboutRestore || false;
    this.lastRestoreCheckTime = sessionData.lastRestoreCheckTime || null;
  }

  getSessionData() {
    try {
      const data = localStorage.getItem('chesscope_backup_session');
      if (data) {
        const parsed = JSON.parse(data);
        // Check if session is still valid (within 30 minutes)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed;
        }
      }
    } catch (e) {
      console.log('Error reading session data:', e);
    }
    return {};
  }

  updateSessionData(updates) {
    try {
      const currentData = this.getSessionData();
      const newData = {
        ...currentData,
        ...updates,
        timestamp: Date.now()
      };
      localStorage.setItem('chesscope_backup_session', JSON.stringify(newData));
    } catch (e) {
      console.log('Error saving session data:', e);
    }
  }

  async enableBackup() {
    if (!googleAuth.isSignedIn) {
      throw new Error('User must be signed in to Google');
    }

    // If already enabled, don't re-initialize
    if (this.isBackupEnabled) {
      console.log('Google Drive backup already enabled, skipping re-initialization');
      return true;
    }

    try {
      // Create or find backup folder
      await this.ensureBackupFolder();
      
      this.isBackupEnabled = true;
      
      // Don't perform automatic backup on enable - let user choose to backup or restore
      
      console.log('Google Drive backup enabled successfully');
      return true;
    } catch (error) {
      console.error('Failed to enable backup:', error);
      this.isBackupEnabled = false; // Reset on error
      throw error;
    }
  }

  async disableBackup() {
    this.isBackupEnabled = false;
    console.log('Google Drive backup disabled');
  }

  async ensureBackupFolder() {
    try {
      // Check if we have a valid access token
      const accessToken = googleAuth.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available. Please sign in again.');
      }

      console.log('Searching for ChessScope folder with token:', accessToken.substring(0, 20) + '...');
      
      // Search for existing ChessScope folder using REST API
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='ChessScope' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&spaces=drive`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        if (searchResponse.status === 401) {
          throw new Error('Authentication failed. Please sign out and sign in again to refresh your credentials.');
        }
        if (searchResponse.status === 403) {
          const errorText = await searchResponse.text();
          console.error('Google Drive API error:', searchResponse.status, searchResponse.statusText, errorText);
          
          // Check if it's the API not enabled error
          if (errorText.includes('Google Drive API has not been used') || errorText.includes('SERVICE_DISABLED')) {
            throw new Error('Google Drive API is not enabled. Please enable it in Google Cloud Console and try again.');
          }
          throw new Error('Google Drive access denied. Please check your API permissions.');
        }
        const errorText = await searchResponse.text();
        console.error('Google Drive API error:', searchResponse.status, searchResponse.statusText, errorText);
        throw new Error(`Failed to search for folder: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        this.backupFolderId = searchData.files[0].id;
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
        description: `ChessScope database backup - ${new Date().toISOString()}`
      };

      // Only include parents for new files (POST), not updates (PATCH)
      if (!fileId) {
        metadata.parents = [this.backupFolderId];
      }

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const url = fileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const method = fileId ? 'PATCH' : 'POST';

      console.log(`Uploading backup using ${method} to:`, url);
      console.log('File size:', blob.size, 'bytes');
      console.log('Metadata:', metadata);
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`,
          // Don't set Content-Type - let browser set it for multipart/form-data
        },
        body: form
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error:', response.status, response.statusText, errorText);
        
        if (response.status === 403) {
          if (errorText.includes('insufficient permissions') || errorText.includes('drive.file')) {
            throw new Error('Insufficient permissions to upload to Google Drive. Please sign out and sign in again to refresh permissions.');
          }
          throw new Error('Google Drive upload access denied. Please check your permissions.');
        }
        
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
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

      // Debug: Check what we actually restored
      console.log('Database restore completed successfully - size:', dbData.byteLength, 'bytes');
      console.log('Stored database string length:', dataString.length);
      
      console.log('✅ Database restored successfully! Reloading page...');
      
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

  // Get detailed backup content info by analyzing the database
  async getBackupContentInfo() {
    try {
      const backupInfo = await this.getBackupInfo();
      if (!backupInfo) {
        return null;
      }

      // Download and analyze the backup file to show what's inside
      const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${backupInfo.fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!downloadResponse.ok) {
        throw new Error(`Failed to download backup for analysis: ${downloadResponse.statusText}`);
      }

      const dbData = await downloadResponse.arrayBuffer();
      
      // Load the backup database temporarily to analyze its contents
      const SQL = await import('sql.js');
      const sql = await SQL.default({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });
      
      const uint8Array = new Uint8Array(dbData);
      const tempDb = new sql.Database(uint8Array);
      
      // Query the backup database to see what's inside
      const studiesResult = tempDb.exec("SELECT COUNT(*) as count FROM user_studies");
      const studyCount = studiesResult.length > 0 ? studiesResult[0].values[0][0] : 0;
      
      const usernamesResult = tempDb.exec("SELECT DISTINCT username FROM user_studies LIMIT 5");
      const usernames = usernamesResult.length > 0 ? usernamesResult[0].values.map(row => row[0]) : [];
      
      const foldersResult = tempDb.exec("SELECT COUNT(*) as count FROM study_folders");
      const folderCount = foldersResult.length > 0 ? foldersResult[0].values[0][0] : 0;
      
      // Clean up
      tempDb.close();
      
      return {
        ...backupInfo,
        studyCount,
        usernames,
        folderCount,
        hasData: studyCount > 0
      };
    } catch (error) {
      console.error('Error analyzing backup content:', error);
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