import React, { useEffect, useState } from 'react';
import { Shield, Monitor, Play, ExternalLink, Smartphone, DollarSign, Code, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MobileRedirect() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user is on mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webOS|iPhone|iPad|iPod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      
      setIsMobile(isMobileDevice || (isTouchDevice && isSmallScreen));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Set viewport meta tag for proper mobile rendering
    let viewport = document.querySelector('meta[name=viewport]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  if (!isMobile) return null;

  return (
    <div className="mobile-redirect-wrapper fixed inset-0 z-[9999] bg-background overflow-y-auto">
      <div className="mobile-redirect-container min-h-screen flex flex-col items-center justify-center px-4 py-8">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold text-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              ChessScope
            </span>
          </h1>
          <p className="text-muted-foreground text-center mt-2 text-sm">
            Advanced chess game analysis and performance tracking
          </p>
        </div>

        {/* Three Key Features - Same as desktop */}
        <div className="flex flex-wrap gap-3 justify-center mb-6 px-4">
          {/* Free */}
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-emerald-400 font-semibold text-sm">100% Free</span>
          </div>

          {/* Open Source */}
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
              <Code className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-blue-400 font-semibold text-sm">Open Source</span>
          </div>

          {/* Community Driven */}
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
            <div className="w-7 h-7 bg-purple-500 rounded-lg flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-purple-400 font-semibold text-sm">Community Driven</span>
          </div>
        </div>

        {/* Mobile Not Supported Card */}
        <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Monitor className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold">Desktop Required</h2>
          </div>
          
          <p className="text-muted-foreground text-sm mb-4">
            ChessScope is currently not supported on mobile devices. Please visit us on a desktop browser to access our advanced analysis features and interactive visualizations.
          </p>

          {/* Video Preview */}
          <div className="relative bg-secondary rounded-lg aspect-video mb-4 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Play className="w-5 h-5 text-amber-500 ml-0.5" />
                </div>
                <p className="text-xs text-muted-foreground px-4">
                  Watch how ChessScope transforms your chess analysis
                </p>
              </div>
            </div>
            {/* Decorative browser elements */}
            <div className="absolute top-2 left-2 flex gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full opacity-60"></div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full opacity-60"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full opacity-60"></div>
            </div>
          </div>

          {/* Features you're missing */}
          <div className="space-y-2 mb-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What you'll get on desktop:</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Interactive game analysis with move visualization</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Performance graphs and statistics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Study creation and management tools</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Real-time position evaluation</span>
              </li>
            </ul>
          </div>

          {/* CTA Button */}
          <Button 
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
            onClick={() => {
              // Option to copy link or share
              if (navigator.share) {
                navigator.share({
                  title: 'ChessScope',
                  text: 'Check out ChessScope - Advanced Chess Analysis Platform',
                  url: window.location.origin
                });
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.origin);
                alert('Link copied! Open it on your desktop browser.');
              }
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Share to Desktop
          </Button>
        </div>

        {/* Desktop Reminder */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Monitor className="w-4 h-4" />
          <span>Open this link on your desktop computer to continue</span>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            © 2024 ChessScope • Free & Open Source
          </p>
        </div>
      </div>
    </div>
  );
}