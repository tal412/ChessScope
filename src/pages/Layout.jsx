import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
// DriveBackupSection removed - using Firebase instead
import { Network, User, Settings, Shield, RefreshCw, Loader2, Calendar as CalendarIcon, Globe, CheckCircle, AlertCircle, LogOut, ChevronLeft, ChevronRight, Github, Linkedin, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/FirebaseAuthContext";
import { useChessPlatform } from "@/contexts/ChessPlatformContext";
import { performCompleteLogout } from "@/utils/logoutUtils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SettingsLoading } from "@/components/ui/settings-loading";
import SyncingOverlay from "@/components/ui/syncing-overlay";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import BrandIcon from "@/components/ui/brand-icon";
import Spinner from "@/components/ui/spinner";

function createPageUrl(name) {
  return `/${name}`;
}

// Helper function to format last online time
const formatLastOnline = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  let date;
  
  // Handle different timestamp formats
  if (typeof timestamp === 'string') {
    // ISO string format (from Lichess)
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    // Unix timestamp
    if (timestamp < 10000000000) {
      // If it's in seconds (less than year 2286 in seconds)
      date = new Date(timestamp * 1000);
    } else {
      // Already in milliseconds
      date = new Date(timestamp);
    }
  } else {
    return 'Unknown';
  }
  
  // Check if date is valid
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

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  // Chess platform auth for main app functionality
  const { user, logout: logoutChess, isImporting, importProgress, importStatus, connectPlatform } = useChessPlatform();
  
  // Firebase auth for Studies (optional)
  const { firebaseUser, signInWithGoogle, signOutGoogle } = useAuth();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    return savedState ? JSON.parse(savedState) : false;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingOutTransition, setIsLoggingOutTransition] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [settingsSaveStarted, setSettingsSaveStarted] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [showUserContent, setShowUserContent] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    const isCollapsed = savedState ? JSON.parse(savedState) : false;
    return !isCollapsed; // Show content if sidebar is expanded
  });
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showPawnInPosition, setShowPawnInPosition] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    const isCollapsed = savedState ? JSON.parse(savedState) : false;
    return !isCollapsed; // Show pawn in position if sidebar is expanded
  });
  const [showGithubInPosition, setShowGithubInPosition] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    const isCollapsed = savedState ? JSON.parse(savedState) : false;
    return !isCollapsed; // Show github in position if sidebar is expanded
  });
  const [showLinkedinInPosition, setShowLinkedinInPosition] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    const isCollapsed = savedState ? JSON.parse(savedState) : false;
    return !isCollapsed; // Show linkedin in position if sidebar is expanded
  });

  const navigationItems = [
    { name: "Performance Graph", url: createPageUrl("PerformanceGraph"), icon: Network },
    { name: "Studies Book", url: createPageUrl("studies-book"), icon: BookOpen },
  ];

  const handleManualSync = async () => {
    // Check if we have a valid user profile
    if (!user || isImporting) {
      console.log('Cannot sync: user not available or import already in progress');
      return;
    }

    try {
      console.log('🔄 Starting manual sync for', user.platform, user.username);

      // Use the context method which properly manages isImporting state
      const result = await connectPlatform(
        user.platform,
        user.username,
        user.importSettings || {
          selectedTimeControls: user.platform === 'lichess' ?
            ['rapid', 'blitz', 'bullet', 'classical'] :
            ['rapid', 'blitz', 'bullet'],
          selectedDateRange: '3',
          customDateRange: { from: null, to: null },
          autoSyncFrequency: '1day'
        }
      );

      if (result.success) {
        console.log('✅ Manual sync completed successfully');

        // Dispatch refresh event to update the performance graph
        try {
          const event = new CustomEvent('refreshPerformanceGraph', {
            detail: { source: 'manual-sync', timestamp: Date.now() }
          });
          window.dispatchEvent(event);
          console.log('✅ Performance graph refresh event dispatched');
        } catch (error) {
          console.error('❌ Error dispatching refresh event:', error);
        }
      } else {
        console.error('❌ Manual sync failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error during manual sync:', error);
    }
  };

  const handleSettingsOpen = () => {
    setTempSettings(user?.importSettings || {});
    setIsSettingsOpen(true);
    setSettingsSaveStarted(false);
    setSettingsError('');
  };

  const handleSettingsSave = async () => {
    // Validate settings before saving
    if ((tempSettings.selectedTimeControls || []).length === 0) {
      setSettingsError('Please select at least one time control to import');
      return;
    }

    if (tempSettings.selectedDateRange === "custom" && 
        (!tempSettings.customDateRange?.from || !tempSettings.customDateRange?.to)) {
      setSettingsError('Please select both start and end dates for custom range');
      return;
    }

    try {
      console.log('🎯 Starting settings save');
      setSettingsError(''); // Clear any previous errors
      setSettingsSaveStarted(true); // Mark that save has started
      // Settings update functionality removed - would need to be reimplemented for chess platform
      console.log('Settings update not implemented in new architecture');
      handleSettingsLoadingComplete();
      
      if (result && !result.success) {
        setSettingsError(result.error || 'Failed to update settings');
        setSettingsSaveStarted(false);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      setSettingsError('Failed to update settings. Please try again.');
      setSettingsSaveStarted(false); // Reset on error
    }
  };

  const handleSettingsLoadingComplete = () => {
    console.log('🎉 Settings loading complete callback called!');
    
    // Close dialog immediately
    setIsSettingsOpen(false);
    setSettingsSaveStarted(false);
    
    // Dispatch refresh event immediately
    try {
      const event = new CustomEvent('refreshPerformanceGraph', { 
        detail: { source: 'settings', timestamp: Date.now() } 
      });
      window.dispatchEvent(event);
      console.log('✅ refreshPerformanceGraph event dispatched successfully');
    } catch (error) {
      console.error('❌ Error dispatching refresh event:', error);
    }
  };

  const handleTimeControlChange = (timeControl, checked) => {
    if (checked) {
      setTempSettings(prev => ({
        ...prev,
        selectedTimeControls: [...(prev.selectedTimeControls || []), timeControl]
      }));
    } else {
      setTempSettings(prev => ({
        ...prev,
        selectedTimeControls: (prev.selectedTimeControls || []).filter(tc => tc !== timeControl)
      }));
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setShowLogoutDialog(false); // Close dialog first
    
    try {
      // Start smooth exit transition
      setIsLoggingOutTransition(true);
      
      // Use the shared logout utility with navigation
      await performCompleteLogout(logoutChess, signOutGoogle, firebaseUser, navigate, false);
      
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
      setIsLoggingOutTransition(false);
    }
  };

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };

  // Initialize on mount
  useEffect(() => {
    setHasInitialized(true);
  }, []);

  // Handle content visibility
  useEffect(() => {
    if (!hasInitialized) return; // Wait for initialization
    
    if (!isSidebarCollapsed) {
      // Expanding - wait for sidebar animation
      const timer = setTimeout(() => {
        setShowUserContent(true);
        setShowPawnInPosition(true);
        setShowGithubInPosition(true);
        setShowLinkedinInPosition(true);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      // Collapsing - hide immediately
      setShowUserContent(false);
      setShowPawnInPosition(false);
      setShowGithubInPosition(false);
      setShowLinkedinInPosition(false);
    }
  }, [isSidebarCollapsed, hasInitialized]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className={`app-layout bg-background ${
        isLoggingOutTransition ? 'opacity-0 transform -translate-x-8 transition-all duration-200' : 'opacity-100 transform translate-x-0'
      }`}>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className={`bg-sidebar border-r border-sidebar-border h-full flex flex-col justify-between transition-[width] duration-300 relative z-20 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`} id="app-sidebar">
            <div>
              <div className={`p-4 border-b border-sidebar-border ${isSidebarCollapsed ? 'h-[89px] flex items-center justify-center' : 'p-6'}`}>
                <div className="flex items-center gap-3">
                  <BrandIcon size="sm" />
                  {!isSidebarCollapsed && (
                    <div>
                      <h1 className="text-xl font-bold text-sidebar-foreground">ChessScope</h1>
                      <p className="text-xs text-sidebar-foreground/60">Chess Analysis</p>
                    </div>
                  )}
                </div>
              </div>
              
              <nav className="p-2 space-y-2 mt-2">
                {navigationItems.map((item) => (
                  <Tooltip key={item.name} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        to={isImporting ? '#' : item.url}
                        onClick={(e) => {
                          if (isImporting) {
                            e.preventDefault();
                          }
                        }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-[transform,box-shadow] duration-200 group outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 ${
                          location.pathname === item.url
                            ? "bg-gradient-primary text-white border border-warning/50 shadow-lg shadow-warning/25"
                            : `text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent border border-transparent ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`
                        } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">{item.name}</span>}
                      </Link>
                    </TooltipTrigger>
                    {isSidebarCollapsed && (
                      <TooltipContent 
                        side="right" 
                        className="bg-popover border-border text-popover-foreground"
                        sideOffset={10}
                      >
                        <p>{item.name}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))}
              </nav>
            </div>
            
            <div className="p-4 border-t border-sidebar-border space-y-3">
              {/* User Info */}
              {user && (
                <Tooltip delayDuration={0} open={isSidebarCollapsed ? undefined : false}>
                  <TooltipTrigger asChild>
                    <div className={`bg-sidebar-accent/50 rounded-lg overflow-hidden ${isSidebarCollapsed ? 'cursor-pointer' : ''}`}>
                      <div className="p-3 h-[88px] relative">
                        {user.platform === 'lichess' ? (
                          <img 
                            src="/Lichess_Logo_2019.svg.png" 
                            alt="Lichess" 
                            className={`w-6 h-6 absolute transition-[left,top,transform] duration-300 ease-in-out ${
                              showPawnInPosition 
                                ? 'left-3 top-3' 
                                : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
                            }`} 
                          />
                        ) : (
                          <img 
                            src="/chesscom_logo_pawn.svg" 
                            alt="Chess.com" 
                            className={`w-6 h-6 absolute transition-[left,top,transform] duration-300 ease-in-out ${
                              showPawnInPosition 
                                ? 'left-3 top-3' 
                                : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
                            }`} 
                          />
                        )}
                        <div className={`text-sm transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'} pl-11`}>
                          <div className={`transition-opacity duration-300 ${showUserContent ? 'opacity-100' : 'opacity-0'}`}>
                            <span className="text-sidebar-foreground font-medium">
                              {user.username || user.chessComUsername}
                            </span>
                          </div>
                          <div className={`transition-[opacity,visibility] duration-300 ${showUserContent ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                            <p className="text-sidebar-foreground/60 text-xs leading-tight">
                              Last game: {formatLastOnline(user.lastGameTime || (user.platformUser || user.chessComUser)?.lastOnline)}
                            </p>
                            <p className="text-sidebar-foreground/60 text-xs leading-tight">
                              Games: {user.gameCount || 0}
                            </p>
                            {user.lastSync && (
                              <p className="text-sidebar-foreground/60 text-xs leading-tight">
                                Last sync: {new Date(user.lastSync).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="right" 
                    className="bg-popover border-border text-popover-foreground"
                    sideOffset={10}
                  >
                    <div className="text-sm">
                      <p className="font-medium">{user.username || user.chessComUsername}</p>
                      <p className="text-muted-foreground text-xs">
                        Last game: {formatLastOnline(user.lastGameTime || (user.platformUser || user.chessComUser)?.lastOnline)}
                      </p>
                      <p className="text-muted-foreground text-xs">Games: {user.gameCount || 0}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Separator Line */}
              {user && (
                <div className="border-t border-sidebar-border/30 my-1"></div>
              )}
              
              {/* Firebase sync status shown in page headers instead */}
              
              {/* Separator Line */}
              {user && (
                <div className="border-t border-sidebar-border/30 my-1"></div>
              )}
              
              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleManualSync}
                      disabled={isImporting}
                      size="sm"
                      variant="outline"
                      className={`border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-[transform] duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-start'}`}
                    >
                      <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isImporting ? 'animate-spin' : ''}`} />
                      {!isSidebarCollapsed && (
                        <span className="ml-2">
                          {isImporting ? 'Syncing...' : 'Sync Games'}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent
                      side="right"
                      className="bg-popover border-border text-popover-foreground"
                      sideOffset={10}
                    >
                      <p>{isImporting ? 'Syncing...' : 'Sync Games'}</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSettingsOpen}
                      disabled={isImporting}
                      size="sm"
                      variant="outline"
                      className={`border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-[transform] duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-start'}`}
                    >
                      <Settings className="w-4 h-4 flex-shrink-0" />
                      {!isSidebarCollapsed && <span className="ml-2">Settings</span>}
                    </Button>
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent 
                      side="right" 
                      className="bg-popover border-border text-popover-foreground"
                      sideOffset={10}
                    >
                      <p>Settings</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <ThemeToggle 
                      variant="outline"
                      size="sm"
                      sidebar={true}
                      collapsed={isSidebarCollapsed}
                      className="border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-[transform] duration-200"
                    />
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent 
                      side="right" 
                      className="bg-popover border-border text-popover-foreground"
                      sideOffset={10}
                    >
                      <p>Toggle Theme</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setShowLogoutDialog(true)}
                      disabled={isImporting || isLoggingOut}
                      size="sm"
                      variant="outline"
                      className={`border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-[transform] duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-start'}`}
                    >
                      {isLoggingOut ? (
                        <Spinner size="sm" className="flex-shrink-0" />
                      ) : (
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                      )}
                      {!isSidebarCollapsed && (
                        <span className="ml-2">
                          {isLoggingOut ? 'Logging out...' : 'Logout'}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent 
                      side="right" 
                      className="bg-popover border-border text-popover-foreground"
                      sideOffset={10}
                    >
                      <p>{isLoggingOut ? 'Logging out...' : 'Logout'}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
              
              {/* Community Note */}
              <div className="pt-3 border-t border-sidebar-border/30">
                <div className="min-h-[104px] relative">
                  {/* GitHub Icon with Animation */}
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <a
                        href="https://github.com/tal412/ChessScope"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`absolute w-8 h-8 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-[left,bottom,transform] duration-300 ease-in-out flex items-center justify-center group z-10 ${
                          showGithubInPosition 
                            ? 'left-1/2 bottom-3 -translate-x-[calc(100%+6px)]' 
                            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-[22px]'
                        }`}
                      >
                        <Github className="w-4 h-4 text-sidebar-foreground/70 group-hover:text-sidebar-foreground transition-colors" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      className="bg-popover border-border text-popover-foreground"
                      sideOffset={10}
                    >
                      <p>ChessScope on GitHub</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* LinkedIn Icon with Animation */}
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <a
                        href="https://www.linkedin.com/in/tal-barda412/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`absolute w-8 h-8 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-[left,bottom,transform] duration-300 ease-in-out flex items-center justify-center group z-10 ${
                          showLinkedinInPosition 
                            ? 'left-1/2 bottom-3 translate-x-[6px]' 
                            : 'left-1/2 top-1/2 -translate-x-1/2 translate-y-[22px]'
                        }`}
                      >
                        <Linkedin className="w-4 h-4 text-sidebar-foreground/70 group-hover:text-info transition-colors" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      className="bg-popover border-border text-popover-foreground"
                      sideOffset={10}
                    >
                      <p>Tal Barda on LinkedIn</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Text Content */}
                  <div className={`text-center space-y-2 p-3 transition-opacity duration-300 ${showUserContent ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="min-h-[40px] flex items-center justify-center">
                      <div>
                        <p className="text-xs text-sidebar-foreground/60">
                          Made for the community by
                        </p>
                        <p className="text-sm font-medium text-sidebar-foreground">
                          Tal Barda
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Toggle Button at Bottom */}
              <div className="pt-3 border-t border-sidebar-border/30">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleSidebar}
                      disabled={isImporting}
                      variant="ghost"
                      size="sm"
                      className={`w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-[transform] duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-center'} ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                      {isSidebarCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <>
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          <span>Collapse</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent 
                      side="right" 
                      className="bg-popover border-border text-popover-foreground"
                      sideOffset={10}
                    >
                      <p>Expand sidebar</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 h-full overflow-hidden relative">
            
            <Outlet />
            
            {/* Global Syncing Overlay */}
            <SyncingOverlay
              isVisible={isImporting}
              syncProgress={importProgress}
              syncStatus={importStatus}
              title="Syncing Games"
              subtitle="Updating your chess database with latest games. This may take a moment..."
              showProgress={true}
            />
          </div>
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={(open) => {
          // Prevent closing during import
          if (!open && isImporting) {
            return;
          }
          
          setIsSettingsOpen(open);
          if (!open) {
            setSettingsSaveStarted(false); // Reset when dialog closes
            setSettingsError(''); // Clear errors when dialog closes
          }
        }}>
          <DialogContent className="bg-card/95 backdrop-blur-optimized border-border text-card-foreground max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Import Settings</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Update your import preferences. Changes will re-import your games with new settings.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 py-6">
              {/* Time Controls */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-info rounded-lg flex items-center justify-center">
                      <Settings className="w-5 h-5 text-sidebar-foreground flex-shrink-0" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-card-foreground">Time Controls</CardTitle>
                      <p className="text-muted-foreground text-sm">Select game types to analyze</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(user?.platform === 'lichess' ? [
                    { id: 'bullet', label: 'Bullet', desc: '< 3 minutes' },
                    { id: 'blitz', label: 'Blitz', desc: '3-8 minutes' },
                    { id: 'rapid', label: 'Rapid', desc: '8-25 minutes' },
                    { id: 'classical', label: 'Classical', desc: '> 25 minutes' },
                    { id: 'correspondence', label: 'Correspondence', desc: 'Several days' }
                  ] : [
                    { id: 'bullet', label: 'Bullet', desc: '< 3 minutes' },
                    { id: 'blitz', label: 'Blitz', desc: '3-10 minutes' },
                    { id: 'rapid', label: 'Rapid', desc: '10-30 minutes' },
                    { id: 'daily', label: 'Daily', desc: 'Correspondence' }
                  ]).map((timeControl) => (
                    <div key={timeControl.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent/30 transition-colors">
                      <Checkbox
                        id={`settings-${timeControl.id}`}
                        checked={(tempSettings.selectedTimeControls || []).includes(timeControl.id)}
                        onCheckedChange={(checked) => handleTimeControlChange(timeControl.id, checked)}
                        className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        disabled={isImporting}
                      />
                      <div className="flex-1">
                        <label htmlFor={`settings-${timeControl.id}`} className="text-foreground font-medium cursor-pointer">
                          {timeControl.label}
                        </label>
                        <p className="text-muted-foreground text-xs">{timeControl.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Date Range */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success rounded-lg flex items-center justify-center">
                      <CalendarIcon className="w-5 h-5 text-foreground flex-shrink-0" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-card-foreground">Date Range</CardTitle>
                      <p className="text-muted-foreground text-sm">Configure data range</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-foreground font-medium">Date Range</Label>
                    <Select 
                      value={tempSettings.selectedDateRange || '3'} 
                      onValueChange={(value) => setTempSettings(prev => ({...prev, selectedDateRange: value}))}
                      disabled={isImporting}
                    >
                      <SelectTrigger className="bg-input border-border text-foreground disabled:opacity-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="1">Last 1 month</SelectItem>
                        <SelectItem value="2">Last 2 months</SelectItem>
                        <SelectItem value="3">Last 3 months</SelectItem>
                        <SelectItem value="6">Last 6 months</SelectItem>
                        <SelectItem value="custom">Custom range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {tempSettings.selectedDateRange === "custom" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-foreground text-sm font-medium">From</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={isImporting}
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent disabled:opacity-50",
                                  !tempSettings.customDateRange?.from && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                                {tempSettings.customDateRange?.from ? (
                                  format(tempSettings.customDateRange.from, "MMM yyyy")
                                ) : (
                                  "Pick date"
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                              <Calendar
                                mode="single"
                                selected={tempSettings.customDateRange?.from}
                                onSelect={(date) => setTempSettings(prev => ({
                                  ...prev, 
                                  customDateRange: { ...prev.customDateRange, from: date }
                                }))}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                                className="bg-popover"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-foreground text-sm font-medium">To</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={isImporting}
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent disabled:opacity-50",
                                  !tempSettings.customDateRange?.to && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                                {tempSettings.customDateRange?.to ? (
                                  format(tempSettings.customDateRange.to, "MMM yyyy")
                                ) : (
                                  "Pick date"
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                              <Calendar
                                mode="single"
                                selected={tempSettings.customDateRange?.to}
                                onSelect={(date) => setTempSettings(prev => ({
                                  ...prev, 
                                  customDateRange: { ...prev.customDateRange, to: date }
                                }))}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                                className="bg-popover"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Auto-Sync Settings */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-info rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-white flex-shrink-0" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-card-foreground">Sync Settings</CardTitle>
                      <p className="text-muted-foreground text-sm">Configure auto-sync</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-foreground font-medium">Auto-Sync Frequency</Label>
                      <p className="text-muted-foreground text-xs">How often to check for and import new games</p>
                    </div>
                    <Select 
                      value={tempSettings.autoSyncFrequency || '1day'} 
                      onValueChange={(value) => setTempSettings(prev => ({...prev, autoSyncFrequency: value}))}
                      disabled={isImporting}
                    >
                      <SelectTrigger className="bg-input border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="never">Never (Manual only)</SelectItem>
                        <SelectItem value="visit">Every visit</SelectItem>
                        <SelectItem value="5min">Every 5 minutes</SelectItem>
                        <SelectItem value="30min">Every 30 minutes</SelectItem>
                        <SelectItem value="1hour">Every hour</SelectItem>
                        <SelectItem value="3hours">Every 3 hours</SelectItem>
                        <SelectItem value="1day">Daily</SelectItem>
                        <SelectItem value="1week">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-foreground font-medium mb-1">Current Settings</p>
                        <p className="text-muted-foreground text-xs">
                          Game limit: 1500 games (fixed)
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Time controls: {(tempSettings.selectedTimeControls || []).join(', ') || 'None selected'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Date range: {tempSettings.selectedDateRange === 'custom' ? 'Custom' : `${tempSettings.selectedDateRange || '3'} months`}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Auto-sync: {(() => {
                            const freq = tempSettings.autoSyncFrequency || '1day';
                            const freqLabels = {
                              'never': 'Disabled',
                              'visit': 'Every visit',
                              '5min': 'Every 5 minutes',
                              '30min': 'Every 30 minutes', 
                              '1hour': 'Every hour',
                              '3hours': 'Every 3 hours',
                              '1day': 'Daily',
                              '1week': 'Weekly'
                            };
                            return freqLabels[freq] || freq;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Validation */}
            {settingsError && (
              <Alert className="status-error border">
                <AlertCircle className="h-4 w-4 text-error" />
                <AlertDescription className="text-error">
                  {settingsError}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="min-h-[72px] flex items-center">
              <SettingsLoading 
                isLoading={isImporting}
                progress={importProgress}
                status={importStatus}
                onComplete={handleSettingsLoadingComplete}
                className="w-full"
                showButtons={!isImporting}
                buttonText="Save & Re-import Games"
                loadingText="Updating..."
                onButtonClick={handleSettingsSave}
                buttonDisabled={(tempSettings.selectedTimeControls || []).length === 0 || 
                              (tempSettings.selectedDateRange === "custom" && (!tempSettings.customDateRange?.from || !tempSettings.customDateRange?.to))}
                successMessage="Settings Updated Successfully!"
                error={settingsError}
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent className="bg-card/95 backdrop-blur-optimized border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl text-card-foreground">Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to logout? This will clear your session, sign you out of Firebase, and return you to the main page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bg-error hover:bg-error/90 text-error-foreground disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Logging out...
                  </>
                ) : (
                  'Logout'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </TooltipProvider>
  );
}
