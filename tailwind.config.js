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
          DEFAULT: 'var(--color-primary)', /* red-500 */
          foreground: 'var(--color-primary-foreground)' /* white */
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)', /* gold */
          foreground: 'var(--color-secondary-foreground)' /* black */
        },
        accent: {
          DEFAULT: 'var(--color-accent)', /* cyan-400 */
          foreground: 'var(--color-accent-foreground)' /* black */
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
        border: 'var(--color-border)', /* white with opacity */
        input: 'var(--color-input)', /* gray-800 */
        ring: 'var(--color-ring)', /* red-500 */
        success: {
          DEFAULT: 'var(--color-success)', /* green-500 */
          foreground: 'var(--color-success-foreground)' /* black */
        },
        warning: {
          DEFAULT: 'var(--color-warning)', /* orange-500 */
          foreground: 'var(--color-warning-foreground)' /* black */
        },
        error: {
          DEFAULT: 'var(--color-error)', /* red-600 */
          foreground: 'var(--color-error-foreground)' /* white */
        },
        destructive: {
          DEFAULT: 'var(--color-destructive)', /* red-600 */
          foreground: 'var(--color-destructive-foreground)' /* white */
        },
        surface: 'var(--color-surface)', /* gray-900 */
        'text-primary': 'var(--color-text-primary)', /* gray-100 */
        'text-secondary': 'var(--color-text-secondary)' /* gray-400 */
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        caption: ['Source Sans 3', 'sans-serif'],
        data: ['JetBrains Mono', 'monospace']
      },
      fontSize: {
        'h1': ['2.75rem', { lineHeight: '1.15' }],
        'h2': ['2.25rem', { lineHeight: '1.2' }],
        'h3': ['1.75rem', { lineHeight: '1.25' }],
        'h4': ['1.375rem', { lineHeight: '1.3' }],
        'h5': ['1.125rem', { lineHeight: '1.4' }],
        'body': ['16px', { lineHeight: '1.6' }],
        'caption': ['0.875rem', { lineHeight: '1.45', letterSpacing: '0.01em' }]
      },
      spacing: {
        '6': '6px',
        '12': '12px',
        '18': '18px',
        '24': '24px',
        '28': '28px',
        '32': '32px',
        '36': '36px',
        '48': '48px',
        '64': '64px',
        '80': '80px',
        '120': '120px'
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '10px',
        'md': '10px',
        'lg': '14px',
        'xl': '20px'
      },
      boxShadow: {
        'sm': '0 2px 4px rgba(0, 0, 0, 0.3)',
        'DEFAULT': '0 4px 8px rgba(0, 0, 0, 0.35)',
        'md': '0 6px 12px rgba(0, 0, 0, 0.35)',
        'lg': '0 12px 24px rgba(0, 0, 0, 0.4)',
        'xl': '0 20px 40px rgba(0, 0, 0, 0.4)',
        'glow-primary': '0 0 20px rgba(255, 68, 68, 0.15)',
        'glow-secondary': '0 0 20px rgba(255, 215, 0, 0.1)'
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