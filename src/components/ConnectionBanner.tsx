import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { SOCKET_URL } from '@/constants/config';
import { getSocket } from '@/socket/socketClient';
import { useChatStore } from '@/store/chatStore';
import { useDiagnosticsStore } from '@/store/diagnosticsStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

/**
 * Thin strip that surfaces a captured fatal error or the realtime connection
 * state. Hidden while online; otherwise shows a spinner (connecting) or the
 * failure reason, plus the host being contacted and a tap-to-retry action.
 */

// Raw engine.io error strings ("websocket error", "xhr poll error", …) are
// meaningless to users — surface what the failure means for the session instead.
const ERROR_LABELS: Record<string, string> = {
  'websocket error': "Can't reach ARC-AI. Trying another connection…",
  'xhr poll error': "Can't reach ARC-AI.",
};

function friendlyError(message?: string | null): string {
  const raw = (message || '').trim();
  if (!raw) return 'Offline.';
  return ERROR_LABELS[raw.toLowerCase()] ?? raw;
}
export function ConnectionBanner() {
  const theme = useTheme();
  const connection = useChatStore((s) => s.connection);
  const error = useChatStore((s) => s.connectionError);
  const fatal = useDiagnosticsStore((s) => s.fatal);
  const clearFatal = useDiagnosticsStore((s) => s.clear);

  if (fatal) {
    return (
      <Pressable
        onPress={clearFatal}
        style={[styles.wrap, { backgroundColor: theme.destructiveSoft, borderBottomColor: theme.destructive }]}>
        <Ionicons name="bug-outline" size={16} color={theme.destructive} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="caption" color={theme.destructive} numberOfLines={2}>
            {fatal.message}
          </ThemedText>
          <ThemedText variant="caption" numberOfLines={1}>
            Tap to dismiss
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  if (connection === 'online') return null;

  const connecting = connection === 'connecting';
  const tint = connecting ? theme.foregroundMuted : theme.destructive;

  const retry = () => {
    const socket = getSocket();
    if (socket) socket.connect();
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
          {connecting ? 'Connecting to ARC-AI…' : `${friendlyError(error)} Tap to retry.`}
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
