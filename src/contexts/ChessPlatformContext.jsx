// Chess Platform Context - Only handles Chess.com/Lichess authentication
// Completely separate from Firebase - this is for game analysis only

import { createContext, useContext, useState, useEffect } from 'react';
import { chessPlatformService } from '../services/ChessPlatformAuth.js';

const ChessPlatformContext = createContext();

export const useChessPlatform = () => {
  const context = useContext(ChessPlatformContext);
  if (!context) {
    throw new Error('useChessPlatform must be used within a ChessPlatformProvider');
  }
  return context;
};

export const ChessPlatformProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');

  // Initialize on mount
  useEffect(() => {
    // Check for existing profile in localStorage
    const savedProfile = localStorage.getItem('chessScope_chessProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setProfile(profile);
        setIsConnected(true);
      } catch (error) {
        console.error('Error parsing saved chess profile:', error);
        localStorage.removeItem('chessScope_chessProfile');
      }
    }

    // Set up service listeners
    const unsubscribeProgress = chessPlatformService.onProgress(setImportProgress);
    const unsubscribeStatus = chessPlatformService.onStatusChange(setImportStatus);
    const unsubscribeComplete = chessPlatformService.onComplete((result) => {
      setIsImporting(false);
      if (result.success) {
        setProfile(result.profile);
        setIsConnected(true);
      }
    });

    // Track import state
    setIsImporting(chessPlatformService.isImporting);

    return () => {
      unsubscribeProgress();
      unsubscribeStatus();
      unsubscribeComplete();
    };
  }, []);

  const connectPlatform = async (platform, username, importSettings) => {
    setIsImporting(true);
    const result = await chessPlatformService.connectChessPlatform(platform, username, importSettings);
    
    if (result.success) {
      setProfile(result.profile);
      setIsConnected(true);
    }
    
    return result;
  };

  const disconnect = () => {
    chessPlatformService.disconnect();
    setProfile(null);
    setIsConnected(false);
    setIsImporting(false);
    setImportProgress(0);
    setImportStatus('');
  };

  const value = {
    // State
    isConnected,
    profile,
    isImporting,
    importProgress,
    importStatus,
    
    // Actions
    connectPlatform,
    disconnect,
    
    // Aliases for compatibility
    user: profile,
    isAuthenticated: isConnected,
    login: connectPlatform,
    logout: disconnect
  };

  return (
    <ChessPlatformContext.Provider value={value}>
      {children}
    </ChessPlatformContext.Provider>
  );
};