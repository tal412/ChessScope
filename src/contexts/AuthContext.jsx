import { createContext, useContext, useState, useEffect } from 'react';
import { extractGameData, extractGameDataGeneric } from '../components/chess/PgnParser';
import { identifyOpening } from '../components/chess/OpeningDatabase';
import { 
  saveOpeningGraph, 
  loadOpeningGraph, 
  initGraphDB,
  deleteOpeningGraph,
  clearAllGraphs
} from '@/api/graphStorage';
import { OpeningGraph } from '@/api/openingGraph';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for existing authentication on app start
    const savedAuth = localStorage.getItem('chessScope_auth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        setUser(authData.user);
        setIsAuthenticated(true);
        // If user has auto-sync enabled, trigger a background sync immediately
        if (authData.user?.importSettings?.autoSync) {
          // Fire and forget – we don't await to avoid blocking UI
          (async () => {
            try {
              await syncUserData(authData.user);
            } catch (e) {
              console.warn('Auto-sync on startup failed:', e);
            }
          })();
        }
      } catch (error) {
        console.error('Error parsing saved auth:', error);
        localStorage.removeItem('chessScope_auth');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username, platform = 'chess.com', importSettings = null, googleAccount = null) => {
    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus(`Verifying ${platform === 'lichess' ? 'Lichess' : 'Chess.com'} account...`);
      
      // Verify account based on platform
      let platformUser;
      if (platform === 'lichess') {
        platformUser = await verifyLichessAccount(username);
      } else {
        platformUser = await verifyChessComAccount(username);
      }
      
      setImportProgress(10);
      setImportStatus('Account verified! Starting import...');
      
      const userData = {
        platform,
        username,
        platformUser,
        // Keep backwards compatibility with existing Chess.com keys
        chessComUsername: platform === 'chess.com' ? username : null,
        chessComUser: platform === 'chess.com' ? platformUser : null,
        lichessUsername: platform === 'lichess' ? username : null,
        lichessUser: platform === 'lichess' ? platformUser : null,
        googleAccount,
        importSettings: importSettings || {
          selectedTimeControls: platform === 'lichess' ? 
            ['rapid', 'blitz', 'bullet', 'classical'] : 
            ['rapid', 'blitz', 'bullet'],
          selectedDateRange: '3',
          customDateRange: { from: null, to: null },
          autoSync: true
        },
        loginTime: new Date().toISOString(),
        lastSync: null
      };

      // Initialize graph database
      await initGraphDB();
      
      // Import games and build graph with progress tracking
      const gameCount = await importGamesWithProgress(userData);
      userData.gameCount = gameCount;
      userData.lastSync = new Date().toISOString();

      // Save to localStorage for persistence
      localStorage.setItem('chessScope_auth', JSON.stringify({ user: userData }));
      
      setUser(userData);
      setIsAuthenticated(true);
      
      setImportProgress(100);
      setImportStatus('Login completed successfully!');
      
      // Hold at 100% briefly so user can see it
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Wait for the Done animation (800ms) before cleanup
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      setImportStatus(`Error: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      // Cleanup after animations complete
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
      }, 1500); // Just for success message duration
    }
  };

  const logout = async () => {
    try {
      console.log('🔄 Starting comprehensive logout cleanup...');
      
      // Get platform-specific identifier before clearing auth data for IndexedDB cleanup
      const currentIdentifier = user?.platform ? `${user.platform}:${user.username}`.toLowerCase() : user?.chessComUsername?.toLowerCase();
      
      // 1. Clear authentication data
      localStorage.removeItem('chessScope_auth');
      console.log('✅ Cleared authentication data');
      
      // 2. Clear username data
      localStorage.removeItem('chesscope_username');
      console.log('✅ Cleared username data');
      
      // 3. Clear any legacy database data
      localStorage.removeItem('chesscope_db');
      console.log('✅ Cleared legacy database data');
      
      // 4. Clear other potential localStorage keys
      const keysToCheck = [
        'chesscope_games',
        'chesscope_nodes',
        'chesscope_settings',
        'chesscope_openings',
        'chesscope_cache'
      ];
      
      keysToCheck.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`✅ Cleared ${key}`);
        }
      });
      
      // 5. Clear sessionStorage
      sessionStorage.clear();
      console.log('✅ Cleared session storage');
      
      // 6. Clear all opening graphs from IndexedDB (comprehensive approach)
      try {
        await clearAllGraphs();
        console.log('✅ Cleared all opening graphs from IndexedDB');
      } catch (error) {
        console.warn('⚠️ Could not clear all graphs:', error);
        
        // Fallback: try to delete specific user's graph
        if (currentIdentifier) {
          try {
            await deleteOpeningGraph(currentIdentifier);
            console.log('✅ Deleted specific user graph as fallback');
          } catch (fallbackError) {
            console.warn('⚠️ Could not delete user-specific graph either:', fallbackError);
          }
        }
      }
      
      // 7. Clear any cached data or memory references
      try {
        // Force garbage collection if available (development only)
        if (typeof window !== 'undefined' && window.gc) {
          window.gc();
          console.log('✅ Forced garbage collection');
        }
      } catch (error) {
        // Ignore if gc is not available
      }
      
      // 8. Update auth state
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('🎉 Logout cleanup completed successfully');
      
      // Optional: Show a brief success message
      console.log('🔒 All user data has been securely cleared');
      
    } catch (error) {
      console.error('❌ Error during logout cleanup:', error);
      
      // Still clear the auth state even if cleanup partially fails
      setUser(null);
      setIsAuthenticated(false);
      
      // Basic cleanup as fallback
      try {
        localStorage.removeItem('chessScope_auth');
        localStorage.removeItem('chesscope_username');
        sessionStorage.clear();
        
        // Try one more time to clear graphs
        if (typeof clearAllGraphs === 'function') {
          await clearAllGraphs();
        }
      } catch (fallbackError) {
        console.error('❌ Fallback cleanup also failed:', fallbackError);
      }
    }
  };

  const syncUserData = async (userData) => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      console.log('Starting sync for user:', userData.username, 'on platform:', userData.platform);
      
      // Fetch latest games based on platform (lightweight sync)
      let latestGames;
      if (userData.platform === 'lichess') {
        latestGames = await fetchLichessGames(userData.username, userData.importSettings);
      } else {
        latestGames = await fetchChessComGames(userData.username, userData.importSettings);
      }
      
      // Update user's last sync time
      const updatedUser = {
        ...userData,
        lastSync: new Date().toISOString(),
        gameCount: latestGames.length
      };
      
      setUser(updatedUser);
      localStorage.setItem('chessScope_auth', JSON.stringify({ user: updatedUser }));
      
      // Backup to Google Drive if connected
      if (userData.googleAccount) {
        await backupToGoogleDrive(latestGames, userData.googleAccount);
      }
      
      return latestGames;
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const connectGoogleDrive = async (googleAccount) => {
    try {
      const updatedUser = {
        ...user,
        googleAccount
      };
      
      setUser(updatedUser);
      localStorage.setItem('chessScope_auth', JSON.stringify({ user: updatedUser }));
      
      // Backup existing data to Google Drive
      if (user.gameCount > 0) {
        let games;
        if (user.platform === 'lichess') {
          games = await fetchLichessGames(user.username, user.importSettings);
        } else {
          games = await fetchChessComGames(user.username, user.importSettings);
        }
        await backupToGoogleDrive(games, googleAccount);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Google Drive connection error:', error);
      return { success: false, error: error.message };
    }
  };

  const updateImportSettings = async (newSettings, onComplete = null) => {
    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus('Updating settings and re-importing games...');
      
      const updatedUser = {
        ...user,
        importSettings: newSettings
      };
      
      // Re-import games with new settings and rebuild graph
      const gameCount = await importGamesWithProgress(updatedUser);
      updatedUser.gameCount = gameCount;
      updatedUser.lastSync = new Date().toISOString();
      
      setUser(updatedUser);
      localStorage.setItem('chessScope_auth', JSON.stringify({ user: updatedUser }));
      
      setImportProgress(100);
      setImportStatus('Settings updated successfully!');
      
      return { success: true };
    } catch (error) {
      console.error('Settings update error:', error);
      setImportStatus(`Error: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      // Cleanup immediately and call completion callback
      setIsImporting(false);
      setImportProgress(0);
      setImportStatus('');
      
      // Call the completion callback if provided
      if (onComplete) {
        console.log('🎯 Calling settings completion callback');
        onComplete();
      }
    }
  };

  // New function to import games with progress tracking (similar to import page)
  const importGamesWithProgress = async (userData) => {
    const { platform, username, importSettings } = userData;
    const {
      selectedTimeControls = platform === 'lichess' ? 
        ['rapid', 'blitz', 'bullet', 'classical'] : 
        ['rapid', 'blitz', 'bullet'],
      selectedDateRange = '3',
      customDateRange = { from: null, to: null }
    } = importSettings;

    try {
      setImportProgress(15);
      setImportStatus('Fetching games...');

      let recentTargetedGames = [];
      const TARGET_GAMES = 1500; // Hard limit
      
      if (platform === 'lichess') {
        // Lichess direct API approach
        const games = await fetchLichessGames(username, importSettings);
        recentTargetedGames = games.slice(0, TARGET_GAMES);
        
        setImportProgress(45);
        setImportStatus(`Found ${recentTargetedGames.length} games from Lichess...`);
        
      } else {
        // Chess.com archive-based approach
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
            const urlParts = archiveUrl.split('/');
            const year = parseInt(urlParts[urlParts.length - 2]);
            const month = parseInt(urlParts[urlParts.length - 1]);
            const archiveDate = new Date(year, month - 1, 1);
            
            return archiveDate >= fromDate && archiveDate <= toDate;
          });
        } else {
          const monthsToFetch = parseInt(selectedDateRange);
          recentArchives = allArchives.slice(-monthsToFetch);
        }
        
        setImportProgress(25);
        setImportStatus('Fetching games by time control...');

        let targetedGames = [];
        let archivesProcessed = 0;
        
        // Process archives from most recent to oldest until we have enough games
        for (let i = recentArchives.length - 1; i >= 0 && targetedGames.length < TARGET_GAMES; i--) {
          try {
            setImportStatus(`Checking archive ${archivesProcessed + 1}/${recentArchives.length} for ${selectedTimeControls.join('/')} games...`);
            
            const archiveResponse = await fetch(recentArchives[i]);
            const archiveData = await archiveResponse.json();
            
            // Filter games by selected time controls as we fetch
            const filteredGames = archiveData.games
              .filter(game => game.rules === "chess")
              .filter(game => selectedTimeControls.includes(game.time_class));
            
            targetedGames = [...targetedGames, ...filteredGames];
            
            archivesProcessed++;
            
            // Update progress: 25% to 45% for fetching
            setImportProgress(25 + (archivesProcessed / recentArchives.length) * 20);
            
            setImportStatus(`Found ${targetedGames.length} ${selectedTimeControls.join('/')} games so far...`);
            
            // Small delay to prevent API rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (archiveError) {
            console.warn(`Failed to fetch archive ${recentArchives[i]}:`, archiveError);
          }
        }

        // Take the most recent games up to our target
        recentTargetedGames = targetedGames
          .slice(-TARGET_GAMES)
          .reverse(); // Process newest first
      }
      
      setImportProgress(50);
      setImportStatus('Clearing previous data and creating new opening graph...');

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
      
      setImportStatus(`Processing ${recentTargetedGames.length} games into new opening graph...`);

      const totalGames = recentTargetedGames.length;
      
      // Process games one at a time with proper UI yielding
      for (let i = 0; i < totalGames; i++) {
        const game = recentTargetedGames[i];
        let gameData;
        
        // DEBUG: Log the actual Lichess game structure
        if (platform === 'lichess' && i === 0) {
          console.log('🔍 DEBUG AuthContext - First Lichess game structure:', {
            game,
            keys: Object.keys(game),
            hasWinner: !!game.winner,
            hasPlayers: !!game.players,
            hasStatus: !!game.status,
            hasMoves: !!game.moves,
            sample: JSON.stringify(game).substring(0, 200)
          });
          // Log the full game object to see its structure
          console.log('📋 Full first game object:', game);
        }
        
        // For Lichess, the games are already processed by fetchLichessGames
        if (platform === 'lichess') {
          // Lichess games are already in the correct format from fetchLichessGames
          gameData = game;
          
          // DEBUG: Check player color distribution
          if (i === 0 || i === 50 || i === 100) {
            console.log(`🎨 DEBUG Game ${i} player color:`, {
              player_color: gameData.player_color,
              white_username: gameData.white_username,
              black_username: gameData.black_username,
              input_username: username,
              result: gameData.result
            });
          }
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
        }
        
        // Update progress: 50% to 90% for processing
        const progressPercent = 50 + ((i + 1) / totalGames) * 40;
        setImportProgress(progressPercent);
        setImportStatus(`Building graph: ${i + 1}/${totalGames} games processed`);
        
        // Yield control to the UI thread
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
      }

      setImportProgress(95);
      setImportStatus('Saving opening graph...');

      // Save the complete graph
      await saveOpeningGraph(openingGraph);
      
      // Store the platform-specific username in localStorage
      localStorage.setItem('chesscope_username', identifier);

      const stats = openingGraph.getOverallStats();
      const totalPositions = stats.white.totalPositions + stats.black.totalPositions;
      
      // Smooth transition to 100%
      setImportProgress(98);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      setImportProgress(100);
      setImportStatus(`Graph built with ${totalPositions} unique positions!`);
      
      // Hold at 100% briefly so user can see it
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Wait for the Done animation (800ms) before cleanup
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return recentTargetedGames.length;

    } catch (error) {
      console.error('Import games error:', error);
      throw error;
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    isSyncing,
    isImporting,
    importProgress,
    importStatus,
    user,
    login,
    logout,
    syncUserData,
    connectGoogleDrive,
    updateImportSettings
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Function to verify Chess.com account and fetch real data
const verifyChessComAccount = async (username) => {
  try {
    // Fetch user profile from Chess.com API
    const profileResponse = await fetch(`https://api.chess.com/pub/player/${username}`);
    if (!profileResponse.ok) {
      throw new Error('User not found on Chess.com');
    }
    const profileData = await profileResponse.json();
    
    // Fetch user stats from Chess.com API
    const statsResponse = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
    if (!statsResponse.ok) {
      throw new Error('Could not fetch user stats');
    }
    const statsData = await statsResponse.json();
    
    // Get the most relevant rating (rapid, blitz, or bullet - whichever is highest/most recent)
    let rating = null;
    let gameType = 'unrated';
    
    if (statsData.chess_rapid?.last?.rating) {
      rating = statsData.chess_rapid.last.rating;
      gameType = 'rapid';
    } else if (statsData.chess_blitz?.last?.rating) {
      rating = statsData.chess_blitz.last.rating;
      gameType = 'blitz';
    } else if (statsData.chess_bullet?.last?.rating) {
      rating = statsData.chess_bullet.last.rating;
      gameType = 'bullet';
    } else if (statsData.chess_daily?.last?.rating) {
      rating = statsData.chess_daily.last.rating;
      gameType = 'daily';
    }
    
    return {
      username: profileData.username,
      rating: rating || 'Unrated',
      gameType,
      country: profileData.country ? profileData.country.split('/').pop() : 'Unknown',
      verified: true,
      joinDate: profileData.joined,
      lastOnline: profileData.last_online
    };
  } catch (error) {
    console.error('Chess.com API error:', error);
    throw new Error(`Failed to verify Chess.com account: ${error.message}`);
  }
};

// Function to verify Lichess account and fetch real data
const verifyLichessAccount = async (username) => {
  try {
    // Validate username format
    if (!username || username.trim().length === 0) {
      throw new Error('Username cannot be empty');
    }
    
    if (username.length < 3 || username.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }
    
    // Fetch user profile from Lichess API
    const profileResponse = await fetch(`https://lichess.org/api/user/${username}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Handle specific HTTP status codes
    if (profileResponse.status === 404) {
      throw new Error(`User "${username}" not found on Lichess. Please check the username and try again.`);
    } else if (profileResponse.status === 429) {
      throw new Error('Too many requests to Lichess API. Please wait a moment and try again.');
    } else if (profileResponse.status >= 500) {
      throw new Error('Lichess servers are currently unavailable. Please try again later.');
    } else if (!profileResponse.ok) {
      throw new Error(`Lichess API error (${profileResponse.status}): Unable to verify account`);
    }
    
    const profileData = await profileResponse.json();
    
    // Validate response structure
    if (!profileData || !profileData.username) {
      throw new Error('Invalid response from Lichess API. Please try again.');
    }
    
    // Check if the account is closed/banned
    if (profileData.disabled || profileData.tosViolation) {
      throw new Error('This Lichess account is disabled or has violated terms of service.');
    }
    
    // Get the most relevant rating (rapid, blitz, or bullet - whichever is highest/most recent)
    let rating = null;
    let gameType = 'unrated';
    
    if (profileData.perfs?.rapid?.rating) {
      rating = profileData.perfs.rapid.rating;
      gameType = 'rapid';
    } else if (profileData.perfs?.blitz?.rating) {
      rating = profileData.perfs.blitz.rating;
      gameType = 'blitz';
    } else if (profileData.perfs?.bullet?.rating) {
      rating = profileData.perfs.bullet.rating;
      gameType = 'bullet';
    } else if (profileData.perfs?.classical?.rating) {
      rating = profileData.perfs.classical.rating;
      gameType = 'classical';
    } else if (profileData.perfs?.correspondence?.rating) {
      rating = profileData.perfs.correspondence.rating;
      gameType = 'correspondence';
    }
    
    return {
      username: profileData.username,
      rating: rating || 'Unrated',
      gameType,
      country: profileData.profile?.country || 'Unknown',
      verified: true,
      joinDate: profileData.createdAt,
      lastOnline: profileData.seenAt,
      title: profileData.title || null
    };
  } catch (error) {
    console.error('Lichess API error:', error);
    
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to Lichess. Please check your internet connection.');
    }
    
    // Re-throw with our custom message if it's already a user-friendly error
    if (error.message.includes('not found') || 
        error.message.includes('Too many requests') || 
        error.message.includes('servers are currently unavailable') ||
        error.message.includes('disabled') ||
        error.message.includes('Username must be') ||
        error.message.includes('Username cannot be') ||
        error.message.includes('Invalid response')) {
      throw error;
    }
    
    // Generic fallback error
    throw new Error(`Failed to verify Lichess account: ${error.message || 'Unknown error occurred'}`);
  }
};

// Function to fetch recent Chess.com games
const fetchChessComGames = async (username, importSettings = {}) => {
  try {
    const {
      selectedTimeControls = ['rapid', 'blitz', 'bullet'],
      selectedDateRange = '3',
      customDateRange = { from: null, to: null }
    } = importSettings;

    let games = [];
    const currentDate = new Date();
    
    // Calculate how many months back to fetch based on selectedDateRange
    let monthsToFetch = 3; // default
    if (selectedDateRange === "custom") {
      if (customDateRange.from && customDateRange.to) {
        const fromDate = new Date(customDateRange.from);
        const toDate = new Date(customDateRange.to);
        monthsToFetch = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24 * 30)); // approximate months
      }
    } else {
      monthsToFetch = parseInt(selectedDateRange);
    }
    
    // Fetch games from multiple months
    for (let i = 0; i < monthsToFetch && games.length < 1500; i++) { // 1500 games limit
      const targetDate = new Date(currentDate);
      targetDate.setMonth(targetDate.getMonth() - i);
      
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      
      const gamesResponse = await fetch(`https://api.chess.com/pub/player/${username}/games/${year}/${month}`);
      
      if (gamesResponse.ok) {
        const gamesData = await gamesResponse.json();
        const monthGames = gamesData.games || [];
        games = [...games, ...monthGames];
        
        // Break early if we have enough games
        if (games.length >= 1500) {
          break;
        }
      }
    }
    
    // Filter games by type and limit
    const filteredGames = games
      .filter(game => {
        const timeControl = game.time_control;
        const gameType = getGameType(timeControl);
        return selectedTimeControls.includes(gameType);
      })
      .slice(0, 1500) // Hard limit of 1500 games
      .sort((a, b) => b.end_time - a.end_time); // Most recent first
    
    // Process and return the games
    return filteredGames.map((game, index) => ({
      id: game.uuid || index,
      white: game.white?.username || 'Unknown',
      black: game.black?.username || 'Unknown',
      result: game.white?.result || 'unknown',
      date: new Date(game.end_time * 1000).toISOString(),
      timeControl: game.time_control,
      gameType: getGameType(game.time_control),
      url: game.url,
      pgn: game.pgn
    }));
  } catch (error) {
    console.error('Failed to fetch Chess.com games:', error);
    // Return empty array on error rather than throwing
    return [];
  }
};

// Function to fetch recent Lichess games
const fetchLichessGames = async (username, importSettings = {}) => {
  try {
    // Validate inputs
    if (!username || username.trim().length === 0) {
      console.warn('Empty username provided to fetchLichessGames');
      return [];
    }
    
    const {
      selectedTimeControls = ['rapid', 'blitz', 'bullet'],
      selectedDateRange = '3',
      customDateRange = { from: null, to: null }
    } = importSettings;

    // Validate time controls
    if (!Array.isArray(selectedTimeControls) || selectedTimeControls.length === 0) {
      console.warn('No time controls selected for Lichess games fetch');
      return [];
    }

    // Calculate date range for Lichess API
    const currentDate = new Date();
    let sinceDate = new Date();
    
    try {
      if (selectedDateRange === "custom") {
        if (customDateRange.from && customDateRange.to) {
          sinceDate = new Date(customDateRange.from);
          const toDate = new Date(customDateRange.to);
          
          // Validate date range
          if (sinceDate >= toDate) {
            console.warn('Invalid date range: start date must be before end date');
            sinceDate.setMonth(currentDate.getMonth() - 3); // fallback to 3 months
          }
        } else {
          sinceDate.setMonth(currentDate.getMonth() - 3); // default to 3 months
        }
      } else {
        const monthsBack = parseInt(selectedDateRange);
        if (isNaN(monthsBack) || monthsBack <= 0) {
          console.warn('Invalid date range value, defaulting to 3 months');
          sinceDate.setMonth(currentDate.getMonth() - 3);
        } else {
          sinceDate.setMonth(currentDate.getMonth() - monthsBack);
        }
      }
    } catch (dateError) {
      console.warn('Error processing date range, defaulting to 3 months:', dateError);
      sinceDate.setMonth(currentDate.getMonth() - 3);
    }
    
    // Convert to Unix timestamp (milliseconds)
    const sinceTimestamp = sinceDate.getTime();
    
    // Build Lichess API URL like the working openingtree project
    const lichessBaseURL = 'https://lichess.org/api/games/user/';
    const playerNameFilter = encodeURIComponent(username);
    
    // Map our time controls to Lichess perfType values
    const getPerfs = (selectedTimeControls) => {
      if (selectedTimeControls.length === 0 || selectedTimeControls.length >= 4) {
        return null; // Get all time controls
      }
      
      const perfMapping = {
        'bullet': 'bullet',
        'blitz': 'blitz', 
        'rapid': 'rapid',
        'classical': 'classical'
      };
      
      return selectedTimeControls
        .map(tc => perfMapping[tc])
        .filter(p => p)
        .join(',');
    };
    
    const perfs = getPerfs(selectedTimeControls);
    const perfFilter = perfs ? `&perfType=${perfs}` : '';
    const ratedFilter = '&rated=true'; // Only rated games
    const timeSinceFilter = `&since=${sinceTimestamp}`;
    
    const apiUrl = `${lichessBaseURL}${playerNameFilter}?max=1500${ratedFilter}${perfFilter}${timeSinceFilter}`;
    
    console.log('Fetching Lichess games from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/x-ndjson'
      }
    });
    
    // Handle specific HTTP status codes
    if (response.status === 404) {
      console.warn(`User "${username}" not found on Lichess or has no games`);
      return [];
    } else if (response.status === 429) {
      console.warn('Rate limited by Lichess API');
      throw new Error('Too many requests to Lichess. Please wait a moment and try again.');
    } else if (response.status >= 500) {
      console.warn('Lichess server error');
      throw new Error('Lichess servers are temporarily unavailable. Please try again later.');
    } else if (!response.ok) {
      console.warn(`Lichess API error: ${response.status}`);
      throw new Error(`Unable to fetch games from Lichess (Error ${response.status})`);
    }
    
    // Check if response is empty (no games)
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      console.info(`No games found for user ${username} in the specified date range`);
      return [];
    }
    
    // Parse NDJSON (newline-delimited JSON) - each line is a separate game JSON object
    let jsonLines = [];
    try {
      jsonLines = text.trim().split('\n').filter(line => line.trim());
      console.log(`Received ${jsonLines.length} JSON games from Lichess`);
    } catch (parseError) {
      console.error('Error parsing Lichess games response:', parseError);
      throw new Error('Invalid response format from Lichess API');
    }
    
    // Check if we got any valid games
    if (jsonLines.length === 0) {
      console.info(`No valid games found for user ${username}`);
      return [];
    }
    
    // Parse JSON lines to extract game data
    let processedGames = [];
    for (let i = 0; i < jsonLines.length; i++) {
      try {
        const jsonLine = jsonLines[i];
        if (!jsonLine || jsonLine.trim().length === 0) continue;
        
        // Parse the JSON game data
        const gameData = JSON.parse(jsonLine);
        
        // Extract game data directly from Lichess JSON format
        const extractedData = {
          username,
          game_id: gameData.id,
          url: `https://lichess.org/${gameData.id}`,
          time_control: `${gameData.clock.initial}+${gameData.clock.increment}`,
          end_time: new Date(gameData.lastMoveAt).toISOString(),
          rated: gameData.rated,
          time_class: gameData.speed,
          rules: gameData.variant,
          white_rating: gameData.players.white.rating,
          black_rating: gameData.players.black.rating,
          white_username: gameData.players.white.user.name,
          black_username: gameData.players.black.user.name,
          moves: gameData.moves.split(' ').filter(m => m.trim()),
          player_color: gameData.players.white.user.name.toLowerCase() === username.toLowerCase() ? "white" : "black",
          result: (() => {
            const isWhite = gameData.players.white.user.name.toLowerCase() === username.toLowerCase();
            if (gameData.winner === 'white' && isWhite) return "win";
            else if (gameData.winner === 'black' && !isWhite) return "win";
            else if (gameData.winner === 'white' && !isWhite) return "lose";
            else if (gameData.winner === 'black' && isWhite) return "lose";
            else return "draw";
          })(),
          platform: 'lichess'
        };
        
        // Filter by time control if needed (additional safety check)
        const gameType = getLichessGameType(extractedData.time_class);
        if (selectedTimeControls.includes(gameType)) {
          processedGames.push(extractedData);
          
          // Debug logging every 50 games to track result distribution
          if (processedGames.length % 50 === 0 || i === jsonLines.length - 1) {
            const wins = processedGames.filter(g => g.result === 'win').length;
            const losses = processedGames.filter(g => g.result === 'lose').length;
            const draws = processedGames.filter(g => g.result === 'draw').length;
            console.log(`📊 After ${processedGames.length} games: ${wins} wins (${((wins/processedGames.length)*100).toFixed(1)}%), ${losses} losses (${((losses/processedGames.length)*100).toFixed(1)}%), ${draws} draws (${((draws/processedGames.length)*100).toFixed(1)}%)`);
          }
        }
      } catch (processError) {
        console.warn(`Error processing game ${i}:`, processError);
        // Continue processing other games
      }
    }
    
    // Final result summary
    const finalWins = processedGames.filter(g => g.result === 'win').length;
    const finalLosses = processedGames.filter(g => g.result === 'lose').length;
    const finalDraws = processedGames.filter(g => g.result === 'draw').length;
    
    console.log(`✅ Final Lichess results: ${finalWins} wins (${((finalWins/processedGames.length)*100).toFixed(1)}%), ${finalLosses} losses (${((finalLosses/processedGames.length)*100).toFixed(1)}%), ${finalDraws} draws (${((finalDraws/processedGames.length)*100).toFixed(1)}%)`);
    console.log(`Successfully processed ${processedGames.length} games from Lichess`);
    
    // Sort by date (most recent first) and limit to 1500 games
    return processedGames
      .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))
      .slice(0, 1500);
    
  } catch (error) {
    console.error('Failed to fetch Lichess games:', error);
    
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.warn('Network error fetching Lichess games');
      throw new Error('Network error: Unable to connect to Lichess. Please check your internet connection.');
    }
    
    // Re-throw user-friendly errors
    if (error.message.includes('Too many requests') || 
        error.message.includes('temporarily unavailable') ||
        error.message.includes('Invalid response format')) {
      throw error;
    }
    
    // For other errors, log but return empty array to allow the app to continue
    console.warn('Unexpected error fetching Lichess games, returning empty array');
    return [];
  }
};

