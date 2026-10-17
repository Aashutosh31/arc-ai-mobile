import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing, card } from '@/theme/layout';
import type { ThemeTokens } from '@/theme/tokens';

type TextVariant = 'title' | 'subtitle' | 'body' | 'muted' | 'caption' | 'mono' | 'label';

export function ThemedText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string }) {
  const theme = useTheme();
  const styleMap: Record<TextVariant, TextStyle> = {
    title: { color: theme.foreground, fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: 0.2 },
    subtitle: { color: theme.foreground, fontSize: FontSize.xl, fontWeight: '700' },
    body: { color: theme.foreground, fontSize: FontSize.md, lineHeight: FontSize.md * 1.45 },
    muted: { color: theme.foregroundMuted, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.4 },
    caption: { color: theme.foregroundSubtle, fontSize: FontSize.xs },
    mono: { color: theme.foreground, fontSize: FontSize.sm, fontFamily: 'monospace' },
    label: { color: theme.foregroundMuted, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  };
  return <Text {...rest} style={[styleMap[variant], color ? { color } : null, style]} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';

export function Button({
  label,
  variant = 'primary',
  loading,
  icon,
  style,
  disabled,
  ...rest
}: PressableProps & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle | ViewStyle[];
}) {
  const theme = useTheme();
  const tone: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.primary, fg: theme.primaryForeground, border: theme.primary },
    secondary: { bg: theme.accent, fg: theme.accentForeground, border: theme.accent },
    ghost: { bg: 'transparent', fg: theme.foreground, border: 'transparent' },
    destructive: { bg: theme.destructive, fg: '#fff', border: theme.destructive },
    outline: { bg: 'transparent', fg: theme.foreground, border: theme.borderStrong },
  };
  const t = tone[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: t.bg,
          borderColor: t.border,
          borderRadius: theme.radii.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style as ViewStyle,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={t.fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={t.fg} /> : null}
          <Text style={{ color: t.fg, fontSize: FontSize.md, fontWeight: '600' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  size = 22,
  color,
  onPress,
  disabled,
  badge,
  style,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  onPress?: () => void;
  disabled?: boolean;
  badge?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        style,
      ]}>
      <Ionicons name={name} size={size} color={color ?? theme.foreground} />
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.destructive }]}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
  radius = 'lg',
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  radius?: keyof ThemeTokens['radii'];
}) {
  const theme = useTheme();
  const base = [card(theme, radius), style as ViewStyle];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.9 }]}>
      {children}
    </Pressable>
  );
}

export function TextField({
  labelText,
  style,
  ...rest
}: TextInputProps & { labelText?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.xs, flex: 1 }}>
      {labelText ? <ThemedText variant="label">{labelText}</ThemedText> : null}
      <TextInput
        placeholderTextColor={theme.foregroundSubtle}
        style={[
          {
            color: theme.foreground,
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: theme.radii.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm + 2,
            fontSize: FontSize.md,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = 'default',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const theme = useTheme();
  const tones: Record<string, string> = {
    default: theme.foregroundMuted,
    success: theme.success,
    warning: theme.warning,
    destructive: theme.destructive,
  };
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: theme.radii.sm,
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.primary + '22' : 'transparent',
        },
      ]}>
      <Text style={{ color: active ? theme.primary : tones[tone], fontSize: FontSize.sm, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Spinner({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
      <ActivityIndicator color={theme.primary} />
      {label ? <ThemedText variant="muted">{label}</ThemedText> : null}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }, style]} />;
}

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={['top']}
      style={[{ flex: 1, backgroundColor: theme.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  iconButton: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
