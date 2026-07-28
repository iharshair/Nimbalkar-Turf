import type { Config } from 'tailwindcss'

/**
 * "Floodlit Night Turf" design tokens.
 * Dark, high-contrast, athletic. No pastel gradients.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        night: {
          DEFAULT: '#0A0E14',
          800: '#0E1420',
          700: '#131A28',
          600: '#1A2333',
        },
        turf: {
          dark: '#0B3D24',
          DEFAULT: '#146B3A',
          mid: '#146B3A',
          light: '#1C8A4B',
        },
        neon: '#39FF6E',
        amber: '#FBBF24',
        chalk: '#F4F6F1',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        deva: ['var(--font-deva)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Scoreboard-scale display type. [size, { lineHeight, letterSpacing }]
        'display-xl': ['clamp(3.5rem, 12vw, 11rem)', { lineHeight: '0.86', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2.75rem, 8vw, 6.5rem)', { lineHeight: '0.9', letterSpacing: '-0.015em' }],
        'display-md': ['clamp(2.25rem, 5.5vw, 4rem)', { lineHeight: '0.95', letterSpacing: '-0.01em' }],
        'display-sm': ['clamp(1.75rem, 4vw, 2.75rem)', { lineHeight: '1', letterSpacing: '0' }],
        eyebrow: ['0.75rem', { lineHeight: '1', letterSpacing: '0.22em' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.7' }],
      },
      spacing: {
        section: 'clamp(4.5rem, 10vw, 9rem)',
      },
      maxWidth: {
        shell: '84rem',
      },
      borderRadius: {
        card: '1.25rem',
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(57,255,110,0.35), 0 0 24px -4px rgba(57,255,110,0.45)',
        'neon-lg': '0 0 0 1px rgba(57,255,110,0.5), 0 0 60px -10px rgba(57,255,110,0.6)',
        'inset-line': 'inset 0 1px 0 0 rgba(244,246,241,0.08)',
        lift: '0 24px 60px -24px rgba(0,0,0,0.85)',
      },
      backgroundImage: {
        'floodlight': 'radial-gradient(circle at center, rgba(57,255,110,0.20) 0%, rgba(20,107,58,0.10) 38%, transparent 70%)',
        'pitch-line': 'linear-gradient(90deg, transparent, rgba(244,246,241,0.22) 12%, rgba(244,246,241,0.22) 88%, transparent)',
        'night-fade': 'linear-gradient(180deg, rgba(10,14,20,0) 0%, rgba(10,14,20,0.72) 55%, #0A0E14 100%)',
      },
      keyframes: {
        'drift-a': {
          '0%,100%': { transform: 'translate3d(-6%, -4%, 0) scale(1)' },
          '50%': { transform: 'translate3d(8%, 6%, 0) scale(1.14)' },
        },
        'drift-b': {
          '0%,100%': { transform: 'translate3d(6%, 5%, 0) scale(1.1)' },
          '50%': { transform: 'translate3d(-7%, -6%, 0) scale(0.94)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'live-blink': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'drift-a': 'drift-a 26s ease-in-out infinite',
        'drift-b': 'drift-b 34s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.24,0.6,0.35,1) infinite',
        'live-blink': 'live-blink 1.8s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out',
        shimmer: 'shimmer 1.6s infinite',
      },
      transitionTimingFunction: {
        turf: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}

export default config
