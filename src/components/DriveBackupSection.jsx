import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, RefreshCw, HardDrive, Loader2 } from 'lucide-react';
import { autoBackupService } from '@/services/AutoBackupService.js';
import { googleAuth } from '@/services/GoogleAuth.js';
import { googleDriveSync } from '@/services/GoogleDriveSync.js';
import { cloudSyncManager } from '@/services/CloudSyncManager.js';
import { useNavigate } from 'react-router-dom';

const DriveBackupSection = ({ isSidebarCollapsed }) => {
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState({
    isInitialized: false,
    isSignedIn: false,
    syncEnabled: false,
    lastSyncTime: null,
    queueSize: 0,
    isProcessingQueue: false
  });
  const [driveStatus, setDriveStatus] = useState(null);
  const [conflictsDetected, setConflictsDetected] = useState(false);
  const [conflictAnalysis, setConflictAnalysis] = useState(null);
  const [currentSyncStatus, setCurrentSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced', 'error', 'conflicts'
  const [showContent, setShowContent] = useState(!isSidebarCollapsed);
  const [showDriveInPosition, setShowDriveInPosition] = useState(!isSidebarCollapsed);

  useEffect(() => {
    const updateStatus = async () => {
      // Get status from cloud sync manager
      const status = cloudSyncManager.getStatus();
      
      setSyncStatus({
        isInitialized: googleAuth.initialized,
        isSignedIn: googleAuth.isSignedIn,
        syncEnabled: status.isEnabled,
        lastSyncTime: status.lastSyncTime?.getTime(),
        queueSize: status.queueSize,
        isProcessingQueue: status.isSyncing
      });
      
      // Update conflict information
      setConflictsDetected(status.hasConflicts);
      setConflictAnalysis(status.conflictData);
      
      // Map sync state to status
      if (status.hasConflicts) {
        setCurrentSyncStatus('conflicts');
      } else if (status.isSyncing) {
        setCurrentSyncStatus('syncing');
      } else {
        setCurrentSyncStatus('idle');
      }
      
      if (googleAuth.isSignedIn) {
        setDriveStatus(googleDriveSync.status);
      } else {
        setDriveStatus(null);
      }
    };

    // Initial update
    updateStatus();

    // Update status periodically (less frequent since we have event listeners)
    const interval = setInterval(updateStatus, 5000);

    // Listen for cloud sync manager state changes
    const unsubscribeState = cloudSyncManager.onStateChange(() => {
      updateStatus();
    });

    // Listen for sync completion events
    const unsubscribeSync = cloudSyncManager.onSyncComplete((syncData) => {
      if (syncData.success && syncData.syncTime) {
        setSyncStatus(prev => ({
          ...prev,
          lastSyncTime: syncData.syncTime.getTime()
        }));
        setCurrentSyncStatus('synced');
      } else if (!syncData.success) {
        setCurrentSyncStatus('error');
      }
      
      // Update full status after sync events
      setTimeout(updateStatus, 100);
    });

    return () => {
      clearInterval(interval);
      unsubscribeState();
      unsubscribeSync();
    };
  }, []);

  // Handle content visibility when sidebar expands/collapses
  useEffect(() => {
    if (!isSidebarCollapsed) {
      const timer = setTimeout(() => {
        setShowContent(true);
        setShowDriveInPosition(true);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
      setShowDriveInPosition(false);
    }
  }, [isSidebarCollapsed]);

  const getStatusIcon = () => {
    if (!syncStatus.isInitialized) {
      return <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />;
    }
    
    if (!syncStatus.isSignedIn) {
      return <HardDrive className="w-3 h-3 text-slate-500" />;
    }
    
    // Use new sync status for real-time feedback
    if (currentSyncStatus === 'syncing' || syncStatus.isProcessingQueue) {
      return <Loader2 className="w-3 h-3 animate-spin text-blue-400" />;
    }
    
    if (currentSyncStatus === 'conflicts' || conflictsDetected) {
      return <AlertCircle className="w-3 h-3 text-amber-400 animate-pulse" />;
    }
    
    if (currentSyncStatus === 'error') {
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    }
    
    if (currentSyncStatus === 'synced') {
      return <CheckCircle className="w-3 h-3 text-green-400" />;
    }
    
    if (syncStatus.syncEnabled) {
      return <CheckCircle className="w-3 h-3 text-green-400" />;
    }
    
    return <AlertCircle className="w-3 h-3 text-yellow-400" />;
  };

  const getStatusText = () => {
    if (!syncStatus.isInitialized) return 'Initializing...';
    if (!syncStatus.isSignedIn) return 'Sign in to enable sync';
    
    // Use new sync status for real-time feedback
    if (currentSyncStatus === 'syncing' || syncStatus.isProcessingQueue) {
      return 'Syncing studies...';
    }
    
    if (currentSyncStatus === 'conflicts' || conflictsDetected) {
      if (conflictAnalysis?.level) {
        return `${conflictAnalysis.level.charAt(0).toUpperCase() + conflictAnalysis.level.slice(1)} conflicts`;
      }
      return 'Conflicts detected';
    }
    
    if (currentSyncStatus === 'error') {
      return 'Sync error';
    }
    
    if (currentSyncStatus === 'synced') {
      return 'Just synced';
    }
    
    if (syncStatus.syncEnabled) return 'Sync enabled';
    return 'Sync disabled';
  };

  const getStatusColor = () => {
    if (!syncStatus.isInitialized) return 'text-slate-400';
    if (!syncStatus.isSignedIn) return 'text-slate-500';
    
    // Use new sync status for real-time feedback
    if (currentSyncStatus === 'syncing' || syncStatus.isProcessingQueue) {
      return 'text-blue-400';
    }
    
    if (currentSyncStatus === 'conflicts' || conflictsDetected) {
      return 'text-amber-400';
    }
    
    if (currentSyncStatus === 'error') {
      return 'text-red-400';
    }
    
    if (currentSyncStatus === 'synced') {
      return 'text-green-400';
    }
    
    if (syncStatus.syncEnabled) return 'text-green-400';
    return 'text-yellow-400';
  };

  const formatLastSyncTime = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Tooltip delayDuration={0} open={isSidebarCollapsed ? undefined : false}>
      <TooltipTrigger asChild>
        <div 
          className={`bg-slate-700/30 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer hover:bg-slate-700/40`}
          onClick={() => navigate('/google-drive-sync')}
        >
            <div className="p-3 h-[88px] relative">
              <img 
                src="/Google_Drive_icon_(2020).svg" 
                alt="Google Drive" 
                className={`w-6 h-6 absolute transition-all duration-300 ease-in-out ${
                  showDriveInPosition 
                    ? 'left-3 top-3' 
                    : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
                }`} 
              />
              
              {/* Status indicator at top right of icon */}
              <div className={`absolute transition-all duration-300 ease-in-out ${
                showDriveInPosition 
                  ? 'left-8 top-2' 
                  : 'left-1/2 top-1/2 translate-x-2 -translate-y-4'
              }`}>
                {getStatusIcon()}
              </div>
              
              <div className={`text-sm transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'} pl-11`}>
                <div className={`transition-all duration-300 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                  <span className="text-white font-medium">Drive Sync</span>
                </div>
                <div className={`transition-all duration-300 ${showContent ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                  <p className={`text-xs leading-tight ${getStatusColor()}`}>
                    {getStatusText()}
                  </p>
                  {syncStatus.lastSyncTime && (
                    <p className="text-slate-400 text-xs leading-tight">
                      Last: {formatLastSyncTime(syncStatus.lastSyncTime)}
                    </p>
                  )}
                  {syncStatus.queueSize > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-slate-400 text-xs">Pending:</span>
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                        {syncStatus.queueSize}
                      </Badge>
                    </div>
                  )}
                  {conflictAnalysis && conflictAnalysis.details && conflictAnalysis.details.length > 0 && (
                    <p className="text-amber-400 text-xs leading-tight">
                      {conflictAnalysis.details.length} conflict{conflictAnalysis.details.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="bg-slate-800 border-slate-700 text-white"
          sideOffset={10}
        >
          <div className="text-sm">
            <p className="font-medium">Drive Sync</p>
            <p className={`text-xs ${getStatusColor()}`}>{getStatusText()}</p>
            {conflictAnalysis && conflictAnalysis.hasConflicts && (
              <div className="text-xs text-amber-400 font-medium mt-1">
                <p>⚠️ {conflictAnalysis.level.charAt(0).toUpperCase() + conflictAnalysis.level.slice(1)} conflicts</p>
                {conflictAnalysis.details && conflictAnalysis.details.length > 0 && (
                  <p className="text-xs text-slate-400">
                    {conflictAnalysis.details.length} conflict{conflictAnalysis.details.length > 1 ? 's' : ''} detected
                  </p>
                )}
                {conflictAnalysis.resolutionSuggestions && conflictAnalysis.resolutionSuggestions.length > 0 && (
                  <p className="text-xs text-slate-400">
                    {conflictAnalysis.resolutionSuggestions[0].action}
                  </p>
                )}
              </div>
            )}
            {currentSyncStatus === 'syncing' && (
              <p className="text-xs text-blue-400">
                🔄 Syncing changes to cloud...
              </p>
            )}
            {currentSyncStatus === 'synced' && (
              <p className="text-xs text-green-400">
                ✅ Changes synced successfully
              </p>
            )}
            {syncStatus.lastSyncTime && (
              <p className="text-xs text-slate-400">
                Last: {formatLastSyncTime(syncStatus.lastSyncTime)}
              </p>
            )}
            {syncStatus.queueSize > 0 && (
              <p className="text-xs text-slate-400">
                Pending: {syncStatus.queueSize}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {conflictsDetected ? 'Click to resolve conflicts' : 'Click to manage sync'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
  );
};

export default DriveBackupSection;