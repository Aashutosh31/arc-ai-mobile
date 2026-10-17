/**
 * Layout scale + typography helpers.
 *
 * The web client used a design-token CSS system. Mobile consumes a numeric
 * scale plus helper builders that read the active theme, so components stay
 * theme-aware without prop-drilling.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import type { ThemeTokens } from './tokens';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/** Soft elevation card on the active theme. */
export function card(theme: ThemeTokens, radius: keyof ThemeTokens['radii'] = 'lg'): ViewStyle {
  return {
    backgroundColor: theme.surface,
    borderRadius: theme.radii[radius],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: theme.colorScheme === 'dark' ? 0.5 : 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  };
}

export function heading(theme: ThemeTokens, size: number = FontSize.xl): TextStyle {
  return {
    color: theme.foreground,
    fontSize: size,
    fontWeight: '700',
    letterSpacing: 0.2,
  };
}

export function body(theme: ThemeTokens, size: number = FontSize.md): TextStyle {
  return {
    color: theme.foreground,
    fontSize: size,
    lineHeight: size * 1.45,
  };
}

export function muted(theme: ThemeTokens, size: number = FontSize.sm): TextStyle {
  return {
    color: theme.foregroundMuted,
    fontSize: size,
    lineHeight: size * 1.4,
  };
}
