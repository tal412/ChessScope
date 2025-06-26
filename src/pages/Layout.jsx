import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Shield, TrendingUp, Database, User, Crown, ChevronLeft, ChevronRight, Activity, Network } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default to collapsed
  
  const navigationItems = [
    { name: "Dashboard", url: createPageUrl("Dashboard"), icon: TrendingUp },
    { name: "Import Games", url: createPageUrl("Import"), icon: Database },
    { name: "White Opening Tree", url: createPageUrl("WhiteTree"), icon: Crown },
    { name: "Black Opening Tree", url: createPageUrl("BlackTree"), icon: Shield },
    { name: "Performance Graph", url: createPageUrl("PerformanceGraph"), icon: Network },
    { name: "Profile", url: createPageUrl("Profile"), icon: User },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-full max-h-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className={`bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 h-full flex flex-col justify-between transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
            <div>
              <div className={`p-4 border-b border-slate-700/50 ${isSidebarCollapsed ? 'h-[89px] flex items-center justify-center' : 'p-6'}`}>
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
          <div className="p-4 border-t border-slate-700/50">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-slate-300 hover:text-white hover:bg-slate-700/50 w-full outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border border-transparent"
                >
                  {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
              </TooltipTrigger>
              {isSidebarCollapsed && (
                <TooltipContent 
                  side="right" 
                  className="bg-slate-800 border-slate-700 text-white"
                  sideOffset={10}
                >
                  <p>Expand Menu</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full max-h-full overflow-hidden">
          <header className="bg-slate-800/30 backdrop-blur-xl border-b border-slate-700/50 px-8 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{currentPageName}</h2>
                <p className="text-slate-400 mt-1">
                  {currentPageName === "Dashboard" && "Overview of your chess performance"}
                  {currentPageName === "Import" && "Import your Chess.com games"}
                  {currentPageName === "WhiteTree" && "Analyze your performance as White"}
                  {currentPageName === "BlackTree" && "Analyze your performance as Black"}
                  {currentPageName === "PerformanceGraph" && "Revolutionary chess opening graph visualization"}
                  {currentPageName === "Profile" && "Your chess profile and statistics"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-slate-400">Chess.com Connected</p>
                  <p className="text-sm text-green-400">● Online</p>
                </div>
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-8 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
