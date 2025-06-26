import React from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export function NavigationButtons({
  currentIndex = 0,
  totalCount = 0,
  onPrevious,
  onNext,
  onReset,
  showReset = true,
  className = "",
  disabled = false
}) {
  const canGoPrevious = currentIndex > 0 && !disabled;
  const canGoNext = currentIndex < totalCount && !disabled;
  const canReset = currentIndex > 0 && !disabled;

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      {showReset && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={!canReset}
          className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/60 hover:border-slate-500 hover:text-slate-200 transition-all duration-200"
          title="Reset to beginning"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/60 hover:border-slate-500 hover:text-slate-200 transition-all duration-200"
          title="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <span className="text-slate-400 text-sm px-2 min-w-[60px] text-center">
          {currentIndex} / {totalCount}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!canGoNext}
          className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/60 hover:border-slate-500 hover:text-slate-200 transition-all duration-200"
          title="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {!showReset && <div />} {/* Spacer to maintain layout when reset is hidden */}
    </div>
  );
} 