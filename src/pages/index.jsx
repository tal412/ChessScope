import Layout from "./Layout.jsx";
import InitialPlatformSelect from "./InitialPlatformSelect";
import PerformanceGraph from "./PerformanceGraph";
import StudiesBook from "./StudiesBook";
import StudyEditor from "./StudyEditor";
import { useChessPlatform } from "@/contexts/ChessPlatformContext";
import { Loader2, Shield, Crown, Heart, Code, DollarSign, Users, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import { ProtectedRoute } from "@/components/route-protection/ProtectedRoute";

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

// Persistent background wrapper with performance optimizations
function BackgroundWrapper({ children }) {
    return (
        <div className="min-h-screen text-foreground">
            {children}
        </div>
    );
}

// Simple platform selection prompt component
function SimplePlatformPrompt() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isNavigating, setIsNavigating] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    
    // Simple entrance animation
    useEffect(() => {
        // Check if we're returning from platform page
        if (location.state?.returning) {
            // When returning, start invisible and animate in after platform exit completes
            setIsVisible(false);
            const timer = setTimeout(() => setIsVisible(true), 100); // Shorter pause for snappy transition
            return () => clearTimeout(timer);
        } else {
            // Normal entrance (first visit)
            const timer = setTimeout(() => setIsVisible(true), 10);
            return () => clearTimeout(timer);
        }
    }, [location.state?.returning]);
    
    const handleConnectClick = async (platform) => {
        setIsNavigating(true);
        
        // Wait for CSS exit animation to complete
        setTimeout(() => {
            navigate('/platform-select', { 
                state: { 
                    fromHome: true,
                    selectedPlatform: platform,
                    skipPlatformSelection: true
                }
            });
        }, 150); // Match CSS animation duration exactly
    };
    
    return (
        <div className={`h-screen flex items-center justify-center transition-all duration-150 ease-out ${
            isNavigating ? 'opacity-0 transform -translate-x-2' : 
            isVisible ? 'opacity-100 transform translate-x-0' : 
            'opacity-0 transform translate-x-2'
        }`}>
            {/* Theme Toggle Button - Fixed top right */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle 
                    variant="outline" 
                    className="shadow-lg border-border/50 backdrop-blur-sm bg-background/80 hover:bg-accent hover:text-accent-foreground"
                />
            </div>
            
            <div className="container mx-auto px-4 h-full flex items-center">
                <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
                    {/* Left Side - Main Content */}
                    <div className="space-y-6">
                        {/* Header with App Logo */}
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
                                    <Shield className="w-10 h-10 text-slate-900" />
                                </div>
                                <h1 className="text-5xl lg:text-6xl font-bold text-white">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                                        ChessScope
                                    </span>
                                </h1>
                            </div>
                            <p className="text-xl text-muted-foreground mb-6">
                                Advanced chess game analysis and performance tracking for everyone
                            </p>
                        </div>

                        {/* Three Key Features - Compact */}
                        <div className="flex flex-wrap gap-4 justify-center">
                            {/* Free */}
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 hover:bg-emerald-500/20 transition-all duration-300">
                                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-emerald-400 font-semibold">100% Free</span>
                            </div>

                            {/* Open Source */}
                            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2 hover:bg-blue-500/20 transition-all duration-300">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                    <Code className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-blue-400 font-semibold">Open Source</span>
                            </div>

                            {/* Community Driven */}
                            <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-2 hover:bg-purple-500/20 transition-all duration-300">
                                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                                    <Users className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-purple-400 font-semibold">Community Driven</span>
                            </div>
                        </div>

                        {/* Connect Buttons for Both Platforms */}
                        <div className="flex flex-col gap-4 items-center">
                            <p className="text-muted-foreground text-lg font-medium">Choose your chess platform:</p>
                            
                            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-2xl">
                                {/* Chess.com Button */}
                                <Button 
                                    onClick={() => handleConnectClick('chess.com')}
                                    disabled={isNavigating}
                                    size="lg"
                                    className="bg-secondary hover:bg-secondary/80 disabled:bg-muted text-secondary-foreground px-6 py-6 rounded-xl text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 group transform hover:scale-[1.02] disabled:transform-none disabled:cursor-not-allowed flex-1"
                                >
                                    <div className="flex items-center gap-3">
                                        {isNavigating ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span>Connecting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <img src="/chesscom_logo_pawn.svg" alt="Chess.com" className="h-7 w-7 transition-all duration-300 group-hover:scale-105" />
                                                <span>Connect Chess.com</span>
                                            </>
                                        )}
                                    </div>
                                </Button>

                                {/* Lichess Button */}
                                <Button 
                                    onClick={() => handleConnectClick('lichess')}
                                    disabled={isNavigating}
                                    size="lg"
                                    className="bg-secondary hover:bg-secondary/80 disabled:bg-muted text-secondary-foreground px-6 py-6 rounded-xl text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 group transform hover:scale-[1.02] disabled:transform-none disabled:cursor-not-allowed flex-1"
                                >
                                    <div className="flex items-center gap-3">
                                        {isNavigating ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span>Connecting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <img src="/Lichess_Logo_2019.svg.png" alt="Lichess" className="h-7 w-7 transition-all duration-300 group-hover:scale-105" />
                                                <span>Connect Lichess</span>
                                            </>
                                        )}
                                    </div>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Video Placeholder */}
                    <div className="flex items-center justify-center">
                        <div className="relative w-full max-w-lg">
                            <div className="aspect-video bg-card rounded-2xl border-2 border-border shadow-xl overflow-hidden">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                            <Play className="w-8 h-8 text-white ml-1" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-card-foreground mb-2">See ChessScope in Action</h3>
                                            <p className="text-muted-foreground">
                                                Watch how ChessScope analyzes your games and helps improve your chess
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Decorative browser elements */}
                                <div className="absolute top-4 left-4 w-3 h-3 bg-red-500 rounded-full"></div>
                                <div className="absolute top-4 left-10 w-3 h-3 bg-yellow-500 rounded-full"></div>
                                <div className="absolute top-4 left-16 w-3 h-3 bg-green-500 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const { isAuthenticated, isImporting } = useChessPlatform();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [showAuthenticated, setShowAuthenticated] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [waitingForPlatformExit, setWaitingForPlatformExit] = useState(false);
    const [showBlankScreen, setShowBlankScreen] = useState(false);
    const [justCompletedImport, setJustCompletedImport] = useState(false);
    
    // Listen for platform page exit completion event
    useEffect(() => {
        const handlePlatformExitComplete = () => {
            const eventTime = performance.now();
            
            if (waitingForPlatformExit) {
                
                // Platform page exit animation is complete, show blank screen
                setIsExiting(false);
                setWaitingForPlatformExit(false);
                setShowBlankScreen(true);
                
                // Use requestAnimationFrame to ensure blank screen renders before continuing
                requestAnimationFrame(() => {
                    
                    // After blank screen pause, show the authenticated view
                    setTimeout(() => {
                        const blankScreenEndTime = performance.now();
                        
                        setShowBlankScreen(false);
                        setShowAuthenticated(true);
                        
                        // Log the total time from import start to final view
                        if (window.importFlowStartTime) {
                            const totalTime = performance.now() - window.importFlowStartTime;
                        }
                        
                        setTimeout(() => {
                            setIsTransitioning(false);
                        }, 100); // Small delay for entrance animation to start
                    }, 1200); // Longer blank screen pause to make it very obvious
                });
            }
        };

        window.addEventListener('platformPageExitComplete', handlePlatformExitComplete);
        return () => window.removeEventListener('platformPageExitComplete', handlePlatformExitComplete);
    }, [waitingForPlatformExit]);

    // Track when import completes (transitions from true to false)
    const prevImporting = useRef(isImporting);
    
    useEffect(() => {
        if (prevImporting.current === true && isImporting === false && isAuthenticated) {
            setJustCompletedImport(true);
            
            // Clear this flag after a short delay to prevent it from affecting future logic
            setTimeout(() => {
                setJustCompletedImport(false);
            }, 100);
        }
        
        prevImporting.current = isImporting;
    }, [isImporting, isAuthenticated]);

    // Handle authentication transition with proper exit/enter animation
    useEffect(() => {
        
        if (isAuthenticated && !showAuthenticated && !isTransitioning) {
            // Check if user just completed import or is currently importing
            if (isImporting || justCompletedImport) {
                // User just finished importing - start exit animation for platform page and wait for completion
                setIsExiting(true);
                setIsTransitioning(true);
                setWaitingForPlatformExit(true);
                // The actual transition will happen when we receive the 'platformPageExitComplete' event
            } else {
                // User is already authenticated (e.g., page refresh) - show main app immediately
                setShowAuthenticated(true);
                setIsTransitioning(false);
                setIsExiting(false);
                setWaitingForPlatformExit(false);
                setShowBlankScreen(false);
            }
        } else if (!isAuthenticated && showAuthenticated) {
            // Reset when user logs out
            setShowAuthenticated(false);
            setIsTransitioning(false);
            setIsExiting(false);
            setWaitingForPlatformExit(false);
            setShowBlankScreen(false);
        }
    }, [isAuthenticated, showAuthenticated, isTransitioning, isImporting, justCompletedImport]);
    
    // Don't show global loading - InitialPlatformSelect handles its own loading with SettingsLoading
    
    // If authenticated but transitioning, just show the authenticated view
    // No need for loading overlay since Firebase handles it automatically
    
    // Show blank screen during pause
    if (showBlankScreen) {
        return <BackgroundWrapper />;
    }
    
    // Show platform pages when not authenticated OR when exiting
    if (!isAuthenticated || isExiting) {
        return (
            <BackgroundWrapper>
                <div className={`w-full h-full transition-all duration-200 ease-out ${
                    isExiting ? 'opacity-0 transform -translate-x-2' : 'opacity-100 transform translate-x-0'
                }`}>
                    <Routes>
                        <Route path="/platform-select" element={<InitialPlatformSelect isTransitioning={isTransitioning} />} />
                        <Route path="*" element={<SimplePlatformPrompt />} />
                    </Routes>
                </div>
            </BackgroundWrapper>
        );
    }
    
    // If authenticated, show the main app with Layout wrapper
    return (
        <div className={`w-full h-full transition-all duration-400 ease-out ${
            showAuthenticated ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-4'
        }`}>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<ProtectedRoute><PerformanceGraph /></ProtectedRoute>} />
                    <Route path="PerformanceGraph" element={<ProtectedRoute><PerformanceGraph /></ProtectedRoute>} />
                    <Route path="studies-book" element={<ProtectedRoute><StudiesBook /></ProtectedRoute>} />
                    <Route path="studies-book/editor/new" element={<ProtectedRoute><StudyEditor /></ProtectedRoute>} />
                    <Route path="studies-book/editor/:studyId" element={<ProtectedRoute><StudyEditor /></ProtectedRoute>} />
                    <Route path="studies-book/study/:studyId" element={<ProtectedRoute><StudyEditor /></ProtectedRoute>} />
                    {/* Redirect authenticated users away from platform select */}
                    <Route path="platform-select" element={<ProtectedRoute><PerformanceGraph /></ProtectedRoute>} />
                </Route>
            </Routes>
        </div>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}