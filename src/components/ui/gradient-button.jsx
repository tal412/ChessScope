import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Loader2 } from "lucide-react";

/**
 * GradientButton - A consistent gradient button component that handles disabled states elegantly
 *
 * @param {Object} props
 * @param {'primary' | 'green' | 'blue'} props.variant - The gradient variant to use
 * @param {boolean} props.loading - Whether the button is in a loading state
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {React.ReactNode} props.children - The button content
 * @param {string} props.className - Additional CSS classes
 */
const GradientButton = React.forwardRef(({
  children,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...props
}, ref) => {
  const isDisabled = disabled || loading;

  // Map variants to Tailwind utility classes
  const variantClasses = {
    primary: {
      enabled: "bg-gradient-primary hover:bg-gradient-primary-hover text-white",
      disabled: "bg-transparent border border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 cursor-not-allowed"
    },
    green: {
      enabled: "bg-gradient-green hover:bg-gradient-green-hover text-white",
      disabled: "bg-transparent border border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 cursor-not-allowed"
    },
    blue: {
      enabled: "bg-gradient-blue hover:bg-gradient-blue-hover text-white",
      disabled: "bg-transparent border border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 cursor-not-allowed"
    }
  };

  const currentVariant = variantClasses[variant] || variantClasses.primary;

  return (
    <Button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        "transition-all duration-200 font-medium",
        isDisabled ? currentVariant.disabled : currentVariant.enabled,
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </Button>
  );
});

GradientButton.displayName = "GradientButton";

// Export a convenience method for the primary amber/orange gradient
export const PrimaryGradientButton = React.forwardRef((props, ref) => (
  <GradientButton ref={ref} variant="primary" {...props} />
));

PrimaryGradientButton.displayName = "PrimaryGradientButton";

// Export a convenience method for the green gradient
export const GreenGradientButton = React.forwardRef((props, ref) => (
  <GradientButton ref={ref} variant="green" {...props} />
));

GreenGradientButton.displayName = "GreenGradientButton";

export { GradientButton };