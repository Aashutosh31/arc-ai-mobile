import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/ui';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

export type AttachMenuEntry =
  | { type: 'divider' }
  | {
      type: 'item';
      key: string;
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      hint?: string;
      onPress: () => void;
    };

interface AttachAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AttachMenuProps {
  visible: boolean;
  /** Screen coordinates of the button the menu is anchored above. */
  anchor: AttachAnchor | null;
  entries: AttachMenuEntry[];
  onClose: () => void;
}

const MENU_WIDTH = 232;
const EDGE = 12;

/**
 * Composer attachment popover — a web-parity floating menu anchored above the
 * "+" button, with a full-screen backdrop (tap-away) and an explicit close (×).
 */
export function AttachMenu({ visible, anchor, entries, onClose }: AttachMenuProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  if (!visible || !anchor) return null;

  const left = Math.max(EDGE, Math.min(anchor.x, windowWidth - MENU_WIDTH - EDGE));
  const bottom = windowHeight - anchor.y + 10;

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
            styles.menu,
            {
              left,
              bottom,
              width: MENU_WIDTH,
              backgroundColor: theme.surfaceOverlay,
              borderColor: theme.border,
              borderRadius: theme.radii.md,
              shadowColor: '#000',
              shadowOpacity: theme.colorScheme === 'dark' ? 0.6 : 0.18,
            },
          ]}>
          <View style={styles.header}>
            <ThemedText variant="caption" color={theme.foregroundMuted}>
              Add to message
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={16} color={theme.foregroundMuted} />
            </Pressable>
          </View>

          {entries.map((entry, index) =>
            entry.type === 'divider' ? (
              <View
                key={`divider-${index}`}
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
            ) : (
              <Fragment key={entry.key}>
                <Pressable
                  onPress={entry.onPress}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: pressed ? theme.surfaceElevated : 'transparent' },
                  ]}>
                  <Ionicons name={entry.icon} size={17} color={theme.foreground} />
                  <ThemedText style={{ fontSize: FontSize.sm }}>{entry.label}</ThemedText>
                  {entry.hint ? (
                    <ThemedText
                      variant="caption"
                      color={theme.foregroundSubtle}
                      style={styles.hint}>
                      {entry.hint}
                    </ThemedText>
                  ) : null}
                </Pressable>
              </Fragment>
            ),
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.sm + 4,
    paddingRight: 2,
    paddingTop: 2,
    paddingBottom: Spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: 7,
  },
  hint: { marginLeft: 'auto' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 5, marginHorizontal: Spacing.sm },
});
