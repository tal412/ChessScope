import React, { useState, useEffect } from 'react';
import { User, LogOut, RefreshCw, AlertTriangle, CheckCircle, Cloud, Monitor } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { AppBar } from '../components/ui/flexible-layout';
import { googleAuth } from '../services/GoogleAuth.js';
import { googleDriveSync } from '../services/GoogleDriveSync.js';
import { GOOGLE_API_CONFIG, validateGoogleConfig } from '../config/google.js';
import SyncConflictDialog from '../components/SyncConflictDialog.jsx';

// Custom Google Drive icon component for AppBar
const GoogleDriveIcon = ({ className }) => (
  <img 
    src="/Google_Drive_icon_(2020).svg" 
    alt="Google Drive" 
    className={className}
  />
);

const GoogleDriveSyncPage = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStats, setSyncStats] = useState(null);

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
        setInitializing(false);
        return;
      }
      
      try {
        console.log('Initializing Google Auth...');
        
        await googleAuth.initialize(GOOGLE_API_CONFIG);
        console.log('Google Auth initialized successfully');
        
        // Set initial state
        setIsSignedIn(googleAuth.isSignedIn);
        if (googleAuth.isSignedIn) {
          setUserInfo(googleAuth.getUserInfo());
          
          // Auto-enable sync if user is already signed in
          try {
            await googleDriveSync.enableSync();
            console.log('Auto-enabled sync for already signed-in user');
          } catch (error) {
            console.error('Failed to auto-enable sync for signed-in user:', error);
            if (error.message.includes('Authentication failed')) {
              setError('Google Drive authentication expired. Please sign out and sign in again.');
            }
          }
          
          await refreshSyncStatus();
          await loadSyncStats();
        }
      } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
        setError(`Failed to initialize Google authentication: ${error.message}`);
      } finally {
        setInitializing(false);
      }
    };

    // Listen for auth state changes
    const handleSignIn = async (user) => {
      setIsSignedIn(true);
      setUserInfo(user);
      setError(null);
      
      // Enable sync capability
      try {
        await googleDriveSync.enableSync();
        setSuccessMessage('Google Drive connected! You can now sync your data.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('Failed to enable sync:', error);
        if (error.message.includes('Authentication failed')) {
          setError('Authentication expired. Please sign out and sign in again to refresh your Google Drive access.');
        } else {
          setError('Failed to connect to Google Drive. Try signing out and signing in again.');
        }
      }
      
      await refreshSyncStatus();
      await loadSyncStats();
    };

    const handleSignOut = async () => {
      setIsSignedIn(false);
      setUserInfo(null);
      setSyncStatus(null);
      setConflictData(null);
      setLastSyncTime(null);
      setSyncStats(null);
    };

    googleAuth.addEventListener('signIn', handleSignIn);
    googleAuth.addEventListener('signOut', handleSignOut);

    initializeAuth();

    // Listen for sync events
    const handleSyncCompleted = (event) => {
      setSuccessMessage('Sync completed successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setLastSyncTime(new Date());
      refreshSyncStatus();
      loadSyncStats();
    };

    const handleSyncError = (event) => {
      setError(`Sync failed: ${event.detail.error}`);
    };

    window.addEventListener('syncCompleted', handleSyncCompleted);
    window.addEventListener('syncError', handleSyncError);

    return () => {
      googleAuth.removeEventListener('signIn', handleSignIn);
      googleAuth.removeEventListener('signOut', handleSignOut);
      window.removeEventListener('syncCompleted', handleSyncCompleted);
      window.removeEventListener('syncError', handleSyncError);
    };
  }, [configError]);

  const refreshSyncStatus = async () => {
    try {
      const status = googleDriveSync.status;
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to refresh sync status:', error);
    }
  };

  const loadSyncStats = async () => {
    try {
      if (googleAuth.isSignedIn && googleDriveSync.status.isEnabled) {
        const comparison = await googleDriveSync.compareData();
        setSyncStats(comparison);
      }
    } catch (error) {
      console.error('Failed to load sync stats:', error);
      setSyncStats(null);
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
    } catch (error) {
      console.error('Sign out failed:', error);
      setError('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First check for conflicts
      const comparison = await googleDriveSync.compareData();
      
      if (comparison.hasConflicts) {
        setConflictData(comparison);
        setShowConflictDialog(true);
      } else {
        // No conflicts, proceed with merge sync
        await googleDriveSync.syncToRemote('merge');
        setSuccessMessage('Sync completed successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        setLastSyncTime(new Date());
        await loadSyncStats();
      }
    } catch (error) {
      console.error('Sync failed:', error);
      if (error.message.includes('DELETION_WARNING')) {
        setError(error.message.replace('DELETION_WARNING: ', ''));
      } else {
        setError('Sync failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConflictResolve = async (strategy) => {
    try {
      setLoading(true);
      setError(null);
      setShowConflictDialog(false);
      
      if (strategy === 'force_overwrite' && conflictData.conflicts.toDelete.length > 0) {
        // Special handling for deletions - ask for explicit confirmation
        const confirmMessage = `Are you sure you want to delete ${conflictData.conflicts.toDelete.length} studies from the cloud?\n\nStudies to be deleted:\n${conflictData.conflicts.toDelete.map(s => s.name).join('\n')}`;
        if (!window.confirm(confirmMessage)) {
          return;
        }
      }
      
      await googleDriveSync.syncToRemote(strategy);
      setSuccessMessage('Sync conflicts resolved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setLastSyncTime(new Date());
      setConflictData(null);
      await loadSyncStats();
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      setError('Failed to resolve conflicts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConflictCancel = () => {
    setShowConflictDialog(false);
    setConflictData(null);
  };

  const handleRefreshStats = async () => {
    setLoading(true);
    await loadSyncStats();
    setLoading(false);
  };

  // Show loading screen while initializing
  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Header using AppBar */}
        <AppBar
          title="Google Drive Sync"
          icon={GoogleDriveIcon}
        />
        
        <div className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-4" />
                <p className="text-slate-300 text-lg">Initializing Google Drive sync...</p>
                <p className="text-slate-400 text-sm mt-2">Checking authentication status</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show configuration error
  if (configError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <img 
                src="/Google_Drive_icon_(2020).svg" 
                alt="Google Drive" 
                className="w-8 h-8"
              />
              <h1 className="text-2xl font-bold text-white">Google Drive Sync</h1>
            </div>
          </div>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Configuration Error</CardTitle>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header using AppBar */}
      <AppBar
        title="Google Drive Sync"
        icon={GoogleDriveIcon}
      />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">

        {/* Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-6 border-green-600/50 bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-200">{successMessage}</AlertDescription>
          </Alert>
        )}

        {!isSignedIn ? (
          /* Sign In Section */
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <img 
                  src="/Google_Drive_icon_(2020).svg" 
                  alt="Google Drive" 
                  className="w-8 h-8"
                />
              </div>
              <CardTitle className="text-2xl text-white">Connect to Google Drive</CardTitle>
              <CardDescription className="text-slate-400 text-lg">
                Sync your chess studies across all devices with smart conflict resolution
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <Cloud className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                  <h3 className="font-medium text-white mb-1">Cloud Storage</h3>
                  <p className="text-slate-400">Secure backup of all your studies</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <RefreshCw className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <h3 className="font-medium text-white mb-1">Smart Sync</h3>
                  <p className="text-slate-400">Never lose data with conflict detection</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <Monitor className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                  <h3 className="font-medium text-white mb-1">Cross-Device</h3>
                  <p className="text-slate-400">Access studies from anywhere</p>
                </div>
              </div>
              
              <Button 
                onClick={handleSignIn} 
                disabled={loading}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              >
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <User className="h-5 w-5 mr-2" />
                )}
                Sign in with Google
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Account & Status */}
            <div className="flex flex-col space-y-6 h-full">
              {/* User Account */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Account</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    {userInfo?.imageUrl && (
                      <img 
                        src={userInfo.imageUrl} 
                        alt={userInfo.name}
                        className="h-12 w-12 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-white">{userInfo?.name}</p>
                      <p className="text-sm text-slate-400">{userInfo?.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSignOutClick}
                      disabled={loading}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Sync Status</span>
                      <Badge variant={syncStatus?.isEnabled ? "secondary" : "destructive"}>
                        {syncStatus?.isEnabled ? "Connected" : "Disconnected"}
                      </Badge>
                    </div>
                    {lastSyncTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Last Sync</span>
                        <span className="text-sm text-white">{lastSyncTime.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-slate-800/50 border-slate-700 flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center space-y-4">
                  <Button 
                    onClick={handleSync}
                    disabled={loading || !syncStatus?.isEnabled}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {syncStats?.conflicts && (
                      syncStats.conflicts.localOnly.length > 0 || 
                      syncStats.conflicts.remoteOnly.length > 0 || 
                      syncStats.conflicts.modified.length > 0
                    ) ? 'Resolve and Sync' : 'Sync Now'}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={handleRefreshStats}
                    disabled={loading || !syncStatus?.isEnabled}
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                  
                  {/* Extra spacing content to help fill the card */}
                  <div className="pt-4 border-t border-slate-600/30">
                    <p className="text-xs text-slate-400 text-center">
                      Sync your studies safely with conflict detection
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Middle & Right Columns - Data Overview */}
            <div className="lg:col-span-2 flex">
              <Card className="bg-slate-800/50 border-slate-700 flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-white">Sync Overview</CardTitle>
                  <CardDescription className="text-slate-400">
                    Compare your local and cloud data
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {syncStats ? (
                    <div className="flex-1 flex flex-col justify-between space-y-6">
                      {/* Data Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-700/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Monitor className="h-5 w-5 text-blue-400" />
                            <h3 className="font-medium text-white">This Device</h3>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Studies</span>
                              <span className="text-white font-medium">{syncStats.local.studies.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Folders</span>
                              <span className="text-white font-medium">{syncStats.local.folders.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Tags</span>
                              <span className="text-white font-medium">{syncStats.local.tags.length}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-700/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Cloud className="h-5 w-5 text-green-400" />
                            <h3 className="font-medium text-white">Google Drive</h3>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Studies</span>
                              <span className="text-white font-medium">{syncStats.remote.studies.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Folders</span>
                              <span className="text-white font-medium">{syncStats.remote.folders.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Tags</span>
                              <span className="text-white font-medium">{syncStats.remote.tags.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sync Status */}
                      {syncStats.hasConflicts ? (
                        <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                            <h3 className="font-medium text-amber-200">Conflicts Detected</h3>
                          </div>
                          <div className="space-y-2 text-sm">
                            {syncStats.conflicts.localOnly.length > 0 && (
                              <p className="text-amber-200">
                                💻 {syncStats.conflicts.localOnly.length} studies only on device
                              </p>
                            )}
                            {syncStats.conflicts.remoteOnly.length > 0 && (
                              <p className="text-amber-200">
                                ☁️ {syncStats.conflicts.remoteOnly.length} studies only in cloud
                              </p>
                            )}
                            {syncStats.conflicts.modified.length > 0 && (
                              <p className="text-amber-200">
                                🔄 {syncStats.conflicts.modified.length} studies modified in both locations
                              </p>
                            )}
                          </div>
                          <p className="text-amber-200 text-sm mt-3">
                            Click "Resolve and Sync" to resolve these conflicts safely.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                            <h3 className="font-medium text-green-200">Everything in Sync</h3>
                          </div>
                          <p className="text-green-200 text-sm mt-1">
                            Your local and cloud data are perfectly synchronized.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                          <p className="text-slate-400">Loading sync status...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Cloud className="h-8 w-8 text-slate-400" />
                          <p className="text-slate-400">Click "Refresh Status" to check sync data</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Sync Conflict Dialog */}
      {showConflictDialog && (
        <SyncConflictDialog
          conflictData={conflictData}
          onResolve={handleConflictResolve}
          onCancel={handleConflictCancel}
          loading={loading}
        />
      )}
    </div>
  );
};

export default GoogleDriveSyncPage;