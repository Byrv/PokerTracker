/**
 * Poker Tracker design tokens.
 *
 * Single source of truth for palette + semantic colors. Mirrors the CSS
 * custom properties declared in `app/globals.css`. Components should generally
 * reference Tailwind utilities (which read the CSS variables) rather than
 * importing from this file directly — the TS exports exist for consumers
 * that need raw values (chart libs, OG-image renderers, tests).
 */

export const colors = {
  feltGreen: {
    50: '#E5F2EC',
    100: '#BFE0D0',
    500: '#0F6D40',
    600: '#0B5732',
    700: '#073D24',
  },
  cardRed: {
    50: '#FBE9E6',
    100: '#F4C5BD',
    500: '#C0392B',
    600: '#A93226',
    700: '#922B21',
  },
  cardBlack: {
    500: '#1F1F1F',
  },
  cream: {
    50: '#FAF7EE',
    100: '#F2EDDC',
  },
  ink: {
    100: '#E6E9EE',
    200: '#C2C8D0',
    300: '#7A828D',
    500: '#3A4048',
    700: '#1B1F23',
  },
  profit: '#1B7F4F',
  loss: '#C0392B',
} as const;

export const lightTheme = {
  bg: colors.cream[50],
  surface: '#FFFFFF',
  text: colors.ink[700],
  textMuted: colors.ink[500],
  border: colors.ink[100],
  accent: colors.feltGreen[500],
  accentForeground: '#FFFFFF',
  profit: colors.profit,
  loss: colors.loss,
} as const;

export const darkTheme = {
  bg: colors.cardBlack[500],
  surface: '#262626',
  text: colors.cream[50],
  textMuted: colors.ink[300],
  border: '#333333',
  accent: colors.feltGreen[500],
  accentForeground: '#FFFFFF',
  profit: '#3DCB80',
  loss: '#FF6B5B',
} as const;

export const radius = {
  card: '0.75rem',
  control: '0.5rem',
  pill: '9999px',
} as const;

export const spacing = {
  gutter: '1rem',
  page: '1rem',
  section: '1.5rem',
} as const;

export type ColorPalette = typeof colors;
export type SemanticTheme = typeof lightTheme;
