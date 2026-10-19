import { create } from 'zustand';

import { conversationsApi } from '@/api/conversations';
import { deriveAttachmentFields, sanitizeHistoryText } from '@/lib/conversationHistory';
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
      isStreaming: Boolean((m as any).streaming ?? false),
      interrupted: false,
      ...deriveAttachmentFields(m.attachments),
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
  /** Re-sync the OPEN thread with server history (reconnect/focus catch-up). */
  refreshCurrent: () => Promise<void>;
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

  // Reconnect / foreground catch-up (sync Phase B): the server transcript is
  // canonical, so a live refetch reconciles any messages this device missed
  // while offline. Skipped while a stream is drawing (its live bubble is
  // fresher than a fetch would be) and when no thread is open.
  refreshCurrent: async () => {
    const chat = useChatStore.getState();
    if (!chat.conversationId || chat.isStreaming) return;
    try {
      const workspaceId = useWorkspaceStore.getState().active?._id ?? null;
      const page = await conversationsApi.messages(chat.conversationId, {
        limit: 30,
        workspaceId,
      });
      if (useChatStore.getState().conversationId === chat.conversationId) {
        chat.setMessages(mapChatMessagesToUi(page.messages));
      }
      set({
        hasMore: page.page?.hasMore ?? page.hasMore ?? false,
        nextBefore: page.page?.nextBefore ?? null,
      });
    } catch {
      // Catch-up is best-effort; the next reconnect retries.
    }
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
    if (!conversationId || !hasMore || loadingMore) return;

    // Bug B-12: a page could report hasMore without a nextBefore cursor and
    // stall loading forever. Fall back to the CHAT VIEW's oldest known
    // SERVER id — an equivalent server-side cursor (`before=`) — instead of a
    // dead end. Ack-stamped optimistic bubbles expose it as `serverId`;
    // history-loaded bubbles already carry it as `id` (never `local_*`).
    let cursor = nextBefore;
    if (!cursor) {
      const messages = useChatStore.getState().messages;
      for (const m of messages) {
        if (m.serverId) {
          cursor = m.serverId;
          break;
        }
        if (typeof m.id === 'string' && m.id && !m.id.startsWith('local_')) {
          cursor = m.id;
          break;
        }
      }
    }
    if (!cursor) return;

    set({ loadingMore: true });
    try {
      const workspaceId = useWorkspaceStore.getState().active?._id ?? null;
      const page = await conversationsApi.messages(conversationId, {
        limit: 30,
        before: cursor,
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
