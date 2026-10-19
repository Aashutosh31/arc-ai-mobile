import type { Socket } from 'socket.io-client';

import { applyClientAction, type ClientAction } from '@/socket/clientActions';
import { SOCKET_EVENTS } from '@/socket/events';
import { useApprovalStore } from '@/store/approvalStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import { useExecutionStore } from '@/store/executionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  notifyAssistantDone,
  notifySttCancelled,
  notifySttEnd,
  notifySttError,
  notifySttFinal,
  notifySttInterim,
  notifySttSpeechEnd,
  notifySttSpeechStart,
  notifySttStarted,
} from '@/voice/voiceSession';

type Any = Record<string, any>;

const s = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Attach all realtime handlers to the socket; returns a detach function. */
export function registerSocketHandlers(socket: Socket): () => void {
  const chat = () => useChatStore.getState();
  const offs: (() => void)[] = [];
  const on = (event: string, handler: (...args: any[]) => void) => {
    socket.on(event, handler);
    offs.push(() => socket.off(event, handler));
  };

  // ---- Chat streaming -------------------------------------------------------
  on(SOCKET_EVENTS.responseChunk, (payload: Any) => {
    const delta = s(payload?.displayText) || s(payload?.chunk) || s(payload?.text);
    if (payload?.conversationId) chat().setConversationId(s(payload.conversationId));
    if (delta) chat().appendChunk(delta);
    if (payload?.isFinal || payload?.final) {
      chat().finishAssistantStream();
      notifyAssistantDone();
    }
  });

  on(SOCKET_EVENTS.agentStatus, (payload: Any) => {
    const status = s(payload?.status) || s(payload);
    chat().setAgentStatus(status || null);
    if (status) chat().setProcessing(true);
  });

  on(SOCKET_EVENTS.providerInfo, (payload: Any) => {
    chat().setProviderInfo({
      provider: payload?.provider ?? null,
      fallbackUsed: Boolean(payload?.fallbackUsed),
      detail: s(payload?.detail) || s(payload?.message),
    });
  });

  on(SOCKET_EVENTS.creditsUpdate, (payload: Any) => {
    const credits = Number(payload?.credits ?? payload?.creditsRemaining);
    if (Number.isFinite(credits)) useAuthStore.getState().setCredits(credits);
  });

  on(SOCKET_EVENTS.conversationCreated, (payload: Any) => {
    const id = s(payload?.conversationId) || s(payload?.id);
    if (id) chat().setConversationId(id);
    void useConversationStore.getState().load();
  });

  on(SOCKET_EVENTS.conversationTitle, (payload: Any) => {
    const id = s(payload?.conversationId);
    const title = s(payload?.title);
    if (id && title) {
      useConversationStore.getState().updateTitleLocally(id, title);
      void useConversationStore.getState().load();
    }
  });

  // Realtime sync Phase A ([planning 05]): one durable message broadcast for
  // every device of this user. Only the OPEN thread is folded in (dedupe /
  // replace by the record's `_id` in chatStore.mergeServerMessage); non-open
  // records are ignored — the conversation list refetches on created/title.
  on(SOCKET_EVENTS.messageAppended, (payload: Any) => {
    const convId = s(payload?.conversationId);
    const message = payload?.message;
    if (!convId || !message || !s(message?._id)) return;
    if (convId === useChatStore.getState().conversationId) {
      useChatStore.getState().mergeServerMessage({
        _id: s(message._id),
        role: s(message.role),
        content: typeof message.content === 'string' ? message.content : '',
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
        streaming: Boolean(message.streaming),
        interrupted: Boolean(message.interrupted),
        createdAt: typeof message.createdAt === 'string' ? message.createdAt : undefined,
      });
    }
  });

  on(SOCKET_EVENTS.clientAction, (payload: Any) => {
    const action: ClientAction | undefined = payload?.action ?? payload;
    if (action) void applyClientAction(action);
  });

  on(SOCKET_EVENTS.botError, (payload: Any) => {
    const message = s(payload?.message) || s(payload?.error) || 'Something went wrong.';
    chat().appendSystemError(message);
    notifySttError(message);
  });

  // ---- Streaming STT --------------------------------------------------------
  on(SOCKET_EVENTS.sttStarted, (payload: Any) => notifySttStarted(s(payload?.sessionId)));
  on(SOCKET_EVENTS.sttInterim, (payload: Any) => notifySttInterim(s(payload?.text)));
  on(SOCKET_EVENTS.sttSpeechStart, () => notifySttSpeechStart());
  on(SOCKET_EVENTS.sttSpeechEnd, (payload: Any) => notifySttSpeechEnd(s(payload?.sessionId)));
  on(SOCKET_EVENTS.sttFinal, (payload: Any) => notifySttFinal(s(payload?.text), s(payload?.sessionId)));
  on(SOCKET_EVENTS.sttEnd, () => notifySttEnd());
  on(SOCKET_EVENTS.sttError, (payload: Any) =>
    notifySttError(s(payload?.message) || s(payload?.error) || 'Speech recognition failed.'),
  );
  on(SOCKET_EVENTS.sttCancelled, () => notifySttCancelled());

  // ---- Workspaces -----------------------------------------------------------
  on(SOCKET_EVENTS.workspaceSwitched, (payload: Any) => {
    const workspace = payload?.workspace ?? payload;
    if (workspace?._id) {
      useWorkspaceStore.getState().setActive(workspace);
      void useConversationStore.getState().load();
      chat().reset();
    }
  });

  on(SOCKET_EVENTS.workspaceError, (payload: Any) => {
    console.warn('[ARC] workspace error:', payload?.message || payload);
  });

  // ---- Approvals ------------------------------------------------------------
  on(SOCKET_EVENTS.approvalRequested, (payload: Any) => {
    useApprovalStore.getState().addRequest(payload);
  });

  // ---- Executions -----------------------------------------------------------
  on(SOCKET_EVENTS.executionCreated, (payload: Any) =>
    useExecutionStore.getState().upsertCreated({
      executionId: s(payload?.executionId),
      title: s(payload?.title),
      workspaceId: payload?.workspaceId ?? null,
      steps: Array.isArray(payload?.steps)
        ? payload.steps.map((st: Any) => ({
            id: s(st?.stepId) || s(st?.id),
            tool: s(st?.tool),
            status: st?.status,
          }))
        : [],
    }),
  );
  on(SOCKET_EVENTS.executionStarted, (payload: Any) =>
    useExecutionStore.getState().setStarted({
      executionId: s(payload?.executionId),
      workspaceId: payload?.workspaceId ?? null,
    }),
  );
  on(SOCKET_EVENTS.executionStepStarted, (payload: Any) =>
    useExecutionStore.getState().stepStarted({
      executionId: s(payload?.executionId),
      stepId: s(payload?.stepId),
      tool: s(payload?.tool),
    }),
  );
  on(SOCKET_EVENTS.executionStepCompleted, (payload: Any) =>
    useExecutionStore.getState().stepCompleted({
      executionId: s(payload?.executionId),
      stepId: s(payload?.stepId),
      status: payload?.status ?? 'COMPLETED',
      result: payload?.result,
      tool: s(payload?.tool),
    }),
  );
  on(SOCKET_EVENTS.executionStepFailed, (payload: Any) =>
    useExecutionStore.getState().stepFailed({
      executionId: s(payload?.executionId),
      stepId: s(payload?.stepId),
      error: s(payload?.error),
    }),
  );
  on(SOCKET_EVENTS.executionBlocked, (payload: Any) =>
    useExecutionStore.getState().setBlocked({
      executionId: s(payload?.executionId),
      reason: s(payload?.reason),
    }),
  );
  on(SOCKET_EVENTS.executionCompleted, (payload: Any) =>
    useExecutionStore.getState().setCompleted({
      executionId: s(payload?.executionId),
      status: s(payload?.status) || 'COMPLETED',
      reason: s(payload?.reason),
    }),
  );
  on(SOCKET_EVENTS.executionFailed, (payload: Any) =>
    useExecutionStore.getState().setCompleted({
      executionId: s(payload?.executionId),
      status: 'FAILED',
      reason: s(payload?.reason) || s(payload?.error),
    }),
  );
  on(SOCKET_EVENTS.executionReplan, (payload: Any) =>
    useExecutionStore.getState().replanSuggested({
      executionId: payload?.executionId ?? null,
      tool: s(payload?.tool),
      reason: s(payload?.reason),
    }),
  );

  return () => offs.forEach((fn) => fn());
}
