import React, { useState, useEffect } from "react";
import { loadOpeningGraph } from "@/api/graphStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Crown, Shield, Target, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Dashboard() {
  const [openingGraph, setOpeningGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGames: 0,
    whiteWins: 0,
    blackWins: 0,
    draws: 0,
    whiteWinRate: 0,
    blackWinRate: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const username = localStorage.getItem('chesscope_username');
      
      // If no username is set, use default empty stats
      if (!username) {
        console.log('No username found - using default stats');
        setStats({
          totalGames: 0,
          whiteWins: 0,
          blackWins: 0,
          draws: 0,
          whiteWinRate: 0,
          blackWinRate: 0
        });
        return;
      }
      
      const graph = await loadOpeningGraph(username);
      
      if (graph) {
        setOpeningGraph(graph);
        const overallStats = graph.getOverallStats();
        
        const whiteStats = overallStats.white;
        const blackStats = overallStats.black;
        
        setStats({
          totalGames: whiteStats.totalGames + blackStats.totalGames,
          whiteWins: whiteStats.wins,
          blackWins: blackStats.wins,
          draws: whiteStats.draws + blackStats.draws,
          whiteWinRate: whiteStats.winRate,
          blackWinRate: blackStats.winRate
        });
      } else {
        // No data available
        setStats({
          totalGames: 0,
          whiteWins: 0,
          blackWins: 0,
          draws: 0,
          whiteWinRate: 0,
          blackWinRate: 0
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTopOpenings = (color, limit = 5) => {
    if (!openingGraph) return [];
    
    const firstMovePositions = openingGraph.getChildPositions('');
    const openings = [];
    
    firstMovePositions.forEach(firstMove => {
      const secondMovePositions = openingGraph.getChildPositions(firstMove.moves);
      secondMovePositions.forEach(secondMove => {
        const node = openingGraph.getNode(secondMove.fen);
        if (node && node.stats[color].totalGames >= 3) {
          const stats = node.stats[color];
          openings.push({
            fen: secondMove.fen,
            moves: secondMove.moves,
            totalGames: stats.totalGames,
            winRate: stats.winRate,
            openingName: node.openingName || 'Unknown Opening'
          });
        }
      });
    });
    
    return openings
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limit);
  };

  const getWorstOpenings = (color, limit = 5) => {
    if (!openingGraph) return [];
    
    const firstMovePositions = openingGraph.getChildPositions('');
    const openings = [];
    
    firstMovePositions.forEach(firstMove => {
      const secondMovePositions = openingGraph.getChildPositions(firstMove.moves);
      secondMovePositions.forEach(secondMove => {
        const node = openingGraph.getNode(secondMove.fen);
        if (node && node.stats[color].totalGames >= 3) {
          const stats = node.stats[color];
          openings.push({
            fen: secondMove.fen,
            moves: secondMove.moves,
            totalGames: stats.totalGames,
            winRate: stats.winRate,
            openingName: node.openingName || 'Unknown Opening'
          });
        }
      });
    });
    
    return openings
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, limit);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your chess data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Total Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalGames}</div>
            <p className="text-slate-400 text-xs mt-1">Analyzed games</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <Crown className="w-4 h-4" />
              White Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.whiteWinRate.toFixed(1)}%</div>
            <Progress value={stats.whiteWinRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Black Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.blackWinRate.toFixed(1)}%</div>
            <Progress value={stats.blackWinRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to={createPageUrl("Import")}>
              <button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 px-3 py-2 rounded-lg text-sm font-medium hover:from-amber-400 hover:to-orange-400 transition-all duration-200">
                Import Games
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Opening Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Best Openings as White */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Best Openings as White
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getTopOpenings('white').map((opening, index) => (
                <div key={`best-white-${opening.fen}`} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-white text-sm">{opening.openingName}</h4>
                    <p className="text-xs text-slate-500 mt-1">{opening.totalGames} games</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {opening.winRate.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {getTopOpenings('white').length === 0 && (
                <p className="text-slate-400 text-center py-4">No opening data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Best Openings as Black */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Best Openings as Black
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getTopOpenings('black').map((opening, index) => (
                <div key={`best-black-${opening.fen}`} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-white text-sm">{opening.openingName}</h4>
                    <p className="text-xs text-slate-500 mt-1">{opening.totalGames} games</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {opening.winRate.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {getTopOpenings('black').length === 0 && (
                <p className="text-slate-400 text-center py-4">No opening data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Worst Openings as White */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              Needs Improvement (White)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getWorstOpenings('white').map((opening, index) => (
                <div key={`worst-white-${opening.fen}`} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-white text-sm">{opening.openingName}</h4>
                    <p className="text-xs text-slate-500 mt-1">{opening.totalGames} games</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      {opening.winRate.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {getWorstOpenings('white').length === 0 && (
                <p className="text-slate-400 text-center py-4">No opening data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Worst Openings as Black */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              Needs Improvement (Black)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getWorstOpenings('black').map((opening, index) => (
                <div key={`worst-black-${opening.fen}`} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-white text-sm">{opening.openingName}</h4>
                    <p className="text-xs text-slate-500 mt-1">{opening.totalGames} games</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      {opening.winRate.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {getWorstOpenings('black').length === 0 && (
                <p className="text-slate-400 text-center py-4">No opening data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to={createPageUrl("WhiteTree")}>
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 backdrop-blur-xl hover:from-amber-500/20 hover:to-orange-500/20 transition-all duration-200 cursor-pointer">
            <CardHeader>
              <CardTitle className="text-amber-300 flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Explore White Opening Tree
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">Analyze your performance and discover patterns when playing as White</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("BlackTree")}>
          <Card className="bg-gradient-to-r from-slate-600/10 to-slate-500/10 border-slate-500/30 backdrop-blur-xl hover:from-slate-600/20 hover:to-slate-500/20 transition-all duration-200 cursor-pointer">
            <CardHeader>
              <CardTitle className="text-slate-300 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Explore Black Opening Tree
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">Analyze your performance and discover patterns when playing as Black</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
