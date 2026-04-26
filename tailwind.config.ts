import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        // Surfaces
        canvas: 'var(--color-bg-canvas)',
        surface: {
          DEFAULT: 'var(--color-bg-surface)',
          hover: 'var(--color-bg-surface-hover)',
          active: 'var(--color-bg-surface-active)',
          elevated: 'var(--color-bg-elevated)',
        },
        input: 'var(--color-bg-input)',

        // Borders
        border: {
          DEFAULT: 'var(--color-border-default)',
          subtle: 'var(--color-border-subtle)',
          strong: 'var(--color-border-strong)',
          focus: 'var(--color-border-focus)',
        },

        // Text
        fg: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
        },

        // Brand
        brand: {
          DEFAULT: 'var(--brand-primary)',
          hover: 'var(--brand-hover)',
          active: 'var(--brand-active)',
          subtle: 'var(--brand-subtle)',
        },

        // Trading semantic
        bullish: {
          DEFAULT: 'var(--color-bullish)',
          hover: 'var(--color-bullish-hover)',
          subtle: 'var(--color-bullish-subtle)',
        },
        bearish: {
          DEFAULT: 'var(--color-bearish)',
          hover: 'var(--color-bearish-hover)',
          subtle: 'var(--color-bearish-subtle)',
        },

        // Status
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',

        // Edge colors for flow lines
        edge: {
          default: 'var(--color-edge-default)',
          long: 'var(--color-edge-long)',
          short: 'var(--color-edge-short)',
          signal: 'var(--color-edge-signal)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        md: ['15px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['32px', { lineHeight: '40px' }],
        '4xl': ['40px', { lineHeight: '48px' }],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow-brand)',
      },
      transitionTimingFunction: {
        'out-quick': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'in-out-snap': 'cubic-bezier(0.6, 0, 0.4, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        instant: '100ms',
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        pulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--brand-subtle)' },
          '50%': { boxShadow: '0 0 0 8px var(--brand-subtle)' },
        },
        march: {
          to: { strokeDashoffset: '-12' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        'flash-success': {
          '0%': { backgroundColor: 'var(--color-bullish-subtle)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 250ms ease-out',
        pulse: 'pulse 1500ms ease-in-out infinite',
        march: 'march 1.4s linear infinite',
        shimmer: 'shimmer 2s linear infinite',
        'flash-success': 'flash-success 1000ms ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
