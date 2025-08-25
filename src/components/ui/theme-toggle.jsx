import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/ThemeContext'

export const ThemeToggle = React.forwardRef(({ className = "", variant = "ghost", size = "sm", sidebar = false, collapsed = false }, ref) => {
  const { theme, toggleTheme } = useTheme()

  if (sidebar) {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        onClick={toggleTheme}
        className={`transition-all duration-300 ${collapsed ? 'px-3' : 'w-full justify-start'} ${className}`}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        <Sun
          className={`h-4 w-4 transition-all duration-300 flex-shrink-0 ${
            theme === 'light' 
              ? 'rotate-0 scale-100' 
              : 'rotate-90 scale-0'
          }`}
        />
        <Moon
          className={`${collapsed ? 'absolute' : 'absolute'} h-4 w-4 transition-all duration-300 flex-shrink-0 ${
            theme === 'dark' 
              ? 'rotate-0 scale-100' 
              : '-rotate-90 scale-0'
          }`}
        />
        {!collapsed && (
          <span className="ml-2">
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </span>
        )}
      </Button>
    )
  }

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={`relative h-9 w-9 rounded-full transition-all duration-300 hover:scale-105 ${className}`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      <Sun
        className={`h-4 w-4 transition-all duration-300 ${
          theme === 'light' 
            ? 'rotate-0 scale-100' 
            : 'rotate-90 scale-0'
        }`}
      />
      <Moon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          theme === 'dark' 
            ? 'rotate-0 scale-100' 
            : '-rotate-90 scale-0'
        }`}
      />
    </Button>
  )
})

ThemeToggle.displayName = "ThemeToggle"

export default ThemeToggle