import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Responsive breakpoint detection hook
export function useResponsiveLayout() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return { isMobile, isTablet };
}

// Grid layout calculation utilities
export function calculateGridLayout(visibleComponents, componentConfig, { isMobile, isTablet }) {
  const validComponents = visibleComponents.filter(Boolean);
  
  // Mobile layout - single component or prioritized component
  if (isMobile) {
    if (validComponents.length > 1) {
      // Show highest priority component on mobile
      const priorityComponent = validComponents.find(comp => componentConfig[comp]?.mobilePriority === 1) || validComponents[0];
      return {
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr',
        forceComponents: [priorityComponent],
        className: 'mobile-layout'
      };
    } else {
      return {
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr',
        forceComponents: validComponents,
        className: 'mobile-layout'
      };
    }
  }

  // Tablet layout - max 2 components
  if (isTablet) {
    if (validComponents.length >= 3) {
      // Show top 2 priority components
      const sortedComponents = validComponents.sort((a, b) => 
        (componentConfig[a]?.tabletPriority || 99) - (componentConfig[b]?.tabletPriority || 99)
      );
      const topTwo = sortedComponents.slice(0, 2);
      
      const columns = topTwo.map(comp => componentConfig[comp]?.tabletWidth || 'minmax(200px, 1fr)');
      
      return {
        gridTemplateColumns: columns.join(' '),
        gridTemplateRows: '1fr',
        forceComponents: topTwo,
        className: 'tablet-layout'
      };
    } else {
      const columns = validComponents.map(comp => componentConfig[comp]?.tabletWidth || 'minmax(200px, 1fr)');
      return {
        gridTemplateColumns: columns.join(' ') || '1fr',
        gridTemplateRows: '1fr',
        forceComponents: validComponents,
        className: 'tablet-layout'
      };
    }
  }

  // Desktop layout - all components with dynamic sizing
  const columns = validComponents.map(comp => {
    const config = componentConfig[comp];
    if (!config) return '1fr';
    
    // Determine which width to use based on number of active components
    if (validComponents.length === 1) {
      // Single component - use oneActive width
      return config.oneActive || '1fr';
    } else if (validComponents.length === 2) {
      // Two components - use twoActive width
      const sortedComponents = [...validComponents].sort();
      const combinationKey = sortedComponents.join('+');
      const width = config.twoActive?.[combinationKey] || config.desktopWidth || '1fr';
      return width;
    } else if (validComponents.length === 3) {
      // Three components - use threeActive width if available
      const sortedComponents = [...validComponents].sort();
      const combinationKey = sortedComponents.join('+');
      const width = config.threeActive?.[combinationKey] || config.desktopWidth || '1fr';
      return width;
    } else if (validComponents.length === 4) {
      // Four components - use fourActive width if available
      const sortedComponents = [...validComponents].sort();
      const combinationKey = sortedComponents.join('+');
      const width = config.fourActive?.[combinationKey] || config.desktopWidth || '1fr';
      return width;
    } else {
      // Five or more components - use desktopWidth as fallback
      return config.desktopWidth || '1fr';
    }
  });
  
  return {
    gridTemplateColumns: columns.join(' ') || '1fr',
    gridTemplateRows: '1fr',
    forceComponents: validComponents,
    className: 'desktop-layout'
  };
}

// App Bar Component - Compact navigation bar for consistent design
export function AppBar({ 
  title, 
  subtitle,
  icon: Icon,
  leftControls, 
  rightControls,
  centerControls,
  className = "",
  ...props 
}) {
  return (
    <header className={cn(
      "bg-slate-800/95 border-b border-slate-700/50 backdrop-blur-lg px-3 sm:px-4 py-3 flex-shrink-0 min-h-[3.5rem] max-h-[3.5rem]",
      className
    )} {...props}>
      <div className="flex items-center justify-between gap-2 sm:gap-4 h-full max-w-full">
        
        {/* Left Side - Controls + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Left Controls */}
          {leftControls && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {leftControls}
            </div>
          )}
          
          {/* Title with Icon */}
          {title && (
            <div className="flex items-center gap-2 min-w-0">
              {Icon && <Icon className="w-5 h-5 text-amber-500 flex-shrink-0" />}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-slate-100 truncate">{title}</h1>
                {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Center Controls */}
        {centerControls && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {centerControls}
          </div>
        )}

        {/* Right Controls */}
        {rightControls && (
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {rightControls}
          </div>
        )}
      </div>
    </header>
  );
}

// Flexible Layout Header Component (kept for backward compatibility)
export function FlexibleLayoutHeader({ 
  title, 
  subtitle,
  leftControls, 
  rightControls,
  centerControls,
  className = "",
  ...props 
}) {
  return (
    <AppBar 
      title={title}
      subtitle={subtitle}
      leftControls={leftControls}
      rightControls={rightControls}
      centerControls={centerControls}
      className={className}
      {...props}
    />
  );
}

