import React, { useState, useEffect } from "react";
import { loadOpeningGraph } from "@/api/graphStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, Trophy, Clock, Target, TrendingUp, Calendar } from "lucide-react";

export default function Profile() {
  const [openingGraph, setOpeningGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileStats, setProfileStats] = useState({
    totalGames: 0,
    winRate: 0,
    whiteWinRate: 0,
    blackWinRate: 0,
    mostPlayedOpening: "",
    totalPositions: 0
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const username = localStorage.getItem('chesscope_username');
      
      // If no username is set, skip loading
      if (!username) {
        console.log('No username found - skipping profile data load');
        return;
      }
      
      const graph = await loadOpeningGraph(username);
      
      if (graph) {
        setOpeningGraph(graph);
        calculateStats(graph);
      }
    } catch (error) {
      console.error("Error loading profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (graph) => {
    const overallStats = graph.getOverallStats();
    const whiteStats = overallStats.white;
    const blackStats = overallStats.black;
    
    const totalGames = whiteStats.totalGames + blackStats.totalGames;
    const totalWins = whiteStats.wins + blackStats.wins;
    const overallWinRate = totalGames > 0 ? (totalWins / totalGames * 100) : 0;
    
    // Find most played opening by looking at root level moves
    let mostPlayedOpening = "Unknown";
    let maxGames = 0;
    
    const firstMovePositions = graph.getChildPositions('');
    firstMovePositions.forEach(firstMove => {
      const secondMovePositions = graph.getChildPositions(firstMove.moves);
      secondMovePositions.forEach(secondMove => {
        const node = graph.getNode(secondMove.fen);
        if (node) {
          const positionGames = node.stats.white.totalGames + node.stats.black.totalGames;
          if (positionGames > maxGames) {
            maxGames = positionGames;
            mostPlayedOpening = node.openingName || "Unknown Opening";
          }
        }
      });
    });
    
    setProfileStats({
      totalGames,
      winRate: overallWinRate,
      whiteWinRate: whiteStats.winRate,
      blackWinRate: blackStats.winRate,
      mostPlayedOpening,
      totalPositions: graph.getPositionCount()
    });
  };

  const getTopPositions = () => {
    if (!openingGraph) return [];
    
    const positions = [];
    const firstMovePositions = openingGraph.getChildPositions('');
    
    firstMovePositions.forEach(firstMove => {
      const secondMovePositions = openingGraph.getChildPositions(firstMove.moves);
      secondMovePositions.forEach(secondMove => {
        const node = openingGraph.getNode(secondMove.fen);
        if (node) {
          const totalGames = node.stats.white.totalGames + node.stats.black.totalGames;
          if (totalGames >= 2) {
            positions.push({
              fen: secondMove.fen,
              moves: secondMove.moves,
              openingName: node.openingName || 'Unknown Opening',
              totalGames,
              whiteWinRate: node.stats.white.winRate,
              blackWinRate: node.stats.black.winRate
            });
          }
        }
      });
    });
    
    return positions.sort((a, b) => b.totalGames - a.totalGames).slice(0, 10);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Profile Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Total Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{profileStats.totalGames}</div>
            <p className="text-slate-400 text-xs mt-1">Games analyzed</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Overall Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{profileStats.winRate.toFixed(1)}%</div>
            <Progress value={profileStats.winRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              White Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{profileStats.whiteWinRate.toFixed(1)}%</div>
            <Progress value={profileStats.whiteWinRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Black Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{profileStats.blackWinRate.toFixed(1)}%</div>
            <Progress value={profileStats.blackWinRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Top Positions */}
      <div className="grid grid-cols-1 gap-8">
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Most Played Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getTopPositions().map((position, index) => (
                <div key={position.fen} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-white text-sm">{position.openingName}</h4>
                    <p className="text-xs text-slate-400">{position.totalGames} games</p>
                  </div>
                  <div className="text-right flex gap-2">
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      W: {position.whiteWinRate.toFixed(1)}%
                    </Badge>
                    <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                      B: {position.blackWinRate.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {getTopPositions().length === 0 && (
                <p className="text-slate-400 text-center py-4">No position data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-200 text-sm">Most Played Opening</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-white text-sm">{profileStats.mostPlayedOpening || "N/A"}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-200 text-sm">Total Positions Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-white">{profileStats.totalPositions}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}