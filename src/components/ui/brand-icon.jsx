import React from 'react';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BrandIcon - Consistent brand logo component used throughout the app
 *
 * @param {Object} props
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} props.size - Size variant
 * @param {React.ElementType} props.icon - Icon component (defaults to Shield)
 * @param {string} props.className - Additional classes for the container
 * @param {string} props.iconClassName - Additional classes for the icon
 * @param {boolean} props.animated - Whether to add hover animation
 */
const BrandIcon = ({
  size = 'md',
  icon: Icon = Shield,
  className,
  iconClassName,
  animated = false,
  ...props
}) => {
  const sizeConfig = {
    xs: {
      container: 'w-8 h-8 rounded-lg',
      icon: 'w-4 h-4'
    },
    sm: {
      container: 'w-10 h-10 rounded-xl',
      icon: 'w-6 h-6'
    },
    md: {
      container: 'w-16 h-16 rounded-2xl',
      icon: 'w-10 h-10'
    },
    lg: {
      container: 'w-20 h-20 rounded-2xl',
      icon: 'w-12 h-12'
    },
    xl: {
      container: 'w-24 h-24 rounded-3xl',
      icon: 'w-14 h-14'
    }
  };

  const config = sizeConfig[size] || sizeConfig.md;

  return (
    <div
      className={cn(
        config.container,
        'bg-gradient-primary',
        'flex items-center justify-center flex-shrink-0',
        animated && 'transition-transform duration-300 hover:scale-105',
        className
      )}
      {...props}
    >
      <Icon className={cn(
        config.icon,
        'text-background',
        iconClassName
      )} />
    </div>
  );
};

/**
 * BrandText - Consistent brand text component
 */
export const BrandText = ({
  children = 'ChessScope',
  className,
  size = 'default',
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-2xl',
    default: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-6xl'
  };

  return (
    <span
      className={cn(
        'font-bold text-transparent bg-clip-text',
        'bg-gradient-primary',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

/**
 * BrandLogo - Combined icon and text logo
 */
export const BrandLogo = ({
  showText = true,
  size = 'md',
  orientation = 'horizontal',
  className,
  textClassName,
  iconSize,
  ...props
}) => {
  const textSizeMap = {
    xs: 'sm',
    sm: 'default',
    md: 'lg',
    lg: 'xl',
    xl: 'xl'
  };

  return (
    <div
      className={cn(
        'flex items-center',
        orientation === 'horizontal' ? 'flex-row gap-3' : 'flex-col gap-2',
        className
      )}
      {...props}
    >
      <BrandIcon size={iconSize || size} />
      {showText && (
        <BrandText size={textSizeMap[size]} className={textClassName} />
      )}
    </div>
  );
};

// Export both as default and named export for flexibility
export { BrandIcon };
export default BrandIcon;