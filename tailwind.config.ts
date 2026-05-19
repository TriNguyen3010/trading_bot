import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const withAlpha = (variableName: string) =>
  `rgb(var(${variableName}) / <alpha-value>)`;

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
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        // Surfaces
        canvas: withAlpha('--color-bg-canvas-rgb'),
        surface: {
          DEFAULT: withAlpha('--color-bg-surface-rgb'),
          hover: withAlpha('--color-bg-surface-hover-rgb'),
          active: withAlpha('--color-bg-surface-active-rgb'),
          elevated: withAlpha('--color-bg-elevated-rgb'),
        },
        input: withAlpha('--color-bg-input-rgb'),

        // Borders
        border: {
          DEFAULT: withAlpha('--color-border-default-rgb'),
          subtle: withAlpha('--color-border-subtle-rgb'),
          strong: withAlpha('--color-border-strong-rgb'),
          focus: withAlpha('--brand-primary-rgb'),
        },

        // Text
        fg: {
          DEFAULT: withAlpha('--color-text-primary-rgb'),
          secondary: withAlpha('--color-text-secondary-rgb'),
          muted: withAlpha('--color-text-muted-rgb'),
          disabled: withAlpha('--color-text-disabled-rgb'),
          inverse: withAlpha('--color-text-inverse-rgb'),
        },

        // Brand
        brand: {
          DEFAULT: withAlpha('--brand-primary-rgb'),
          hover: withAlpha('--brand-hover-rgb'),
          active: withAlpha('--brand-active-rgb'),
          subtle: 'var(--brand-subtle)',
          soft: 'rgb(var(--brand-primary-rgb) / 0.06)',
        },

        // Trading semantic
        bullish: {
          DEFAULT: withAlpha('--color-bullish-rgb'),
          hover: withAlpha('--color-bullish-hover-rgb'),
          subtle: 'var(--color-bullish-subtle)',
        },
        bearish: {
          DEFAULT: withAlpha('--color-bearish-rgb'),
          hover: withAlpha('--color-bearish-hover-rgb'),
          subtle: 'var(--color-bearish-subtle)',
        },

        // Status
        success: withAlpha('--color-success-rgb'),
        warning: withAlpha('--color-warning-rgb'),
        danger: withAlpha('--color-danger-rgb'),
        info: withAlpha('--color-info-rgb'),

        // Edge colors for flow lines
        edge: {
          default: withAlpha('--color-edge-default-rgb'),
          long: withAlpha('--color-bullish-rgb'),
          short: withAlpha('--color-bearish-rgb'),
          signal: withAlpha('--brand-primary-rgb'),
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