// Component Toggle Button
export function ComponentToggleButton({ 
  isActive, 
  onClick, 
  icon: Icon, 
  label, 
  size = "sm",
  className = "",
  ...props 
}) {
  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size={size}
      onClick={onClick}
      className={cn(
        isActive ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700/30',
        className
      )}
      {...props}
    >
      <Icon className="w-4 h-4 sm:mr-2" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

// Main Flexible Layout Component
export function FlexibleLayout({ 
  children, 
  components = {},
  componentConfig = {},
  className = "",
  onLayoutChange,
  // AppBar props
  title,
  subtitle,
  icon: Icon,
  leftControls,
  rightControls,
  // Component toggle configuration
  componentToggleConfig = {},
  onComponentToggle,
  ...props 
}) {
  const { isMobile, isTablet } = useResponsiveLayout();
  
  // Calculate which components are visible
  const visibleComponents = Object.entries(components)
    .filter(([key, isVisible]) => isVisible)
    .map(([key]) => key);

  // Calculate grid layout
  const gridLayout = calculateGridLayout(visibleComponents, componentConfig, { isMobile, isTablet });

  // Notify parent of layout changes
  useEffect(() => {
    if (onLayoutChange) {
      onLayoutChange({ 
        visibleComponents, 
        gridLayout, 
        isMobile, 
        isTablet 
      });
    }
  }, [visibleComponents.join(','), gridLayout.gridTemplateColumns, isMobile, isTablet]); // Removed onLayoutChange from deps to prevent infinite loops

  // Trigger resize event when components change
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM updates are complete
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }, [gridLayout.gridTemplateColumns]);

  // Force specific components on mobile/tablet
  const shouldForceComponents = gridLayout.forceComponents && gridLayout.forceComponents.length !== visibleComponents.length;

  // Generate toggle buttons from configuration
  const toggleButtons = Object.entries(componentToggleConfig).map(([key, config]) => (
    <ComponentToggleButton
      key={key}
      isActive={components[key]}
      onClick={() => onComponentToggle?.(key)}
      icon={config.icon}
      label={config.label}
    />
  ));

  // Combine rightControls with toggle buttons, adding divider if both exist
  const combinedRightControls = (
    <>
      {rightControls && (
        <>
          {rightControls}
          {toggleButtons.length > 0 && (
            <div className="w-px h-6 bg-slate-600 mx-2" />
          )}
        </>
      )}
      {toggleButtons.length > 0 && (
        <div className="flex items-center gap-1 sm:gap-2">
          {toggleButtons}
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full">
      {/* AppBar with integrated toggle buttons */}
      <AppBar
        title={title}
        subtitle={subtitle}
        icon={Icon}
        leftControls={leftControls}
        rightControls={combinedRightControls}
      />
      
      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 min-h-0 overflow-hidden",
          className
        )}
        {...props}
      >
        <div 
          className={cn(
            "h-full transition-all duration-300 ease-in-out overflow-hidden",
            gridLayout.className
          )}
          style={{
            display: 'grid',
            gridTemplateColumns: gridLayout.gridTemplateColumns,
            gridTemplateRows: gridLayout.gridTemplateRows
          }}
        >
        {/* Render children based on visible components */}
        {visibleComponents.map(componentKey => {
          // Skip if this component is being forced out on mobile/tablet
          if (shouldForceComponents && !gridLayout.forceComponents.includes(componentKey)) {
            return null;
          }
          
          return children[componentKey] || null;
        })}
        
        {/* Empty State */}
        {visibleComponents.length === 0 && (
          <div className="col-span-full row-span-full flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <div className="w-16 h-16 text-slate-600 mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">All Components Hidden</h3>
              <p className="text-slate-400 mb-4">Use the view controls to show components.</p>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

// Layout Section Component - simplified without titles
export function LayoutSection({ 
  children, 
  className = "",
  headerControls,
  noPadding = false,
  ...props 
}) {
  return (
    <section 
      className={cn(
        "h-full border-r border-slate-700/50 bg-slate-800/50 backdrop-blur-xl overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="flex flex-col h-full w-full min-w-0">
        {/* Section Header - only show if there are header controls */}
        {headerControls && (
          <div className="p-3 border-b border-slate-700/50 bg-slate-700/30 flex-shrink-0">
            <div className="flex items-center justify-center">
              {headerControls}
            </div>
          </div>
        )}
        
        {/* Section Content */}
        <div className={cn(
          "flex-1 min-h-0 overflow-hidden",
          !noPadding && "p-2"
        )}>
          {children}
        </div>
      </div>
    </section>
  );
}

// Pre-defined component configurations
export const ComponentConfigs = {
  // Performance Graph Layout
  performanceGraph: {
    moves: {
      desktopWidth: 'minmax(280px, 20%)',
      // Width when only this component + 1 other is active
      twoActive: {
        'board+moves': 'minmax(280px, 30%)',
        'moves+board': 'minmax(280px, 30%)',
        'moves+graph': 'minmax(280px, 25%)'
      },
      // Width when only this component is active
      oneActive: '1fr'
    },
    board: {
      desktopWidth: 'minmax(220px, 28%)',
      twoActive: {
        'board+moves': '1fr',
        'moves+board': '1fr',
        'board+graph': 'minmax(220px, 35%)'
      },
      oneActive: '1fr'
    },
    graph: {
      desktopWidth: '1fr',
      twoActive: {
        'moves+graph': '1fr',
        'board+graph': '1fr'
      },
      oneActive: '1fr'
    }
  },
  
  // Opening Editor Layout
  openingEditor: {
    details: {
      desktopWidth: 'minmax(320px, 25%)',
      twoActive: {
        'board+details': 'minmax(320px, 30%)',
        'details+board': 'minmax(320px, 30%)',
        'details+graph': 'minmax(320px, 30%)'
      },
      oneActive: '1fr'
    },
    board: {
      desktopWidth: '1fr',
      twoActive: {
        'board+details': '1fr',
        'details+board': '1fr',
        'board+graph': '1fr'
      },
      oneActive: '1fr'
    },
    graph: {
      desktopWidth: '1fr',
      twoActive: {
        'details+graph': '1fr',
        'board+graph': '1fr'
      },
      oneActive: '1fr'
    }
  }
}; 