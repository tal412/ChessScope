import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, User, LogOut, RefreshCw, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
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
      if (configError) return; // Don't initialize if config is invalid
      
      try {
        setLoading(true);
        await googleAuth.initialize(GOOGLE_API_CONFIG);
        
        // Set initial state
        setIsSignedIn(googleAuth.isSignedIn);
        if (googleAuth.isSignedIn) {
          setUserInfo(googleAuth.getUserInfo());
          await refreshBackupStatus();
        }
      } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
        setError('Failed to initialize Google authentication. Please check your configuration.');
      } finally {
        setLoading(false);
      }
    };

    // Listen for auth state changes
    const handleSignIn = (user) => {
      setIsSignedIn(true);
      setUserInfo(user);
      setError(null);
      refreshBackupStatus();
    };

    const handleSignOut = () => {
      setIsSignedIn(false);
      setUserInfo(null);
      setBackupStatus(null);
      setBackupInfo(null);
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

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await googleAuth.signOut();
      await googleDriveBackup.disableBackup();
    } catch (error) {
      console.error('Sign out failed:', error);
      setError('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBackup = async () => {
    try {
      setLoading(true);
      setError(null);
      await googleDriveBackup.enableBackup();
      setSuccessMessage('Google Drive backup enabled successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await refreshBackupStatus();
    } catch (error) {
      console.error('Failed to enable backup:', error);
      setError('Failed to enable backup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableBackup = async () => {
    try {
      setLoading(true);
      await googleDriveBackup.disableBackup();
      setSuccessMessage('Google Drive backup disabled');
      setTimeout(() => setSuccessMessage(null), 3000);
      await refreshBackupStatus();
    } catch (error) {
      console.error('Failed to disable backup:', error);
      setError('Failed to disable backup. Please try again.');
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-red-500" />
            Google Drive Backup
          </CardTitle>
          <CardDescription>
            Secure cloud backup for your study data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>{configError}</p>
                <p className="text-xs">
                  Set up instructions can be found in src/config/google.js
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Google Drive Backup
          </CardTitle>
          <CardDescription>
            Initializing Google authentication...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {backupStatus?.isEnabled ? (
            <Cloud className="h-5 w-5 text-green-500" />
          ) : (
            <CloudOff className="h-5 w-5 text-gray-400" />
          )}
          Google Drive Backup
        </CardTitle>
        <CardDescription>
          Automatically sync your study data to Google Drive for safe keeping
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
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
            <p className="text-muted-foreground">
              Sign in to Google to enable automatic backup of your study data
            </p>
            <Button onClick={handleSignIn} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <User className="h-4 w-4 mr-2" />
              )}
              Sign in to Google
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User info */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                {userInfo?.imageUrl && (
                  <img 
                    src={userInfo.imageUrl} 
                    alt={userInfo.name}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium">{userInfo?.name}</p>
                  <p className="text-sm text-muted-foreground">{userInfo?.email}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} disabled={loading}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            {/* Backup controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automatic Backup</p>
                  <p className="text-sm text-muted-foreground">
                    Sync changes to Google Drive every 30 seconds
                  </p>
                </div>
                {backupStatus?.isEnabled ? (
                  <Button variant="outline" onClick={handleDisableBackup} disabled={loading}>
                    Disable
                  </Button>
                ) : (
                  <Button onClick={handleEnableBackup} disabled={loading}>
                    Enable
                  </Button>
                )}
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
                    <div className="text-sm text-muted-foreground">
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