import { create } from 'zustand';

import { conversationsApi } from '@/api/conversations';
import { sanitizeHistoryText } from '@/lib/conversationHistory';
import { useChatStore, type UiMessage } from '@/store/chatStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { ChatMessage, Conversation } from '@/types/api';

export function mapChatMessagesToUi(messages: ChatMessage[]): UiMessage[] {
  return messages
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((m) => ({
      id: m._id,
      sender: m.role === 'ai' ? 'ai' : 'user',
      text: (sanitizeHistoryText(m.content) as string) ?? '',
      isStreaming: false,
      interrupted: false,
      createdAt: new Date(m.createdAt).getTime(),
    }));
}

interface ConversationState {
  items: Conversation[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  nextBefore: string | null;

  load: () => Promise<void>;
  open: (conversationId: string) => Promise<void>;
  startNew: () => void;
  create: (title?: string) => Promise<Conversation | null>;
  rename: (conversationId: string, title: string) => Promise<void>;
  setPinned: (conversationId: string, pinned: boolean) => Promise<void>;
  archive: (conversationId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  updateTitleLocally: (conversationId: string, title: string) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  items: [],
  loading: false,
  loadingMore: false,
  error: null,
  hasMore: false,
  nextBefore: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const workspaceId = useWorkspaceStore.getState().active?._id ?? null;
      const items = await conversationsApi.list(workspaceId);
      set({ items, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load' });
    }
  },

  open: async (conversationId) => {
    const chat = useChatStore.getState();
    const workspaceId = useWorkspaceStore.getState().active?._id ?? null;
    chat.setConversationId(conversationId);
    const page = await conversationsApi.messages(conversationId, {
      limit: 30,
      workspaceId,
    });
    chat.setMessages(mapChatMessagesToUi(page.messages));
    set({
      hasMore: page.page?.hasMore ?? page.hasMore ?? false,
      nextBefore: page.page?.nextBefore ?? null,
    });
  },

  startNew: () => {
    useChatStore.getState().reset();
    set({ hasMore: false, nextBefore: null });
  },

  create: async (title) => {
    try {
      const workspaceId = useWorkspaceStore.getState().active?._id ?? null;
      const conversation = await conversationsApi.create(title, workspaceId);
      set((s) => ({ items: [conversation, ...s.items] }));
      return conversation;
    } catch {
      return null;
    }
  },

  rename: async (conversationId, title) => {
    set((s) => ({
      items: s.items.map((c) => (c._id === conversationId ? { ...c, title } : c)),
    }));
    try {
      await conversationsApi.update(conversationId, { title });
    } catch {
      // keep optimistic title
    }
  },

  setPinned: async (conversationId, pinned) => {
    set((s) => ({
      items: s.items.map((c) => (c._id === conversationId ? { ...c, pinned } : c)),
    }));
    try {
      await conversationsApi.update(conversationId, { pinned });
    } catch {
      // ignore
    }
  },

  archive: async (conversationId) => {
    set((s) => ({ items: s.items.filter((c) => c._id !== conversationId) }));
    try {
      await conversationsApi.archive(conversationId);
    } catch {
      // ignore
    }
    if (useChatStore.getState().conversationId === conversationId) {
      useChatStore.getState().reset();
    }
  },

  loadMore: async () => {
    const { nextBefore, hasMore, loadingMore } = get();
    const conversationId = useChatStore.getState().conversationId;
    if (!conversationId || !hasMore || !nextBefore || loadingMore) return;
    set({ loadingMore: true });
    try {
      const workspaceId = useWorkspaceStore.getState().active?._id ?? null;
      const page = await conversationsApi.messages(conversationId, {
        limit: 30,
        before: nextBefore,
        workspaceId,
      });
      const older = mapChatMessagesToUi(page.messages);
      const chat = useChatStore.getState();
      chat.setMessages([...older, ...chat.messages]);
      set({
        hasMore: page.page?.hasMore ?? page.hasMore ?? false,
        nextBefore: page.page?.nextBefore ?? null,
        loadingMore: false,
      });
    } catch {
      set({ loadingMore: false });
    }
  },

  updateTitleLocally: (conversationId, title) =>
    set((s) => ({
      items: s.items.map((c) => (c._id === conversationId ? { ...c, title } : c)),
    })),

  reset: () => set({ items: [], loading: false, error: null, hasMore: false, nextBefore: null }),
}));
