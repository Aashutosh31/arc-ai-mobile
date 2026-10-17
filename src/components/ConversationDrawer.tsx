import { Ionicons } from '@expo/vector-icons';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import { useExecutionStore } from '@/store/executionStore';
import { useTheme } from '@/store/themeStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { startNewChat } from '@/chat/newChat';
import { Spacing } from '@/theme/layout';

const NAV = [
  { route: 'index', label: 'Chat', icon: 'chatbubbles-outline' as const },
  { route: 'memory', label: 'Memory', icon: 'sparkles-outline' as const },
  { route: 'tools', label: 'Tools', icon: 'construct-outline' as const },
  { route: 'automation', label: 'Automation', icon: 'logo-whatsapp' as const },
  { route: 'settings', label: 'Settings', icon: 'settings-outline' as const },
  { route: 'about', label: 'About', icon: 'information-circle-outline' as const },
];

export function ConversationDrawer(props: DrawerContentComponentProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const identity = useAuthStore((s) => s.identity);
  const credits = useAuthStore((s) => s.credits);
  const logout = useAuthStore((s) => s.logout);
  const conversations = useConversationStore((s) => s.items);
  const open = useConversationStore((s) => s.open);
  const setPinned = useConversationStore((s) => s.setPinned);
  const archive = useConversationStore((s) => s.archive);
  const rename = useConversationStore((s) => s.rename);
  const activeWorkspace = useWorkspaceStore((s) => s.active);
  const clearExecutions = useExecutionStore((s) => s.reset);

  const activeRoute = props.state.routeNames[props.state.index];
  const activeConversationId = useChatStore((s) => s.conversationId);

  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [conversations],
  );

  const goto = (route: string) => {
    props.navigation.navigate(route as never);
    props.navigation.closeDrawer();
  };

  const onNewChat = () => {
    startNewChat();
    props.navigation.closeDrawer();
    router.replace('/');
  };

  const openConversation = (id: string) => {
    void open(id);
    props.navigation.closeDrawer();
    router.replace('/');
  };

  const longPress = (id: string) => {
    const items: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      {
        text: 'Rename',
        onPress: () => {
          if (Platform.OS === 'ios' && Alert.prompt) {
            Alert.prompt('Rename conversation', undefined, (value) => {
              if (value?.trim()) void rename(id, value.trim());
            });
          }
        },
      },
      { text: 'Pin / Unpin', onPress: () => void setPinned(id, !conversations.find((c) => c._id === id)?.pinned) },
      { text: 'Delete', style: 'destructive', onPress: () => void archive(id) },
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Conversation', undefined, items);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.brandRow}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]}>
            <ThemedText variant="subtitle" color={theme.primaryForeground}>
              A
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="body" style={{ fontWeight: '800' }}>
              ARC-AI
            </ThemedText>
            <ThemedText variant="caption" numberOfLines={1}>
              {identity?.username || 'Guest'} · {credits} credits
            </ThemedText>
          </View>
        </View>
        {activeWorkspace ? (
          <View style={[styles.workspaceTag, { borderColor: theme.border }]}>
            <Ionicons name="cube-outline" size={12} color={theme.accent} />
            <ThemedText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {activeWorkspace.name}
            </ThemedText>
          </View>
        ) : null}
        <Pressable
          onPress={onNewChat}
          style={[styles.newChat, { borderColor: theme.primary, backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="add" size={18} color={theme.primary} />
          <ThemedText variant="body" color={theme.primary} style={{ fontWeight: '600' }}>
            New chat
          </ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingVertical: Spacing.sm }}
        ListHeaderComponent={
          <ThemedText variant="label" style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs }}>
            Recent
          </ThemedText>
        }
        ListEmptyComponent={
          <ThemedText variant="caption" style={{ paddingHorizontal: Spacing.lg }}>
            No conversations yet.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openConversation(item._id)}
            onLongPress={() => longPress(item._id)}
            style={({ pressed }) => [
              styles.convItem,
              {
                backgroundColor:
                  item._id === activeConversationId ? theme.primary + '14' : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Ionicons
              name={item.pinned ? 'bookmark' : 'chatbubble-ellipses-outline'}
              size={16}
              color={item.pinned ? theme.primary : theme.foregroundMuted}
            />
            <View style={{ flex: 1 }}>
              <ThemedText variant="muted" numberOfLines={1} color={theme.foreground}>
                {item.title || 'Untitled'}
              </ThemedText>
              {item.lastMessage?.content ? (
                <ThemedText variant="caption" numberOfLines={1}>
                  {item.lastMessage.content}
                </ThemedText>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      <View style={[styles.nav, { borderTopColor: theme.border }]}>
        {NAV.map((item) => {
          const active = activeRoute === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => goto(item.route)}
              style={({ pressed }) => [
                styles.navItem,
                {
                  backgroundColor: active ? theme.primary + '18' : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name={item.icon} size={18} color={active ? theme.primary : theme.foregroundMuted} />
              <ThemedText variant="muted" color={active ? theme.primary : theme.foreground}>
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            clearExecutions();
            void logout();
          }}
          style={({ pressed }) => [styles.navItem, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="log-out-outline" size={18} color={theme.destructive} />
          <ThemedText variant="muted" color={theme.destructive}>
            Sign out
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.lg, gap: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  logo: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  workspaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  nav: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.sm },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
});
