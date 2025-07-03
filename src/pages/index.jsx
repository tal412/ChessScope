import Layout from "./Layout.jsx";
import LoginPage from "./LoginPage";
import PerformanceGraph from "./PerformanceGraph";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

// Simple login prompt component
function SimpleLoginPrompt() {
    const navigate = useNavigate();
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-8">
                    <Shield className="w-12 h-12 text-slate-900" />
                </div>
                
                <h1 className="text-3xl font-bold text-white mb-4">
                    Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">ChessScope</span>
                </h1>
                
                <p className="text-lg text-slate-300 mb-6">
                    Connect your Chess.com account to start analyzing your games and tracking your progress.
                </p>
                
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-8">
                    <div className="flex items-center justify-center gap-2 text-green-300 font-semibold mb-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>100% Free & Open Source</span>
                    </div>
                    <p className="text-green-200 text-sm">
                        No subscriptions, no ads, no premium features. Always free for the chess community.
                    </p>
                </div>
                
                <Button 
                    onClick={() => navigate('/login')}
                    size="lg"
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full"
                >
                    <Crown className="w-5 h-5 mr-2" />
                    Connect Chess.com Account
                </Button>
                
                <p className="text-slate-400 text-sm mt-4">
                    Safe & secure • No passwords required • Access your public games only
                </p>
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
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<SimpleLoginPrompt />} />
            </Routes>
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