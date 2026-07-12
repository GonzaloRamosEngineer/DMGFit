module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)', /* electric blue */
          light: 'var(--color-primary-light)',
          foreground: 'var(--color-primary-foreground)' /* white */
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)', /* energetic orange */
          light: 'var(--color-secondary-light)',
          foreground: 'var(--color-secondary-foreground)' /* white */
        },
        accent: {
          DEFAULT: 'var(--color-accent)', /* turquoise */
          light: 'var(--color-accent-light)',
          foreground: 'var(--color-accent-foreground)' /* white */
        },
        background: 'var(--color-background)', /* gray-950 */
        foreground: 'var(--color-foreground)', /* gray-100 */
        card: {
          DEFAULT: 'var(--color-card)', /* gray-900 */
          foreground: 'var(--color-card-foreground)' /* gray-100 */
        },
        popover: {
          DEFAULT: 'var(--color-popover)', /* gray-900 */
          foreground: 'var(--color-popover-foreground)' /* gray-100 */
        },
        muted: {
          DEFAULT: 'var(--color-muted)', /* gray-800 */
          foreground: 'var(--color-muted-foreground)' /* gray-400 */
        },
        border: {
          DEFAULT: 'var(--color-border)', /* soft border */
          light: 'var(--color-border-light)'
        },
        input: 'var(--color-input)', /* white */
        ring: 'var(--color-ring)', /* electric blue */
        success: {
          DEFAULT: 'var(--color-success)', /* green */
          light: 'var(--color-success-light)',
          foreground: 'var(--color-success-foreground)' /* white */
        },
        warning: {
          DEFAULT: 'var(--color-warning)', /* orange */
          light: 'var(--color-warning-light)',
          foreground: 'var(--color-warning-foreground)' /* white */
        },
        error: {
          DEFAULT: 'var(--color-error)', /* red */
          light: 'var(--color-error-light)',
          foreground: 'var(--color-error-foreground)' /* white */
        },
        info: {
          DEFAULT: 'var(--color-info)', /* electric blue */
          light: 'var(--color-info-light)',
          foreground: 'var(--color-info-foreground)' /* white */
        },
        destructive: {
          DEFAULT: 'var(--color-destructive)', /* red */
          foreground: 'var(--color-destructive-foreground)' /* white */
        },
        surface: 'var(--color-surface)', /* white */
        'text-primary': 'var(--color-text-primary)', /* almost black */
        'text-secondary': 'var(--color-text-secondary)', /* medium gray */
        'text-tertiary': 'var(--color-text-tertiary)' /* light gray */
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        caption: ['Source Sans 3', 'sans-serif'],
        data: ['JetBrains Mono', 'monospace']
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'DEFAULT': 'var(--radius)',
        'md': 'var(--radius)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)'
      },
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow-md)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        'glow-primary': 'var(--glow-primary)',
        'glow-secondary': 'var(--glow-secondary)',
        'glow-accent': 'var(--glow-accent)',
        'glow-success': 'var(--glow-success)'
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      },
      transitionDuration: {
        'smooth': '250ms'
      },
      zIndex: {
        'base': '0',
        'card': '1',
        'dropdown': '50',
        'nav': '100',
        'modal': '200',
        'toast': '300',
        'debug': '9999'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-animate')
  ]
}