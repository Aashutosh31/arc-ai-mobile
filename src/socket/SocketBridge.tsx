import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';

import { registerSocketHandlers } from '@/socket/registerHandlers';
import { connectSocket, disconnectSocket } from '@/socket/socketClient';
import { useApprovalStore } from '@/store/approvalStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
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

    const reload = () => {
      void useWorkspaceStore.getState().load();
      void useConversationStore.getState().load();
    };
    const onConnect = () => {
      useChatStore.getState().setConnection('online', null);
      reload();
    };
    const onDisconnect = () => {
      useChatStore.getState().setConnection('offline', 'Disconnected from ARC-AI.');
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
