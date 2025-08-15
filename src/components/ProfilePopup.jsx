import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const formatLastOnline = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  let date;
  
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    if (timestamp < 10000000000) {
      date = new Date(timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
  } else {
    return 'Unknown';
  }
  
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
};

const ProfilePopup = ({ isOpen, onOpenChange }) => {
  const { user } = useAuth();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Profile</DialogTitle>
          <DialogDescription className="text-slate-400">
            Manage your chess account connection.
          </DialogDescription>
        </DialogHeader>

        <div className="max-w-2xl mx-auto py-6">
          {/* Chess Account Info */}
          <Card className="bg-slate-700/30 border-slate-600/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-white flex-shrink-0" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">Chess Account</CardTitle>
                  <p className="text-slate-400 text-sm">Connected platform account</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <>
                  <div className="flex items-center gap-3 p-3 bg-slate-600/30 rounded-lg border border-slate-600/50">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {user.platform === 'lichess' ? (
                        <img 
                          src="/Lichess_Logo_2019.svg.png" 
                          alt="Lichess" 
                          className="w-6 h-6" 
                        />
                      ) : (
                        <img 
                          src="/chesscom_logo_pawn.svg" 
                          alt="Chess.com" 
                          className="w-6 h-6" 
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {user.username || user.chessComUsername}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {user.platform === 'lichess' ? 'Lichess' : 'Chess.com'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Games:</span>
                      <span className="text-white font-medium">{user.gameCount || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Last Game:</span>
                      <span className="text-white font-medium">
                        {formatLastOnline(user.lastGameTime || (user.platformUser || user.chessComUser)?.lastOnline)}
                      </span>
                    </div>
                    {user.lastSync && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Last Sync:</span>
                        <span className="text-white font-medium">
                          {new Date(user.lastSync).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfilePopup;