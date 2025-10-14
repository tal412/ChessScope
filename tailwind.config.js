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
  				foreground: 'hsl(var(--card-foreground))'
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
  			'gradient-primary': 'linear-gradient(to right, #f59e0b, #ea580c)',
  			'gradient-primary-hover': 'linear-gradient(to right, #d97706, #c2410c)',
  			'gradient-blue': 'linear-gradient(to right, #3b82f6, #2563eb)',
  			'gradient-blue-hover': 'linear-gradient(to right, #2563eb, #1d4ed8)',
  			'gradient-green': 'linear-gradient(to right, #22c55e, #16a34a)',
  			'gradient-green-hover': 'linear-gradient(to right, #16a34a, #15803d)',
  			'gradient-purple': 'linear-gradient(to right, #8b5cf6, #7c3aed)',
  			'gradient-purple-hover': 'linear-gradient(to right, #7c3aed, #6d28d9)'
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
          backgroundColor: 'rgb(243 244 246)', // gray-100
          '.dark &': {
            backgroundColor: 'rgb(51 65 85)', // slate-700
          }
        },
        '.surface-secondary': {
          backgroundColor: 'rgb(249 250 251)', // gray-50
          '.dark &': {
            backgroundColor: 'rgb(30 41 59)', // slate-800
          }
        },
        '.surface-hover': {
          '&:hover': {
            backgroundColor: 'rgb(229 231 235)', // gray-200
          },
          '.dark &:hover': {
            backgroundColor: 'rgb(71 85 105)', // slate-600
          }
        },
        '.border-default': {
          borderWidth: '1px',
          borderColor: 'rgb(209 213 219)', // gray-300
          '.dark &': {
            borderColor: 'rgb(71 85 105)', // slate-600
          }
        },
        '.text-default': {
          color: 'rgb(55 65 81)', // gray-700
          '.dark &': {
            color: 'rgb(203 213 225)', // slate-300
          }
        },
        '.text-muted': {
          color: 'rgb(107 114 128)', // gray-500
          '.dark &': {
            color: 'rgb(148 163 184)', // slate-400
          }
        },
        // Loading spinner utilities
        '.spinner-primary': {
          borderColor: 'rgb(229 231 235)',
          borderTopColor: 'rgb(245 158 11)', // amber-500
          '.dark &': {
            borderColor: 'rgb(71 85 105)',
            borderTopColor: 'rgb(245 158 11)',
          }
        },
        '.spinner-blue': {
          borderColor: 'rgb(229 231 235)',
          borderTopColor: 'rgb(59 130 246)', // blue-500
          '.dark &': {
            borderColor: 'rgb(71 85 105)',
            borderTopColor: 'rgb(59 130 246)',
          }
        },
        '.spinner-purple': {
          borderColor: 'rgb(229 231 235)',
          borderTopColor: 'rgb(139 92 246)', // purple-500
          '.dark &': {
            borderColor: 'rgb(71 85 105)',
            borderTopColor: 'rgb(139 92 246)',
          }
        },
        '.btn-gradient-primary': {
          background: 'linear-gradient(to right, #f59e0b, #ea580c)',
          color: 'white',
          transition: 'all 200ms',
          '&:hover:not(:disabled)': {
            background: 'linear-gradient(to right, #d97706, #c2410c)',
          },
          '&:disabled': {
            background: 'transparent',
            border: '1px solid rgb(209 213 219)',
            color: 'rgb(156 163 175)',
            cursor: 'not-allowed',
          },
          '.dark &:disabled': {
            borderColor: 'rgb(71 85 105)',
            color: 'rgb(100 116 139)',
          }
        },
        '.btn-gradient-green': {
          background: 'linear-gradient(to right, #22c55e, #16a34a)',
          color: 'white',
          transition: 'all 200ms',
          '&:hover:not(:disabled)': {
            background: 'linear-gradient(to right, #16a34a, #15803d)',
          },
          '&:disabled': {
            background: 'transparent',
            border: '1px solid rgb(209 213 219)',
            color: 'rgb(156 163 175)',
            cursor: 'not-allowed',
          },
          '.dark &:disabled': {
            borderColor: 'rgb(71 85 105)',
            color: 'rgb(100 116 139)',
          }
        },
        '.btn-gradient-disabled': {
          background: 'transparent !important',
          border: '1px solid rgb(209 213 219)',
          color: 'rgb(156 163 175)',
          cursor: 'not-allowed',
          '.dark &': {
            borderColor: 'rgb(71 85 105)',
            color: 'rgb(100 116 139)',
          }
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
        }
      })
    }
  ],
}