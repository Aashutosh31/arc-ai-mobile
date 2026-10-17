import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { SOCKET_URL } from '@/constants/config';
import { getSocket } from '@/socket/socketClient';
import { useChatStore } from '@/store/chatStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

/**
 * Thin strip that surfaces the realtime connection state. Hidden while online;
 * otherwise shows a spinner (connecting) or the failure reason, plus the host
 * being contacted and a tap-to-retry affordance.
 */
export function ConnectionBanner() {
  const theme = useTheme();
  const connection = useChatStore((s) => s.connection);
  const error = useChatStore((s) => s.connectionError);

  if (connection === 'online') return null;

  const connecting = connection === 'connecting';
  const tint = connecting ? theme.foregroundMuted : theme.destructive;

  const retry = () => {
    const socket = getSocket();
    if (socket) {
      socket.connect();
    }
  };

  return (
    <Pressable
      onPress={connecting ? undefined : retry}
      style={[styles.wrap, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      {connecting ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Ionicons name="cloud-offline-outline" size={16} color={tint} />
      )}
      <View style={{ flex: 1 }}>
        <ThemedText variant="caption" color={tint} numberOfLines={2}>
          {connecting
            ? 'Connecting to ARC-AI…'
            : `${error || 'Offline.'} Tap to retry.`}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1}>
          {SOCKET_URL}
        </ThemedText>
      </View>
    </Pressable>
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
