import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { MarkdownMessage } from '@/components/MarkdownMessage';
import { ThemedText } from '@/components/ui';
import { regenerateLast } from '@/chat/chatController';
import type { UiMessage } from '@/store/chatStore';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

export function ChatMessageBubble({
  message,
  showActions = false,
}: {
  message: UiMessage;
  showActions?: boolean;
}) {
  const theme = useTheme();
  const isUser = message.sender === 'user';

  const copy = async () => {
    await Clipboard.setStringAsync(message.text).catch(() => {});
    Haptics.selectionAsync().catch(() => {});
  };

  const onRegenerate = () => {
    Haptics.selectionAsync().catch(() => {});
    regenerateLast();
  };

  return (
    <View
      style={[
        styles.row,
        { justifyContent: isUser ? 'flex-end' : 'flex-start' },
      ]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.primary : theme.surface,
            borderColor: isUser ? theme.primary : theme.border,
            borderRadius: theme.radii.lg,
            borderBottomRightRadius: isUser ? theme.radii.sm : theme.radii.lg,
            borderBottomLeftRadius: isUser ? theme.radii.lg : theme.radii.sm,
            maxWidth: '88%',
          },
        ]}>
        {message.image ? (
          <Image
            source={{ uri: message.image.startsWith('data:') ? message.image : `data:image/jpeg;base64,${message.image}` }}
            style={[styles.image, { borderRadius: theme.radii.md }]}
            resizeMode="cover"
          />
        ) : null}

        {message.documentName ? (
          <View style={[styles.docRow, { borderColor: theme.border }]}>
            <Ionicons name="document-text-outline" size={14} color={isUser ? theme.primaryForeground : theme.foregroundMuted} />
            <ThemedText variant="caption" color={isUser ? theme.primaryForeground : theme.foregroundMuted}>
              {message.documentName}
            </ThemedText>
          </View>
        ) : null}

        {message.text ? (
          isUser ? (
            <Pressable onLongPress={copy}>
              <ThemedText variant="body" color={theme.primaryForeground}>
                {message.text}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable onLongPress={copy}>
              <MarkdownMessage content={message.text} />
              {message.isStreaming ? <StreamCursor /> : null}
            </Pressable>
          )
        ) : message.isStreaming ? (
          <ThinkingDots />
        ) : null}

        {message.interrupted ? (
          <ThemedText variant="caption" color={theme.warning} style={{ marginTop: Spacing.xs }}>
            stopped
          </ThemedText>
        ) : null}

        {showActions && !isUser ? (
          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            <Pressable onPress={copy} hitSlop={6} accessibilityRole="button" accessibilityLabel="Copy message">
              <View style={styles.actionBtn}>
                <Ionicons name="copy-outline" size={15} color={theme.foregroundMuted} />
                <ThemedText variant="caption" color={theme.foregroundMuted}>
                  Copy
                </ThemedText>
              </View>
            </Pressable>
            <Pressable onPress={onRegenerate} hitSlop={6} accessibilityRole="button" accessibilityLabel="Regenerate response">
              <View style={styles.actionBtn}>
                <Ionicons name="refresh-outline" size={15} color={theme.foregroundMuted} />
                <ThemedText variant="caption" color={theme.foregroundMuted}>
                  Regenerate
                </ThemedText>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StreamCursor() {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 8,
        height: 16,
        backgroundColor: theme.primary,
        marginTop: 2,
        borderRadius: 2,
      }}
    />
  );
}

function ThinkingDots() {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: Spacing.xs }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.foregroundMuted,
            opacity: 0.5 + i * 0.2,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: Spacing.xs, paddingHorizontal: Spacing.lg },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: 200, height: 200, marginBottom: Spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    maxWidth: 240,
  },
  cursor: {
    fontSize: FontSize.md,
  },
});
