import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GoogleBackupManager from "@/components/GoogleBackupManager";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock, RefreshCw, HardDrive } from 'lucide-react';
import { autoBackupService } from '@/services/AutoBackupService.js';
import { googleAuth } from '@/services/GoogleAuth.js';
import { googleDriveBackup } from '@/services/GoogleDriveBackup.js';

const BackupStatusIcon = ({ isSidebarCollapsed }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [backupStatus, setBackupStatus] = useState({
    isInitialized: false,
    isSignedIn: false,
    backupEnabled: false,
    lastBackupTime: null,
    queueSize: 0,
    isProcessingQueue: false
  });
  const [driveStatus, setDriveStatus] = useState(null);
  const [showContent, setShowContent] = useState(!isSidebarCollapsed);

  useEffect(() => {
    const updateStatus = () => {
      const status = autoBackupService.getStatus();
      setBackupStatus(status);
      
      if (status.isSignedIn && status.backupEnabled) {
        setDriveStatus(googleDriveBackup.status);
      } else {
        setDriveStatus(null);
      }
    };

    // Initial update
    updateStatus();

    // Update status periodically
    const interval = setInterval(updateStatus, 2000);

    // Listen for backup events
    const handleBackupCompleted = () => updateStatus();
    const handleBackupError = () => updateStatus();
    const handleAutoBackupCompleted = () => updateStatus();
    const handleAutoBackupError = () => updateStatus();

    window.addEventListener('backupCompleted', handleBackupCompleted);
    window.addEventListener('backupError', handleBackupError);
    window.addEventListener('autoBackupCompleted', handleAutoBackupCompleted);
    window.addEventListener('autoBackupError', handleAutoBackupError);

    return () => {
      clearInterval(interval);
      window.removeEventListener('backupCompleted', handleBackupCompleted);
      window.removeEventListener('backupError', handleBackupError);
      window.removeEventListener('autoBackupCompleted', handleAutoBackupCompleted);
      window.removeEventListener('autoBackupError', handleAutoBackupError);
    };
  }, []);

  // Handle content visibility when sidebar expands/collapses
  useEffect(() => {
    if (!isSidebarCollapsed) {
      const timer = setTimeout(() => setShowContent(true), 350);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isSidebarCollapsed]);

  const getStatusIcon = () => {
    if (!backupStatus.isInitialized) {
      return <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />;
    }
    
    if (!backupStatus.isSignedIn) {
      return <HardDrive className="w-4 h-4 text-slate-500" />;
    }
    
    if (backupStatus.isProcessingQueue || driveStatus?.backupInProgress) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />;
    }
    
    if (backupStatus.backupEnabled) {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
    
    return <AlertCircle className="w-4 h-4 text-yellow-400" />;
  };

  const getStatusText = () => {
    if (!backupStatus.isInitialized) return 'Initializing...';
    if (!backupStatus.isSignedIn) return 'Sign in to enable backup';
    if (backupStatus.isProcessingQueue || driveStatus?.backupInProgress) return 'Backing up...';
    if (backupStatus.backupEnabled) return 'Backup enabled';
    return 'Backup disabled';
  };

  const getStatusColor = () => {
    if (!backupStatus.isInitialized) return 'text-slate-400';
    if (!backupStatus.isSignedIn) return 'text-slate-500';
    if (backupStatus.isProcessingQueue || driveStatus?.backupInProgress) return 'text-blue-400';
    if (backupStatus.backupEnabled) return 'text-green-400';
    return 'text-yellow-400';
  };

  const formatLastBackupTime = (timestamp) => {
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
    <>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setIsDialogOpen(true)}
            size="sm"
            variant="outline"
            className={`border-slate-600 text-slate-300 hover:bg-slate-700 transition-all duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-start'}`}
          >
            {getStatusIcon()}
            {!isSidebarCollapsed && <span className="ml-2">Cloud Backup</span>}
          </Button>
        </TooltipTrigger>
        {isSidebarCollapsed && (
          <TooltipContent 
            side="right" 
            className="bg-slate-800 border-slate-700 text-white"
            sideOffset={10}
          >
            <div className="text-sm">
              <p className="font-medium">Cloud Backup</p>
              <p className={`text-xs ${getStatusColor()}`}>{getStatusText()}</p>
              {backupStatus.lastBackupTime && (
                <p className="text-xs text-slate-400">
                  Last: {formatLastBackupTime(backupStatus.lastBackupTime)}
                </p>
              )}
            </div>
          </TooltipContent>
        )}
      </Tooltip>

      {/* Expanded sidebar status info */}
      {!isSidebarCollapsed && (
        <div className={`transition-all duration-300 ${showContent ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          <div className="text-xs space-y-1 px-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Status:</span>
              <span className={`font-medium ${getStatusColor()}`}>
                {backupStatus.isProcessingQueue || driveStatus?.backupInProgress ? 'Syncing...' : 
                 backupStatus.backupEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            {backupStatus.lastBackupTime && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Last backup:</span>
                <span className="text-slate-300 font-medium">
                  {formatLastBackupTime(backupStatus.lastBackupTime)}
                </span>
              </div>
            )}
            {backupStatus.queueSize > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pending:</span>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {backupStatus.queueSize}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backup Management Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Cloud Backup</DialogTitle>
            <DialogDescription className="text-slate-400">
              Manage your automatic cloud backup settings and monitor sync status.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <GoogleBackupManager />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BackupStatusIcon;