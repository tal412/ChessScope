import { useState, useEffect } from 'react';
import { Cloud, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { Badge } from './ui/badge';
import { autoDriveSync } from '../services/AutoDriveSync.js';
import { cn } from '../lib/utils';

const SyncStatusIndicator = ({ className = '' }) => {
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced', 'error', 'conflicts'
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [conflictsExist, setConflictsExist] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Get initial status
    const status = autoDriveSync.getStatus();
    setConflictsExist(status.conflictsExist);
    setLastSyncTime(status.lastSyncTime);
    
    if (status.conflictsExist) {
      setSyncStatus('conflicts');
      setIsVisible(true);
    }

    // Listen for sync status changes from the auto sync service
    const handleSyncStatusChange = (event) => {
      const { status, timestamp } = event.detail;
      
      setSyncStatus(status);
      if (timestamp) {
        setLastSyncTime(timestamp);
      }
      
      // Show indicator when sync activity occurs
      setIsVisible(true);
      
      // Auto-hide after successful sync (but keep visible if conflicts exist)
      if (status === 'synced' && !conflictsExist) {
        setTimeout(() => {
          setIsVisible(false);
        }, 3000);
      }
    };

    // Listen for conflict changes
    const handleConflictChange = (conflicts) => {
      const hasConflicts = !!conflicts;
      setConflictsExist(hasConflicts);
      
      if (hasConflicts) {
        setSyncStatus('conflicts');
        setIsVisible(true);
      } else if (syncStatus === 'conflicts') {
        setSyncStatus('idle');
        // Keep visible briefly to show conflicts resolved
        setTimeout(() => {
          if (!hasConflicts) setIsVisible(false);
        }, 3000);
      }
    };

    window.addEventListener('syncStatusChange', handleSyncStatusChange);
    autoDriveSync.addConflictListener(handleConflictChange);

    return () => {
      window.removeEventListener('syncStatusChange', handleSyncStatusChange);
      autoDriveSync.removeConflictListener(handleConflictChange);
    };
  }, [syncStatus, conflictsExist]);

  if (!isVisible) {
    return null;
  }

  const getStatusInfo = () => {
    switch (syncStatus) {
      case 'syncing':
        return {
          icon: Loader2,
          label: 'Syncing...',
          className: 'bg-blue-500/20 border-blue-500 text-blue-400',
          iconClassName: 'animate-spin'
        };
      case 'synced':
        return {
          icon: CheckCircle,
          label: 'Synced',
          className: 'bg-green-500/20 border-green-500 text-green-400',
          iconClassName: ''
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Sync Error',
          className: 'bg-red-500/20 border-red-500 text-red-400',
          iconClassName: ''
        };
      case 'conflicts':
        return {
          icon: AlertCircle,
          label: 'Conflicts',
          className: 'bg-orange-500/20 border-orange-500 text-orange-400',
          iconClassName: 'animate-pulse'
        };
      default:
        return {
          icon: Cloud,
          label: 'Sync Ready',
          className: 'bg-slate-500/20 border-slate-500 text-slate-400',
          iconClassName: ''
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out',
      className
    )}>
      <Badge
        variant="outline"
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm font-medium border-2 backdrop-blur-sm',
          statusInfo.className
        )}
      >
        <StatusIcon className={cn('w-4 h-4', statusInfo.iconClassName)} />
        <span>{statusInfo.label}</span>
        {lastSyncTime && (syncStatus === 'synced' || syncStatus === 'error') && (
          <span className="text-xs opacity-75">
            {lastSyncTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })}
          </span>
        )}
      </Badge>
    </div>
  );
};

SyncStatusIndicator.propTypes = {
  className: PropTypes.string
};

export default SyncStatusIndicator;