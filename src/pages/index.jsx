import Layout from "./Layout.jsx";
import LoginPage from "./LoginPage";
import PerformanceGraph from "./PerformanceGraph";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield, Crown, Heart, Code, DollarSign, Users, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

// Persistent background wrapper
function BackgroundWrapper({ children }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {children}
        </div>
    );
}

// Simple login prompt component
function SimpleLoginPrompt() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isNavigating, setIsNavigating] = useState(false);
    const [isReturning, setIsReturning] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    
    // Initial entrance animation
    useEffect(() => {
        setIsVisible(true);
    }, []);
    
    // Check if we're returning from login page
    useEffect(() => {
        if (location.state?.returning) {
            setIsReturning(true);
            setIsVisible(false);
            // Trigger entrance animation
            setTimeout(() => {
                setIsVisible(true);
                setIsReturning(false);
            }, 50);
        }
    }, [location]);
    
    const handleConnectClick = async () => {
        setIsNavigating(true);
        
        // Near-instant navigation for overlapping transitions
        setTimeout(() => {
            navigate('/login', { state: { fromHome: true } });
        }, 50);
    };
    
    return (
        <div className="h-screen flex items-center justify-center transition-all duration-500">
            <div className="container mx-auto px-4 h-full flex items-center">
                <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
                    {/* Left Side - Main Content */}
                    <div className={`space-y-6 transition-all duration-300 ${
                        isNavigating ? 'opacity-0 transform -translate-x-8' : 
                        isReturning && !isVisible ? 'opacity-0 transform translate-x-8' :
                        isVisible ? 'opacity-100 transform translate-x-0' : 
                        'opacity-0 transform -translate-x-8'
                    }`}>
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
                            <p className="text-xl text-slate-300 mb-6">
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
                                <span className="text-emerald-300 font-semibold">100% Free</span>
                            </div>

                            {/* Open Source */}
                            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2 hover:bg-blue-500/20 transition-all duration-300">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                    <Code className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-blue-300 font-semibold">Open Source</span>
                            </div>

                            {/* Community Driven */}
                            <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-2 hover:bg-purple-500/20 transition-all duration-300">
                                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                                    <Users className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-purple-300 font-semibold">Community Driven</span>
                            </div>
                        </div>

                        {/* Connect Button with Chess.com Logo */}
                        <div className="flex justify-center">
                            <Button 
                                onClick={handleConnectClick}
                                disabled={isNavigating}
                                size="lg"
                                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white px-6 py-7 rounded-2xl text-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 group transform hover:scale-[1.02] disabled:transform-none disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center gap-4">
                                    {isNavigating ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span>Connecting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <img src="/chesscom_logo_wordmark.svg" alt="Chess.com Logo" className="h-8 w-auto transition-all duration-300 group-hover:scale-105" />
                                            <span>Connect Chess.com Account</span>
                                        </>
                                    )}
                                </div>
                            </Button>
                        </div>
                    </div>

                    {/* Right Side - Video Placeholder */}
                    <div className={`flex items-center justify-center transition-all duration-300 ${
                        isNavigating ? 'opacity-0 transform -translate-x-4' : 
                        isReturning && !isVisible ? 'opacity-0 transform translate-x-4' :
                        isVisible ? 'opacity-100 transform translate-x-0' : 
                        'opacity-0 transform -translate-x-4'
                    }`}>
                        <div className="relative w-full max-w-lg">
                            <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl border-2 border-slate-600 shadow-2xl overflow-hidden">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="w-20 h-20 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                            <Play className="w-8 h-8 text-white ml-1" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">See ChessScope in Action</h3>
                                            <p className="text-slate-300">
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
    const { isAuthenticated, isLoading } = useAuth();
    
    // Show loading spinner while checking authentication
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-4" />
                    <p className="text-slate-300">Loading ChessScope...</p>
                </div>
            </div>
        );
    }
    
    // If not authenticated, show login prompt or login page
    if (!isAuthenticated) {
        return (
            <BackgroundWrapper>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="*" element={<SimpleLoginPrompt />} />
                </Routes>
            </BackgroundWrapper>
        );
    }
    
    // If authenticated, show the main app with Layout wrapper
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<PerformanceGraph />} />
                <Route path="PerformanceGraph" element={<PerformanceGraph />} />
                {/* Redirect authenticated users away from login */}
                <Route path="login" element={<PerformanceGraph />} />
            </Route>
        </Routes>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}