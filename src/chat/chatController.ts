import { SOCKET_EVENTS } from '@/socket/events';
import { emitEvent, getSocket } from '@/socket/socketClient';
import { sanitizeHistoryText } from '@/lib/conversationHistory';
import { createMessageId, useChatStore, type UiMessage } from '@/store/chatStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { TurnAck, TurnPayload } from '@/types/api';

/**
 * Receipts cut off after this (old server without ack support, dead socket,
 * dropped ack). A late ack after the timeout is still honored — confirm() only
 * fills serverId at that point, so nothing tears.
 */
const TURN_ACK_TIMEOUT_MS = 10000;

/** Hard cap on turns held while offline — image/document base64 is heavy. */
const MAX_QUEUED_TURNS = 10;

interface QueuedTurn {
  localId: string;
  payload: TurnPayload;
  /** Queued from the new-chat screen (no conversation id yet). */
  startNew: boolean;
  /** Bubble creation time, so re-rendered held bubbles keep their position. */
  createdAt: number;
}

/**
 * Type-while-offline queue (sync Phase C tail). Turns are held in order and
 * replayed one at a time when the socket comes back: the server aborts any
 * in-flight generation for a socket on a new `ai:stt:final`, so the queue must
 * wait for each turn to settle before sending the next. In-memory by design —
 * a cold start drops unsent turns (same as the rest of the live transcript).
 */
let turnQueue: QueuedTurn[] = [];
/** A queued turn is streaming; the next one waits for it to settle. */
let drainingQueue = false;
/** The streaming queued turn was a new-chat turn (owner id may still be null). */
let drainingStartNew = false;
/** Conversation created by the queue itself (for follow-up new-chat turns). */
let queueOwnerConversationId: string | null = null;

const socketReady = (): boolean => Boolean(getSocket()?.connected);

/**
 * Send one turn now: open the streaming bubble, emit, and correlate the turn
 * receipt back to the optimistic bubble.
 */
function sendTurn(
  payload: TurnPayload,
  localId?: string,
  onConversation?: (conversationId: string) => void,
): boolean {
  const socket = getSocket();
  if (!socket?.connected) return false;

  const chat = useChatStore.getState();
  chat.beginAssistantMessage();
  chat.setProcessing(true);

  const ackTimer =
    localId != null
      ? setTimeout(() => {
          useChatStore.getState().confirmUserMessage(localId, null);
        }, TURN_ACK_TIMEOUT_MS)
      : null;

  socket.emit(SOCKET_EVENTS.turnSubmit, payload, (ack: TurnAck) => {
    if (ackTimer) clearTimeout(ackTimer);
    const confirmed = useChatStore.getState();
    if (ack?.conversationId) {
      const conversationId = String(ack.conversationId);
      confirmed.setConversationId(conversationId);
      onConversation?.(conversationId);
    }
    if (localId != null) {
      confirmed.confirmUserMessage(localId, ack?.userMessageId ?? null);
    }
  });
  return true;
}

/**
 * Replay held turns in order. Only the queue head goes out, and only when its
 * thread is the one open on screen — a turn queued in another conversation
 * waits until the user reopens that thread (or starts a new chat for
 * new-chat queued turns), so its reply can never land in the wrong transcript.
 */
export function flushQueuedTurns(): void {
  if (drainingQueue || turnQueue.length === 0) return;
  if (!socketReady()) return;

  const current = useChatStore.getState().conversationId;
  const next = turnQueue[0];
  let target: string | null;
  if (next.startNew) {
    // Follow-up new-chat turns continue the conversation the queue created;
    // the first one needs the user to be on the new-chat screen.
    const owner = queueOwnerConversationId;
    const expected = owner ?? null;
    if (current !== expected) return;
    target = expected;
  } else {
    if (next.payload.conversationId !== current) return;
    target = next.payload.conversationId;
  }

  const sent = sendTurn({ ...next.payload, conversationId: target }, next.localId, (id) => {
    if (next.startNew) queueOwnerConversationId = id;
  });
  if (!sent) return;

  turnQueue.shift();
  useChatStore.getState().setMessageQueued(next.localId, false);
  drainingQueue = true;
  drainingStartNew = next.startNew;
  if (turnQueue.length === 0) queueOwnerConversationId = null;
}

/**
 * A turn finished (final chunk / finalized record / user stop): release the
 * queue so the next held turn can go out.
 */
