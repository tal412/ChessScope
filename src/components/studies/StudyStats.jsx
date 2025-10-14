import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Zap } from "lucide-react";
import { getPerformanceColorClasses, getPerformanceIconColor } from "@/constants/colors";

export default function OpeningStats({ selectedPath, allNodes, color }) {
  if (!selectedPath || selectedPath.length === 0) {
    return (
      <Card className="bg-card/95 border-border backdrop-blur-optimized">
        <CardHeader>
          <CardTitle className="text-card-foreground text-lg">Opening Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Click on study moves to see detailed statistics
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentNode = selectedPath[selectedPath.length - 1];
  const pathMoves = selectedPath.map(node => node.last_move).join(" ");

  // Calculate related openings (same opening name but different variations)
  const relatedOpenings = allNodes.filter(node => 
    node.opening_name === currentNode.opening_name && 
    node.id !== currentNode.id &&
    node.total_games >= 2
  ).sort((a, b) => b.win_rate - a.win_rate);

  return (
    <div className="space-y-6">
      {/* Current Position Stats */}
      <Card className="bg-card/95 border-border backdrop-blur-optimized">
        <CardHeader>
          <CardTitle className="text-card-foreground text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Current Position
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-foreground font-medium mb-1">{currentNode.opening_name}</h3>
            {currentNode.variation_name && (
              <p className="text-muted-foreground text-sm mb-2">{currentNode.variation_name}</p>
            )}
            <p className="text-muted-foreground text-xs font-mono">{pathMoves}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{currentNode.total_games}</div>
              <div className="text-xs text-muted-foreground">Total Games</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{currentNode.win_rate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-success">Wins: {currentNode.wins}</span>
              <span className="text-destructive">Losses: {currentNode.losses}</span>
              <span className="text-muted-foreground">Draws: {currentNode.draws}</span>
            </div>
            <Progress value={currentNode.win_rate} className="h-2" />
          </div>

          {currentNode.eco_code && (
            <Badge variant="outline" className="bg-muted/50 text-foreground">
              ECO: {currentNode.eco_code}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Related Variations */}
      {relatedOpenings.length > 0 && (
        <Card className="bg-card/95 border-border backdrop-blur-optimized">
          <CardHeader>
            <CardTitle className="text-card-foreground text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Other Variations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relatedOpenings.slice(0, 5).map((node) => (
                <div key={node.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                  <div className="flex-1">
                    <p className="text-foreground text-sm font-medium">{node.variation_name || "Main Line"}</p>
                    <p className="text-muted-foreground text-xs">{node.total_games} games</p>
                  </div>
                  <Badge className={getPerformanceColorClasses(node.win_rate)}>
                    {node.win_rate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Analysis */}
      <Card className="bg-card/95 border-border backdrop-blur-optimized">
        <CardHeader>
          <CardTitle className="text-card-foreground text-lg flex items-center gap-2">
            {currentNode.win_rate >= 60 ? (
              <TrendingUp className={`w-5 h-5 ${getPerformanceIconColor(currentNode.win_rate)}`} />
            ) : (
              <TrendingDown className={`w-5 h-5 ${getPerformanceIconColor(currentNode.win_rate)}`} />
            )}
            Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentNode.win_rate >= 70 && (
              <div className={`p-3 ${getPerformanceColorClasses(currentNode.win_rate)} rounded-lg`}>
                <p className={`${getPerformanceIconColor(currentNode.win_rate)} text-sm font-medium`}>Excellent Performance! 🎉</p>
                <p className="text-foreground text-xs mt-1">This opening is working great for you. Consider playing it more often.</p>
              </div>
            )}

            {currentNode.win_rate >= 50 && currentNode.win_rate < 70 && (
              <div className={`p-3 ${getPerformanceColorClasses(currentNode.win_rate)} rounded-lg`}>
                <p className={`${getPerformanceIconColor(currentNode.win_rate)} text-sm font-medium`}>Solid Performance 👍</p>
                <p className="text-foreground text-xs mt-1">Decent results. Look for ways to improve your play in this opening.</p>
              </div>
            )}

            {currentNode.win_rate < 50 && (
              <div className={`p-3 ${getPerformanceColorClasses(currentNode.win_rate)} rounded-lg`}>
                <p className={`${getPerformanceIconColor(currentNode.win_rate)} text-sm font-medium`}>Needs Improvement 📚</p>
                <p className="text-foreground text-xs mt-1">Consider studying this opening more or switching to alternatives.</p>
              </div>
            )}

            <div className="text-xs text-muted-foreground mt-3">
              <p>• Win rate above 60% is considered excellent</p>
              <p>• Win rate between 50-60% is solid</p>
              <p>• Win rate below 50% needs attention</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}