import React, { useState } from 'react';
import { AlertTriangle, Upload, Download, Merge, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';

const SyncConflictDialog = ({ 
  conflictData, 
  onResolve, 
  onCancel, 
  loading = false 
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState('merge');

  if (!conflictData) return null;

  const { conflicts, local, remote } = conflictData;

  const handleResolve = () => {
    onResolve(selectedStrategy);
  };

  const getStudyNames = (studies) => {
    return studies.map(s => s.name).join(', ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-slate-600 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Sync Conflicts Detected</h2>
        </div>

        <div className="space-y-6">
          {/* Conflict Summary */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="font-medium text-white mb-3">Conflict Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Local Database</p>
                <p className="text-white font-medium">{local.studies.length} studies</p>
                <p className="text-white font-medium">{local.folders.length} folders</p>
              </div>
              <div>
                <p className="text-slate-400">Remote Database</p>
                <p className="text-white font-medium">{remote.studies.length} studies</p>
                <p className="text-white font-medium">{remote.folders.length} folders</p>
              </div>
            </div>
          </div>

          {/* Detailed Conflicts */}
          <div className="space-y-4">
            {conflicts.localOnly.length > 0 && (
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
                <h4 className="font-medium text-blue-200 mb-2">
                  💻 Only in Local ({conflicts.localOnly.length})
                </h4>
                <p className="text-blue-200 text-sm">
                  Studies: {getStudyNames(conflicts.localOnly)}
                </p>
              </div>
            )}

            {conflicts.remoteOnly.length > 0 && (
              <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                <h4 className="font-medium text-green-200 mb-2">
                  ☁️ Only in Cloud ({conflicts.remoteOnly.length})
                </h4>
                <p className="text-green-200 text-sm">
                  Studies: {getStudyNames(conflicts.remoteOnly)}
                </p>
              </div>
            )}

            {conflicts.modified.length > 0 && (
              <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4">
                <h4 className="font-medium text-amber-200 mb-2">
                  🔄 Modified in Both ({conflicts.modified.length})
                </h4>
                <div className="space-y-1">
                  {conflicts.modified.map((conflict, index) => (
                    <p key={index} className="text-amber-200 text-sm">
                      • {conflict.local.name} (newer: {conflict.source === 'local' ? 'local' : 'remote'})
                    </p>
                  ))}
                </div>
              </div>
            )}

            {conflicts.toDelete.length > 0 && (
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">⚠️ Studies would be deleted from cloud ({conflicts.toDelete.length})</p>
                      <p className="text-sm">These studies exist in the cloud but not locally:</p>
                      <p className="text-sm font-medium">{getStudyNames(conflicts.toDelete)}</p>
                      <p className="text-xs">
                        Choose "Keep Both" or "Use Remote" to avoid losing these studies.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          {/* Resolution Strategy */}
          <div className="space-y-4">
            <h3 className="font-medium text-white">Choose Resolution Strategy</h3>
            
            <div className="space-y-3">
              {/* Merge Strategy */}
              <label className="flex items-start gap-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50 cursor-pointer hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="strategy"
                  value="merge"
                  checked={selectedStrategy === 'merge'}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Merge className="h-4 w-4 text-green-400" />
                    <span className="font-medium text-white">Keep Both (Recommended)</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Merge all studies from both local and remote. No data will be lost.
                    For conflicts, newer version wins.
                  </p>
                </div>
              </label>

              {/* Local Only */}
              <label className="flex items-start gap-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50 cursor-pointer hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="strategy"
                  value="local_only"
                  checked={selectedStrategy === 'local_only'}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Upload className="h-4 w-4 text-blue-400" />
                    <span className="font-medium text-white">Use Local</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Replace cloud data with local data. 
                    {conflicts.toDelete.length > 0 && (
                      <span className="text-red-400 font-medium">
                        Warning: Will delete {conflicts.toDelete.length} studies from cloud.
                      </span>
                    )}
                  </p>
                </div>
              </label>

              {/* Remote Only */}
              <label className="flex items-start gap-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50 cursor-pointer hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="strategy"
                  value="remote_only"
                  checked={selectedStrategy === 'remote_only'}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Download className="h-4 w-4 text-green-400" />
                    <span className="font-medium text-white">Use Remote</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Replace local data with cloud data.
                    {conflicts.localOnly.length > 0 && (
                      <span className="text-red-400 font-medium">
                        Warning: Will lose {conflicts.localOnly.length} local studies.
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-600">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="border-slate-500 text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={loading}
              className={`${
                selectedStrategy === 'merge' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : selectedStrategy === 'local_only' && conflicts.toDelete.length > 0
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                selectedStrategy === 'merge' ? (
                  <Merge className="h-4 w-4 mr-2" />
                ) : selectedStrategy === 'local_only' ? (
                  <Upload className="h-4 w-4 mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )
              )}
              {loading ? 'Resolving...' : 'Resolve Conflicts'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncConflictDialog;