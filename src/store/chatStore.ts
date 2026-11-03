import { create } from 'zustand';

import { saveActiveConversationId } from '@/lib/activeConversation';
import { deriveAttachmentFields, sanitizeHistoryText } from '@/lib/conversationHistory';
import type { ToolCall } from '@/types/api';

/** Durable `conversation.message.appended` record (sync Phase A payload). */
export interface ServerAppendedMessage {
  _id: string;
  role?: string;
  content?: string;
  attachments?: unknown[];
  toolCalls?: ToolCall[];
  streaming?: boolean;
  interrupted?: boolean;
  createdAt?: string;
}

export interface UiMessage {
  id: string | null;
  sender: 'user' | 'ai';
  text: string;
  isStreaming: boolean;
  interrupted: boolean;
  image?: string;
  documentName?: string;
  toolCalls?: ToolCall[];
  createdAt?: number;
  /**
   * True while the turn receipt (`ai:stt:final` ack) is outstanding. Pure
   * bookkeeping for the device-sync layer — no UI renders it yet.
   */
  pending?: boolean;
  /** Durable server message id, filled when the turn receipt arrives. */
  serverId?: string;
  /**
   * Type-while-offline: the turn is held in the in-memory send queue and goes
   * out (in order) once the socket reconnects.
   */
  queued?: boolean;
}

export interface MediaState {
  videoId: string;
  title: string;
}

export type ConnectionState = 'connecting' | 'online' | 'offline';

interface ChatState {
  conversationId: string | null;
  messages: UiMessage[];
  isStreaming: boolean;
  isProcessing: boolean;
  agentStatus: string | null;
  providerInfo: { provider: string | null; fallbackUsed: boolean; detail: string } | null;
  media: MediaState | null;
  connection: ConnectionState;
  connectionError: string | null;

  setConnection: (connection: ConnectionState, error?: string | null) => void;
  setConversationId: (id: string | null) => void;
  setMessages: (messages: UiMessage[]) => void;
  addUserMessage: (
    text: string,
    opts?: { image?: string; documentName?: string; id?: string; pending?: boolean },
  ) => void;
  /**
   * Bind an optimistic user bubble to its durable server document (turn
   * receipt). `serverId: null` just resolves the pending state — used for
   * guest turns and timeouts where no durable id will ever exist.
   */
  confirmUserMessage: (id: string, serverId: string | null) => void;
  /** Mark/clear the type-while-offline badge on an optimistic user bubble. */
  setMessageQueued: (id: string, queued: boolean) => void;
  /**
   * Fold one durable `conversation.message.appended` record into the live
   * transcript (sync Phase B). Reconciles by the canonical server `_id`:
   * known (`serverId`-stamped or fan-out-seen) ids replace in place — a
   * streaming draft converging to final — unknown ids append. Optimistic
   * bubbles without a receipt-stamp stay below untouched.
   */
  mergeServerMessage: (
    message: ServerAppendedMessage | null,
    opts?: { foldLocalAssistant?: boolean },
  ) => void;
  beginAssistantMessage: () => void;
  appendChunk: (delta: string) => void;
  finishAssistantStream: (opts?: { interrupted?: boolean }) => void;
  setProcessing: (v: boolean) => void;
  setAgentStatus: (status: string | null) => void;
  setProviderInfo: (info: ChatState['providerInfo']) => void;
  setMedia: (media: MediaState | null) => void;
  appendSystemError: (message: string) => void;
  reset: () => void;
}

let localIdSeq = 0;
const nextLocalId = () => `local_${Date.now().toString(36)}_${(localIdSeq += 1)}`;

/** Mint an optimistic ui id the turn ack can later be correlated against. */
export const createMessageId = (): string => nextLocalId();

