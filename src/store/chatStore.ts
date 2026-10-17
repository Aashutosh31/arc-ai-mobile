import { create } from 'zustand';

import { sanitizeHistoryText } from '@/lib/conversationHistory';

export interface UiMessage {
  id: string | null;
  sender: 'user' | 'ai';
  text: string;
  isStreaming: boolean;
  interrupted: boolean;
  image?: string;
  documentName?: string;
  createdAt?: number;
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
  isSpeaking: boolean;
  agentStatus: string | null;
  providerInfo: { provider: string | null; fallbackUsed: boolean; detail: string } | null;
  media: MediaState | null;
  connection: ConnectionState;
  connectionError: string | null;

  setConnection: (connection: ConnectionState, error?: string | null) => void;
  setConversationId: (id: string | null) => void;
  setMessages: (messages: UiMessage[]) => void;
  addUserMessage: (text: string, opts?: { image?: string; documentName?: string }) => void;
  beginAssistantMessage: () => void;
  appendChunk: (delta: string) => void;
  finishAssistantStream: (opts?: { interrupted?: boolean }) => void;
  setProcessing: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
  setAgentStatus: (status: string | null) => void;
  setProviderInfo: (info: ChatState['providerInfo']) => void;
  setMedia: (media: MediaState | null) => void;
  appendSystemError: (message: string) => void;
  reset: () => void;
}

let localIdSeq = 0;
const nextLocalId = () => `local_${Date.now().toString(36)}_${(localIdSeq += 1)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  conversationId: null,
  messages: [],
  isStreaming: false,
  isProcessing: false,
  isSpeaking: false,
  agentStatus: null,
  providerInfo: null,
  media: null,
  connection: 'connecting',
  connectionError: null,

  setConnection: (connection, error = null) => set({ connection, connectionError: error }),

  setConversationId: (id) => set({ conversationId: id }),

  setMessages: (messages) => set({ messages }),

  addUserMessage: (text, opts) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: nextLocalId(),
          sender: 'user',
          text: sanitizeHistoryText(text) as string,
          isStreaming: false,
          interrupted: false,
          image: opts?.image,
          documentName: opts?.documentName,
          createdAt: Date.now(),
        },
      ],
    })),

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

  appendChunk: (delta) => {
    if (!delta) return;
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.sender === 'ai' && last.isStreaming) {
        messages[messages.length - 1] = {
          ...last,
          text: sanitizeHistoryText(last.text + delta) as string,
        };
      } else {
        messages.push({
          id: nextLocalId(),
          sender: 'ai',
          text: sanitizeHistoryText(delta) as string,
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
        messages[messages.length - 1] = {
          ...last,
          isStreaming: false,
          interrupted: Boolean(opts?.interrupted),
          text: opts?.interrupted
            ? `${last.text}${last.text ? '\n\n' : ''}[stopped]`
            : last.text,
        };
      }
      return { messages, isStreaming: false, isProcessing: false, agentStatus: null };
    }),

  setProcessing: (v) => set({ isProcessing: v }),
  setSpeaking: (v) => set({ isSpeaking: v }),
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

  reset: () =>
    set({
      conversationId: null,
      messages: [],
      isStreaming: false,
      isProcessing: false,
      isSpeaking: false,
      agentStatus: null,
      providerInfo: null,
      media: null,
    }),
}));
