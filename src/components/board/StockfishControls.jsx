import React from 'react';
import { Button } from '@/components/ui/button';
import { Fish, Loader2 } from 'lucide-react';

const StockfishControls = ({ 
  stockfishEnabled = false,
  isAnalyzing = false,
  onToggle = null,
  disabled = false,
  showStatusText = false,
  topMoves = []
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        disabled={disabled || (isAnalyzing && !stockfishEnabled)}
        className={`transition-all duration-200 ${
          stockfishEnabled || isAnalyzing
            ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90 hover:border-primary/90'
            : 'bg-secondary/50 border-border text-muted-foreground hover:bg-accent/60 hover:border-border hover:text-foreground'
        }`}
        title={stockfishEnabled ? "Disable Stockfish analysis" : "Enable Stockfish analysis"}
      >
        {isAnalyzing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Fish className="w-4 h-4" />
        )}
      </Button>
      
      {showStatusText && (
        <div className="text-xs text-muted-foreground">
          {stockfishEnabled ? (
            isAnalyzing ? (
              "Analyzing..."
            ) : topMoves.length > 0 ? (
              `Best: ${topMoves[0].san}`
            ) : (
              "Ready"
            )
          ) : (
            "Disabled"
          )}
        </div>
      )}
    </div>
  );
};

export default StockfishControls;