/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        'hx-space': 'var(--hx-color-bg-space)',
        'hx-panel': 'var(--hx-color-bg-panel)',
        'hx-card': 'var(--hx-color-bg-card)',
        'hx-surface-elevated': 'var(--hx-color-bg-surface-elevated)',
        'hx-hover': 'var(--hx-color-bg-hover)',
        'hx-active': 'var(--hx-color-bg-active)',
        
        'hx-text-primary': 'var(--hx-color-text-primary)',
        'hx-text-secondary': 'var(--hx-color-text-secondary)',
        'hx-text-muted': 'var(--hx-color-text-muted)',
        'hx-text-inverse': 'var(--hx-color-text-inverse)',
        
        'hx-cyan': 'var(--hx-color-accent-cyan)',
        'hx-cyan-hover': 'var(--hx-color-accent-cyan-hover)',
        'hx-sky': 'var(--hx-color-accent-sky)',
        'hx-blue': 'var(--hx-color-accent-blue)',
        'hx-blue-hover': 'var(--hx-color-accent-blue-hover)',
        'hx-deep-blue': 'var(--hx-color-accent-deep-blue)',
        
        'hx-border-subtle': 'var(--hx-color-border-subtle)',
        'hx-border-panel': 'var(--hx-color-border-panel)',
        'hx-border-glow': 'var(--hx-color-border-glow)',
        
        'hx-nominal': 'var(--hx-color-status-nominal)',
        'hx-warning': 'var(--hx-color-status-warning)',
        'hx-danger': 'var(--hx-color-status-danger)',
        'hx-info': 'var(--hx-color-status-info)',
      },
      fontFamily: {
        display: ['var(--hx-font-family-display)'],
        body: ['var(--hx-font-family-body)'],
        mono: ['var(--hx-font-family-mono)']
      },
      boxShadow: {
        'hx-subtle': 'var(--hx-shadow-subtle)',
        'hx-card': 'var(--hx-shadow-card)',
        'hx-elevated': 'var(--hx-shadow-elevated)',
        'hx-glow-cyan': 'var(--hx-glow-cyan-md)',
        'hx-glow-cyan-sm': 'var(--hx-glow-cyan-sm)',
        'hx-glow-blue': 'var(--hx-glow-blue-md)'
      },
      borderRadius: {
        'hx-sm': 'var(--hx-radius-sm)',
        'hx-md': 'var(--hx-radius-md)',
        'hx-lg': 'var(--hx-radius-lg)',
        'hx-xl': 'var(--hx-radius-xl)'
      },
      transitionDuration: {
        'instant': 'var(--hx-duration-instant)',
        'fast': 'var(--hx-duration-fast)',
        'normal': 'var(--hx-duration-normal)',
        'deliberate': 'var(--hx-duration-deliberate)',
        'pulse': 'var(--hx-duration-pulse)'
      },
      transitionTimingFunction: {
        'standard': 'var(--hx-ease-standard)',
        'enter': 'var(--hx-ease-enter)',
        'exit': 'var(--hx-ease-exit)',
        'orbital': 'var(--hx-ease-orbital)'
      },
      animation: {
        'pulse-glow': 'hx-pulse-glow 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'fade-in': 'hx-fade-in 250ms cubic-bezier(0, 0, 0.2, 1) forwards'
      },
      zIndex: {
        'hx-base': 'var(--hx-z-base)',
        'hx-elevated': 'var(--hx-z-elevated)',
        'hx-sticky': 'var(--hx-z-sticky)',
        'hx-dropdown': 'var(--hx-z-dropdown)',
        'hx-modal': 'var(--hx-z-modal)',
        'hx-toast': 'var(--hx-z-toast)',
        'hx-titlebar': 'var(--hx-z-titlebar)'
      }
    }
  },
  plugins: []
}
