import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ui';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'destructive';
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

/**
 * Themed bottom action sheet — the app's own UI instead of the platform
 * `Alert` dialog. Mirrors the visual language of the composer's AttachMenu
 * (rounded floating surface, border, hairline dividers, icon chips) while
 * keeping the familiar mobile bottom-sheet placement.
 */
export function ActionSheet({ visible, title, subtitle, items, onClose }: ActionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surfaceOverlay,
              borderColor: theme.border,
              borderRadius: theme.radii.lg,
              marginBottom: Math.max(insets.bottom, Spacing.md),
              shadowColor: '#000',
              shadowOpacity: theme.colorScheme === 'dark' ? 0.6 : 0.18,
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <ThemedText variant="caption" color={theme.foregroundMuted}>
                  {title}
                </ThemedText>
                {subtitle ? (
                  <ThemedText variant="body" numberOfLines={1} style={{ fontWeight: '700' }}>
                    {subtitle}
                  </ThemedText>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={18} color={theme.foregroundMuted} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.items}>
            {items.map((item, index) => {
              const destructive = item.tone === 'destructive';
              const accent = destructive ? theme.destructive : theme.primary;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={item.onPress}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: pressed ? theme.surfaceElevated : 'transparent',
                      borderTopColor: theme.border,
                      borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    },
                  ]}>
                  {item.icon ? (
                    <View style={[styles.itemIcon, { backgroundColor: accent + '18' }]}>
                      <Ionicons name={item.icon} size={17} color={accent} />
                    </View>
                  ) : null}
                  <ThemedText
                    style={{
                      color: destructive ? theme.destructive : theme.foreground,
                      fontSize: FontSize.md,
                      fontWeight: '600',
                    }}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <ThemedText
              style={{ color: theme.foregroundMuted, fontSize: FontSize.md, fontWeight: '600' }}>
              Cancel
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000066',
  },
  sheet: {
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm + 4,
    paddingBottom: Spacing.sm,
  },
  items: { marginTop: Spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 5,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: 8,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: Spacing.sm + 5,
    alignItems: 'center',
  },
});