export function noteTurnSettled(): void {
  if (!drainingQueue) return;
  // The receipt may have been lost; the streamed chunk still carries the new
  // conversation id. Adopt it so follow-up new-chat turns continue the thread.
  if (drainingStartNew && !queueOwnerConversationId) {
    queueOwnerConversationId = useChatStore.getState().conversationId;
  }
  drainingStartNew = false;
  drainingQueue = false;
  flushQueuedTurns();
}

/**
 * Optimistic bubbles for turns still held in the queue, shaped like chat
 * bubbles. History replacements (`open` / reconnect catch-up) render these
 * after the server records, so a held turn survives a thread switch instead
 * of silently vanishing while still queued.
 */
export function queuedBubbles(conversationId: string | null): UiMessage[] {
  return turnQueue
    .filter((q) =>
      q.startNew
        ? conversationId === null || conversationId === queueOwnerConversationId
        : q.payload.conversationId === conversationId,
    )
    .map((q) => ({
      id: q.localId,
      sender: 'user' as const,
      text: (sanitizeHistoryText(q.payload.command) as string) ?? '',
      isStreaming: false,
      interrupted: false,
      pending: true,
      queued: true,
      image: q.payload.image ?? undefined,
      documentName: q.payload.document?.name,
      createdAt: q.createdAt,
    }));
}

/** The socket dropped mid-turn: the server aborted it, so free the lock. */
export function resetTurnQueueFlush(): void {
  drainingQueue = false;
  drainingStartNew = false;
}

/** Sign-out / session reset: drop everything held (bubbles are cleared too). */
export function clearTurnQueue(): void {
  turnQueue = [];
  drainingQueue = false;
  drainingStartNew = false;
  queueOwnerConversationId = null;
}

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

  lastTurnInput = { ...input, text };

  // The bubble id doubles as the turn correlation label: the server echoes it
  // in the receipt, which lets this exact bubble be bound to the durable
  // document later (device-sync layer).
  const localId = createMessageId();
  chat.addUserMessage(text, {
    image: input.image ?? undefined,
    documentName: input.document?.name,
    id: localId,
    pending: true,
  });
  emitTurn(input, localId);
}

/** Emit a turn without pushing a new user bubble (used by regenerate). */
function emitTurn(input: SubmitTurnInput, localId?: string): void {
  const text = String(input.text || '').trim();
  if (!text && !input.image && !input.document) return;
  const chat = useChatStore.getState();
  const socket = getSocket();

  const conversationId =
    input.conversationId !== undefined ? input.conversationId : chat.conversationId;
  const payload: TurnPayload = {
    command: text,
    image: input.image ?? null,
    document: input.document ?? null,
    conversationId,
    workspaceId: useWorkspaceStore.getState().active?._id ?? null,
    language: input.language ?? null,
    clientTurnId: localId,
  };

  if (!socket?.connected) {
    // Keep retrying in the background; the queue flushes on `connect`.
    socket?.connect();
    if (localId != null) {
      if (turnQueue.length >= MAX_QUEUED_TURNS) {
        chat.appendSystemError(
          `Offline queue is full (${MAX_QUEUED_TURNS} messages). Reconnect to send.`,
        );
        chat.confirmUserMessage(localId, null);
        return;
      }
      turnQueue.push({
        localId,
        payload,
        startNew: conversationId === null,
        createdAt: Date.now(),
      });
      chat.setMessageQueued(localId, true);
      return;
    }
    // Regenerate has no optimistic bubble to hold — it can only run online.
    chat.appendSystemError(
      socket
        ? 'Still connecting to ARC-AI. Please try again in a moment.'
        : 'Not signed in to ARC-AI. Please sign in and try again.',
    );
    return;
  }

  sendTurn(payload, localId);
}

/** The last turn's full payload (bug B-11): regenerate must re-send the
 * document and language it originally carried, not only text/image. The
 * bubble alone never has the document bytes — they were consumed by the
 * previous emission. Module-lifetime is intended (per regeneration session). */
let lastTurnInput: SubmitTurnInput | null = null;

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

  // Carry through the original payload (bug B-11): document + language travel
  // alongside text/image so the regenerated answer sees the exact same input.
  emitTurn({
    text: lastTurnInput?.text ?? userMsg.text,
    image: lastTurnInput?.image ?? userMsg.image ?? null,
    document: lastTurnInput?.document ?? null,
    language: lastTurnInput?.language ?? null,
  });
}

/** Stop in-flight generation and finalize the streaming bubble. */
export function stopGeneration(): void {
  emitEvent(SOCKET_EVENTS.streamStop);
  useChatStore.getState().finishAssistantStream({ interrupted: true });
  // A stopped queued turn must not wedge the rest of the queue.
  noteTurnSettled();
}