// Mock function to backup to Google Drive
const backupToGoogleDrive = async (games, googleAccount) => {
  // Simulate Google Drive API call
  await new Promise(resolve => setTimeout(resolve, 800));
  
  console.log(`Backed up ${games.length} games to Google Drive for ${googleAccount}`);
  return { success: true, backupDate: new Date().toISOString() };
};

// Helper function to determine game type from time control
const getGameType = (timeControl) => {
  if (!timeControl) return 'unknown';
  
  if (timeControl.includes('+')) {
    const [baseTime] = timeControl.split('+');
    const minutes = parseInt(baseTime) / 60;
    
    if (minutes < 3) return 'bullet';
    if (minutes <= 10) return 'blitz';
    if (minutes <= 30) return 'rapid';
    return 'classical';
  }
  
  if (timeControl === '1/86400') return 'daily';
  
  // Fallback logic
  const seconds = parseInt(timeControl) || 0;
  const minutes = seconds / 60;
  
  if (minutes < 3) return 'bullet';
  if (minutes <= 10) return 'blitz';
  if (minutes <= 30) return 'rapid';
  if (minutes > 30) return 'classical';
  
  return 'daily';
};

// Helper function to determine Lichess game type from speed
const getLichessGameType = (speed) => {
  if (!speed) return 'unknown';
  
  switch (speed) {
    case 'bullet':
      return 'bullet';
    case 'blitz':
      return 'blitz';
    case 'rapid':
      return 'rapid';
    case 'classical':
      return 'classical';
    case 'correspondence':
      return 'correspondence';
    default:
      return 'unknown';
  }
}; 