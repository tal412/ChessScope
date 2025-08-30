import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChessPlatform } from '@/contexts/ChessPlatformContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, User, Settings, Globe, ChevronRight, Calendar as CalendarIcon, Loader2, AlertCircle, ArrowLeft, Cloud } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from '@/components/ui/use-toast';
import { SettingsLoading } from '@/components/ui/settings-loading';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function InitialPlatformSelect({ isTransitioning = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { connectPlatform, isImporting, importProgress, importStatus } = useChessPlatform();
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFromHome, setIsFromHome] = useState(false);
  
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [username, setUsername] = useState('');
  const [chessComUsername, setChessComUsername] = useState('');
  const [googleAccount, setGoogleAccount] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Connect Account (Firebase auth handled separately)
  
  // Import settings - matching the import page exactly
  const [selectedTimeControls, setSelectedTimeControls] = useState(['rapid']); // Default selection
  const [selectedDateRange, setSelectedDateRange] = useState('3'); // months
  const [customDateRange, setCustomDateRange] = useState({
    from: null,
    to: null
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [autoSyncFrequency, setAutoSyncFrequency] = useState('1day');

  // Handle external transition trigger
  useEffect(() => {
    if (isTransitioning) {
      setIsLeaving(true);
    }
  }, [isTransitioning]);

  // Entrance animation effect
  useEffect(() => {
    const state = location.state || {};
    const { fromHome, selectedPlatform: platformFromState } = state;

    // Track if coming from home for proper transition direction
    if (fromHome) {
      setIsFromHome(true);
    }
    
    const platform = platformFromState || 'chess.com';
    setSelectedPlatform(platform);

    // Update default time controls based on platform
    if (platform === 'lichess') {
      setSelectedTimeControls(['rapid']);
    } else {
      setSelectedTimeControls(['rapid']);
    }
    
    // Start entrance animation after main page exit completes
    setTimeout(() => {
      setIsVisible(true);
    }, 100); // Shorter pause for snappy transition
  }, [location.state]);

  // Handle back navigation
  const handleBack = () => {
    // Prevent navigation during import
    if (isImporting) {
      return;
    }
    
    // Go back to home with exact same timing as forward transition
    setIsLeaving(true);
    setTimeout(() => {
      navigate('/', { state: { returning: true } });
    }, 150); // Match CSS animation duration exactly
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (e) => {
      // Prevent browser back navigation during import
      if (isImporting) {
        e.preventDefault();
        // Push the current state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
        return;
      }
      setIsLeaving(true);
    };

    // Add initial history entry to prevent back navigation during import
    if (isImporting) {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isImporting]);

  // Block navigation during import
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isImporting) {
        e.preventDefault();
        e.returnValue = 'Import is in progress. Are you sure you want to leave?';
        return 'Import is in progress. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isImporting]);

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    
    // Start the overall timer
    const overallStartTime = performance.now();
    console.log('🚀 [IMPORT-FLOW] Starting import process at', new Date().toLocaleTimeString());
    window.importFlowStartTime = overallStartTime;
    
    if (!username.trim()) {
      setError(`Please enter your ${selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} username`);
      return;
    }

    if (selectedTimeControls.length === 0) {
      setError('Please select at least one time control to import');
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

    setError('');

    try {
      console.log('🚀 [IMPORT-FLOW] Calling connectPlatform...');
      
      // Convert our settings to the expected format
      const importSettings = {
        selectedTimeControls,
        selectedDateRange,
        customDateRange,
        autoSyncFrequency
      };
      
      const result = await connectPlatform(selectedPlatform, username, importSettings);
      if (result.success) {
        console.log('🚀 [IMPORT-FLOW] connectPlatform succeeded');
        // The onComplete callback will handle moving to step 2
        // No need for setTimeout here since SettingsLoading handles the timing
      } else {
        console.log('🚀 [IMPORT-FLOW] connectPlatform failed:', result.error);
        setError(result.error || `Failed to connect ${selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} account`);
      }
    } catch (error) {
      console.log('🚀 [IMPORT-FLOW] connectPlatform threw error:', error);
      setError('Connection failed. Please check your username and try again.');
    }
  };

  const handleTimeControlChange = (timeControl, checked) => {
    if (checked) {
      setSelectedTimeControls(prev => [...prev, timeControl]);
    } else {
      setSelectedTimeControls(prev => prev.filter(tc => tc !== timeControl));
    }
  };

  const handleTimeControlClick = (timeControlId) => {
    if (!isImporting) {
      setSelectedTimeControls(prev => {
        const isCurrentlySelected = prev.includes(timeControlId);
        if (isCurrentlySelected) {
          return prev.filter(tc => tc !== timeControlId);
        } else {
          return [...prev, timeControlId];
        }
      });
    }
  };

  const handleImportCompleteAndNavigate = () => {
    // After chess platform import is complete, navigate to main app
    navigate('/');
  };

  const handleImportComplete = () => {
    const startTime = performance.now();
    console.log('🎯 [ANIMATION] handleImportComplete called at', new Date().toLocaleTimeString());
    
    // Import complete - wait for success message to be fully visible before starting exit
    setTimeout(() => {
      const pauseEndTime = performance.now();
      console.log('🎯 [ANIMATION] Success message pause ended after', Math.round(pauseEndTime - startTime), 'ms - starting page exit');
      
      // Trigger page exit animation
      setIsLeaving(true);
      console.log('🎯 [ANIMATION] setIsLeaving(true) - starting CSS exit animation');
      
      // Wait for CSS animation to complete, then dispatch event
      setTimeout(() => {
        console.log('🎯 [ANIMATION] Exit animation complete - dispatching platformPageExitComplete event');
        window.dispatchEvent(new CustomEvent('platformPageExitComplete'));
      }, 150); // Wait for CSS animation duration
    }, 2000); // Allow 2 seconds pause after success message appears
  };

  // Step 1: Account Connection
  if (step === 1) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 relative transition-all duration-150 ease-out ${
        isLeaving ? 'opacity-0 transform translate-x-2' :
        isVisible ? 'opacity-100 transform translate-x-0' : 
        'opacity-0 transform -translate-x-2'
      }`}>
        {/* Back Button */}
        <Button
          onClick={handleBack}
          variant="ghost"
          disabled={isImporting}
          className={`absolute top-4 left-4 ${
            isImporting 
              ? 'text-muted-foreground cursor-not-allowed' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        {/* Theme Toggle Button - Fixed top right */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle 
            variant="outline" 
            className="shadow-lg border-border/50 backdrop-blur-sm bg-background/80 hover:bg-accent hover:text-accent-foreground"
          />
        </div>

        <div className="w-full max-w-7xl">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-background" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-3">Connect Your {selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} Account</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Configure your import settings and connect to analyze your opening performance and discover patterns in your games
            </p>
          </div>

          <form onSubmit={handleAccountSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Account Connection */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-card-foreground">Connect Account</CardTitle>
                      <p className="text-muted-foreground text-sm">Link your {selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} profile</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="mb-2 flex items-center gap-2">
                      {selectedPlatform === 'lichess' ? (
                        <div className="flex items-center gap-2">
                          <img src="/Lichess_Logo_2019.svg.png" alt="Lichess" className="h-8 w-8" />
                          <span className="text-foreground font-semibold text-lg">Lichess</span>
                        </div>
                      ) : (
                        <img src="/chesscom_logo_wordmark.svg" alt="Chess.com Logo" className="h-8 w-auto" />
                      )}
                    </div>
                    <Label htmlFor="username" className="sr-only">{selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError(''); // Clear error when user types
                      }}
                      placeholder="Enter your username"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
                      disabled={isImporting}
                      required
                    />
                  </div>
                  
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-foreground font-medium mb-1">Secure & Private</p>
                        <p className="text-muted-foreground">
                          Only public game history is accessed. No private data is read.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Middle Column - Time Controls */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-card-foreground">Time Controls</CardTitle>
                      <p className="text-muted-foreground text-sm">Select game types to analyze</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(selectedPlatform === 'lichess' ? [
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
                      <div 
                        key={timeControl.id} 
                        className={`flex items-center space-x-3 p-3 rounded-lg transition-colors select-none ${
                          isImporting 
                            ? 'cursor-not-allowed opacity-50' 
                            : 'hover:bg-muted/30 cursor-pointer'
                        }`}
                        onClick={() => !isImporting && handleTimeControlClick(timeControl.id)}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center pointer-events-none transition-all ${
                          selectedTimeControls.includes(timeControl.id)
                            ? 'bg-primary border-primary'
                            : 'bg-background border-border'
                        }`}>
                          {selectedTimeControls.includes(timeControl.id) && (
                            <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <label htmlFor={timeControl.id} className="text-foreground font-medium cursor-pointer">
                            {timeControl.label}
                          </label>
                          <p className="text-muted-foreground text-xs">{timeControl.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Right Column - Date Range & Auto-Sync */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-card-foreground">Import Settings</CardTitle>
                      <p className="text-muted-foreground text-sm">Configure data range</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-foreground font-medium">Date Range</Label>
                    <select 
                      value={selectedDateRange} 
                      onChange={(e) => setSelectedDateRange(e.target.value)}
                      disabled={isImporting}
                      className="bg-input border-border text-foreground rounded-md px-3 py-2 w-full"
                    >
                      <option value="1">Last 1 month</option>
                      <option value="2">Last 2 months</option>
                      <option value="3">Last 3 months</option>
                      <option value="6">Last 6 months</option>
                      <option value="custom">Custom range</option>
                    </select>
                  </div>

                  {selectedDateRange === "custom" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-foreground text-sm font-medium">From</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-muted",
                                  !customDateRange.from && "text-muted-foreground"
                                )}
                                disabled={isImporting}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                                {customDateRange.from ? (
                                  format(customDateRange.from, "MMM yyyy")
                                ) : (
                                  "Pick date"
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                              <Calendar
                                mode="single"
                                selected={customDateRange.from}
                                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
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
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-muted",
                                  !customDateRange.to && "text-slate-400"
                                )}
                                disabled={isImporting}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                                {customDateRange.to ? (
                                  format(customDateRange.to, "MMM yyyy")
                                ) : (
                                  "Pick date"
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                              <Calendar
                                mode="single"
                                selected={customDateRange.to}
                                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
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

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">Auto-Sync Frequency</Label>
                      <p className="text-muted-foreground text-xs">How often to check for and import new games</p>
                      <select 
                        value={autoSyncFrequency} 
                        onChange={(e) => setAutoSyncFrequency(e.target.value)}
                        disabled={isImporting}
                        className="bg-input border-border text-foreground rounded-md px-3 py-2 w-full"
                      >
                        <option value="never">Never (Manual only)</option>
                        <option value="visit">Every visit</option>
                        <option value="5min">Every 5 minutes</option>
                        <option value="30min">Every 30 minutes</option>
                        <option value="1hour">Every hour</option>
                        <option value="3hours">Every 3 hours</option>
                        <option value="1day">Daily</option>
                        <option value="1week">Weekly</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Submit Button with integrated loading and error display */}
            <div className="flex flex-col items-center">
              {/* Fixed container to prevent layout shifts */}
              <div className="w-full max-w-md min-h-[120px] flex flex-col items-center justify-center space-y-4">
                <SettingsLoading 
                  isLoading={isImporting}
                  progress={importProgress}
                  status={importStatus}
                  onComplete={handleImportComplete}
                  successMessage="Games Imported Successfully!"
                  successDuration={2600}
                  className="w-full"
                  showButtons={!isImporting}
                  buttonText="Connect & Import Games"
                  loadingText="Importing Games..."
                  onButtonClick={(e) => {
                    e.preventDefault();
                    handleAccountSubmit(e);
                  }}
                  buttonDisabled={selectedTimeControls.length === 0}
                  error={error}
                />
                {/* Fixed error area below button */}
                <div className="h-6 flex items-center justify-center w-full">
                  {error && (
                    <div className="flex items-center gap-1.5 text-red-400 text-sm animate-in slide-in-from-bottom-1 duration-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // No step 2 needed - Firebase auth is handled separately in Studies
} 