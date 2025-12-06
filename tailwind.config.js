/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))',
				elevated: 'hsl(var(--card-elevated))',
				'elevated-border': 'hsl(var(--card-elevated-border))',
				'elevated-shadow': 'hsl(var(--card-elevated-shadow))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			appbar: {
  				DEFAULT: 'hsl(var(--appbar-background))',
  				foreground: 'hsl(var(--appbar-foreground))',
  				accent: 'hsl(var(--appbar-accent))',
  				'accent-foreground': 'hsl(var(--appbar-accent-foreground))',
  				border: 'hsl(var(--appbar-border))'
  			},
  			column: {
  				primary: 'hsl(var(--column-primary))',
  				secondary: 'hsl(var(--column-secondary))',
  				tertiary: 'hsl(var(--column-tertiary))',
  				border: 'hsl(var(--column-border))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))'
  			},
  			error: {
  				DEFAULT: 'hsl(var(--error))',
  				foreground: 'hsl(var(--error-foreground))'
  			}
  		},
  		backgroundImage: {
  			// Theme-aware gradients using CSS variables
  			'gradient-primary': 'linear-gradient(to right, hsl(var(--warning)), hsl(25 95% 53%))',
  			'gradient-primary-hover': 'linear-gradient(to right, hsl(25 95% 53%), hsl(25 95% 43%))',
  			'gradient-blue': 'linear-gradient(to right, hsl(var(--info)), hsl(217 91% 55%))',
  			'gradient-blue-hover': 'linear-gradient(to right, hsl(217 91% 55%), hsl(217 91% 45%))',
  			'gradient-green': 'linear-gradient(to right, hsl(var(--success)), hsl(142 71% 40%))',
  			'gradient-green-hover': 'linear-gradient(to right, hsl(142 71% 40%), hsl(142 71% 35%))',
  			'gradient-purple': 'linear-gradient(to right, hsl(var(--cluster-1)), hsl(262 83% 53%))',
  			'gradient-purple-hover': 'linear-gradient(to right, hsl(262 83% 53%), hsl(262 83% 48%))'
  		},
  		transitionDuration: {
  			'fast': '150ms',
  			'normal': '200ms',
  			'slow': '300ms',
  			'400': '400ms'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addUtilities, theme }) {
      addUtilities({
        // Surface utilities for consistent backgrounds and borders
        '.surface-primary': {
          backgroundColor: 'hsl(var(--secondary))',
        },
        '.surface-secondary': {
          backgroundColor: 'hsl(var(--muted))',
        },
        '.surface-hover': {
          '&:hover': {
            backgroundColor: 'hsl(var(--accent))',
          }
        },
        '.border-default': {
          borderWidth: '1px',
          borderColor: 'hsl(var(--border))',
        },
        '.text-default': {
          color: 'hsl(var(--foreground))',
        },
        '.text-muted': {
          color: 'hsl(var(--muted-foreground))',
        },
        // Loading spinner utilities
        '.spinner-primary': {
          borderColor: 'hsl(var(--border))',
          borderTopColor: 'hsl(var(--warning))',
        },
        '.spinner-blue': {
          borderColor: 'hsl(var(--border))',
          borderTopColor: 'hsl(var(--info))',
        },
        '.spinner-purple': {
          borderColor: 'hsl(var(--border))',
          borderTopColor: 'hsl(var(--cluster-1))',
        },
        '.btn-gradient-primary': {
          background: 'linear-gradient(to right, hsl(var(--warning)), hsl(25 95% 53%))',
          color: 'hsl(var(--warning-foreground))',
          transition: 'all 200ms',
          '&:hover:not(:disabled)': {
            background: 'linear-gradient(to right, hsl(25 95% 53%), hsl(25 95% 43%))',
          },
          '&:disabled': {
            background: 'transparent',
            borderWidth: '1px',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--muted-foreground))',
            cursor: 'not-allowed',
          }
        },
        '.btn-gradient-green': {
          background: 'linear-gradient(to right, hsl(var(--success)), hsl(142 71% 40%))',
          color: 'hsl(var(--success-foreground))',
          transition: 'all 200ms',
          '&:hover:not(:disabled)': {
            background: 'linear-gradient(to right, hsl(142 71% 40%), hsl(142 71% 35%))',
          },
          '&:disabled': {
            background: 'transparent',
            borderWidth: '1px',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--muted-foreground))',
            cursor: 'not-allowed',
          }
        },
        '.btn-gradient-disabled': {
          background: 'transparent !important',
          borderWidth: '1px',
          borderColor: 'hsl(var(--border))',
          color: 'hsl(var(--muted-foreground))',
          cursor: 'not-allowed',
        },
        // Status indicator utilities
        '.status-success': {
          backgroundColor: 'hsl(var(--success) / 0.1)',
          borderColor: 'hsl(var(--success) / 0.5)',
          color: 'hsl(var(--success))',
        },
        '.status-error': {
          backgroundColor: 'hsl(var(--error) / 0.1)',
          borderColor: 'hsl(var(--error) / 0.5)',
          color: 'hsl(var(--error))',
        },
        '.status-warning': {
          backgroundColor: 'hsl(var(--warning) / 0.1)',
          borderColor: 'hsl(var(--warning) / 0.5)',
          color: 'hsl(var(--warning))',
        },
        '.status-info': {
          backgroundColor: 'hsl(var(--info) / 0.1)',
          borderColor: 'hsl(var(--info) / 0.5)',
          color: 'hsl(var(--info))',
        },
        // Card elevation shadows
        '.shadow-card-sm': {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
        },
        '.dark .shadow-card-sm': {
          boxShadow: '0 0 0 1px hsl(var(--card-elevated-border) / 0.5)'
        },
        '.shadow-card-hover': {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
        },
        '.dark .shadow-card-hover': {
          boxShadow: '0 0 20px 0 hsl(var(--card-elevated-shadow) / 0.15), 0 0 0 1px hsl(var(--card-elevated-border))'
        }
      })
    }
  ],
}