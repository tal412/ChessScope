import React, { useState, useEffect } from 'react';
import { User, ChevronRight, AlertTriangle, CheckCircle, Cloud } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { googleAuth } from '../services/GoogleAuth.js';
import { googleDriveSync } from '../services/GoogleDriveSync.js';
import { GOOGLE_API_CONFIG, validateGoogleConfig } from '../config/google.js';
import { useNavigate } from 'react-router-dom';

const GoogleBackupManager = () => {
  const navigate = useNavigate();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(false);

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
    // Quick initialization to check current state
    const initializeQuickStatus = async () => {
      if (configError) {
        return;
      }
      
      try {
        // Check if already initialized and signed in
        if (googleAuth.isInitialized) {
          setIsSignedIn(googleAuth.isSignedIn);
          if (googleAuth.isSignedIn) {
            setUserInfo(googleAuth.getUserInfo());
            setSyncStatus(googleDriveSync.status);
          }
        }
      } catch (error) {
        console.error('Failed to get quick status:', error);
      }
    };

    initializeQuickStatus();

    // Listen for auth state changes
    const handleSignIn = (user) => {
      setIsSignedIn(true);
      setUserInfo(user);
      setSyncStatus(googleDriveSync.status);
    };

    const handleSignOut = () => {
      setIsSignedIn(false);
      setUserInfo(null);
      setSyncStatus(null);
    };

    googleAuth.addEventListener('signIn', handleSignIn);
    googleAuth.addEventListener('signOut', handleSignOut);

    return () => {
      googleAuth.removeEventListener('signIn', handleSignIn);
      googleAuth.removeEventListener('signOut', handleSignOut);
    };
  }, [configError]);

  const handleCardClick = () => {
    navigate('/google-drive-sync');
  };

  return (
    <Card 
      className="bg-slate-700/30 border-slate-600/50 cursor-pointer hover:bg-slate-700/40 transition-colors"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <Cloud className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Google Drive Sync</CardTitle>
              <p className="text-slate-400 text-sm">Smart conflict-free synchronization</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </div>
      </CardHeader>
      
      <CardContent>
        {configError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="text-sm">Configuration required</p>
                <p className="text-xs">Click to configure Google Drive API</p>
              </div>
            </AlertDescription>
          </Alert>
        ) : !isSignedIn ? (
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-white text-sm font-medium">Not connected</p>
              <p className="text-slate-400 text-xs">Click to sign in and sync your studies</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {userInfo?.imageUrl && (
                <img 
                  src={userInfo.imageUrl} 
                  alt={userInfo.name}
                  className="h-6 w-6 rounded-full"
                />
              )}
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{userInfo?.name}</p>
                <p className="text-slate-400 text-xs">Connected</p>
              </div>
              <Badge variant={syncStatus?.isEnabled ? "secondary" : "destructive"} className="text-xs">
                {syncStatus?.isEnabled ? "Ready" : "Disabled"}
              </Badge>
            </div>
            <p className="text-slate-400 text-xs">Click to manage sync settings and view conflicts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleBackupManager;