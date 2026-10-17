import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { useChatStore } from '@/store/chatStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

export function AgentStatusBar() {
  const theme = useTheme();
  const status = useChatStore((s) => s.agentStatus);
  const provider = useChatStore((s) => s.providerInfo);
  const speaking = useChatStore((s) => s.isSpeaking);

  if (!status && !speaking && !provider) return null;

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      {speaking ? (
        <View style={styles.row}>
          <Ionicons name="volume-high" size={14} color={theme.primary} />
          <ThemedText variant="caption" color={theme.primary}>
            Speaking
          </ThemedText>
        </View>
      ) : null}
      {status ? (
        <View style={styles.row}>
          <Ionicons name="sparkles" size={14} color={theme.accent} />
          <ThemedText variant="caption">{status}</ThemedText>
        </View>
      ) : null}
      {provider?.provider ? (
        <View style={styles.row}>
          <Ionicons
            name={provider.fallbackUsed ? 'swap-horizontal' : 'checkmark-circle-outline'}
            size={14}
            color={provider.fallbackUsed ? theme.warning : theme.success}
          />
          <ThemedText variant="caption">
            {provider.provider}
            {provider.fallbackUsed ? ' (fallback)' : ''}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
