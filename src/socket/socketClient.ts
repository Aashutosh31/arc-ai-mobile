import { io, type Socket } from 'socket.io-client';

import { SOCKET_PATH, SOCKET_URL } from '@/constants/config';
import { authApi } from '@/api/auth';

/**
 * Singleton Socket.IO connection to the ARC-AI realtime runtime.
 *
 * Auth uses the one-time handshake ticket (the same mechanism the web client
 * uses to avoid third-party cookies): the authenticated REST call issues a
 * short-lived ticket which is presented in `handshake.auth.ticket`.
 *
 * Binary audio frames (`voice:stt:audio` / `voice:tts:audio`) require a
 * binary-capable transport, so websocket is preferred.
 */
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export interface ConnectOptions {
  /** Resolves tickets; defaults to the authenticated REST endpoint. */
  getTicket?: () => Promise<{ ticket: string; expiresInMs: number }>;
}

export async function connectSocket(
  opts: ConnectOptions = {},
): Promise<Socket> {
  if (socket?.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const fetchTicket = opts.getTicket ?? (() => authApi.socketTicket());
  let ticket: string | undefined;
  try {
    const res = await fetchTicket();
    ticket = res.ticket;
  } catch {
    // Fall back to cookie/Bearer-less auth; the server will reject if invalid.
    ticket = undefined;
  }

  socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 12000,
    auth: { ticket },
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Emit with an optional ack; safe when disconnected. */
export function emitEvent(
  event: string,
  payload?: unknown,
  ack?: (...args: unknown[]) => void,
): void {
  if (!socket) return;
  if (ack) socket.emit(event, payload ?? {}, ack);
  else socket.emit(event, payload ?? {});
}
