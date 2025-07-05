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

// Helper function to check if auto-sync should happen based on frequency setting
const shouldAutoSync = (user) => {
  if (!user || !user.importSettings) return false;
  
  const frequency = user.importSettings.autoSyncFrequency || '1hour';
  
  // Never sync
  if (frequency === 'never') return false;
  
  // Always sync on visit
  if (frequency === 'visit') return true;
  
  // Check time-based frequencies
  const lastSync = user.lastSync;
  if (!lastSync) return true; // First time, always sync
  
  const lastSyncTime = new Date(lastSync);
  const now = new Date();
  const timeDiff = now - lastSyncTime;
  
  const frequencies = {
    '5min': 5 * 60 * 1000,        // 5 minutes
    '30min': 30 * 60 * 1000,      // 30 minutes
    '1hour': 60 * 60 * 1000,      // 1 hour
    '3hours': 3 * 60 * 60 * 1000, // 3 hours
    '1day': 24 * 60 * 60 * 1000,  // 1 day
    '1week': 7 * 24 * 60 * 60 * 1000 // 1 week
  };
  
  const interval = frequencies[frequency];
  return interval && timeDiff >= interval;
};

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
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [user, setUser] = useState(null);
  const [pendingAutoSync, setPendingAutoSync] = useState(null);

  useEffect(() => {
    // Check for existing authentication on app start
    const savedAuth = localStorage.getItem('chessScope_auth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        setUser(authData.user);
        setIsAuthenticated(true);
        // Mark that we need to auto-sync based on frequency, but don't do it yet
        if (shouldAutoSync(authData.user)) {
          setPendingAutoSync(authData.user);
        }
      } catch (error) {
        console.error('Error parsing saved auth:', error);
        localStorage.removeItem('chessScope_auth');
      }
    }
    setIsLoading(false);
  }, []);

  // Handle auto-sync in a separate effect after component is fully initialized
  useEffect(() => {
    if (pendingAutoSync && !isLoading && !isSyncing) {
      // Delay auto-sync to ensure UI is responsive
      const syncTimer = setTimeout(async () => {
        console.log('🔄 Starting delayed auto-sync...');
        try {
          // Use callback pattern to ensure we have current state
          setIsSyncing(true);
          
          const syncUserData = {
            ...pendingAutoSync,
                    importSettings: pendingAutoSync.importSettings || {
          selectedTimeControls: pendingAutoSync.platform === 'lichess' ? 
            ['rapid', 'blitz', 'bullet', 'classical'] : 
            ['rapid', 'blitz', 'bullet'],
          selectedDateRange: '3',
          customDateRange: { from: null, to: null },
          autoSyncFrequency: '1hour'
        }
          };
          
          // Use a silent version that doesn't update UI progress
          const result = await importGamesSilently(syncUserData);
          
          // Update user's last sync time, game count, and last game time
          const updatedUser = {
            ...pendingAutoSync,
            lastSync: new Date().toISOString(),
            gameCount: result.gameCount,
            lastGameTime: result.lastGameTime
          };
          
          setUser(updatedUser);
          localStorage.setItem('chessScope_auth', JSON.stringify({ user: updatedUser }));
          
          console.log('✅ Auto-sync completed successfully - opening graph rebuilt');
          console.log(`🎮 Updated last game time: ${updatedUser.lastGameTime ? new Date(updatedUser.lastGameTime).toLocaleString() : 'Unknown'}`);
        } catch (e) {
          console.error('Auto-sync on startup failed:', e);
        } finally {
          setIsSyncing(false);
          setPendingAutoSync(null);
        }
      }, 50); // Very short delay to allow UI to settle while starting sync quickly

      return () => clearTimeout(syncTimer);
    }
  }, [pendingAutoSync, isLoading, isSyncing]);

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
          autoSyncFrequency: '1hour'
        },
        loginTime: new Date().toISOString(),
        lastSync: null
      };

      // Initialize graph database
      await initGraphDB();
      
      // Import games and build graph with progress tracking
      const importResult = await importGamesWithProgress(userData);
      userData.gameCount = importResult.gameCount;
      userData.lastGameTime = importResult.lastGameTime;
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

  const logout = async (delay = 0) => {
    try {
      console.log('🔄 Starting comprehensive logout cleanup...');
      
      // Get platform-specific identifier before clearing auth data for IndexedDB cleanup
      const currentIdentifier = user?.platform ? `${user.platform}:${user.username}`.toLowerCase() : user?.chessComUsername?.toLowerCase();
      
      // If delay is specified, wait before clearing data (for smooth transitions)
      if (delay > 0) {
        console.log(`⏳ Waiting ${delay}ms for smooth transition...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
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
    setSyncProgress(0);
    setSyncStatus('Starting sync...');
    try {
      console.log('Starting sync for user:', userData.username, 'on platform:', userData.platform);
      
      // Use a silent import process for sync (no UI progress updates)
      console.log('🔄 Auto-sync: Rebuilding opening graph with latest games...');
      
      // Create a temporary userData object for the import process
      const syncUserData = {
        ...userData,
        importSettings: userData.importSettings || {
          selectedTimeControls: userData.platform === 'lichess' ? 
            ['rapid', 'blitz', 'bullet', 'classical'] : 
            ['rapid', 'blitz', 'bullet'],
          selectedDateRange: '3',
          customDateRange: { from: null, to: null },
          autoSyncFrequency: '1hour'
        }
      };
      
      // Use a silent version that doesn't update UI progress
      const result = await importGamesSilently(syncUserData);
      
      // Update user's last sync time, game count, and last game time
      const updatedUser = {
        ...userData,
        lastSync: new Date().toISOString(),
        gameCount: result.gameCount,
        lastGameTime: result.lastGameTime
      };
      
      setUser(updatedUser);
      localStorage.setItem('chessScope_auth', JSON.stringify({ user: updatedUser }));
      
      console.log('✅ Auto-sync completed successfully - opening graph rebuilt');
      console.log(`🎮 Updated last game time: ${updatedUser.lastGameTime ? new Date(updatedUser.lastGameTime).toLocaleString() : 'Unknown'}`);
      
      return result.gameCount;
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
      setSyncStatus('');
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
      const importResult = await importGamesWithProgress(updatedUser);
      updatedUser.gameCount = importResult.gameCount;
      updatedUser.lastGameTime = importResult.lastGameTime;
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
      setImportProgress(5);
      setImportStatus('Connecting to server...');

      let recentTargetedGames = [];
      const TARGET_GAMES = 1500; // Hard limit
      
      // Progress callback for fetch operations
      const handleFetchProgress = (progressData) => {
        const { phase, progress, status } = progressData;
        
        // During fetch phase, progress goes from 5% to 45%
        if (phase === 'download' || phase === 'parsing') {
          const adjustedProgress = 5 + (progress / 45) * 40; // Map 0-45% to 5-45%
          setImportProgress(adjustedProgress);
          setImportStatus(status);
        }
      };
      
      if (platform === 'lichess') {
        // Lichess direct API approach with progress tracking
        const games = await fetchLichessGames(username, importSettings, handleFetchProgress);
        recentTargetedGames = games.slice(0, TARGET_GAMES);
        
        setImportProgress(45);
        setImportStatus(`Found ${recentTargetedGames.length} games from Lichess...`);
        
      } else {
        // Chess.com archive-based approach with progress tracking
        const games = await fetchChessComGames(username, importSettings, handleFetchProgress);
        recentTargetedGames = games.slice(0, TARGET_GAMES);
        
        setImportProgress(45);
        setImportStatus(`Found ${recentTargetedGames.length} games from Chess.com...`);
      }
      
      // Small pause to show the found games status
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      
      // Reset debug tracking for this import session
      window.gameResults = { wins: 0, losses: 0, draws: 0, total: 0 };
      
      // Track if we're running in background for logging
      let wasInBackground = false;
      
      // Process games one at a time with proper UI yielding
      for (let i = 0; i < totalGames; i++) {
        const game = recentTargetedGames[i];
        let gameData;
        
        // Log background execution for user awareness
        if (document.hidden && !wasInBackground) {
          console.log('📱 Import continues in background - feel free to switch tabs!');
          wasInBackground = true;
        } else if (!document.hidden && wasInBackground) {
          console.log('👁️ Welcome back! Import was running in background and is still processing...');
          wasInBackground = false;
        }
        
        // DEBUG: Log the actual Chess.com game structure
        if (platform === 'chess.com' && i === 0) {
          console.log('🔍 DEBUG AuthContext - First Chess.com game structure:', {
            game,
            keys: Object.keys(game),
            hasWhite: !!game.white,
            hasBlack: !!game.black,
            whiteResult: game.white?.result,
            blackResult: game.black?.result,
            sample: JSON.stringify(game).substring(0, 200)
          });
          // Log the full game object to see its structure
          console.log('📋 Full first Chess.com game object:', game);
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
          
          // DEBUG: Check Chess.com processing results
          if (i === 0 || i === 50 || i === 100) {
            console.log(`🎲 DEBUG Chess.com Game ${i} processing:`, {
              player_color: gameData?.player_color,
              white_username: gameData?.white_username,
              black_username: gameData?.black_username,
              input_username: username,
              result: gameData?.result,
              white_result: game.white?.result,
              black_result: game.black?.result
            });
          }
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
        
        // Update progress: 50% to 90% for processing (smooth single-game updates)
        const progressPercent = 50 + ((i + 1) / totalGames) * 40;
        setImportProgress(progressPercent);
        setImportStatus(`Building graph: ${i + 1}/${totalGames} games processed`);
        
        // Debug logging for result distribution tracking (every 50 games)
        if ((i + 1) % 50 === 0 || i === totalGames - 1) {
          if (window.gameResults) {
            const { wins, losses, draws, total } = window.gameResults;
            console.log(`📊 After ${total} ${platform} games: ${wins} wins (${((wins/total)*100).toFixed(1)}%), ${losses} losses (${((losses/total)*100).toFixed(1)}%), ${draws} draws (${((draws/total)*100).toFixed(1)}%)`);
          }
        }
        
        // Better yielding for UI responsiveness
        if (i % 10 === 0) { // Every 10 games
          // Use requestIdleCallback for better scheduling if available
          if (typeof requestIdleCallback !== 'undefined') {
            await new Promise(resolve => {
              requestIdleCallback(() => resolve(), { timeout: 50 });
            });
          } else {
            // Fallback with longer delay
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
        // Extra yield every 50 games
        if (i % 50 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }

      setImportProgress(95);
      setImportStatus('Saving opening graph...');

      // Save the complete graph
      await saveOpeningGraph(openingGraph);
      
      // Store the platform-specific username in localStorage
      localStorage.setItem('chesscope_username', identifier);

      const stats = openingGraph.getOverallStats();
      const totalPositions = stats.white.totalPositions + stats.black.totalPositions;
      
      // Smooth transition to 100% (background-friendly)
      setImportProgress(98);
      
      // Check if tab is visible for UI animations
      const isTabVisible = !document.hidden;
      
      if (isTabVisible) {
        await new Promise(resolve => setTimeout(resolve, 150));
        setImportProgress(100);
        setImportStatus(`Graph built with ${totalPositions} unique positions!`);
        
        // Hold at 100% briefly so user can see it
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Wait for the Done animation (800ms) before cleanup
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        // Background mode - skip UI animations, complete immediately
        setImportProgress(100);
        setImportStatus(`Graph built with ${totalPositions} unique positions!`);
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
  };

  // Silent import function for background sync (no UI progress updates)
  const importGamesSilently = async (userData) => {
    const { platform, username, importSettings } = userData;
    const {
      selectedTimeControls = platform === 'lichess' ? 
        ['rapid', 'blitz', 'bullet', 'classical'] : 
        ['rapid', 'blitz', 'bullet'],
      selectedDateRange = '3',
      customDateRange = { from: null, to: null }
    } = importSettings;

    try {
      setSyncStatus('Connecting to server...');
      setSyncProgress(5);
      
      console.log('🔄 Silent import: Fetching games...');

      let recentTargetedGames = [];
      const TARGET_GAMES = 1500; // Hard limit
      
      // Allow UI to update before starting heavy work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Progress callback for fetch operations
      const handleFetchProgress = (progressData) => {
        const { phase, progress, status } = progressData;
        
        // During fetch phase, progress goes from 5% to 45%
        if (phase === 'download' || phase === 'parsing') {
          const adjustedProgress = 5 + (progress / 45) * 40; // Map 0-45% to 5-45%
          setSyncProgress(adjustedProgress);
          setSyncStatus(status);
        }
      };
      
      if (platform === 'lichess') {
        // Lichess direct API approach with progress tracking
        const games = await fetchLichessGames(username, importSettings, handleFetchProgress);
        recentTargetedGames = games.slice(0, TARGET_GAMES);
        
        setSyncProgress(45);
        setSyncStatus(`Found ${recentTargetedGames.length} games from Lichess...`);
        console.log(`🔄 Silent import: Found ${recentTargetedGames.length} games from Lichess`);
        
      } else {
        // Chess.com archive-based approach with progress tracking
        const games = await fetchChessComGames(username, importSettings, handleFetchProgress);
        recentTargetedGames = games.slice(0, TARGET_GAMES);
        
        setSyncProgress(45);
        setSyncStatus(`Found ${recentTargetedGames.length} games from Chess.com...`);
        console.log(`🔄 Silent import: Found ${recentTargetedGames.length} games from Chess.com`);
      }
      
      // Small pause to show the found games status
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSyncProgress(50);
      setSyncStatus('Clearing previous data and creating new opening graph...');
      
      console.log('🔄 Silent import: Creating new opening graph...');

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
      
      setSyncStatus(`Processing ${recentTargetedGames.length} games into new opening graph...`);
      console.log(`🔄 Silent import: Processing ${recentTargetedGames.length} games...`);

      const totalGames = recentTargetedGames.length;
      
      // Process games one at a time with maximum UI responsiveness
      for (let i = 0; i < totalGames; i++) {
        const game = recentTargetedGames[i];
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
        }
        
        // Update progress much more frequently for better UX
        if ((i + 1) % 10 === 0 || i === totalGames - 1 || i === 0) {
          // Progress goes from 50% to 95% during game processing
          const gameProgress = ((i + 1) / totalGames) * 45; // 0-45% for games
          const totalProgress = Math.round(50 + gameProgress); // Add to base 50%
          setSyncProgress(totalProgress);
          
          // Update status every 50 games or at completion
          if ((i + 1) % 50 === 0 || i === totalGames - 1) {
            setSyncStatus(`Processing games: ${i + 1}/${totalGames} complete...`);
          }
        }
        
        // Log progress every 100 games
        if ((i + 1) % 100 === 0 || i === totalGames - 1) {
          console.log(`🔄 Silent import: Processed ${i + 1}/${totalGames} games`);
        }
        
        // Yield to UI thread after every single game for maximum responsiveness
        await new Promise(resolve => {
          if (typeof requestIdleCallback !== 'undefined') {
            // Use requestIdleCallback for optimal scheduling
            requestIdleCallback(() => resolve(), { timeout: 32 });
          } else {
            // Short timeout for immediate yielding
            setTimeout(resolve, 5);
          }
        });
        
        // Extra yield every 25 games for heavy processing
        if ((i + 1) % 25 === 0) {
          await new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(() => resolve(), { timeout: 100 });
            } else {
              setTimeout(resolve, 50);
            }
          });
        }
      }

      setSyncProgress(95);
      setSyncStatus('Finalizing sync and saving opening graph...');
      console.log('🔄 Silent import: Saving opening graph...');

      // Save the complete graph
      await saveOpeningGraph(openingGraph);
      
      setSyncProgress(100);
      setSyncStatus('Sync completed successfully!');
      
      // Store the platform-specific username in localStorage
      localStorage.setItem('chesscope_username', identifier);

      const stats = openingGraph.getOverallStats();
      const totalPositions = stats.white.totalPositions + stats.black.totalPositions;
      
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
      
      console.log(`✅ Silent import completed: ${totalPositions} unique positions built`);
      console.log(`🎮 Last game time: ${lastGameTime ? new Date(lastGameTime).toLocaleString() : 'Unknown'}`);
      
      return { gameCount: recentTargetedGames.length, lastGameTime };

    } catch (error) {
      console.error('Silent import error:', error);
      throw error;
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    isSyncing,
    syncProgress,
    syncStatus,
    isImporting,
    importProgress,
    importStatus,
    user,
    pendingAutoSync,
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
const fetchChessComGames = async (username, importSettings = {}, onProgress = null) => {
  try {
    const {
      selectedTimeControls = ['rapid', 'blitz', 'bullet'],
      selectedDateRange = '3',
      customDateRange = { from: null, to: null }
    } = importSettings;

    let games = [];
    const currentDate = new Date();
    
    // Report initial fetch start
    if (onProgress) {
      onProgress({ phase: 'download', progress: 0, status: 'Fetching archive list from Chess.com...' });
    }
    
    // Calculate date range for Chess.com API (similar to Lichess)
    let targetStartDate = null;
    let targetEndDate = null;
    
    if (selectedDateRange === "custom") {
      if (customDateRange.from && customDateRange.to) {
        targetStartDate = new Date(customDateRange.from);
        targetEndDate = new Date(customDateRange.to);
      }
    } else {
      // For preset ranges (1, 2, 3, 6 months), calculate the actual date range
      const monthsBack = parseInt(selectedDateRange);
      if (!isNaN(monthsBack) && monthsBack > 0) {
        targetStartDate = new Date();
        targetStartDate.setMonth(currentDate.getMonth() - monthsBack);
        targetEndDate = new Date(); // Up to current date
      }
    }
    
    // First, get the archives list
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
    
    // Fetch games from multiple months
    let archivesProcessed = 0;
    for (let i = 0; i < recentArchives.length && games.length < 1500; i++) {
      const archiveUrl = recentArchives[recentArchives.length - 1 - i]; // Start from most recent
      
      try {
        if (onProgress) {
          const archiveProgress = 5 + (archivesProcessed / recentArchives.length) * 35; // 5% to 40%
          onProgress({ 
            phase: 'download', 
            progress: archiveProgress,
            status: `Downloading archive ${archivesProcessed + 1}/${recentArchives.length}...`
          });
        }
        
        const gamesResponse = await fetch(archiveUrl);
        
        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          const monthGames = gamesData.games || [];
          
          // Filter games by selected time controls and date range as we fetch
          const filteredMonthGames = monthGames
            .filter(game => game.rules === "chess")
            .filter(game => {
              const timeControl = game.time_control;
              const gameType = getGameType(timeControl);
              return selectedTimeControls.includes(gameType);
            })
            .filter(game => {
              // Additional date filtering within the archive
              if (targetStartDate && targetEndDate) {
                const gameDate = new Date(game.end_time * 1000); // Convert from Unix timestamp
                return gameDate >= targetStartDate && gameDate <= targetEndDate;
              }
              return true; // No date filtering if no range specified
            });
          
          games = [...games, ...filteredMonthGames];
          
          archivesProcessed++;
          
          if (onProgress) {
            const dateRangeText = targetStartDate && targetEndDate ? 
              ` (${targetStartDate.toISOString().split('T')[0]} to ${targetEndDate.toISOString().split('T')[0]})` : 
              '';
            onProgress({ 
              phase: 'download', 
              progress: 5 + (archivesProcessed / recentArchives.length) * 35,
              status: `Found ${games.length} ${selectedTimeControls.join('/')} games${dateRangeText}...`
            });
          }
          
          // Break early if we have enough games
          if (games.length >= 1500) {
            break;
          }
        }
        
        // Delay to prevent API rate limiting and yield to UI
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (archiveError) {
        console.warn(`Failed to fetch archive ${archiveUrl}:`, archiveError);
        archivesProcessed++;
      }
    }
    
    // Report parsing phase
    if (onProgress) {
      onProgress({ 
        phase: 'parsing', 
        progress: 40, 
        status: `Processing ${games.length} games...` 
      });
    }
    
    // Sort and limit games
    const finalGames = games
      .slice(-1500) // Hard limit of 1500 games
      .sort((a, b) => b.end_time - a.end_time); // Most recent first
    
    // Process and return the games
    const processedGames = finalGames.map((game, index) => {
      // Report parsing progress periodically
      if (onProgress && index % 50 === 0) {
        const parseProgress = 40 + (index / finalGames.length) * 5; // 40% to 45%
        onProgress({ 
          phase: 'parsing', 
          progress: parseProgress,
          status: `Processing game ${index}/${finalGames.length}...`
        });
      }
      
      return {
        id: game.uuid || index,
        white: game.white, // Keep full white object with result property
        black: game.black, // Keep full black object with result property
        date: new Date(game.end_time * 1000).toISOString(),
        timeControl: game.time_control,
        gameType: getGameType(game.time_control),
        url: game.url,
        pgn: game.pgn,
        time_control: game.time_control,
        end_time: game.end_time,
        rated: game.rated,
        time_class: game.time_class,
        rules: game.rules || "chess"
      };
    });
    
    if (onProgress) {
      onProgress({ 
        phase: 'complete', 
        progress: 45, 
        status: `Downloaded ${processedGames.length} games from Chess.com` 
      });
    }
    
    return processedGames;
  } catch (error) {
    console.error('Failed to fetch Chess.com games:', error);
    // Return empty array on error rather than throwing
    return [];
  }
};

// Function to fetch recent Lichess games
const fetchLichessGames = async (username, importSettings = {}, onProgress = null) => {
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
    let sinceDate = null;
    let untilDate = null;
    
    try {
      if (selectedDateRange === "custom") {
        if (customDateRange.from && customDateRange.to) {
          sinceDate = new Date(customDateRange.from);
          untilDate = new Date(customDateRange.to);
          
          // Validate date range
          if (sinceDate >= untilDate) {
            console.warn('Invalid date range: start date must be before end date');
            sinceDate = null;
            untilDate = null;
          }
        }
      } else if (selectedDateRange && selectedDateRange !== "all") {
        // For preset ranges (1, 2, 3 months), only set the since date
        const monthsBack = parseInt(selectedDateRange);
        if (!isNaN(monthsBack) && monthsBack > 0) {
          sinceDate = new Date();
          sinceDate.setMonth(currentDate.getMonth() - monthsBack);
        }
      }
    } catch (dateError) {
      console.warn('Error processing date range:', dateError);
      sinceDate = null;
      untilDate = null;
    }
    
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
    
    // Only add date filters if they exist
    const timeSinceFilter = sinceDate ? `&since=${sinceDate.getTime()}` : '';
    const timeUntilFilter = untilDate ? `&until=${untilDate.getTime() + (24 * 60 * 60 * 1000)}` : '';
    
    const apiUrl = `${lichessBaseURL}${playerNameFilter}?max=1500${ratedFilter}${perfFilter}${timeSinceFilter}${timeUntilFilter}`;
    
    console.log('Fetching Lichess games from:', apiUrl);
    
    // Report initial download start
    if (onProgress) {
      onProgress({ phase: 'download', progress: 0, status: 'Connecting to Lichess...' });
    }
    
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
    
    // Get content length if available for progress tracking
    const contentLength = response.headers.get('content-length');
    let receivedLength = 0;
    
    // Report download started
    if (onProgress) {
      onProgress({ phase: 'download', progress: 5, status: 'Downloading games from Lichess...' });
    }
    
    // Read the response as a stream for progress tracking
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunks = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      // Calculate and report download progress
      if (onProgress) {
        if (contentLength) {
          // If we know the total size, show accurate progress
          const downloadPercent = Math.min((receivedLength / contentLength) * 100, 95);
          onProgress({ 
            phase: 'download', 
            progress: 5 + downloadPercent * 0.35, // 5% to 40% of total
            status: `Downloading games: ${Math.round(receivedLength / 1024)}KB...`
          });
        } else {
          // If no content length, show data received
          onProgress({ 
            phase: 'download', 
            progress: Math.min(5 + (receivedLength / (1024 * 100)) * 30, 35), // Estimate based on typical size
            status: `Downloading games: ${Math.round(receivedLength / 1024)}KB received...`
          });
        }
      }
    }
    
    // Combine chunks and decode
    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }
    
    const text = decoder.decode(chunksAll);
    
    // Check if response is empty (no games)
    if (!text || text.trim().length === 0) {
      console.info(`No games found for user ${username} in the specified date range`);
      return [];
    }
    
    // Report parsing start
    if (onProgress) {
      onProgress({ phase: 'parsing', progress: 40, status: 'Parsing downloaded games...' });
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
        
        // Report parsing progress
        if (onProgress && i % 20 === 0) {
          const parsePercent = (i / jsonLines.length) * 100;
          onProgress({ 
            phase: 'parsing', 
            progress: 40 + parsePercent * 0.05, // 40% to 45% of total
            status: `Parsing games: ${i}/${jsonLines.length}...`
          });
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