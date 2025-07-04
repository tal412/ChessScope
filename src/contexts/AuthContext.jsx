import { createContext, useContext, useState, useEffect } from 'react';
import { extractGameData } from '../components/chess/PgnParser';
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

  const login = async (chessComUsername, importSettings = null, googleAccount = null) => {
    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus('Verifying Chess.com account...');
      
      // Simulate Chess.com account verification
      const chessComUser = await verifyChessComAccount(chessComUsername);
      
      setImportProgress(10);
      setImportStatus('Account verified! Starting import...');
      
      const userData = {
        chessComUsername,
        chessComUser,
        googleAccount,
        importSettings: importSettings || {
          selectedTimeControls: ['rapid', 'blitz', 'bullet'],
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
      
      // Get username before clearing auth data for IndexedDB cleanup
      const currentUsername = user?.chessComUsername;
      
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
        if (currentUsername) {
          try {
            await deleteOpeningGraph(currentUsername.toLowerCase());
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
      console.log('Starting sync for user:', userData.chessComUsername);
      
      // Fetch latest games from Chess.com (lightweight sync)
      const latestGames = await fetchChessComGames(userData.chessComUsername, userData.importSettings);
      
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
        const games = await fetchChessComGames(user.chessComUsername, user.importSettings);
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
    const { chessComUsername, importSettings } = userData;
    const {
      selectedTimeControls = ['rapid', 'blitz', 'bullet'],
      selectedDateRange = '3',
      customDateRange = { from: null, to: null }
    } = importSettings;

    try {
      setImportProgress(15);
      setImportStatus('Fetching game archives...');

      const response = await fetch(`https://api.chess.com/pub/player/${chessComUsername}/games/archives`);
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
      const TARGET_GAMES = 1500; // Hard limit
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
      const recentTargetedGames = targetedGames
        .slice(-TARGET_GAMES)
        .reverse(); // Process newest first
      
      setImportProgress(50);
      setImportStatus('Clearing previous data and creating new opening graph...');

      // Clear any existing graph data first (fresh start)
      try {
        await deleteOpeningGraph(chessComUsername.toLowerCase());
      } catch (error) {
        // Ignore if no existing graph to delete
      }

      // Create a completely new OpeningGraph
      const openingGraph = new OpeningGraph(chessComUsername.toLowerCase());
      
      setImportStatus(`Processing ${recentTargetedGames.length} games into new opening graph...`);

      const totalGames = recentTargetedGames.length;
      
      // Process games one at a time with proper UI yielding
      for (let i = 0; i < totalGames; i++) {
        const game = recentTargetedGames[i];
        const gameData = extractGameData(game, chessComUsername);
        
        if (gameData) {
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
      
      // Store the username in localStorage
      localStorage.setItem('chesscope_username', chessComUsername.toLowerCase());

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