import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, AlertCircle, CheckCircle, Loader2, Trash2, Database, RefreshCw, Zap, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { identifyOpening } from "../components/chess/OpeningDatabase";
import { extractGameData } from "../components/chess/PgnParser";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  saveOpeningGraph, 
  loadOpeningGraph, 
  hasOpeningGraph,
  deleteOpeningGraph,
  getGraphStorageStats,
  exportAllGraphs,
  clearAllGraphs,
  initGraphDB
} from "@/api/graphStorage";
import { OpeningGraph } from "@/api/openingGraph";

export default function ImportGraph() {
  const [username, setUsername] = useState("");
  const [selectedTimeControls, setSelectedTimeControls] = useState(["rapid"]); // Default selection
  const [selectedDateRange, setSelectedDateRange] = useState("3"); // months
  const [customDateRange, setCustomDateRange] = useState({
    from: null,
    to: null
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [storageInfo, setStorageInfo] = useState({ 
    totalGraphs: 0,
    totalSizeMB: 0,
    graphs: []
  });

  // Initialize the graph database and load storage info
  useEffect(() => {
    const initAndLoadInfo = async () => {
      try {
        await initGraphDB();
        await updateStorageInfo();
        
        // Load existing username from localStorage if available
        const existingUsername = localStorage.getItem('chesscope_username');
        if (existingUsername && !username) {
          setUsername(existingUsername);
        }
      } catch (error) {
        console.error('Error initializing graph DB:', error);
      }
    };
    
    initAndLoadInfo();
    
    // Update storage info periodically
    const interval = setInterval(updateStorageInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateStorageInfo = async () => {
    try {
      const info = await getGraphStorageStats();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error getting storage info:', error);
    }
  };

  const handleTimeControlChange = (timeControl, checked) => {
    if (checked) {
      setSelectedTimeControls(prev => [...prev, timeControl]);
    } else {
      setSelectedTimeControls(prev => prev.filter(tc => tc !== timeControl));
    }
  };

  const importGames = async () => {
    if (!username.trim()) {
      setError("Please enter a Chess.com username");
      return;
    }

    if (selectedTimeControls.length === 0) {
      setError("Please select at least one time control to import");
      return;
    }

    // Validate custom date range
    if (selectedDateRange === "custom") {
      if (!customDateRange.from || !customDateRange.to) {
        setError("Please select both start and end dates for custom range");
        return;
      }
      if (customDateRange.from >= customDateRange.to) {
        setError("Start date must be before end date");
        return;
      }
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setProgress(0);
    setStatus("Connecting to Chess.com API...");

    try {
      // Check if user already has a graph
      const existingGraph = await loadOpeningGraph(username.toLowerCase());
      
      const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
      if (!response.ok) {
        throw new Error("Username not found or API error");
      }

      const archivesData = await response.json();
      const allArchives = archivesData.archives;
      
      let recentArchives = [];
      
      if (selectedDateRange === "custom") {
        // Filter archives based on custom date range
        const fromDate = new Date(customDateRange.from);
        const toDate = new Date(customDateRange.to);
        
        recentArchives = allArchives.filter(archiveUrl => {
          // Extract year/month from archive URL (format: https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM})
          const urlParts = archiveUrl.split('/');
          const year = parseInt(urlParts[urlParts.length - 2]);
          const month = parseInt(urlParts[urlParts.length - 1]);
          const archiveDate = new Date(year, month - 1, 1); // month is 0-indexed in Date constructor
          
          return archiveDate >= fromDate && archiveDate <= toDate;
        });
      } else {
        // Use predefined month ranges
        const monthsToFetch = parseInt(selectedDateRange);
        recentArchives = allArchives.slice(-monthsToFetch);
      }
      
      setProgress(10);
      setStatus("Fetching games by time control...");

      let targetedGames = [];
      const TARGET_GAMES = 500;
      let archivesProcessed = 0;
      
      // Process archives from most recent to oldest until we have enough games
      for (let i = recentArchives.length - 1; i >= 0 && targetedGames.length < TARGET_GAMES; i--) {
        try {
          setStatus(`Checking archive ${archivesProcessed + 1}/${recentArchives.length} for ${selectedTimeControls.join('/')} games...`);
          
          const archiveResponse = await fetch(recentArchives[i]);
          const archiveData = await archiveResponse.json();
          
          // Filter games by selected time controls as we fetch
          const filteredGames = archiveData.games
            .filter(game => game.rules === "chess")
            .filter(game => selectedTimeControls.includes(game.time_class));
          
          // Add the filtered games to our collection
          targetedGames = [...targetedGames, ...filteredGames];
          
          archivesProcessed++;
          
          // Update progress: 10% to 30% for fetching
          setProgress(10 + (archivesProcessed / recentArchives.length) * 20);
          
          setStatus(`Found ${targetedGames.length} ${selectedTimeControls.join('/')} games so far...`);
          
          // Small delay to prevent API rate limiting and allow UI updates
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (archiveError) {
          console.warn(`Failed to fetch archive ${recentArchives[i]}:`, archiveError);
          // Continue with other archives
        }
      }

      // Take the most recent games up to our target
      const recentTargetedGames = targetedGames
        .slice(-TARGET_GAMES)  // Take the most recent TARGET_GAMES
        .reverse(); // Reverse to process newest first
      
      setProgress(35);
      setStatus(`Processing ${recentTargetedGames.length} ${selectedTimeControls.join('/')} games into opening graph...`);

      // Create or use existing OpeningGraph
      const openingGraph = existingGraph || new OpeningGraph(username.toLowerCase());

      const processedCount = { total: 0, added: 0 };
      
      // Process games one at a time with proper UI yielding
      const totalGames = recentTargetedGames.length;
      
      for (let i = 0; i < totalGames; i++) {
        const game = recentTargetedGames[i];
        const gameData = extractGameData(game, username);
        
        if (gameData) {
          // Add opening information (await the async function)
          const opening = await identifyOpening(gameData.moves);
          
          // Debug logging for the first few games
          if (i < 3) {
            console.log(`🔍 Game ${i + 1} opening identification:`, {
              moves: gameData.moves.slice(0, 6), // First 6 moves
              opening: opening,
              playerColor: gameData.player_color
            });
          }
          
          // Special debug for e4 games
          if (gameData.moves.length > 0 && gameData.moves[0] === 'e4') {
            console.log(`🎯 E4 game found:`, {
              moves: gameData.moves.slice(0, 4),
              opening: opening,
              playerColor: gameData.player_color
            });
          }
          
          gameData.opening = opening;
          
          // Add game to the graph (this merges positions automatically)
          await openingGraph.addGame(gameData);
          
          processedCount.total++;
          processedCount.added++;
        }
        
        // Update progress and yield to UI every single game
        const progressPercent = 35 + ((i + 1) / totalGames) * 55;
        setProgress(progressPercent);
        setStatus(`Building graph: ${i + 1}/${totalGames} ${selectedTimeControls.join('/')} games processed`);
        
        // Yield control to the UI thread after each game using requestAnimationFrame
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
      }

      setProgress(95);
      setStatus("Saving opening graph...");

      // Save the complete graph
      await saveOpeningGraph(openingGraph);
      
      // Store the username in localStorage
      localStorage.setItem('chesscope_username', username.toLowerCase());

      setProgress(100);
      setStatus("Import completed successfully!");
      
      const stats = openingGraph.getOverallStats();
      const dateRangeText = selectedDateRange === "custom" 
        ? `${format(customDateRange.from, "MMM yyyy")} to ${format(customDateRange.to, "MMM yyyy")}`
        : `${selectedDateRange} months`;
      
      setSuccess(
        `✅ Import completed! Processed ${processedCount.total} ${selectedTimeControls.join('/')} games ` +
        `(found ${targetedGames.length} total from ${dateRangeText}) into ${stats.white.totalPositions + stats.black.totalPositions} unique positions. ` +
        `White: ${stats.white.totalGames} games, ${stats.white.totalPositions} positions. ` +
        `Black: ${stats.black.totalGames} games, ${stats.black.totalPositions} positions.`
      );

      // Update storage info
      await updateStorageInfo();

    } catch (error) {
      console.error("Import error:", error);
      setError(error.message || "Failed to import games. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteAllData = async () => {
    setIsDeleting(true);
    try {
      await clearAllGraphs();
      setSuccess("All opening graphs deleted successfully!");
      setError("");
      await updateStorageInfo();
    } catch (error) {
      setError("Failed to delete data: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      await exportAllGraphs();
      setSuccess("Opening graphs exported successfully!");
      setError("");
    } catch (error) {
      setError("Failed to export data: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">


      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Import Form - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl h-full">
            <CardHeader>
              <CardTitle className="text-slate-200">Import Chess.com Games</CardTitle>
          </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-slate-300">Chess.com Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your Chess.com username"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                  disabled={loading}
                />
      </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" />
                    Time Controls to Import
                  </Label>
                                     <div className="grid grid-cols-2 gap-2">
                     {[
                       { value: "bullet", label: "Bullet", description: "< 3 min" },
                       { value: "blitz", label: "Blitz", description: "3-10 min" },
                       { value: "rapid", label: "Rapid", description: "10+ min" },
                       { value: "daily", label: "Daily", description: "1+ day" }
                     ].map((timeControl) => (
                       <div key={timeControl.value} className="flex items-center space-x-2 p-2 bg-slate-700/30 rounded-lg border border-slate-600/50">
                         <Checkbox
                           id={timeControl.value}
                           checked={selectedTimeControls.includes(timeControl.value)}
                           onCheckedChange={(checked) => handleTimeControlChange(timeControl.value, checked)}
                           disabled={loading}
                           className="border-slate-500 text-blue-500"
                         />
                  <div className="flex-1">
                           <Label htmlFor={timeControl.value} className="text-slate-300 font-medium cursor-pointer text-sm">
                             {timeControl.label}
                           </Label>
                           <p className="text-xs text-slate-400">{timeControl.description}</p>
                         </div>
                       </div>
                     ))}
                  </div>
                  {selectedTimeControls.length === 0 && (
                    <p className="text-red-400 text-sm mt-2">⚠️ Select at least one time control</p>
                  )}
                </div>

                <div>
                  <Label className="text-slate-300 flex items-center gap-2 mb-3">
                    <CalendarIcon className="w-4 h-4" />
                    Date Range
                  </Label>
                  <Select value={selectedDateRange} onValueChange={(value) => {
                    setSelectedDateRange(value);
                    setShowCustomDatePicker(value === "custom");
                  }} disabled={loading}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="1" className="text-slate-300 focus:bg-slate-600 focus:text-white">Last 1 month</SelectItem>
                      <SelectItem value="2" className="text-slate-300 focus:bg-slate-600 focus:text-white">Last 2 months</SelectItem>
                      <SelectItem value="3" className="text-slate-300 focus:bg-slate-600 focus:text-white">Last 3 months</SelectItem>
                      <SelectItem value="6" className="text-slate-300 focus:bg-slate-600 focus:text-white">Last 6 months</SelectItem>
                      <SelectItem value="custom" className="text-slate-300 focus:bg-slate-600 focus:text-white">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {selectedDateRange === "custom" && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-slate-400 text-xs mb-1">From Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50",
                                  !customDateRange.from && "text-slate-400"
                                )}
                                disabled={loading}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {customDateRange.from ? format(customDateRange.from, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-600" align="start">
                              <Calendar
                                mode="single"
                                selected={customDateRange.from}
                                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                                disabled={(date) => date > new Date() || date < new Date("2010-01-01")}
                                initialFocus
                                className="bg-slate-800 text-white"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div>
                          <Label className="text-slate-400 text-xs mb-1">To Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50",
                                  !customDateRange.to && "text-slate-400"
                                )}
                                disabled={loading}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {customDateRange.to ? format(customDateRange.to, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-600" align="start">
                              <Calendar
                                mode="single"
                                selected={customDateRange.to}
                                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                                disabled={(date) => date > new Date() || date < new Date("2010-01-01") || (customDateRange.from && date < customDateRange.from)}
                                initialFocus
                                className="bg-slate-800 text-white"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedDateRange === "custom" 
                      ? "Select a custom date range for importing games."
                      : "Fetches games from the selected time period. Shorter ranges are faster."
                    }
                  </p>
                </div>
              </div>

              <Button 
                onClick={importGames} 
                disabled={loading || selectedTimeControls.length === 0}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import Games
                  </>
                )}
              </Button>

              {loading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{status}</span>
                    <span className="text-slate-400">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {error && (
                <Alert className="bg-red-500/10 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-500/10 border-green-500/50">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <AlertDescription className="text-green-300">{success}</AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>
      </div>

        {/* Data Management - Takes 1 column */}
        <div>
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-xl h-full">
          <CardHeader>
              <CardTitle className="text-slate-200 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Management
              </CardTitle>
          </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={exportData}
                  disabled={isExporting || storageInfo.totalGraphs === 0}
                  className="w-full bg-slate-700/50 border-slate-600 text-slate-300 hover:text-white"
                >
                  {isExporting ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Export Data
                </Button>

                <Button
                  variant="outline"
                  onClick={() => updateStorageInfo()}
                  className="w-full bg-slate-700/50 border-slate-600 text-slate-300 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Storage Info
                </Button>

                <Button
                  variant="destructive"
                  onClick={deleteAllData}
                  disabled={isDeleting || storageInfo.totalGraphs === 0}
                  className="w-full bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4 mr-2" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All Data
                    </>
                  )}
                </Button>
              </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}