import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Info, ExternalLink, Calendar, Clock, Trophy, Users, X } from 'lucide-react';

// Helper function to format date
const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown date';
  const date = new Date(timestamp * 1000); // Chess.com timestamps are in seconds
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Helper function to format time control
const formatTimeControl = (timeControl) => {
  if (!timeControl) return '';
  
  // Split by '+' to get base time and increment
  const parts = timeControl.split('+');
  if (parts.length !== 2) return timeControl; // Return original if format is unexpected
  
  const baseTime = parseInt(parts[0]);
  const increment = parseInt(parts[1]);
  
  // Format base time (convert seconds to MM:SS if >= 60 seconds)
  let formattedBaseTime;
  if (baseTime >= 60) {
    const minutes = Math.floor(baseTime / 60);
    const seconds = baseTime % 60;
    formattedBaseTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    formattedBaseTime = baseTime.toString();
  }
  
  return `${formattedBaseTime} + ${increment}`;
};

// Helper function to get result color
const getResultColor = (result) => {
  switch (result) {
    case 'win': return 'text-success';
    case 'lose': return 'text-destructive';
    case 'draw': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
};

// Helper function to get result text
const getResultText = (result) => {
  switch (result) {
    case 'win': return 'Win';
    case 'lose': return 'Loss';
    case 'draw': return 'Draw';
    default: return 'Unknown';
  }
};

// Helper function to build Chess.com URL with move number
const buildGameUrl = (baseUrl, moveNumber) => {
  if (!baseUrl) return '#';
  // If moveNumber is 0 (starting position), don't add move parameter
  if (moveNumber === 0) return baseUrl;
  
  // Check if it's a Lichess URL
  if (baseUrl.includes('lichess.org')) {
    // Lichess uses #moveNumber format (e.g., https://lichess.org/gameId#7)
    // Remove any existing hash first
    const urlWithoutHash = baseUrl.split('#')[0];
    return `${urlWithoutHash}#${moveNumber}`;
  } else {
    // Chess.com and others use ?move= format
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}move=${moveNumber}`;
  }
};

export default function PositionInfoDialog({ 
  openingGraph, 
  currentMoves, 
  isWhite,
  children // The trigger button will be passed as children
}) {
  if (!openingGraph || !currentMoves) {
    return children;
  }

  const positionDetails = openingGraph.getPositionDetails(currentMoves, isWhite);
  const games = openingGraph.getGamesForPosition(currentMoves, isWhite);
  const moveNumber = currentMoves.length; // Current move number for URL

  if (!positionDetails) {
    return children;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground flex items-center gap-2">
            <Info className="w-5 h-5" />
            Position Information
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Position Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{positionDetails.totalGames}</div>
              <div className="text-xs text-muted-foreground">Games</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{positionDetails.winRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-info">{positionDetails.averageOpponentRating || 'N/A'}</div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-lg font-bold text-success">{positionDetails.wins}</div>
              <div className="text-lg font-bold text-destructive">{positionDetails.losses}</div>
              <div className="text-lg font-bold text-muted-foreground">{positionDetails.draws}</div>
              <div className="text-xs text-muted-foreground">W-L-D</div>
            </div>
          </div>

          {/* Opening Information */}
          {positionDetails.openingInfo && (
            <Card className="bg-muted/20 border-border">
              <CardContent className="p-4">
                <h4 className="text-foreground font-medium">
              {positionDetails.openingInfo.eco && positionDetails.openingInfo.name
                ? `${positionDetails.openingInfo.eco} ${positionDetails.openingInfo.name}`
                : positionDetails.openingInfo.name}
            </h4>
                {positionDetails.openingInfo.variation && (
                  <p className="text-muted-foreground text-sm">{positionDetails.openingInfo.variation}</p>
                )}
                {positionDetails.openingInfo.eco && (
                  <Badge variant="outline" className="mt-2 bg-muted/50 text-foreground">
                    ECO: {positionDetails.openingInfo.eco}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}

          {/* Position Moves */}
          <div className="text-xs text-muted-foreground text-center p-3 bg-muted/20 rounded-lg border-t border-border">
            <strong>Position:</strong> {currentMoves.join(' ') || 'Starting position'}
            {moveNumber > 0 && <span className="ml-2">({moveNumber} moves)</span>}
          </div>

          {/* Games List */}
          {games.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-card-foreground mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Games in this position ({games.length})
              </h3>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {games
                  .sort((a, b) => (b.end_time || 0) - (a.end_time || 0)) // Sort by end_time descending (most recent first)
                  .map((game, index) => (
                  <Card key={index} className="bg-muted/30 border-border hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={`${getResultColor(game.result)} bg-transparent border-current`}>
                              {getResultText(game.result)}
                            </Badge>
                            <div className="flex items-center text-muted-foreground text-sm gap-2">
                              <Calendar className="w-3 h-3" />
                              {formatDate(game.end_time)}
                            </div>
                            {game.time_control && (
                              <div className="flex items-center text-muted-foreground text-sm gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeControl(game.time_control)}
                              </div>
                            )}
                            {game.rated && (
                              <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground">
                                Rated
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span className="text-foreground">{game.white_username}</span>
                              <span className="text-muted-foreground">({game.white_rating || '?'})</span>
                              <span className="text-muted-foreground">vs</span>
                              <span className="text-foreground">{game.black_username}</span>
                              <span className="text-muted-foreground">({game.black_rating || '?'})</span>
                            </div>
                          </div>
                        </div>
                        {game.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="text-foreground border-border bg-muted/30 hover:bg-muted/50 hover:text-foreground hover:border-border transition-all duration-200"
                          >
                            <a 
                              href={buildGameUrl(game.url, moveNumber)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span className="text-xs">View Game</span>
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 