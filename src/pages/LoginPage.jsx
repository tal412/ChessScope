import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isImporting, importProgress, importStatus } = useAuth();
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFromHome, setIsFromHome] = useState(false);
  
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [username, setUsername] = useState('');
  const [chessComUsername, setChessComUsername] = useState('');
  const [googleAccount, setGoogleAccount] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Connect Account, 2: Google Drive (optional)
  
  // Import settings - matching the import page exactly
  const [selectedTimeControls, setSelectedTimeControls] = useState(['rapid']); // Default selection
  const [selectedDateRange, setSelectedDateRange] = useState('3'); // months
  const [customDateRange, setCustomDateRange] = useState({
    from: null,
    to: null
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [autoSyncFrequency, setAutoSyncFrequency] = useState('1day');

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
    
    // Start animations with slight delay for smooth transition from main page
    setTimeout(() => {
      setIsVisible(true);
    }, 50);
  }, [location.state]);

  // Handle back navigation
  const handleBack = () => {
    // Prevent navigation during import
    if (isImporting) {
      return;
    }
    
    if (step === 2) {
      // Go back to step 1
      setIsVisible(false);
      setTimeout(() => {
        setStep(1);
        setIsVisible(true);
      }, 150);
    } else if (step === 1) {
        // Go back to home directly with smooth transition
        setIsLeaving(true);
        setTimeout(() => {
          navigate('/', { state: { returning: true } });
        }, 50);
    }
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
      // Convert our settings to the expected format
      const importSettings = {
        selectedTimeControls,
        selectedDateRange,
        customDateRange,
        autoSyncFrequency
      };
      
      const result = await login(username, selectedPlatform, importSettings);
      if (result.success) {
        // The onComplete callback will handle moving to step 2
        // No need for setTimeout here since SettingsLoading handles the timing
      } else {
        setError(result.error || `Failed to connect ${selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} account`);
      }
    } catch {
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

  const handleGoogleDriveConnect = async () => {
    // For now, simulate Google Drive connection
    try {
      toast({
        title: "Google Drive Connected!",
        description: "Your data will be automatically backed up to Google Drive.",
      });
      
      navigate('/');
    } catch {
      setError('Failed to connect Google Drive');
    }
  };

  const handleSkipGoogleDrive = () => {
    navigate('/');
  };

  const handleImportComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      setStep(2);
      // Start animations immediately on step 2
      setIsVisible(true);
    }, 150);
  };

  // Step 1: Account Connection
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        {/* Back Button */}
        <Button
          onClick={handleBack}
          variant="ghost"
          disabled={isImporting}
          className={`absolute top-6 left-6 transition-all duration-300 ${
            isImporting 
              ? 'text-slate-600 cursor-not-allowed' 
              : 'text-slate-400 hover:text-white'
          } ${
            isVisible && !isLeaving ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-4'
          }`}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

                  <div className={`w-full max-w-7xl page-transition transition-all duration-150 ease-out ${
            isLeaving ? 'opacity-0 transform -translate-x-4' :
            isVisible ? 'opacity-100 transform translate-x-0' : 
            'opacity-0 transform translate-x-4'
          }`}>
                      <div className={`text-center mb-12 page-transition transition-all duration-150 ease-out ${
              isLeaving ? 'opacity-0 transform -translate-x-2' :
              isVisible ? 'opacity-100 transform translate-x-0' : 
              'opacity-0 transform translate-x-2'
            }`}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-slate-900" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Connect Your {selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} Account</h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Configure your import settings and connect to analyze your opening performance and discover patterns in your games
            </p>
          </div>

          <form onSubmit={handleAccountSubmit} className="space-y-8">
            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 page-transition transition-all duration-150 ease-out ${
              isLeaving ? 'opacity-0 transform -translate-x-2' :
              isVisible ? 'opacity-100 transform translate-x-0' : 
              'opacity-0 transform translate-x-2'
            }`}>
              {/* Left Column - Account Connection */}
              <Card className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Connect Account</CardTitle>
                      <p className="text-slate-400 text-sm">Link your {selectedPlatform === 'lichess' ? 'Lichess' : 'Chess.com'} profile</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="mb-2 flex items-center gap-2">
                      {selectedPlatform === 'lichess' ? (
                        <div className="flex items-center gap-2">
                          <img src="/Lichess_Logo_2019.svg.png" alt="Lichess" className="h-8 w-8" />
                          <span className="text-white font-semibold text-lg">Lichess</span>
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
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
                      disabled={isImporting}
                      required
                    />
                  </div>
                  
                  <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-slate-200 font-medium mb-1">Secure & Private</p>
                        <p className="text-slate-400">
                          Only public game history is accessed. No private data is read.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Middle Column - Time Controls */}
              <Card className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Time Controls</CardTitle>
                      <p className="text-slate-400 text-sm">Select game types to analyze</p>
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
                            : 'hover:bg-slate-700/30 cursor-pointer'
                        }`}
                        onClick={() => !isImporting && handleTimeControlClick(timeControl.id)}
                      >
                        <div className="w-4 h-4 rounded border border-slate-500 bg-slate-700 flex items-center justify-center pointer-events-none">
                          {selectedTimeControls.includes(timeControl.id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <label htmlFor={timeControl.id} className="text-slate-200 font-medium cursor-pointer">
                            {timeControl.label}
                          </label>
                          <p className="text-slate-400 text-xs">{timeControl.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Right Column - Date Range & Auto-Sync */}
              <Card className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Import Settings</CardTitle>
                      <p className="text-slate-400 text-sm">Configure data range</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-slate-200 font-medium">Date Range</Label>
                    <select 
                      value={selectedDateRange} 
                      onChange={(e) => setSelectedDateRange(e.target.value)}
                      disabled={isImporting}
                      className="bg-slate-700/50 border-slate-600 text-white rounded-md px-3 py-2 w-full"
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
                          <Label className="text-slate-200 text-sm font-medium">From</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700",
                                  !customDateRange.from && "text-slate-400"
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
                            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                              <Calendar
                                mode="single"
                                selected={customDateRange.from}
                                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                                className="bg-slate-800"
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
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700",
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
                            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                              <Calendar
                                mode="single"
                                selected={customDateRange.to}
                                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                                className="bg-slate-800"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-slate-200 font-medium">Auto-Sync Frequency</Label>
                      <p className="text-slate-400 text-xs">How often to check for and import new games</p>
                      <select 
                        value={autoSyncFrequency} 
                        onChange={(e) => setAutoSyncFrequency(e.target.value)}
                        disabled={isImporting}
                        className="bg-slate-700/50 border-slate-600 text-white rounded-md px-3 py-2 w-full"
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
            <div className={`flex flex-col items-center page-transition transition-all duration-150 ease-out ${
              isLeaving ? 'opacity-0' :
              isVisible ? 'opacity-100' : 
              'opacity-0'
            }`}>
              {/* Fixed container to prevent layout shifts */}
              <div className="w-full max-w-md min-h-[120px] flex flex-col items-center justify-center space-y-4">
                <SettingsLoading 
                  isLoading={isImporting}
                  progress={importProgress}
                  status={importStatus}
                  onComplete={handleImportComplete}
                  successMessage="Games Imported Successfully!"
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

  // Google Drive Step
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Back Button */}
      <Button
        onClick={handleBack}
        variant="ghost"
        disabled={isImporting}
        className={`absolute top-6 left-6 transition-all duration-300 ${
          isImporting 
            ? 'text-slate-600 cursor-not-allowed' 
            : 'text-slate-400 hover:text-white'
        } ${
          isVisible && !isLeaving ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-4'
        }`}
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </Button>

      <div className={`max-w-md w-full page-transition transition-all duration-150 ease-out ${
        isLeaving ? 'opacity-0 transform -translate-x-4' :
        isVisible ? 'opacity-100 transform translate-x-0' : 
        'opacity-0 transform translate-x-4'
      }`}>
        <Card className="bg-slate-800/95 backdrop-blur-optimized border-slate-700/50">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cloud className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">Connect Google Drive</CardTitle>
            <p className="text-slate-400">
              Backup your chess analysis data to Google Drive for safekeeping
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-slate-200 font-medium mb-1">Optional Step</p>
                  <p className="text-slate-400">
                    You can skip this and connect Google Drive later from settings
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleGoogleDriveConnect}
                disabled={isImporting}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 mr-2" />
                    Connect Google Drive
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleSkipGoogleDrive}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 w-full"
                disabled={isImporting}
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 