import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Spinner - Consistent loading spinner component
 *
 * @param {Object} props
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} props.size - Size of the spinner
 * @param {'icon' | 'circle' | 'dots'} props.variant - Visual style
 * @param {string} props.color - Color theme (primary, secondary, white, etc.)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.label - Accessibility label
 * @param {boolean} props.center - Center the spinner in its container
 */
const Spinner = ({
  size = 'md',
  variant = 'icon',
  color = 'primary',
  className,
  label = 'Loading...',
  center = false,
  ...props
}) => {
  const sizeConfig = {
    xs: { icon: 'w-3 h-3', circle: 'w-4 h-4', borderWidth: 'border-2' },
    sm: { icon: 'w-4 h-4', circle: 'w-8 h-8', borderWidth: 'border-2' },
    md: { icon: 'w-6 h-6', circle: 'w-12 h-12', borderWidth: 'border-4' },
    lg: { icon: 'w-8 h-8', circle: 'w-16 h-16', borderWidth: 'border-4' },
    xl: { icon: 'w-12 h-12', circle: 'w-20 h-20', borderWidth: 'border-4' }
  };

  const colorConfig = {
    primary: {
      icon: 'text-amber-500',
      circle: 'border-border border-t-amber-500',
      dots: 'bg-amber-500'
    },
    secondary: {
      icon: 'text-blue-500',
      circle: 'border-border border-t-blue-500',
      dots: 'bg-blue-500'
    },
    white: {
      icon: 'text-white',
      circle: 'border-white/20 border-t-white',
      dots: 'bg-white'
    },
    muted: {
      icon: 'text-muted-foreground',
      circle: 'border-border border-t-muted-foreground',
      dots: 'bg-muted-foreground'
    },
    purple: {
      icon: 'text-purple-500',
      circle: 'border-border border-t-purple-500',
      dots: 'bg-purple-500'
    },
    green: {
      icon: 'text-green-500',
      circle: 'border-border border-t-green-500',
      dots: 'bg-green-500'
    }
  };

  const config = sizeConfig[size];
  const colors = colorConfig[color] || colorConfig.primary;

  const wrapperClasses = cn(
    center && 'flex items-center justify-center',
    className
  );

  if (variant === 'icon') {
    return (
      <div className={wrapperClasses} {...props}>
        <Loader2
          className={cn(
            config.icon,
            'animate-spin',
            colors.icon
          )}
          aria-label={label}
        />
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div className={wrapperClasses} {...props}>
        <div
          className={cn(
            'rounded-full animate-spin',
            config.circle,
            config.borderWidth,
            colors.circle
          )}
          aria-label={label}
        />
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={wrapperClasses} {...props}>
        <div className="flex space-x-1" aria-label={label}>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                'rounded-full animate-pulse',
                size === 'xs' && 'w-1 h-1',
                size === 'sm' && 'w-1.5 h-1.5',
                size === 'md' && 'w-2 h-2',
                size === 'lg' && 'w-3 h-3',
                size === 'xl' && 'w-4 h-4',
                colors.dots
              )}
              style={{
                animationDelay: `${index * 150}ms`
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
};

/**
 * LoadingOverlay - Full page or container loading overlay
 */
export const LoadingOverlay = ({
  children,
  loading = false,
  label = 'Loading...',
  blur = true,
  spinnerProps = {},
  className,
  ...props
}) => {
  if (!loading) return children;

  return (
    <div className={cn('relative', className)} {...props}>
      {children}
      <div
        className={cn(
          'absolute inset-0 z-50 flex items-center justify-center',
          'bg-background/50',
          blur && 'backdrop-blur-sm'
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" {...spinnerProps} />
          {label && (
            <p className="text-sm text-muted-foreground font-medium">
              {label}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * InlineSpinner - Small spinner for inline use (buttons, text, etc.)
 */
export const InlineSpinner = ({
  size = 'sm',
  className,
  ...props
}) => {
  return (
    <Spinner
      size={size}
      variant="icon"
      className={cn('inline-block', className)}
      {...props}
    />
  );
};

export default Spinner;