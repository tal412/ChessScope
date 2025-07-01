# NavigationButtons Component

A flexible and reusable navigation component that can be used across different contexts in the application.

## Features

- **Responsive Layout**: Spreads controls across the full width
- **Backward Compatible**: Works with existing legacy props
- **Flexible Configuration**: Supports different navigation contexts
- **Custom Buttons**: Allows adding custom buttons to left/right sides
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Presets**: Pre-configured setups for common use cases

## Basic Usage

```jsx
import { NavigationButtons, NavigationPresets } from '@/components/ui/navigation-buttons';

// Basic usage with presets
<NavigationButtons
  currentIndex={currentMoveIndex}
  totalCount={totalMoves}
  onPrevious={handlePrevious}
  onNext={handleNext}
  onReset={handleReset}
  features={NavigationPresets.chessboard.features}
  labels={NavigationPresets.chessboard.labels}
/>
```

## Available Presets

### `NavigationPresets.chessboard`
Perfect for chess move navigation with all features enabled:
- ✅ Reset button
- ✅ Flip button  
- ✅ Counter display
- Optimized labels for chess context

### `NavigationPresets.openingTree`
Ideal for opening tree navigation:
- ✅ Reset button
- ❌ Flip button (not needed)
- ✅ Counter display
- Tree-specific labels

### `NavigationPresets.analysis`
Minimal setup for analysis variations:
- ❌ Reset button
- ❌ Flip button
- ✅ Counter display
- Analysis-focused labels

### `NavigationPresets.tutorial`
Great for step-by-step tutorials:
- ✅ Reset button
- ❌ Flip button
- ✅ Counter display
- Tutorial-specific labels

## Advanced Usage

### Custom Configuration

```jsx
<NavigationButtons
  currentIndex={step}
  totalCount={totalSteps}
  onPrevious={goBack}
  onNext={goForward}
  onReset={restart}
  features={{
    showReset: true,
    showFlip: false,
    showCounter: true
  }}
  labels={{
    previous: "Previous step",
    next: "Next step", 
    reset: "Start over"
  }}
  styling={{
    className: "my-custom-class",
    size: "md"
  }}
/>
```

### With Custom Buttons

```jsx
<NavigationButtons
  currentIndex={currentIndex}
  totalCount={totalCount}
  onPrevious={handlePrevious}
  onNext={handleNext}
  features={NavigationPresets.chessboard.features}
  customButtons={{
    left: [
      {
        icon: Save,
        title: "Save position",
        onClick: handleSave,
        className: "text-green-400"
      }
    ],
    right: [
      {
        icon: Settings,
        title: "Settings",
        onClick: openSettings
      },
      {
        icon: Help,
        title: "Help",
        onClick: showHelp
      }
    ]
  }}
/>
```

## Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentIndex` | `number` | `0` | Current position (0-based) |
| `totalCount` | `number` | `0` | Total number of items |
| `onPrevious` | `function` | - | Previous navigation handler |
| `onNext` | `function` | - | Next navigation handler |
| `onReset` | `function` | - | Reset handler (optional) |
| `onFlip` | `function` | - | Flip/rotate handler (optional) |
| `features` | `object` | `{}` | Feature toggles |
| `features.showReset` | `boolean` | `true` | Show reset button |
| `features.showFlip` | `boolean` | `false` | Show flip button |
| `features.showCounter` | `boolean` | `true` | Show counter display |
| `labels` | `object` | `{}` | Custom accessibility labels |
| `styling` | `object` | `{}` | Styling options |
| `styling.className` | `string` | `""` | Additional CSS classes |
| `styling.size` | `string` | `"sm"` | Button size |
| `disabled` | `boolean` | `false` | Disable all buttons |
| `customButtons` | `object` | `{}` | Custom button configuration |
| `customButtons.left` | `array` | - | Custom buttons for left side |
| `customButtons.right` | `array` | - | Custom buttons for right side |

### Custom Button Object

```typescript
{
  icon?: LucideIcon,     // Optional icon component
  label?: string,        // Optional text label
  title: string,         // Tooltip text (required)
  onClick: function,     // Click handler (required)
  disabled?: boolean,    // Optional disabled state
  className?: string     // Optional additional CSS classes
}
```

## Legacy Support

The component maintains backward compatibility with the old API:

```jsx
// Old API still works
<NavigationButtons
  currentIndex={index}
  totalCount={total}
  onPrevious={prev}
  onNext={next}
  onReset={reset}
  onFlip={flip}
  showReset={true}
  showFlip={true}
  className="my-class"
  disabled={false}
/>
```

## Migration Guide

### From Legacy Props

```jsx
// Before
<NavigationButtons
  showReset={true}
  showFlip={false}
  className="custom-nav"
/>

// After (recommended)
<NavigationButtons
  features={{
    showReset: true,
    showFlip: false
  }}
  styling={{
    className: "custom-nav"
  }}
/>

// Or use a preset
<NavigationButtons
  features={NavigationPresets.openingTree.features}
  labels={NavigationPresets.openingTree.labels}
/>
```

## Examples by Use Case

### Chess Game Navigation
```jsx
<NavigationButtons
  currentIndex={moveIndex}
  totalCount={moves.length}
  onPrevious={() => goToMove(moveIndex - 1)}
  onNext={() => goToMove(moveIndex + 1)}
  onReset={() => goToMove(0)}
  onFlip={toggleBoardOrientation}
  features={NavigationPresets.chessboard.features}
  labels={NavigationPresets.chessboard.labels}
/>
```

### Opening Tree Browser
```jsx
<NavigationButtons
  currentIndex={pathLength}
  totalCount={maxDepth}
  onPrevious={goBackOneMove}
  onNext={null} // Tree navigation is click-driven
  onReset={goToRoot}
  features={NavigationPresets.openingTree.features}
  labels={NavigationPresets.openingTree.labels}
/>
```

### Tutorial Steps
```jsx
<NavigationButtons
  currentIndex={currentStep}
  totalCount={tutorial.steps.length}
  onPrevious={prevStep}
  onNext={nextStep}
  onReset={restartTutorial}
  features={NavigationPresets.tutorial.features}
  labels={NavigationPresets.tutorial.labels}
  customButtons={{
    right: [
      {
        icon: BookOpen,
        title: "View reference",
        onClick: openReference
      }
    ]
  }}
/>
``` 