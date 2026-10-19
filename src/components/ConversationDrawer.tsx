import { Ionicons } from '@expo/vector-icons';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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

  // Bug B-07: `Alert.prompt` is iOS-only, which made Android rename a no-op.
  // A small cross-platform sheet (Modal + TextInput) gives every platform a
  // real rename dialog.
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

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
    const current = conversations.find((c) => c._id === id);
    const items: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      {
        text: 'Rename',
        onPress: () => {
          setRenaming({ id, title: current?.title || '' });
        },
      },
      { text: 'Pin / Unpin', onPress: () => void setPinned(id, !current?.pinned) },
      { text: 'Delete', style: 'destructive', onPress: () => void archive(id) },
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Conversation', undefined, items);
  };

  const submitRename = () => {
    const nextTitle = renaming?.title.trim();
    if (renaming && nextTitle) void rename(renaming.id, nextTitle);
    setRenaming(null);
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

      {renaming ? (
        <Modal transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
          <View style={[styles.sheetOverlay, { backgroundColor: '#00000066' }]}>
            <Pressable style={{ flex: 1 }} onPress={() => setRenaming(null)} />
            <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
              <ThemedText variant="subtitle">Rename conversation</ThemedText>
              <TextInput
                value={renaming.title}
                onChangeText={(text) => setRenaming({ ...renaming, title: text })}
                placeholder="Conversation title"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={submitRename}
                returnKeyType="done"
                style={[
                  styles.sheetInput,
                  { color: theme.foreground, borderColor: theme.border },
                ]}
              />
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setRenaming(null)}
                  style={({ pressed }) => [
                    styles.sheetButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}>
                  <ThemedText variant="muted" color={theme.foregroundMuted}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={submitRename}
                  style={({ pressed }) => [
                    styles.sheetButton,
                    styles.sheetPrimary,
                    { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <ThemedText variant="muted" color={theme.primaryForeground}>
                    Save
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sheetInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  sheetButton: {
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sheetPrimary: { alignItems: 'center', justifyContent: 'center' },
});
