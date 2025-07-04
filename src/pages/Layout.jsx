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
import { Network, User, Settings, Shield, RefreshCw, Loader2, Calendar as CalendarIcon, Globe, CheckCircle, AlertCircle, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SettingsLoading } from "@/components/ui/settings-loading";

function createPageUrl(name) {
  return `/${name}`;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, syncUserData, updateImportSettings, isSyncing, isImporting, importProgress, importStatus } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [settingsSaveStarted, setSettingsSaveStarted] = useState(false);

  const navigationItems = [
    { name: "Performance Graph", url: createPageUrl("PerformanceGraph"), icon: Network },
  ];

  const handleManualSync = async () => {
    if (isSyncing) return;
    try {
      await syncUserData(user);
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const handleSettingsOpen = () => {
    setTempSettings(user?.importSettings || {});
    setIsSettingsOpen(true);
    setSettingsSaveStarted(false);
  };

  const handleSettingsSave = async () => {
    try {
      console.log('🎯 Starting settings save');
      setSettingsSaveStarted(true); // Mark that save has started
      await updateImportSettings(tempSettings, handleSettingsLoadingComplete); // Add callback back
    } catch (error) {
      console.error('Failed to update settings:', error);
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
      await logout();
      // Force navigation to main page with full page reload
      window.location.href = "/";
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="app-layout bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className={`bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 h-full flex flex-col justify-between transition-all duration-300 relative z-20 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`} id="app-sidebar">
            <div>
              <div className={`p-4 border-b border-slate-700/50 ${isSidebarCollapsed ? 'h-[89px] flex items-center justify-center' : 'p-6'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Shield className="w-6 h-6 text-slate-900" />
                    </div>
                    {!isSidebarCollapsed && (
                      <div>
                        <h1 className="text-xl font-bold text-white">ChessScope</h1>
                        <p className="text-xs text-slate-400">Opening Analysis</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Toggle Button */}
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                                             <Button
                         onClick={toggleSidebar}
                         variant="ghost"
                         size="sm"
                         className="text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200 p-2"
                         title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                       >
                         {isSidebarCollapsed ? (
                           <ChevronRight className="w-4 h-4" />
                         ) : (
                           <ChevronLeft className="w-4 h-4" />
                         )}
                       </Button>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      className="bg-slate-800 border-slate-700 text-white"
                      sideOffset={10}
                    >
                      <p>{isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              
              <nav className="p-2 space-y-2 mt-2">
                {navigationItems.map((item) => (
                  <Tooltip key={item.name} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.url}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 ${
                          location.pathname === item.url
                            ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30"
                            : "text-slate-300 hover:text-white hover:bg-slate-700/50 border border-transparent"
                        } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">{item.name}</span>}
                      </Link>
                    </TooltipTrigger>
                    {isSidebarCollapsed && (
                      <TooltipContent 
                        side="right" 
                        className="bg-slate-800 border-slate-700 text-white"
                        sideOffset={10}
                      >
                        <p>{item.name}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))}
              </nav>
            </div>
            
            <div className="p-4 border-t border-slate-700/50 space-y-3">
              {/* User Info */}
              {!isSidebarCollapsed && user && (
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <img src="/chesscom_logo_pawn.svg" alt="Pawn icon" className="w-6 h-6" />
                      <span className="text-white font-medium">{user.chessComUsername}</span>
                    </div>
                    <p className="text-slate-400 text-xs mb-1">
                      {user.chessComUser?.rating ? 
                        `${user.chessComUser.rating} (${user.chessComUser.gameType})` : 
                        'Loading...'
                      }
                    </p>
                    <p className="text-slate-400 text-xs">
                      Games: {user.gameCount || 0}
                    </p>
                    {user.lastSync && (
                      <p className="text-slate-400 text-xs">
                        Last sync: {new Date(user.lastSync).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleManualSync}
                      disabled={isSyncing || isImporting}
                      size="sm"
                      variant="outline"
                      className={`border-slate-600 text-slate-300 hover:bg-slate-700 transition-all duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-start'}`}
                    >
                      {isSyncing ? (
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      ) : (
                        <RefreshCw className="w-4 h-4 flex-shrink-0" />
                      )}
                      {!isSidebarCollapsed && (
                        <span className="ml-2">
                          {isSyncing ? 'Syncing...' : 'Sync Games'}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent 
                      side="right" 
                      className="bg-slate-800 border-slate-700 text-white"
                      sideOffset={10}
                    >
                      <p>{isSyncing ? 'Syncing...' : 'Sync Games'}</p>
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
                      className={`border-slate-600 text-slate-300 hover:bg-slate-700 transition-all duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-start'}`}
                    >
                      <Settings className="w-4 h-4 flex-shrink-0" />
                      {!isSidebarCollapsed && <span className="ml-2">Settings</span>}
                    </Button>
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent 
                      side="right" 
                      className="bg-slate-800 border-slate-700 text-white"
                      sideOffset={10}
                    >
                      <p>Settings</p>
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
                      className={`border-slate-600 text-slate-300 hover:bg-slate-700 transition-all duration-200 ${isSidebarCollapsed ? 'px-3' : 'justify-start'}`}
                    >
                      {isLoggingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
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
                      className="bg-slate-800 border-slate-700 text-white"
                      sideOffset={10}
                    >
                      <p>{isLoggingOut ? 'Logging out...' : 'Logout'}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 h-full overflow-hidden">
            <Outlet />
          </div>
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={(open) => {
          setIsSettingsOpen(open);
          if (!open) {
            setSettingsSaveStarted(false); // Reset when dialog closes
          }
        }}>
          <DialogContent className="bg-slate-800/95 backdrop-blur-xl border-slate-700/50 text-white max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Import Settings</DialogTitle>
              <DialogDescription className="text-slate-400">
                Update your import preferences. Changes will re-import your games with new settings.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6">
              {/* Time Controls */}
              <Card className="bg-slate-700/30 border-slate-600/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">Time Controls</CardTitle>
                      <p className="text-slate-400 text-sm">Select game types to analyze</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: 'bullet', label: 'Bullet', desc: '< 3 minutes' },
                    { id: 'blitz', label: 'Blitz', desc: '3-10 minutes' },
                    { id: 'rapid', label: 'Rapid', desc: '10-30 minutes' },
                    { id: 'daily', label: 'Daily', desc: 'Correspondence' }
                  ].map((timeControl) => (
                    <div key={timeControl.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-600/30 transition-colors">
                      <Checkbox
                        id={`settings-${timeControl.id}`}
                        checked={(tempSettings.selectedTimeControls || []).includes(timeControl.id)}
                        onCheckedChange={(checked) => handleTimeControlChange(timeControl.id, checked)}
                        className="border-slate-500 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                        disabled={isImporting}
                      />
                      <div className="flex-1">
                        <label htmlFor={`settings-${timeControl.id}`} className="text-slate-200 font-medium cursor-pointer">
                          {timeControl.label}
                        </label>
                        <p className="text-slate-400 text-xs">{timeControl.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Date Range */}
              <Card className="bg-slate-700/30 border-slate-600/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <CalendarIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">Date Range</CardTitle>
                      <p className="text-slate-400 text-sm">Configure data range</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-slate-200 font-medium">Date Range</Label>
                    <Select 
                      value={tempSettings.selectedDateRange || '3'} 
                      onValueChange={(value) => setTempSettings(prev => ({...prev, selectedDateRange: value}))}
                      disabled={isImporting}
                    >
                      <SelectTrigger className="bg-slate-600/50 border-slate-500 text-white disabled:opacity-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
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
                          <Label className="text-slate-200 text-sm font-medium">From</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={isImporting}
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-slate-600/50 border-slate-500 text-white hover:bg-slate-600 disabled:opacity-50",
                                  !tempSettings.customDateRange?.from && "text-slate-400"
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
                            <PopoverContent className="w-auto p-0 bg-slate-700 border-slate-600" align="start">
                              <Calendar
                                mode="single"
                                selected={tempSettings.customDateRange?.from}
                                onSelect={(date) => setTempSettings(prev => ({
                                  ...prev, 
                                  customDateRange: { ...prev.customDateRange, from: date }
                                }))}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                                className="bg-slate-700"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-200 text-sm font-medium">To</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={isImporting}
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-slate-600/50 border-slate-500 text-white hover:bg-slate-600 disabled:opacity-50",
                                  !tempSettings.customDateRange?.to && "text-slate-400"
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
                            <PopoverContent className="w-auto p-0 bg-slate-700 border-slate-600" align="start">
                              <Calendar
                                mode="single"
                                selected={tempSettings.customDateRange?.to}
                                onSelect={(date) => setTempSettings(prev => ({
                                  ...prev, 
                                  customDateRange: { ...prev.customDateRange, to: date }
                                }))}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                                className="bg-slate-700"
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
              <Card className="bg-slate-700/30 border-slate-600/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">Sync Settings</CardTitle>
                      <p className="text-slate-400 text-sm">Configure auto-sync</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-slate-200 font-medium">Auto-Sync</Label>
                      <p className="text-slate-400 text-xs">Automatically import new games when you visit the app</p>
                    </div>
                    <Checkbox
                      checked={tempSettings.autoSync || false}
                      onCheckedChange={(checked) => setTempSettings(prev => ({...prev, autoSync: checked}))}
                      disabled={isImporting}
                      className="border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 disabled:opacity-50"
                    />
                  </div>

                  <div className="bg-slate-600/30 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-slate-200 font-medium mb-1">Current Settings</p>
                        <p className="text-slate-400 text-xs">
                          Game limit: 1500 games (fixed)
                        </p>
                        <p className="text-slate-400 text-xs">
                          Time controls: {(tempSettings.selectedTimeControls || []).join(', ') || 'None selected'}
                        </p>
                        <p className="text-slate-400 text-xs">
                          Date range: {tempSettings.selectedDateRange === 'custom' ? 'Custom' : `${tempSettings.selectedDateRange || '3'} months`}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Validation */}
            {(tempSettings.selectedTimeControls || []).length === 0 && (
              <Alert className="bg-red-500/10 border-red-500/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  Please select at least one time control to import.
                </AlertDescription>
              </Alert>
            )}

            {tempSettings.selectedDateRange === "custom" && (!tempSettings.customDateRange?.from || !tempSettings.customDateRange?.to) && (
              <Alert className="bg-red-500/10 border-red-500/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  Please select both start and end dates for custom range.
                </AlertDescription>
              </Alert>
            )}

            {/* Loading / Success indicator – always shown at the bottom */}
            {isImporting ? (
              <SettingsLoading 
                isLoading={isImporting}
                progress={importProgress}
                status={importStatus}
                onComplete={handleSettingsLoadingComplete}
                className="border-t border-b border-slate-700/50 my-4"
              />
            ) : (
              <div className="border-t border-b border-slate-700/50 my-4 min-h-[60px]" />
            )}

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsSettingsOpen(false)}
                disabled={isImporting}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSettingsSave}
                disabled={isImporting || (tempSettings.selectedTimeControls || []).length === 0 || 
                         (tempSettings.selectedDateRange === "custom" && (!tempSettings.customDateRange?.from || !tempSettings.customDateRange?.to))}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-50"
              >
                {(isImporting || settingsSaveStarted) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    Save & Re-import Games
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent className="bg-slate-800/95 backdrop-blur-xl border-slate-700/50">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl text-white">Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Are you sure you want to logout? This will clear your session and return you to the main page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
