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
  const [step, setStep] = useState(0); // 0: Platform Selection, 1: Connect Account, 2: Google Drive (optional)
  
  // Import settings - matching the import page exactly
  const [selectedTimeControls, setSelectedTimeControls] = useState(['rapid']); // Default selection
  const [selectedDateRange, setSelectedDateRange] = useState('3'); // months
  const [customDateRange, setCustomDateRange] = useState({
    from: null,
    to: null
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [autoSyncFrequency, setAutoSyncFrequency] = useState('1hour');

  // Entrance animation effect
  useEffect(() => {
    // Track if coming from home for proper transition direction
    if (location.state?.fromHome) {
      setIsFromHome(true);
    }
    
    // Check if we should skip platform selection
    if (location.state?.skipPlatformSelection && location.state?.selectedPlatform) {
      // Pre-select platform and go directly to step 1
      setSelectedPlatform(location.state.selectedPlatform);
      setStep(1);
      
      // Update default time controls based on platform
      if (location.state.selectedPlatform === 'lichess') {
        setSelectedTimeControls(['rapid']);
      } else {
        setSelectedTimeControls(['rapid']);
      }
    }
    
    // Start animations with slight delay for smooth transition from main page
    setTimeout(() => {
      setIsVisible(true);
    }, 50);
  }, [location.state]);

  // Handle back navigation
  const handleBack = () => {
    if (step === 2) {
      // Go back to step 1
      setIsVisible(false);
      setTimeout(() => {
        setStep(1);
        setIsVisible(true);
      }, 150);
    } else if (step === 1) {
      // Check if we came directly from main page with pre-selected platform
      if (location.state?.skipPlatformSelection) {
        // Go back to home directly with smooth transition
        setIsLeaving(true);
        setTimeout(() => {
          navigate('/', { state: { returning: true } });
        }, 300);
      } else {
        // Go back to step 0 (platform selection)
        setIsVisible(false);
        setTimeout(() => {
          setStep(0);
          setIsVisible(true);
        }, 150);
      }
    } else {
      // Go back to home with smooth transition
      setIsLeaving(true);
      setTimeout(() => {
        navigate('/', { state: { returning: true } });
      }, 300);
    }
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      setIsLeaving(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handlePlatformSelection = (platform) => {
    setSelectedPlatform(platform);
    setError('');
    
    // Update default time controls based on platform
    if (platform === 'lichess') {
      setSelectedTimeControls(['rapid']);
    } else {
      setSelectedTimeControls(['rapid']);
    }
    
    setIsVisible(false);
    setTimeout(() => {
      setStep(1);
      setIsVisible(true);
    }, 150);
  };

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

  // Step 0: Platform Selection
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        {/* Back Button */}
        <Button
          onClick={handleBack}
          variant="ghost"
          className={`absolute top-6 left-6 text-slate-400 hover:text-white transition-all duration-300 ${
            isVisible && !isLeaving ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-4'
          }`}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        <div className={`w-full max-w-4xl transition-all duration-300 ${
          isLeaving ? 'opacity-0 transform -translate-x-8' :
          isVisible ? 'opacity-100 transform translate-x-0' : 
          'opacity-0 transform translate-x-8'
        }`}>
          <div className={`text-center mb-12 transition-all duration-300 delay-75 ${
            isLeaving ? 'opacity-0 transform -translate-x-6' :
            isVisible ? 'opacity-100 transform translate-x-0' : 
            'opacity-0 transform translate-x-6'
          }`}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-slate-900" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Welcome to ChessScope</h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Choose your chess platform to analyze your opening performance and discover patterns in your games
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto transition-all duration-300 delay-100 ${
            isLeaving ? 'opacity-0 transform -translate-x-4' :
            isVisible ? 'opacity-100 transform translate-x-0' : 
            'opacity-0 transform translate-x-4'
          }`}>
            {/* Chess.com Platform */}
            <Card 
              className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 hover:bg-slate-800/70 transition-all duration-300 cursor-pointer group"
              onClick={() => handlePlatformSelection('chess.com')}
            >
              <CardContent className="p-8">
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <img src="/chesscom_logo_pawn.svg" alt="Chess.com" className="w-12 h-12" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Chess.com</h3>
                    <p className="text-slate-400 text-sm">
                      Connect your Chess.com account to analyze your games and openings
                    </p>
                  </div>
                  <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50 w-full">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-slate-200 font-medium mb-1">Secure Access</p>
                        <p className="text-slate-400">
                          Only public game data is accessed through Chess.com's official API
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lichess Platform */}
            <Card 
              className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 hover:bg-slate-800/70 transition-all duration-300 cursor-pointer group"
              onClick={() => handlePlatformSelection('lichess')}
            >
              <CardContent className="p-8">
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <img src="/Lichess_Logo_2019.svg.png" alt="Lichess" className="w-12 h-12" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Lichess</h3>
                    <p className="text-slate-400 text-sm">
                      Connect your Lichess account to analyze your games and openings
                    </p>
                  </div>
                  <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50 w-full">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-slate-200 font-medium mb-1">Open Source</p>
                        <p className="text-slate-400">
                          Connect to the free, open-source chess platform with comprehensive data
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Account Connection
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        {/* Back Button */}
        <Button
          onClick={handleBack}
          variant="ghost"
          className={`absolute top-6 left-6 text-slate-400 hover:text-white transition-all duration-300 ${
            isVisible && !isLeaving ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-4'
          }`}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        <div className={`w-full max-w-7xl transition-all duration-300 ${
          isLeaving ? 'opacity-0 transform -translate-x-8' :
          isVisible ? 'opacity-100 transform translate-x-0' : 
          'opacity-0 transform translate-x-8'
        }`}>
          <div className={`text-center mb-12 transition-all duration-300 delay-75 ${
            isLeaving ? 'opacity-0 transform -translate-x-6' :
            isVisible ? 'opacity-100 transform translate-x-0' : 
            'opacity-0 transform translate-x-6'
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
            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 transition-all duration-300 delay-100 ${
              isLeaving ? 'opacity-0 transform -translate-x-4' :
              isVisible ? 'opacity-100 transform translate-x-0' : 
              'opacity-0 transform translate-x-4'
            }`}>
              {/* Left Column - Account Connection */}
              <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
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
                      onChange={(e) => setUsername(e.target.value)}
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
              <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
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
                    <div key={timeControl.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-700/30 transition-colors">
                      <Checkbox
                        id={timeControl.id}
                        checked={selectedTimeControls.includes(timeControl.id)}
                        onCheckedChange={(checked) => handleTimeControlChange(timeControl.id, checked)}
                        className="border-slate-500 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                        disabled={isImporting}
                      />
                      <div className="flex-1">
                        <label htmlFor={timeControl.id} className="text-slate-200 font-medium cursor-pointer">
                          {timeControl.label}
                        </label>
                        <p className="text-slate-400 text-xs">{timeControl.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Right Column - Date Range & Auto-Sync */}
              <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
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
                    <Select 
                      value={selectedDateRange} 
                      onValueChange={setSelectedDateRange}
                      disabled={isImporting}
                    >
                      <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="1">Last 1 month</SelectItem>
                        <SelectItem value="2">Last 2 months</SelectItem>
                        <SelectItem value="3">Last 3 months</SelectItem>
                        <SelectItem value="6">Last 6 months</SelectItem>
                        <SelectItem value="custom">Custom range</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <Select 
                        value={autoSyncFrequency} 
                        onValueChange={setAutoSyncFrequency}
                        disabled={isImporting}
                      >
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
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
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error Display */}
            {error && (
              <Alert className="border-red-500/50 bg-red-500/10 max-w-3xl mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button with integrated loading */}
            <div className={`flex justify-center transition-all duration-300 delay-200 ${
              isLeaving ? 'opacity-0 transform -translate-x-2' :
              isVisible ? 'opacity-100 transform translate-x-0' : 
              'opacity-0 transform translate-x-2'
            }`}>
              <SettingsLoading 
                isLoading={isImporting}
                progress={importProgress}
                status={importStatus}
                onComplete={handleImportComplete}
                successMessage="Games Imported Successfully!"
                className="w-full max-w-md"
                showButtons={!isImporting}
                buttonText="Connect & Import Games"
                loadingText="Importing Games..."
                onButtonClick={(e) => {
                  e.preventDefault();
                  handleAccountSubmit(e);
                }}
                buttonDisabled={selectedTimeControls.length === 0}
              />
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
        className={`absolute top-6 left-6 text-slate-400 hover:text-white transition-all duration-300 ${
          isVisible && !isLeaving ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-4'
        }`}
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </Button>

      <div className={`max-w-md w-full transition-all duration-300 ${
        isLeaving ? 'opacity-0 transform -translate-x-8' :
        isVisible ? 'opacity-100 transform translate-x-0' : 
        'opacity-0 transform translate-x-8'
      }`}>
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
          <CardHeader className={`text-center transition-all duration-300 delay-75 ${
            isLeaving ? 'opacity-0 transform -translate-x-6' :
            isVisible ? 'opacity-100 transform translate-x-0' : 
            'opacity-0 transform translate-x-6'
          }`}>
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cloud className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">Connect Google Drive</CardTitle>
            <p className="text-slate-400">
              Backup your chess analysis data to Google Drive for safekeeping
            </p>
          </CardHeader>
          <CardContent className={`space-y-6 transition-all duration-300 delay-100 ${
            isLeaving ? 'opacity-0 transform -translate-x-4' :
            isVisible ? 'opacity-100 transform translate-x-0' : 
            'opacity-0 transform translate-x-4'
          }`}>
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