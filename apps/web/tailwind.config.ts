import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },

        // Brand + imperial accents
        flag: {
          green: 'hsl(var(--flag-green) / <alpha-value>)',
          'green-dark': 'hsl(var(--flag-green-dark) / <alpha-value>)',
          'green-light': 'hsl(var(--flag-green-light) / <alpha-value>)',
        },
        gold: {
          DEFAULT: 'hsl(var(--gold) / <alpha-value>)',
          dim: 'hsl(var(--gold-dim) / <alpha-value>)',
        },
        porphyry: 'hsl(var(--porphyry) / <alpha-value>)',
      },
      fontFamily: {
        // var(--font-display) is injected by next/font (Cinzel) — classical Roman capitals.
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        // var(--font-serif) is Crimson Pro — readable body serif.
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: { prose: '72ch' },
      letterSpacing: {
        roman: '0.14em',
      },
    },
  },
  plugins: [],
};

export default config;