export const useChatStore = create<ChatState>((set, get) => ({
  conversationId: null,
  messages: [],
  isStreaming: false,
  isProcessing: false,
  agentStatus: null,
  providerInfo: null,
  media: null,
  connection: 'connecting',
  connectionError: null,

  setConnection: (connection, error = null) => set({ connection, connectionError: error }),

  setConversationId: (id) =>
    set((s) => {
      // Persist only on change: this is called for every streamed chunk, and
      // the durable id is what lets a cold start reopen the same thread.
      if (s.conversationId !== id) void saveActiveConversationId(id);
      return { conversationId: id };
    }),

  setMessages: (messages) => set({ messages }),

  addUserMessage: (text, opts) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: opts?.id ?? nextLocalId(),
          sender: 'user',
          text: sanitizeHistoryText(text) as string,
          isStreaming: false,
          interrupted: false,
          pending: opts?.pending ?? false,
          image: opts?.image,
          documentName: opts?.documentName,
          createdAt: Date.now(),
        },
      ],
    })),

  confirmUserMessage: (id, serverId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? { ...m, pending: false, queued: false, serverId: serverId ?? m.serverId }
          : m,
      ),
    })),

  setMessageQueued: (id, queued) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, queued } : m)),
    })),

  mergeServerMessage: (message, opts) => {
    if (!message?._id || typeof message._id !== 'string') return;
    const sid = message._id;
    const media = deriveAttachmentFields(message.attachments);
    const next: UiMessage = {
      id: sid,
      sender: message.role === 'user' ? 'user' : 'ai',
      text: (sanitizeHistoryText(message.content ?? '') as string) ?? '',
      isStreaming: Boolean(message.streaming) && message.role !== 'user',
      interrupted: Boolean(message.interrupted),
      ...media,
      toolCalls: Array.isArray(message.toolCalls) ? message.toolCalls : [],
      createdAt: message.createdAt ? new Date(message.createdAt).getTime() : undefined,
    };
    set((s) => {
      let idx = s.messages.findIndex(
        (m) => m.serverId === sid || m.id === sid,
      );
      if (idx === -1 && opts?.foldLocalAssistant && next.sender === 'ai') {
        // Origin-device finalize (`ai:assistant:finalized`): the device that
        // sent the turn already holds the streamed bubble, which has no
        // durable id. Fold the canonical record into the most recent finished
        // local assistant bubble so it gains the server id + tool calls.
        for (let i = s.messages.length - 1; i >= 0; i -= 1) {
          const m = s.messages[i];
          if (
            m.sender === 'ai' &&
            !m.isStreaming &&
            typeof m.id === 'string' &&
            m.id.startsWith('local_')
          ) {
            idx = i;
            break;
          }
        }
      }
      if (idx !== -1) {
        const messages = [...s.messages];
        const prev = messages[idx];
        // The server record is authoritative for content/tool calls, and the
        // folded origin bubble adopts the durable id. An ack-stamped optimistic
        // user bubble keeps its local id (it already exposes `serverId`), so
        // pending-state identity and the list key stay stable.
        messages[idx] = {
          ...prev,
          ...next,
          id: prev.serverId === sid && prev.id !== sid ? prev.id : sid,
        };
        return { messages };
      }
      return { messages: [...s.messages, next] };
    });
  },

  beginAssistantMessage: () =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: nextLocalId(),
          sender: 'ai',
          text: '',
          isStreaming: true,
          interrupted: false,
          createdAt: Date.now(),
        },
      ],
      isStreaming: true,
      isProcessing: true,
    })),

  // Append the raw delta verbatim. Sanitizing here would strip the trailing
  // space that separates streamed words and glue them together (and mangle
  // code). Cleanup is applied once, on finalize.
  appendChunk: (delta) => {
    if (!delta) return;
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.sender === 'ai' && last.isStreaming) {
        messages[messages.length - 1] = {
          ...last,
          text: last.text + delta,
        };
      } else {
        messages.push({
          id: nextLocalId(),
          sender: 'ai',
          text: delta,
          isStreaming: true,
          interrupted: false,
          createdAt: Date.now(),
        });
      }
      return { messages, isStreaming: true };
    });
  },

  finishAssistantStream: (opts) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.sender === 'ai' && last.isStreaming) {
        const base = sanitizeHistoryText(last.text) as string;
        messages[messages.length - 1] = {
          ...last,
          isStreaming: false,
          interrupted: Boolean(opts?.interrupted),
          text: opts?.interrupted ? `${base}${base ? '\n\n' : ''}[stopped]` : base,
        };
      }
      return { messages, isStreaming: false, isProcessing: false, agentStatus: null };
    }),

  setProcessing: (v) => set({ isProcessing: v }),
  setAgentStatus: (status) => set({ agentStatus: status }),
  setProviderInfo: (info) => set({ providerInfo: info }),
  setMedia: (media) => set({ media }),

  appendSystemError: (message) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: nextLocalId(),
          sender: 'ai',
          text: `[Error]: ${message}`,
          isStreaming: false,
          interrupted: false,
          createdAt: Date.now(),
        },
      ],
      isStreaming: false,
      isProcessing: false,
      agentStatus: null,
    })),

  reset: () => {
    void saveActiveConversationId(null);
    set({
      conversationId: null,
      messages: [],
      isStreaming: false,
      isProcessing: false,
      agentStatus: null,
      providerInfo: null,
      media: null,
    });
  },
}));
