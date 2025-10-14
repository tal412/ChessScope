import React from 'react';
import { cn } from '@/lib/utils';
import BrandIcon from './brand-icon';
import { Button } from './button';
import { PrimaryGradientButton } from './gradient-button';

/**
 * EmptyState - Consistent empty state component for when there's no data
 *
 * @param {Object} props
 * @param {React.ElementType} props.icon - Icon component to display
 * @param {string} props.title - Main title text
 * @param {string} props.description - Description text
 * @param {React.ReactNode} props.action - Action button or custom action element
 * @param {'sm' | 'md' | 'lg'} props.size - Size variant
 * @param {boolean} props.useBrandIcon - Use BrandIcon instead of custom icon
 * @param {string} props.className - Additional CSS classes
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  useBrandIcon = false,
  className,
  ...props
}) => {
  const sizeConfig = {
    sm: {
      container: 'p-6 space-y-4',
      iconSize: 'md',
      iconClass: 'w-12 h-12',
      titleClass: 'text-lg font-semibold',
      descClass: 'text-sm'
    },
    md: {
      container: 'p-8 space-y-6',
      iconSize: 'md',
      iconClass: 'w-16 h-16',
      titleClass: 'text-xl font-bold',
      descClass: 'text-base'
    },
    lg: {
      container: 'p-12 space-y-8',
      iconSize: 'lg',
      iconClass: 'w-20 h-20',
      titleClass: 'text-2xl font-bold',
      descClass: 'text-lg'
    }
  };

  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        config.container,
        className
      )}
      {...props}
    >
      <div className="bg-card border border-border rounded-xl p-8 space-y-6 max-w-md w-full">
        <div className="space-y-4 text-center">
          {/* Icon */}
          {useBrandIcon ? (
            <BrandIcon size={config.iconSize} icon={Icon} className="mx-auto" />
          ) : Icon ? (
            <div className="flex justify-center">
              <div className="p-4 bg-muted rounded-full">
                <Icon className={cn(config.iconClass, 'text-muted-foreground')} />
              </div>
            </div>
          ) : null}

          {/* Title */}
          {title && (
            <h3 className={cn(
              config.titleClass,
              'text-foreground'
            )}>
              {title}
            </h3>
          )}

          {/* Description */}
          {description && (
            <p className={cn(
              config.descClass,
              'text-muted-foreground'
            )}>
              {description}
            </p>
          )}
        </div>

        {/* Action */}
        {action && (
          <div className="flex flex-col items-center space-y-4">
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * SimpleEmptyState - Minimal empty state without card wrapper
 */
export const SimpleEmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center space-y-4',
        className
      )}
      {...props}
    >
      {Icon && (
        <Icon className="w-12 h-12 text-muted-foreground opacity-50" />
      )}

      {title && (
        <p className="text-lg font-medium text-foreground">
          {title}
        </p>
      )}

      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};

/**
 * LoadingState - Consistent loading state that matches EmptyState style
 */
export const LoadingState = ({
  title = 'Loading...',
  description,
  size = 'md',
  className,
  ...props
}) => {
  const sizeConfig = {
    sm: {
      container: 'p-6',
      spinnerSize: 'md',
      titleClass: 'text-lg font-semibold'
    },
    md: {
      container: 'p-8',
      spinnerSize: 'lg',
      titleClass: 'text-xl font-bold'
    },
    lg: {
      container: 'p-12',
      spinnerSize: 'xl',
      titleClass: 'text-2xl font-bold'
    }
  };

  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        config.container,
        className
      )}
      {...props}
    >
      <div className="text-center space-y-4">
        <div className={cn(
          'animate-spin rounded-full border-4 spinner-primary mx-auto',
          config.spinnerSize === 'md' && 'h-12 w-12',
          config.spinnerSize === 'lg' && 'h-16 w-16',
          config.spinnerSize === 'xl' && 'h-20 w-20'
        )} />

        {title && (
          <p className={cn(config.titleClass, 'text-foreground')}>
            {title}
          </p>
        )}

        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default EmptyState;