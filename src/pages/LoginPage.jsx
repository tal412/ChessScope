import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { login, isImporting, importProgress, importStatus } = useAuth();
  const { toast } = useToast();
  
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
  const [autoSync, setAutoSync] = useState(true);

  const handleChessComSubmit = async (e) => {
    e.preventDefault();
    if (!chessComUsername.trim()) {
      setError('Please enter your Chess.com username');
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
        autoSync
      };
      
      const result = await login(chessComUsername, importSettings);
      if (result.success) {
        // The onComplete callback will handle moving to step 2
        // No need for setTimeout here since SettingsLoading handles the timing
      } else {
        setError(result.error || 'Failed to connect Chess.com account');
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
    setStep(2);
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-7xl">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-slate-900" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Welcome to ChessScope</h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Connect your Chess.com account to analyze your opening performance and discover patterns in your games
            </p>
          </div>

          <form onSubmit={handleChessComSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Account Connection */}
              <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Connect Account</CardTitle>
                      <p className="text-slate-400 text-sm">Link your Chess.com profile</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-slate-200 font-medium">Chess.com Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={chessComUsername}
                      onChange={(e) => setChessComUsername(e.target.value)}
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
                          We only read your public game history. No passwords or private data required.
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
                  {[
                    { id: 'bullet', label: 'Bullet', desc: '< 3 minutes' },
                    { id: 'blitz', label: 'Blitz', desc: '3-10 minutes' },
                    { id: 'rapid', label: 'Rapid', desc: '10-30 minutes' },
                    { id: 'daily', label: 'Daily', desc: 'Correspondence' }
                  ].map((timeControl) => (
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
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-slate-200 text-sm">From</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700",
                                  !customDateRange.from && "text-slate-400"
                                )}
                                disabled={isImporting}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
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
                          <Label className="text-slate-200 text-sm">To</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700",
                                  !customDateRange.to && "text-slate-400"
                                )}
                                disabled={isImporting}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
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
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-slate-200 font-medium">Auto-Sync</Label>
                        <p className="text-slate-400 text-xs">Automatically import new games when you visit the app</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="autoSync"
                          checked={autoSync}
                          onCheckedChange={setAutoSync}
                          className="border-slate-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                          disabled={isImporting}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Embedded Loading Section - always present to maintain layout */}
            <div className="max-w-3xl mx-auto">
              <SettingsLoading 
                isLoading={isImporting}
                progress={importProgress}
                status={importStatus}
                onComplete={handleImportComplete}
                className="border-t border-b border-slate-700/50 my-6"
              />
            </div>

            {error && (
              <Alert className="bg-red-500/10 border-red-500/50 max-w-2xl mx-auto">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center">
              <Button 
                type="submit" 
                disabled={isImporting || selectedTimeControls.length === 0}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-medium disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 mr-2" />
                    Importing Games...
                  </>
                ) : (
                  <>
                    Connect & Import Games
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Google Drive Step
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
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