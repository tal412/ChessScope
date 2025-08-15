import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, RefreshCw, HardDrive } from 'lucide-react';
import { autoBackupService } from '@/services/AutoBackupService.js';
import { googleAuth } from '@/services/GoogleAuth.js';
import { googleDriveSync } from '@/services/GoogleDriveSync.js';
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
  const [showContent, setShowContent] = useState(!isSidebarCollapsed);
  const [showDriveInPosition, setShowDriveInPosition] = useState(!isSidebarCollapsed);

  useEffect(() => {
    const updateStatus = async () => {
      const status = autoBackupService.getStatus();
      setSyncStatus(status);
      
      if (status.isSignedIn && status.syncEnabled) {
        setDriveStatus(googleDriveSync.status);
        
        // Check for conflicts
        try {
          const comparison = await googleDriveSync.compareData();
          setConflictsDetected(comparison.hasConflicts);
        } catch (error) {
          console.error('Error checking for conflicts:', error);
          setConflictsDetected(false);
        }
      } else {
        setDriveStatus(null);
        setConflictsDetected(false);
      }
    };

    // Initial update
    updateStatus();

    // Update status periodically
    const interval = setInterval(updateStatus, 2000);

    // Listen for sync events
    const handleSyncCompleted = () => updateStatus();
    const handleSyncError = () => updateStatus();

    window.addEventListener('syncCompleted', handleSyncCompleted);
    window.addEventListener('syncError', handleSyncError);

    return () => {
      clearInterval(interval);
      window.removeEventListener('syncCompleted', handleSyncCompleted);
      window.removeEventListener('syncError', handleSyncError);
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
    
    if (syncStatus.isProcessingQueue) {
      return <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />;
    }
    
    if (conflictsDetected) {
      return <AlertCircle className="w-3 h-3 text-amber-400" />;
    }
    
    if (syncStatus.syncEnabled) {
      return <CheckCircle className="w-3 h-3 text-green-400" />;
    }
    
    return <AlertCircle className="w-3 h-3 text-yellow-400" />;
  };

  const getStatusText = () => {
    if (!syncStatus.isInitialized) return 'Initializing...';
    if (!syncStatus.isSignedIn) return 'Sign in to enable sync';
    if (syncStatus.isProcessingQueue) return 'Syncing...';
    if (conflictsDetected) return 'Conflicts detected';
    if (syncStatus.syncEnabled) return 'Sync enabled';
    return 'Sync disabled';
  };

  const getStatusColor = () => {
    if (!syncStatus.isInitialized) return 'text-slate-400';
    if (!syncStatus.isSignedIn) return 'text-slate-500';
    if (syncStatus.isProcessingQueue) return 'text-blue-400';
    if (conflictsDetected) return 'text-amber-400';
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
                    {syncStatus.isProcessingQueue ? 'Syncing...' : 
                     conflictsDetected ? 'Conflicts detected' :
                     syncStatus.syncEnabled ? 'Active' : getStatusText()}
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
            {conflictsDetected && (
              <p className="text-xs text-amber-400 font-medium">
                ⚠️ Sync conflicts need attention
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