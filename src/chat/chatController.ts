import { SOCKET_EVENTS } from '@/socket/events';
import { emitEvent, getSocket } from '@/socket/socketClient';
import { useChatStore } from '@/store/chatStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { TurnPayload } from '@/types/api';

export interface SubmitTurnInput {
  text: string;
  image?: string | null;
  document?: { name: string; type: string; base64: string } | null;
  language?: string | null;
  /** Override the conversation id (e.g. creating a new chat). */
  conversationId?: string | null;
}

/**
 * Submit a user turn to the AI runtime over the socket.
 * Mirrors the web client's `sendCommand` (event `ai:stt:final`).
 */
export function submitTurn(input: SubmitTurnInput): void {
  const text = String(input.text || '').trim();
  if (!text && !input.image && !input.document) return;
  const chat = useChatStore.getState();

  chat.addUserMessage(text, {
    image: input.image ?? undefined,
    documentName: input.document?.name,
  });
  emitTurn(input);
}

/** Emit a turn without pushing a new user bubble (used by regenerate). */
function emitTurn(input: SubmitTurnInput): void {
  const text = String(input.text || '').trim();
  if (!text && !input.image && !input.document) return;
  const chat = useChatStore.getState();
  const socket = getSocket();
  if (!socket || !socket.connected) {
    chat.appendSystemError(
      socket
        ? 'Still connecting to ARC-AI. Please try again in a moment.'
        : 'Not signed in to ARC-AI. Please sign in and try again.',
    );
    socket?.connect();
    return;
  }

  chat.beginAssistantMessage();
  chat.setProcessing(true);

  const payload: TurnPayload = {
    command: text,
    image: input.image ?? null,
    document: input.document ?? null,
    conversationId:
      input.conversationId !== undefined ? input.conversationId : chat.conversationId,
    workspaceId: useWorkspaceStore.getState().active?._id ?? null,
    language: input.language ?? null,
  };

  socket.emit(SOCKET_EVENTS.turnSubmit, payload);
}

/**
 * Re-run the last user turn. Drops any trailing assistant reply, then re-emits
 * the most recent user message so the model regenerates its answer.
 */
export function regenerateLast(): void {
  const chat = useChatStore.getState();
  const messages = chat.messages;

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].sender === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return;

  const userMsg = messages[lastUserIdx];
  // Keep everything up to and including the last user message; drop the reply.
  chat.setMessages(messages.slice(0, lastUserIdx + 1));

  emitTurn({
    text: userMsg.text,
    image: userMsg.image ?? null,
  });
}

/** Stop in-flight generation and finalize the streaming bubble. */
export function stopGeneration(): void {
  emitEvent(SOCKET_EVENTS.streamStop);
  useChatStore.getState().finishAssistantStream({ interrupted: true });
  useChatStore.getState().setSpeaking(false);
}
