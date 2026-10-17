/**
 * ARC-AI design tokens, ported from the web client's `styles/arc.css`
 * (daisyUI custom themes + the ARC semantic bridge).
 *
 * The web build resolves these through CSS custom properties per
 * `data-theme`. React Native has no cascade, so every token is materialized
 * as a plain value per theme id in `themes.ts`, and consumed via `useTheme()`.
 */

export type Radii = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

export interface ThemeTokens {
  id: string;
  name: string;
  description: string;
  category: string;
  colorScheme: 'light' | 'dark';
  /** Swatch colors for the theme picker: [primary, accent, background]. */
  preview: [string, string, string];

  // Base surfaces
  background: string;
  backgroundSubtle: string;
  surface: string;
  surfaceElevated: string;
  surfaceOverlay: string;

  // Text
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;

  // Brand
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  accentSoft: string;
  violet: string;

  // Status
  success: string;
  warning: string;
  destructive: string;
  destructiveSoft: string;

  // Lines & focus
  border: string;
  borderSubtle: string;
  borderStrong: string;
  focusRing: string;

  // Chat-specific
  chatBackground: string;

  // Shape & elevation
  radii: Radii;
  shadow: string;
}
