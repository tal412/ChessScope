import React from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight, RotateCcw, ArrowUpDown } from 'lucide-react';

/**
 * NavigationButtons - A reusable navigation component
 * 
 * @param {Object} props - Navigation configuration
 * @param {number} props.currentIndex - Current position/index (0-based)
 * @param {number} props.totalCount - Total number of items
 * @param {Function} props.onPrevious - Handler for previous navigation
 * @param {Function} props.onNext - Handler for next navigation
 * @param {Function} [props.onReset] - Handler for reset action (optional)
 * @param {Function} [props.onFlip] - Handler for flip/rotate action (optional)
 * @param {Object} [props.features] - Feature toggles
 * @param {boolean} [props.features.showReset=true] - Show reset button
 * @param {boolean} [props.features.showFlip=false] - Show flip button
 * @param {boolean} [props.features.showCounter=true] - Show current/total counter
 * @param {Object} [props.labels] - Custom labels for accessibility
 * @param {string} [props.labels.previous="Previous"] - Previous button title
 * @param {string} [props.labels.next="Next"] - Next button title
 * @param {string} [props.labels.reset="Reset to beginning"] - Reset button title
 * @param {string} [props.labels.flip="Flip board"] - Flip button title
 * @param {Object} [props.styling] - Custom styling options
 * @param {string} [props.styling.className=""] - Additional CSS classes
 * @param {string} [props.styling.size="sm"] - Button size
 * @param {boolean} [props.disabled=false] - Disable all buttons
 * @param {Object} [props.customButtons] - Additional custom buttons
 * @param {Array} [props.customButtons.left] - Custom buttons for left side
 * @param {Array} [props.customButtons.right] - Custom buttons for right side
 */
export function NavigationButtons({
  // Core navigation props
  currentIndex = 0,
  totalCount = 0,
  onPrevious,
  onNext,
  onReset,
  onFlip,
  
  // Feature configuration
  features = {},
  
  // Labels for accessibility
  labels = {},
  
  // Styling options
  styling = {},
  
  // Global disable state
  disabled = false,
  
  // Custom buttons
  customButtons = {},
  
  // Legacy props for backward compatibility
  showReset,
  showFlip,
  className,
}) {
  // Merge legacy props with new structure for backward compatibility
  const config = {
    features: {
      showReset: features.showReset ?? showReset ?? true,
      showFlip: features.showFlip ?? showFlip ?? false,
      showCounter: features.showCounter ?? true,
      ...features
    },
    labels: {
      previous: labels.previous ?? "Previous",
      next: labels.next ?? "Next", 
      reset: labels.reset ?? "Reset to beginning",
      flip: labels.flip ?? "Flip board",
      ...labels
    },
    styling: {
      className: styling.className ?? className ?? "",
      size: styling.size ?? "sm",
      ...styling
    }
  };

  // Calculate navigation states
  const canGoPrevious = currentIndex > 0 && !disabled;
  const canGoNext = currentIndex < totalCount && !disabled;
  const canReset = currentIndex > 0 && !disabled;

  // Button styling
  const buttonClass = "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/60 hover:border-slate-500 hover:text-slate-200 transition-all duration-200";

  return (
    <div className={`flex items-center justify-between w-full ${config.styling.className}`}>
      {/* Left side - Reset button + custom buttons */}
      <div className="flex items-center gap-1">
        {config.features.showReset && onReset && (
          <Button
            variant="outline"
            size={config.styling.size}
            onClick={onReset}
            disabled={!canReset}
            className={buttonClass}
            title={config.labels.reset}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
        
        {/* Custom left buttons */}
        {customButtons.left?.map((button, index) => (
          <Button
            key={`left-${index}`}
            variant="outline"
            size={config.styling.size}
            onClick={button.onClick}
            disabled={button.disabled ?? disabled}
            className={`${buttonClass} ${button.className || ''}`}
            title={button.title}
          >
            {button.icon && <button.icon className="w-4 h-4" />}
            {button.label && <span className="ml-1">{button.label}</span>}
          </Button>
        ))}
        
        {(!config.features.showReset || !onReset) && !customButtons.left?.length && (
          <div /> // Placeholder to maintain layout
        )}
      </div>

      {/* Center - Navigation controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size={config.styling.size}
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={buttonClass}
          title={config.labels.previous}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {config.features.showCounter && (
          <span className="text-slate-400 text-sm px-2 min-w-[60px] text-center">
            {currentIndex} / {totalCount}
          </span>
        )}

        <Button
          variant="outline"
          size={config.styling.size}
          onClick={onNext}
          disabled={!canGoNext}
          className={buttonClass}
          title={config.labels.next}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Right side - Flip button + custom buttons */}
      <div className="flex items-center gap-1">
        {/* Custom right buttons */}
        {customButtons.right?.map((button, index) => (
          <Button
            key={`right-${index}`}
            variant="outline"
            size={config.styling.size}
            onClick={button.onClick}
            disabled={button.disabled ?? disabled}
            className={`${buttonClass} ${button.className || ''}`}
            title={button.title}
          >
            {button.icon && <button.icon className="w-4 h-4" />}
            {button.label && <span className="ml-1">{button.label}</span>}
          </Button>
        ))}
        
        {config.features.showFlip && onFlip && (
          <Button
            variant="outline"
            size={config.styling.size}
            onClick={onFlip}
            disabled={disabled}
            className={buttonClass}
            title={config.labels.flip}
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        )}
        
        {(!config.features.showFlip || !onFlip) && !customButtons.right?.length && (
          <div /> // Placeholder to maintain layout
        )}
      </div>
    </div>
  );
}

// Export navigation presets for common use cases
export const NavigationPresets = {
  // Chessboard navigation with all features
  chessboard: {
    features: {
      showReset: true,
      showFlip: true,
      showCounter: true
    },
    labels: {
      previous: "Previous move",
      next: "Next move",
      reset: "Reset to starting position",
      flip: "Flip board orientation"
    }
  },
  
  // Opening moves navigation
  openingMoves: {
    features: {
      showReset: true,
      showFlip: false,
      showCounter: true
    },
    labels: {
      previous: "Back one move",
      next: "Forward one move", 
      reset: "Reset to root position"
    }
  },
  
  // Legacy alias for backward compatibility
  openingTree: {
    features: {
      showReset: true,
      showFlip: false,
      showCounter: true
    },
    labels: {
      previous: "Back one move",
      next: "Forward one move", 
      reset: "Reset to root position"
    }
  },
  
  // Analysis navigation (minimal)
  analysis: {
    features: {
      showReset: false,
      showFlip: false,
      showCounter: true
    },
    labels: {
      previous: "Previous variation",
      next: "Next variation"
    }
  },
  
  // Tutorial/step navigation
  tutorial: {
    features: {
      showReset: true,
      showFlip: false,
      showCounter: true
    },
    labels: {
      previous: "Previous step",
      next: "Next step",
      reset: "Start over"
    }
  }
}; 