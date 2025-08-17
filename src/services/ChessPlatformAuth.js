// Chess Platform Authentication Service
// Handles Chess.com and Lichess login/import - completely separate from Firebase

import { extractGameData, extractGameDataGeneric } from '../utils/PgnParser';
import { identifyOpening } from '../utils/StudyDatabase';
import { 
  saveOpeningGraph, 
  loadOpeningGraph, 
  initGraphDB,
  deleteOpeningGraph,
  clearAllGraphs
} from '@/api/graphStorage';
import { OpeningGraph } from '@/api/studyGraph';
import { backgroundProcessor } from '../utils/BackgroundProcessor';

class ChessPlatformService {
  constructor() {
    this.isImporting = false;
    this.importProgress = 0;
    this.importStatus = '';
    this.currentProfile = null;
    this.listeners = {
      progress: [],
      status: [],
      complete: []
    };
  }

  // Event listeners
  onProgress(callback) {
    this.listeners.progress.push(callback);
    return () => {
      this.listeners.progress = this.listeners.progress.filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback) {
    this.listeners.status.push(callback);
    return () => {
      this.listeners.status = this.listeners.status.filter(cb => cb !== callback);
    };
  }

  onComplete(callback) {
    this.listeners.complete.push(callback);
    return () => {
      this.listeners.complete = this.listeners.complete.filter(cb => cb !== callback);
    };
  }

  // Notify listeners
  notifyProgress(progress) {
    this.importProgress = progress;
    this.listeners.progress.forEach(callback => callback(progress));
  }

  notifyStatus(status) {
    this.importStatus = status;
    this.listeners.status.forEach(callback => callback(status));
  }

  notifyComplete(result) {
    this.listeners.complete.forEach(callback => callback(result));
  }

  // Connect to chess platform
  async connectChessPlatform(platform, username, importSettings = null) {
    try {
      this.isImporting = true;
      this.notifyProgress(0);
      this.notifyStatus(`Verifying ${platform === 'lichess' ? 'Lichess' : 'Chess.com'} account...`);
      
      // Verify account based on platform
      let platformUser;
      if (platform === 'lichess') {
        platformUser = await this.verifyLichessAccount(username);
      } else {
        platformUser = await this.verifyChessComAccount(username);
      }
      
      this.notifyProgress(10);
      this.notifyStatus('Account verified! Starting import...');
      
      // Create chess profile
      const profile = {
        platform,
        username,
        platformUser,
        importSettings: importSettings || {
          selectedTimeControls: platform === 'lichess' ? 
            ['rapid', 'blitz', 'bullet', 'classical'] : 
            ['rapid', 'blitz', 'bullet'],
          selectedDateRange: '3',
          customDateRange: { from: null, to: null },
          autoSyncFrequency: '1day'
        },
        lastSync: null,
        connectedAt: new Date().toISOString()
      };

      // Save to localStorage (works offline)
      localStorage.setItem('chesscope_username', username);
      localStorage.setItem('chessScope_chessProfile', JSON.stringify(profile));
      this.currentProfile = profile;

      // Initialize graph database
      await initGraphDB();
      
      // Import games and build graph
      const importResult = await this.importGamesWithProgress(profile);
      
      // Update profile with import results
      profile.gameCount = importResult.gameCount;
      profile.lastGameTime = importResult.lastGameTime;
      profile.lastSync = new Date().toISOString();

      // Save updated profile
      localStorage.setItem('chessScope_chessProfile', JSON.stringify(profile));
      this.currentProfile = profile;
      
      this.notifyProgress(100);
      this.notifyStatus('Connection completed successfully!');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = { success: true, profile };
      this.notifyComplete(result);
      return result;
      
    } catch (error) {
      console.error('Platform connection error:', error);
      if (backgroundProcessor.getStatus().isRunning) {
        backgroundProcessor.stop();
      }
      this.notifyStatus(`Error: ${error.message}`);
      const result = { success: false, error: error.message };
      this.notifyComplete(result);
      return result;
    } finally {
      setTimeout(() => {
        this.isImporting = false;
        this.notifyProgress(0);
        this.notifyStatus('');
      }, 1500);
    }
  }

  // Platform verification functions
  async verifyChessComAccount(username) {
    try {
      const profileResponse = await fetch(`https://api.chess.com/pub/player/${username}`);
      if (!profileResponse.ok) {
        throw new Error('User not found on Chess.com');
      }
      const profileData = await profileResponse.json();
      
      const statsResponse = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
      if (!statsResponse.ok) {
        throw new Error('Could not fetch user stats');
      }
      const statsData = await statsResponse.json();
      
      return {
        username: profileData.username,
        url: profileData.url,
        name: profileData.name,
        title: profileData.title,
        followers: profileData.followers,
        country: profileData.country,
        location: profileData.location,
        lastOnline: profileData.last_online,
        joined: profileData.joined,
        status: profileData.status,
        isStreamer: profileData.is_streamer,
        verified: profileData.verified,
        avatar: profileData.avatar,
        stats: statsData
      };
    } catch (error) {
      throw new Error(`Failed to verify Chess.com account: ${error.message}`);
    }
  }

  async verifyLichessAccount(username) {
    try {
      if (!username || username.trim().length === 0) {
        throw new Error('Username cannot be empty');
      }
      
      const response = await fetch(`https://lichess.org/api/user/${username}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found on Lichess');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      
      return {
        id: userData.id,
        username: userData.username,
        url: userData.url,
        title: userData.title,
        online: userData.online,
        playing: userData.playing,
        streaming: userData.streaming,
        createdAt: userData.createdAt,
        seenAt: userData.seenAt,
        profile: userData.profile,
        count: userData.count,
        playTime: userData.playTime,
        perfs: userData.perfs
      };
    } catch (error) {
      throw new Error(`Failed to verify Lichess account: ${error.message}`);
    }
  }

  // Import games with progress tracking
  async importGamesWithProgress(profile) {
    const { platform, username, importSettings } = profile;
    const {
      selectedTimeControls = platform === 'lichess' ? 
        ['rapid', 'blitz', 'bullet', 'classical'] : 
        ['rapid', 'blitz', 'bullet'],
      selectedDateRange = '3',
      customDateRange = { from: null, to: null }
    } = importSettings;

    try {
      this.notifyProgress(5);
      this.notifyStatus('Connecting to server...');

      let recentTargetedGames = [];
      const TARGET_GAMES = 1500; // Hard limit
      
      // Progress callback for fetch operations
      const handleFetchProgress = (progressData) => {
        const { phase, progress, status } = progressData;
        
        // During fetch phase, progress goes from 5% to 45%
        if (phase === 'download' || phase === 'parsing') {
          const adjustedProgress = 5 + (progress / 45) * 40; // Map 0-45% to 5-45%
          this.notifyProgress(adjustedProgress);
          this.notifyStatus(status);
        }
      };
      
      if (platform === 'lichess') {
        // Lichess direct API approach with progress tracking
        const games = await this.fetchLichessGames(username, importSettings, handleFetchProgress);
        recentTargetedGames = games.slice(0, TARGET_GAMES);
        
        this.notifyProgress(45);
        this.notifyStatus(`Found ${recentTargetedGames.length} games from Lichess...`);
        
      } else {
        // Chess.com archive-based approach with progress tracking
        const games = await this.fetchChessComGames(username, importSettings, handleFetchProgress);
        recentTargetedGames = games.slice(0, TARGET_GAMES);
        
        this.notifyProgress(45);
        this.notifyStatus(`Found ${recentTargetedGames.length} games from Chess.com...`);
      }
      
      // Small pause to show the found games status
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.notifyProgress(50);
      this.notifyStatus('Clearing previous data and creating new opening graph...');

      // Create platform-specific identifier
      const identifier = `${platform}:${username}`.toLowerCase();
      
      // Clear any existing graph data first (fresh start)
      try {
        await deleteOpeningGraph(identifier);
      } catch (error) {
        // Ignore if no existing graph to delete
      }

      // Create a completely new OpeningGraph
      const openingGraph = new OpeningGraph(identifier);
      
      this.notifyStatus(`Processing ${recentTargetedGames.length} games into new opening graph...`);

      const totalGames = recentTargetedGames.length;
      
      // Reset debug tracking for this import session
      window.gameResults = { wins: 0, losses: 0, draws: 0, total: 0 };
      
      // Use aggressive BackgroundProcessor with immediate yielding for background processing
      await backgroundProcessor.processArray(
        recentTargetedGames, 
        async (game, index) => {
          let gameData;
          
          // For Lichess, the games are already processed by fetchLichessGames
          if (platform === 'lichess') {
            gameData = game;
          } else {
            // Use the generic function for Chess.com
            gameData = extractGameDataGeneric(game, username, platform);
          }
          
          if (gameData && gameData.moves && gameData.moves.length > 0) {
            // Add opening information
            const opening = await identifyOpening(gameData.moves);
            gameData.opening = opening;
            
            // Add game to the graph
            await openingGraph.addGame(gameData);
            
            // Track results for debugging (simple counter approach)
            if (!window.gameResults) window.gameResults = { wins: 0, losses: 0, draws: 0, total: 0 };
            window.gameResults.total++;
            if (gameData.result === 'win') window.gameResults.wins++;
            else if (gameData.result === 'lose') window.gameResults.losses++;
            else window.gameResults.draws++;
          }
          
          return gameData;
        },
        {
          batchSize: 1, // Process one game at a time
          yieldEvery: 5, // Yield every 5 games when in foreground
          backgroundYieldEvery: 1, // Yield after every game in background for maximum speed
          onProgress: (progress) => {
            // Update progress: 50% to 90% for processing (smooth updates)
            const progressPercent = 50 + (progress.percentage / 100) * 40;
            this.notifyProgress(progressPercent);
            this.notifyStatus(`Building graph: ${progress.processed}/${progress.total} games processed ${progress.isBackground ? '(background)' : ''}`);
            
            // Debug logging for result distribution tracking (every 50 games)
            if (progress.processed % 50 === 0 || progress.processed === progress.total) {
              if (window.gameResults) {
                const { wins, losses, draws, total } = window.gameResults;
                console.log(`📊 After ${total} ${platform} games: ${wins} wins (${((wins/total)*100).toFixed(1)}%), ${losses} losses (${((losses/total)*100).toFixed(1)}%), ${draws} draws (${((draws/total)*100).toFixed(1)}%) ${progress.isBackground ? '(background mode - immediate yielding)' : ''}`);
              }
            }
          },
          onError: (error, game, index) => {
            console.warn(`Error processing game ${index}:`, error);
            // Continue with other games - don't stop the whole process
          }
        }
      );

      this.notifyProgress(95);
      this.notifyStatus('Saving opening graph...');

      // Save the complete graph
      await saveOpeningGraph(openingGraph);
      
      // Store the platform-specific username in localStorage
      localStorage.setItem('chesscope_username', identifier);

      const stats = openingGraph.getOverallStats();
      const totalPositions = stats.white.totalPositions + stats.black.totalPositions;
      
      // Smooth transition to 100%
      this.notifyProgress(98);
      
      // Check if tab is visible for UI animations
      const isTabVisible = !document.hidden;
      
      if (isTabVisible) {
        await new Promise(resolve => setTimeout(resolve, 50));
        this.notifyProgress(100);
        this.notifyStatus(`Graph built with ${totalPositions} unique positions!`);
        
        // Hold at 100% briefly so user can see it
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Reduced wait for smoother completion
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        // Background mode - skip UI animations, complete immediately
        this.notifyProgress(100);
        this.notifyStatus(`Graph built with ${totalPositions} unique positions!`);
        console.log('🔄 Import completed in background mode - skipping UI animations');
      }
      
      // Get the most recent game time (games are already sorted by date, most recent first)
      let lastGameTime = null;
      if (recentTargetedGames.length > 0) {
        const firstGame = recentTargetedGames[0];
        if (platform === 'lichess') {
          // Lichess already has ISO string format
          lastGameTime = firstGame.end_time;
        } else {
          // Chess.com has Unix timestamp in seconds
          lastGameTime = firstGame.end_time * 1000; // Convert to milliseconds
        }
      }
      
      return { gameCount: recentTargetedGames.length, lastGameTime };

    } catch (error) {
      console.error('Import games error:', error);
      throw error;
    }
  }

  // Fetch Chess.com games
  async fetchChessComGames(username, importSettings = {}, onProgress = null) {
    try {
      const {
        selectedTimeControls = ['rapid', 'blitz', 'bullet'],
        selectedDateRange = '3',
        customDateRange = { from: null, to: null }
      } = importSettings;

      let games = [];
      const currentDate = new Date();
      
      if (onProgress) {
        onProgress({ phase: 'download', progress: 0, status: 'Fetching archive list from Chess.com...' });
      }
      
      // Calculate date range for Chess.com API
      let targetStartDate = null;
      let targetEndDate = null;
      
      if (selectedDateRange === "custom") {
        if (customDateRange.from && customDateRange.to) {
          targetStartDate = new Date(customDateRange.from);
          targetEndDate = new Date(customDateRange.to);
        }
      } else {
        // For preset ranges (1, 2, 3 months), calculate the actual date range
        const monthsBack = parseInt(selectedDateRange);
        if (!isNaN(monthsBack) && monthsBack > 0) {
          targetStartDate = new Date();
          targetStartDate.setMonth(currentDate.getMonth() - monthsBack);
          targetEndDate = new Date(); // Up to current date
        }
      }
      
      // Get archives list
      const archivesResponse = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
      if (!archivesResponse.ok) {
        throw new Error("Username not found or API error");
      }
      
      const archivesData = await archivesResponse.json();
      const allArchives = archivesData.archives || [];
      
      // Filter archives based on actual date range instead of just taking the most recent
      let archivesToFetch = allArchives;
      
      if (targetStartDate && targetEndDate) {
        // Parse archive URLs to get year/month and filter by date range
        archivesToFetch = allArchives.filter(archiveUrl => {
          // Chess.com archive URLs are in format: https://api.chess.com/pub/player/{username}/games/YYYY/MM
          const urlParts = archiveUrl.split('/');
          const year = parseInt(urlParts[urlParts.length - 2]);
          const month = parseInt(urlParts[urlParts.length - 1]);
          
          if (isNaN(year) || isNaN(month)) return false;
          
          // Create date for first day of the archive month
          const archiveDate = new Date(year, month - 1, 1); // month is 0-indexed in Date constructor
          
          // Check if archive month overlaps with our target date range
          // Archive month start should be before target end date
          // Archive month end should be after target start date
          const archiveMonthEnd = new Date(year, month, 0); // Last day of the archive month
          
          return archiveDate <= targetEndDate && archiveMonthEnd >= targetStartDate;
        });
        
        console.log(`📅 Chess.com date filtering: ${targetStartDate.toISOString().split('T')[0]} to ${targetEndDate.toISOString().split('T')[0]}`);
        console.log(`📦 Filtered archives: ${archivesToFetch.length}/${allArchives.length} archives match date range`);
      } else {
        // If no date range specified, take all archives but limit to reasonable amount
        archivesToFetch = allArchives.slice(-12); // Last 12 months max
      }
      
      // Sort archives by date (most recent first) for better UX
      archivesToFetch.sort((a, b) => {
        const aDate = a.split('/').slice(-2).join('/');
        const bDate = b.split('/').slice(-2).join('/');
        return bDate.localeCompare(aDate);
      });
      
      const recentArchives = archivesToFetch;
      
      if (onProgress) {
        onProgress({ 
          phase: 'download', 
          progress: 5, 
          status: `Found ${recentArchives.length} archives to check...` 
        });
      }
      
      // Fetch games from archives
      let archivesProcessed = 0;
      for (let i = 0; i < recentArchives.length && games.length < 1500; i++) {
        const archiveUrl = recentArchives[recentArchives.length - 1 - i]; // Most recent first
        
        try {
          if (onProgress) {
            const archiveProgress = 5 + (archivesProcessed / recentArchives.length) * 35; // 5% to 40%
            onProgress({ 
              phase: 'download', 
              progress: archiveProgress, 
              status: `Fetching archive ${archivesProcessed + 1}/${recentArchives.length}...` 
            });
          }
          
          const gamesResponse = await fetch(archiveUrl);
          if (gamesResponse.ok) {
            const gamesData = await gamesResponse.json();
            const archiveGames = gamesData.games || [];
            
            // Filter by time controls and date range
            const filteredGames = archiveGames.filter(game => {
              // Filter by time control
              const timeClass = game.time_class;
              if (!selectedTimeControls.includes(timeClass)) {
                return false;
              }
              
              // Filter by date range if specified
              if (targetStartDate && targetEndDate) {
                const gameDate = new Date(game.end_time * 1000); // Chess.com uses Unix timestamp in seconds
                if (gameDate < targetStartDate || gameDate > targetEndDate) {
                  return false;
                }
              }
              
              // Only include rated games
              if (!game.rated) {
                return false;
              }
              
              return true;
            });
            
            games.push(...filteredGames);
          }
          
          archivesProcessed++;
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.warn(`Error fetching archive ${archiveUrl}:`, error);
          archivesProcessed++;
        }
      }
      
      // Sort games by date (most recent first)
      games.sort((a, b) => b.end_time - a.end_time);
      
      if (onProgress) {
        onProgress({ 
          phase: 'parsing', 
          progress: 40, 
          status: `Found ${games.length} games from Chess.com` 
        });
      }
      
      return games.slice(0, 1500); // Limit to 1500 games
      
    } catch (error) {
      console.error('Error fetching Chess.com games:', error);
      throw error;
    }
  }

  // Fetch Lichess games
  async fetchLichessGames(username, importSettings = {}, onProgress = null) {
    try {
      const {
        selectedTimeControls = ['rapid', 'blitz', 'bullet'],
        selectedDateRange = '3',
        customDateRange = { from: null, to: null }
      } = importSettings;

      // Validate inputs
      if (!username || username.trim().length === 0) {
        throw new Error('Username cannot be empty');
      }

      // Calculate date range
      const currentDate = new Date();
      let sinceDate = null;
      
      if (selectedDateRange === "custom") {
        if (customDateRange.from && customDateRange.to) {
          sinceDate = new Date(customDateRange.from);
        }
      } else if (selectedDateRange && selectedDateRange !== "all") {
        const monthsBack = parseInt(selectedDateRange);
        if (!isNaN(monthsBack) && monthsBack > 0) {
          sinceDate = new Date();
          sinceDate.setMonth(currentDate.getMonth() - monthsBack);
        }
      }
      
      // Build Lichess API URL
      const lichessBaseURL = 'https://lichess.org/api/games/user/';
      const playerNameFilter = encodeURIComponent(username);
      
      // Map time controls to Lichess perfType
      const perfMapping = {
        'bullet': 'bullet',
        'blitz': 'blitz', 
        'rapid': 'rapid',
        'classical': 'classical'
      };
      
      const perfs = selectedTimeControls
        .map(tc => perfMapping[tc])
        .filter(p => p)
        .join(',');
      
      const perfFilter = perfs ? `&perfType=${perfs}` : '';
      const ratedFilter = '&rated=true';
      const timeSinceFilter = sinceDate ? `&since=${sinceDate.getTime()}` : '';
      
      const apiUrl = `${lichessBaseURL}${playerNameFilter}?max=1500${ratedFilter}${perfFilter}${timeSinceFilter}`;
      
      if (onProgress) {
        onProgress({ phase: 'download', progress: 0, status: 'Connecting to Lichess...' });
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/x-ndjson'
        }
      });
      
      if (response.status === 404) {
        throw new Error('User not found on Lichess');
      } else if (response.status === 429) {
        throw new Error('Too many requests to Lichess. Please wait a moment and try again.');
      } else if (!response.ok) {
        throw new Error(`Unable to fetch games from Lichess (Error ${response.status})`);
      }
      
      if (onProgress) {
        onProgress({ phase: 'download', progress: 5, status: 'Downloading games from Lichess...' });
      }
      
      // Read response text
      const responseText = await response.text();
      
      if (onProgress) {
        onProgress({ phase: 'parsing', progress: 40, status: 'Processing games...' });
      }
      
      // Parse NDJSON format
      const lines = responseText.trim().split('\n');
      const games = [];
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const game = JSON.parse(line);
            // Convert to our format
            const gameData = extractGameData(game, username, 'lichess');
            if (gameData) {
              games.push(gameData);
            }
          } catch (parseError) {
            console.warn('Error parsing game line:', parseError);
          }
        }
      }
      
      if (onProgress) {
        onProgress({ 
          phase: 'parsing', 
          progress: 40, 
          status: `Found ${games.length} games from Lichess` 
        });
      }
      
      return games;
      
    } catch (error) {
      console.error('Error fetching Lichess games:', error);
      throw error;
    }
  }

  // Get current profile
  getProfile() {
    return this.currentProfile;
  }

  // Check if connected
  isConnected() {
    return this.currentProfile !== null;
  }

  // Disconnect
  disconnect() {
    this.currentProfile = null;
    localStorage.removeItem('chessScope_chessProfile');
    localStorage.removeItem('chesscope_username');
    
    // Stop any background processing
    if (backgroundProcessor.getStatus().isRunning) {
      backgroundProcessor.stop();
    }
    
    // Clear opening graphs
    try {
      clearAllGraphs();
    } catch (error) {
      console.warn('Error clearing graphs:', error);
    }
  }
}

// Export singleton instance
export const chessPlatformService = new ChessPlatformService();
export default chessPlatformService;