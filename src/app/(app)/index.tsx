import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { AgentStatusBar } from '@/components/AgentStatusBar';
import { ApprovalBanner } from '@/components/ApprovalBanner';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { ExecutionPanel } from '@/components/ExecutionPanel';
import { MediaCard } from '@/components/MediaCard';
import { ThemedText } from '@/components/ui';
import { useChatStore, type UiMessage } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

export default function ChatScreen() {
  const theme = useTheme();
  const messages = useChatStore((s) => s.messages);
  const hasMore = useConversationStore((s) => s.hasMore);
  const loadingMore = useConversationStore((s) => s.loadingMore);
  const listRef = useRef<FlatList<UiMessage>>(null);
  const lastIdRef = useRef<string | null>(null);
  const prependingRef = useRef(false);

  const scrollToEnd = () => {
    if (prependingRef.current) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  // Only auto-scroll when a NEW message is appended. Prepending older history
  // keeps the last message id unchanged, so the viewport stays put.
  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;
    if (lastId !== lastIdRef.current) {
      lastIdRef.current = lastId;
      scrollToEnd();
    }
  }, [messages]);

  const loadOlder = () => {
    if (!hasMore || loadingMore || prependingRef.current) return;
    prependingRef.current = true;
    void useConversationStore
      .getState()
      .loadMore()
      .finally(() => {
        setTimeout(() => {
          prependingRef.current = false;
        }, 150);
      });
  };

  const onScroll = (offsetY: number) => {
    if (offsetY <= 48) loadOlder();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ConnectionBanner />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, index) => item.id ?? `msg-${index}`}
        renderItem={({ item, index }) => (
          <ChatMessageBubble
            message={item}
            showActions={
              index === messages.length - 1 &&
              item.sender === 'ai' &&
              !item.isStreaming &&
              Boolean(item.text)
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (!prependingRef.current) scrollToEnd();
        }}
        onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={160}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListHeaderComponent={
          <>
            {loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : null}
            <MediaCard />
            <ExecutionPanel />
            <ApprovalBanner />
            <AgentStatusBar />
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyLogo, { backgroundColor: theme.primary + '22' }]}>
              <Ionicons name="sparkles" size={32} color={theme.primary} />
            </View>
            <ThemedText variant="subtitle">How can I help?</ThemedText>
            <ThemedText variant="muted" style={{ textAlign: 'center', paddingHorizontal: Spacing.xl }}>
              Ask a question, attach a file, or tap the mic to talk. ARC can run tools,
              manage tasks and remember context.
            </ThemedText>
          </View>
        }
      />

      <ChatInput />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingVertical: Spacing.sm, flexGrow: 1 },
  loadingMore: { paddingVertical: Spacing.sm, alignItems: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  emptyLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
