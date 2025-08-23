import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * PageTransition - A lightweight full-page animation wrapper
 * Animates the entire page as a single unit instead of individual components
 */
export function PageTransition({ 
  children, 
  isVisible = true,
  direction = 'right', // 'left', 'right', 'up', 'down'
  duration = 400,
  className = '',
  onEnterComplete = null,
  onExitComplete = null
}) {
  const [animationState, setAnimationState] = useState(isVisible ? 'visible' : 'hidden');
  
  // Handle visibility changes
  useEffect(() => {
    if (isVisible && animationState === 'hidden') {
      // Start entering animation
      setAnimationState('entering');
      
      // Complete entering after duration
      const timer = setTimeout(() => {
        setAnimationState('visible');
        if (onEnterComplete) onEnterComplete();
      }, duration);
      
      return () => clearTimeout(timer);
    } else if (!isVisible && animationState === 'visible') {
      // Start exiting animation
      setAnimationState('exiting');
      
      // Complete exiting after duration
      const timer = setTimeout(() => {
        setAnimationState('hidden');
        if (onExitComplete) onExitComplete();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, animationState, duration, onEnterComplete, onExitComplete]);
  
  // Direction-based transform classes
  const getTransformClasses = (state) => {
    const transforms = {
      right: {
        hidden: 'translate-x-full',
        entering: 'translate-x-0',
        visible: 'translate-x-0',
        exiting: '-translate-x-full'
      },
      left: {
        hidden: '-translate-x-full',
        entering: 'translate-x-0',
        visible: 'translate-x-0',
        exiting: 'translate-x-full'
      },
      up: {
        hidden: '-translate-y-full',
        entering: 'translate-y-0',
        visible: 'translate-y-0',
        exiting: 'translate-y-full'
      },
      down: {
        hidden: 'translate-y-full',
        entering: 'translate-y-0',
        visible: 'translate-y-0',
        exiting: '-translate-y-full'
      }
    };
    
    return transforms[direction][state] || 'translate-x-0';
  };
  
  // Opacity based on animation state
  const getOpacity = (state) => {
    return state === 'visible' || state === 'entering' ? 'opacity-100' : 'opacity-0';
  };
  
  // Don't render if completely hidden
  if (animationState === 'hidden') {
    return null;
  }
  
  return (
    <div 
      className={cn(
        // Base styles
        'w-full h-full',
        // Animation styles
        `transition-all duration-${duration} ease-out`,
        getOpacity(animationState),
        getTransformClasses(animationState),
        // Custom className
        className
      )}
      style={{
        transitionDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  );
}

/**
 * PageTransitionManager - Higher-level component for managing page transitions
 * Handles the coordination between exiting one page and entering another
 */
export function PageTransitionManager({ 
  currentPage, 
  children,
  transitionDuration = 400,
  blankScreenDuration = 200 
}) {
  const [displayedPage, setDisplayedPage] = useState(currentPage);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showBlankScreen, setShowBlankScreen] = useState(false);
  
  useEffect(() => {
    if (currentPage !== displayedPage && !isTransitioning) {
      // Start transition sequence
      setIsTransitioning(true);
      
      // Step 1: Exit current page
      const exitTimer = setTimeout(() => {
        // Step 2: Show blank screen
        setShowBlankScreen(true);
        
        const blankTimer = setTimeout(() => {
          // Step 3: Switch to new page and enter
          setDisplayedPage(currentPage);
          setShowBlankScreen(false);
          
          const enterTimer = setTimeout(() => {
            // Step 4: Transition complete
            setIsTransitioning(false);
          }, transitionDuration);
          
          return () => clearTimeout(enterTimer);
        }, blankScreenDuration);
        
        return () => clearTimeout(blankTimer);
      }, transitionDuration);
      
      return () => clearTimeout(exitTimer);
    }
  }, [currentPage, displayedPage, isTransitioning, transitionDuration, blankScreenDuration]);
  
  if (showBlankScreen) {
    return <div className="w-full h-full bg-slate-900" />;
  }
  
  return (
    <PageTransition
      isVisible={!isTransitioning}
      duration={transitionDuration}
      className="min-h-screen"
    >
      {children}
    </PageTransition>
  );
}

export default PageTransition;