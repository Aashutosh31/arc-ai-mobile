import { useEffect, useRef } from 'react';

import { registerSocketHandlers } from '@/socket/registerHandlers';
import { connectSocket, disconnectSocket, getSocket } from '@/socket/socketClient';
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
      return;
    }

    let disposed = false;

    const bootstrap = async () => {
      const socket = await connectSocket();
      if (disposed) return;

      const reload = () => {
        void useWorkspaceStore.getState().load();
        void useConversationStore.getState().load();
      };
      socket.on('connect', reload);

      detachRef.current?.();
      detachRef.current = registerSocketHandlers(socket);

      if (socket.connected) reload();
    };

    void bootstrap();

    return () => {
      disposed = true;
      detachRef.current?.();
      detachRef.current = null;
      getSocket()?.removeAllListeners('connect');
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
