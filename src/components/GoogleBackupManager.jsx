import React, { useState, useEffect } from 'react';
import { User, LogOut, RefreshCw, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { googleAuth } from '../services/GoogleAuth.js';
import { googleDriveBackup } from '../services/GoogleDriveBackup.js';
import { GOOGLE_API_CONFIG, validateGoogleConfig } from '../config/google.js';

const GoogleBackupManager = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupInfo, setBackupInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Validate Google API configuration
  const [configError, setConfigError] = useState(null);
  
  useEffect(() => {
    const validation = validateGoogleConfig();
    if (!validation.valid) {
      setConfigError(validation.error);
      return;
    }
    setConfigError(null);
  }, []);

  useEffect(() => {
    // Initialize Google Auth
    const initializeAuth = async () => {
      if (configError) {
        console.log('Skipping Google Auth initialization due to config error:', configError);
        return; // Don't initialize if config is invalid
      }
      
      try {
        setLoading(true);
        console.log('Initializing Google Auth with config:', {
          hasApiKey: !!GOOGLE_API_CONFIG.apiKey,
          hasClientId: !!GOOGLE_API_CONFIG.clientId,
          apiKeyPrefix: GOOGLE_API_CONFIG.apiKey?.substring(0, 10) + '...',
          clientIdSuffix: '...' + GOOGLE_API_CONFIG.clientId?.substring(GOOGLE_API_CONFIG.clientId.length - 30)
        });
        
        await googleAuth.initialize(GOOGLE_API_CONFIG);
        console.log('Google Auth initialized successfully');
        
        // Set initial state
        setIsSignedIn(googleAuth.isSignedIn);
        if (googleAuth.isSignedIn) {
          setUserInfo(googleAuth.getUserInfo());
          
          // Auto-enable backup if user is already signed in but backup is not enabled
          const currentStatus = googleDriveBackup.status;
          if (!currentStatus.isEnabled) {
            try {
              await googleDriveBackup.enableBackup();
              console.log('Auto-enabled backup for already signed-in user');
            } catch (error) {
              console.error('Failed to auto-enable backup for signed-in user:', error);
            }
          }
          
          await refreshBackupStatus();
        }
      } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
        setError(`Failed to initialize Google authentication: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Listen for auth state changes
    const handleSignIn = async (user) => {
      setIsSignedIn(true);
      setUserInfo(user);
      setError(null);
      
      // Automatically enable backup when user signs in
      try {
        await googleDriveBackup.enableBackup();
        setSuccessMessage('Google Drive backup enabled automatically!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('Failed to auto-enable backup:', error);
        setError('Failed to enable automatic backup. You can try manually.');
      }
      
      await refreshBackupStatus();
    };

    const handleSignOut = async () => {
      setIsSignedIn(false);
      setUserInfo(null);
      setBackupStatus(null);
      setBackupInfo(null);
      
      // Automatically disable backup when user signs out
      try {
        await googleDriveBackup.disableBackup();
      } catch (error) {
        console.error('Failed to auto-disable backup on sign out:', error);
      }
    };

    googleAuth.addEventListener('signIn', handleSignIn);
    googleAuth.addEventListener('signOut', handleSignOut);

    initializeAuth();

    // Listen for backup events
    const handleBackupCompleted = (event) => {
      setSuccessMessage('Backup completed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      refreshBackupStatus();
    };

    const handleBackupError = (event) => {
      setError(`Backup failed: ${event.detail.error}`);
    };

    const handleBackupRestored = (event) => {
      setSuccessMessage('Database restored successfully!');
    };

    const handleRestoreError = (event) => {
      setError(`Restore failed: ${event.detail.error}`);
    };

    window.addEventListener('backupCompleted', handleBackupCompleted);
    window.addEventListener('backupError', handleBackupError);
    window.addEventListener('backupRestored', handleBackupRestored);
    window.addEventListener('restoreError', handleRestoreError);

    // Update backup status periodically
    const statusInterval = setInterval(() => {
      if (isSignedIn) {
        const status = googleDriveBackup.status;
        setBackupStatus(status);
      }
    }, 1000);

    return () => {
      googleAuth.removeEventListener('signIn', handleSignIn);
      googleAuth.removeEventListener('signOut', handleSignOut);
      window.removeEventListener('backupCompleted', handleBackupCompleted);
      window.removeEventListener('backupError', handleBackupError);
      window.removeEventListener('backupRestored', handleBackupRestored);
      window.removeEventListener('restoreError', handleRestoreError);
      clearInterval(statusInterval);
    };
  }, [isSignedIn, configError]);

  const refreshBackupStatus = async () => {
    try {
      const status = googleDriveBackup.status;
      const info = await googleDriveBackup.getBackupInfo();
      setBackupStatus(status);
      setBackupInfo(info);
    } catch (error) {
      console.error('Failed to refresh backup status:', error);
    }
  };

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await googleAuth.signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
      setError('Failed to sign in to Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutClick = async () => {
    try {
      setLoading(true);
      await googleAuth.signOut();
      // Backup will be automatically disabled by the handleSignOut event handler
    } catch (error) {
      console.error('Sign out failed:', error);
      setError('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleManualBackup = async () => {
    try {
      setLoading(true);
      setError(null);
      await googleDriveBackup.performBackup();
    } catch (error) {
      console.error('Manual backup failed:', error);
      setError('Manual backup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('This will replace your current database with the backup from Google Drive. Are you sure?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await googleDriveBackup.restoreFromBackup();
    } catch (error) {
      console.error('Restore failed:', error);
      setError('Restore failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show configuration error
  if (configError) {
    return (
      <Card className="bg-slate-700/30 border-slate-600/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <img 
                src="/Google_Drive_icon_(2020).svg" 
                alt="Google Drive" 
                className="w-6 h-6 flex-shrink-0"
              />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Google Drive Backup</CardTitle>
              <p className="text-slate-400 text-sm">Secure cloud backup for your study data</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>{configError}</p>
                <p className="text-xs">
                  Copy .env.example to .env and add your Google API credentials
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading && !isSignedIn) {
    return (
      <Card className="bg-slate-700/30 border-slate-600/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Google Drive Backup</CardTitle>
              <p className="text-slate-400 text-sm">Initializing Google authentication...</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-700/30 border-slate-600/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center">
            <img 
              src="/Google_Drive_icon_(2020).svg" 
              alt="Google Drive" 
              className="w-6 h-6 flex-shrink-0"
            />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Cloud Backup</CardTitle>
            <p className="text-slate-400 text-sm">Secure cloud storage</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {!isSignedIn ? (
          <div className="text-center space-y-4">
            <p className="text-slate-400">
              Sign in to Google to automatically backup your study data
            </p>
            <Button 
              onClick={handleSignIn} 
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <User className="h-4 w-4 mr-2" />
              )}
              Sign in & Enable Backup
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-600/30 rounded-lg border border-slate-600/50">
                {userInfo?.imageUrl && (
                  <img 
                    src={userInfo.imageUrl} 
                    alt={userInfo.name}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-white">{userInfo?.name}</p>
                  <p className="text-sm text-slate-400">{userInfo?.email}</p>
                </div>
                <button
                  onClick={handleSignOutClick}
                  disabled={loading}
                  className="p-1.5 rounded-md hover:bg-slate-500/50 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Backup status */}
            <div className="space-y-3">
              <div>
                <p className="font-medium text-white">Automatic Backup</p>
                <p className="text-sm text-slate-400">
                  Your studies are automatically synced to Google Drive on every save
                </p>
              </div>

              {backupStatus?.isEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={backupStatus.backupInProgress ? "default" : "secondary"}>
                      {backupStatus.backupInProgress ? "Backing up..." : "Ready"}
                    </Badge>
                    {backupStatus.pendingChanges && (
                      <Badge variant="outline">Changes pending</Badge>
                    )}
                  </div>

                  {backupInfo && (
                    <div className="text-sm text-slate-400">
                      <p>Last backup: {backupInfo.lastModified.toLocaleString()}</p>
                      <p>Size: {backupInfo.sizeFormatted}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleManualBackup}
                      disabled={loading || backupStatus.backupInProgress}
                      className="border-slate-500 text-slate-300 hover:bg-slate-600 hover:text-white"
                    >
                      {backupStatus.backupInProgress ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Backup Now
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRestore}
                      disabled={loading || !backupInfo}
                      className="border-slate-500 text-slate-300 hover:bg-slate-600 hover:text-white"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleBackupManager;