import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { useChatStore } from '@/store/chatStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

/**
 * Thin strip that surfaces the realtime connection state. Hidden while online;
 * shows a spinner while connecting and the error/offline reason otherwise, so a
 * stalled turn is never silently invisible.
 */
export function ConnectionBanner() {
  const theme = useTheme();
  const connection = useChatStore((s) => s.connection);
  const error = useChatStore((s) => s.connectionError);

  if (connection === 'online') return null;

  const connecting = connection === 'connecting';
  const tint = connecting ? theme.foregroundMuted : theme.destructive;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      {connecting ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Ionicons name="cloud-offline-outline" size={16} color={tint} />
      )}
      <ThemedText variant="caption" color={tint} numberOfLines={2} style={{ flex: 1 }}>
        {connecting ? 'Connecting to ARC-AI…' : error || 'Offline. Messages can’t be sent right now.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
