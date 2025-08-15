import React, { useState } from 'react';
import { AlertTriangle, Upload, Download, Merge, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-slate-600">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Sync Conflicts</h2>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Local side */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h3 className="font-medium text-blue-300 mb-3 flex items-center gap-2">
              💻 Local Device
            </h3>
            <div className="space-y-2">
              <p className="text-white">{local.studies.length} studies total</p>
              {conflicts.localOnly.length > 0 && (
                <div className="text-blue-200 text-sm">
                  <p className="font-medium">{conflicts.localOnly.length} unique studies:</p>
                  <p className="text-blue-100 ml-2">
                    {conflicts.localOnly.map(s => s.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Remote side */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h3 className="font-medium text-green-300 mb-3 flex items-center gap-2">
              ☁️ Cloud
            </h3>
            <div className="space-y-2">
              <p className="text-white">{remote.studies.length} studies total</p>
              {conflicts.remoteOnly.length > 0 && (
                <div className="text-green-200 text-sm">
                  <p className="font-medium">{conflicts.remoteOnly.length} unique studies:</p>
                  <p className="text-green-100 ml-2">
                    {conflicts.remoteOnly.map(s => s.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modified studies */}
        {conflicts.modified.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-amber-200 mb-2">
              🔄 {conflicts.modified.length} studies modified in both places
            </h4>
            <div className="text-amber-100 text-sm space-y-1">
              {conflicts.modified.map((conflict, index) => (
                <p key={index}>
                  • {conflict.local.name} (newer version: {conflict.source === 'local' ? 'local' : 'cloud'})
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Resolution options */}
        <div className="space-y-4">
          <h3 className="font-medium text-white">How do you want to resolve this?</h3>
          
          <div className="space-y-3">
            {/* Merge */}
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
                  Combine everything. No data lost.
                </p>
              </div>
            </label>

            {/* Use Local */}
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
                  <span className="font-medium text-white">Use Local Only</span>
                </div>
                <p className="text-sm text-slate-400">
                  Replace cloud with local data.
                </p>
              </div>
            </label>

            {/* Use Remote */}
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
                  <span className="font-medium text-white">Use Cloud Only</span>
                </div>
                <p className="text-sm text-slate-400">
                  Replace local with cloud data.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-6 border-t border-slate-600 mt-6">
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
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Merge className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Resolving...' : 'Resolve'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SyncConflictDialog;