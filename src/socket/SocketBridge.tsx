import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { Socket } from 'socket.io-client';

import { loadActiveConversationId, saveActiveConversationId } from '@/lib/activeConversation';
import { registerSocketHandlers } from '@/socket/registerHandlers';
import { connectSocket, disconnectSocket, getSocket } from '@/socket/socketClient';
import { useApprovalStore } from '@/store/approvalStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { handleSocketReconnect } from '@/voice/voiceSession';
import { ttsPlayer } from '@/voice/ttsPlayer';

/**
 * Headless component mounted once at the app root. Owns the socket connection
 * lifecycle and pumps realtime events into the global stores.
 */
export function SocketBridge() {
  const token = useAuthStore((s) => s.token);
  const status = useAuthStore((s) => s.status);
  const detachRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const authed = Boolean(token) && (status === 'authenticated' || status === 'guest');
    if (!authed) {
      detachRef.current?.();
      detachRef.current = null;
      disconnectSocket();
      useChatStore.getState().setConnection('offline', null);
      return;
    }

    let disposed = false;
    let attached: Socket | null = null;
    let restoring = false;

    // Reopen the thread the user was last viewing. Messages live only in
    // memory, so without this a cold start dropped the conversation even
    // though it was stored server-side.
    const restoreActiveConversation = async () => {
      const chat = useChatStore.getState();
      if (restoring || chat.conversationId || chat.messages.length) return;
      const id = await loadActiveConversationId();
      if (!id || disposed) return;
      restoring = true;
      try {
        await useConversationStore.getState().open(id);
      } catch {
        // Conversation gone / belongs to another workspace: stop retrying.
        await saveActiveConversationId(null);
      } finally {
        restoring = false;
      }
    };

    const reload = async () => {
      // Workspace first: conversation fetches are scoped to the active one.
      await useWorkspaceStore.getState().load();
      await useConversationStore.getState().load();
      await restoreActiveConversation();
      // Sync Phase B: on a live reconnect, re-sync the OPEN thread from
      // durable server history so anything this device missed while offline
      // reconciles (dedupe is by server `_id`).
      await useConversationStore.getState().refreshCurrent();
    };
    const onConnect = () => {
      useChatStore.getState().setConnection('online', null);
      // A dropped connection kills the server-side STT session; re-open it so
      // voice mode keeps working after a reconnect.
      handleSocketReconnect();
      void reload();
    };
    const onDisconnect = () => {
      useChatStore.getState().setConnection('offline', 'Disconnected from ARC-AI.');
      useChatStore.getState().setProcessing(false);
      handleSocketReconnect();
    };
    const onConnectError = (err: Error) => {
      console.warn('[ARC] socket connect_error:', err?.message || err);
      useChatStore
        .getState()
        .setConnection('offline', err?.message || 'Could not connect to ARC-AI.');
      useChatStore.getState().setProcessing(false);
    };

    useChatStore.getState().setConnection('connecting', null);

    void connectSocket().then((socket) => {
      if (disposed) return;
      attached = socket;
      detachRef.current?.();
      detachRef.current = registerSocketHandlers(socket);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      if (socket.connected) onConnect();
    });

    return () => {
      disposed = true;
      detachRef.current?.();
      detachRef.current = null;
      if (attached) {
        attached.off('connect', onConnect);
        attached.off('disconnect', onDisconnect);
        attached.off('connect_error', onConnectError);
      }
    };
  }, [token, status]);

  // Android suspends sockets in the background; nudge the connection back to
  // life as soon as the app is foregrounded again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const socket = getSocket();
      if (socket && !socket.connected) socket.connect();
    });
    return () => sub.remove();
  }, []);

  // Reset per-session state on sign-out.
  useEffect(() => {
    if (status === 'unauthenticated') {
      useChatStore.getState().reset();
      useWorkspaceStore.getState().reset();
      useConversationStore.getState().reset();
      useApprovalStore.getState().reset();
      void ttsPlayer.cancel();
    }
  }, [status]);

  return null;
}
