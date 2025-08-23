import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/FirebaseAuthContext';

const EmailAuthForm = ({ onSuccess }) => {
  const { signInWithEmailPassword, signUpWithEmailPassword, resetPassword } = useAuth();
  
  // Form states
  const [activeTab, setActiveTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  
  // UI states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Clear messages when switching tabs
  const handleTabChange = (value) => {
    setActiveTab(value);
    setError('');
    setSuccess('');
    setShowForgotPassword(false);
  };
  
  // Handle sign in
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsSigningIn(true);
    try {
      const result = await signInWithEmailPassword(email, password);
      if (result.success) {
        setSuccess('Successfully signed in!');
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1000);
        }
      } else {
        setError(result.error);
      }
    } finally {
      setIsSigningIn(false);
    }
  };
  
  // Handle sign up
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setIsSigningUp(true);
    try {
      const result = await signUpWithEmailPassword(email, password, displayName || null);
      if (result.success) {
        setSuccess('Account created successfully! You are now signed in.');
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        }
      } else {
        setError(result.error);
      }
    } finally {
      setIsSigningUp(false);
    }
  };
  
  // Handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsResetting(true);
    
    if (!resetEmail) {
      setError('Please enter your email address');
      setIsResetting(false);
      return;
    }
    
    const result = await resetPassword(resetEmail);
    setIsResetting(false);
    
    if (result.success) {
      setSuccess(result.message);
      setResetEmail('');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess('');
      }, 5000);
    } else {
      setError(result.error);
    }
  };
  
  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Reset Password</h3>
          <p className="text-sm text-gray-400">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="text-white">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="your@email.com"
                className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
                disabled={isResetting}
              />
            </div>
          </div>
          
          {error && (
            <Alert className="bg-red-900/20 border-red-800">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-900/20 border-green-800">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-400">{success}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForgotPassword(false)}
              className="flex-1 bg-transparent border-slate-700 text-white hover:bg-slate-800"
              disabled={isResetting}
            >
              Back to Sign In
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Email'
              )}
            </Button>
          </div>
        </form>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 bg-slate-800">
          <TabsTrigger value="signin" className="data-[state=active]:bg-slate-700">
            Sign In
          </TabsTrigger>
          <TabsTrigger value="signup" className="data-[state=active]:bg-slate-700">
            Sign Up
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="signin" className="space-y-4">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="text-white">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
                  disabled={isSigningIn}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signin-password" className="text-white">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="signin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
                  disabled={isSigningIn}
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            
            {error && (
              <Alert className="bg-red-900/20 border-red-800">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-900/20 border-green-800">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-400">{success}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-center">
              <Button
                type="submit"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white w-64"
                disabled={isSigningIn}
              >
              {isSigningIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Sign in with Email
                </>
              )}
              </Button>
            </div>
          </form>
        </TabsContent>
        
        <TabsContent value="signup" className="space-y-4">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="text-white">
                Display Name <span className="text-gray-500">(optional)</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="signup-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
                  disabled={isSigningUp}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-white">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
                  disabled={isSigningUp}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-white">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
                  disabled={isSigningUp}
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Must be at least 6 characters</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signup-confirm" className="text-white">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="signup-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
                  disabled={isSigningUp}
                  required
                />
              </div>
            </div>
            
            {error && (
              <Alert className="bg-red-900/20 border-red-800">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-900/20 border-green-800">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-400">{success}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-center">
              <Button
                type="submit"
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white w-64"
                disabled={isSigningUp}
              >
              {isSigningUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailAuthForm;