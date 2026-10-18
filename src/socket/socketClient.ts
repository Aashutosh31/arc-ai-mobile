import { io, type Socket } from 'socket.io-client';

import { SOCKET_PATH, SOCKET_URL } from '@/constants/config';
import { authApi } from '@/api/auth';
import { getAuthToken } from '@/api/tokenHolder';

/**
 * Singleton Socket.IO connection to the ARC-AI realtime runtime.
 *
 * Auth uses the one-time handshake ticket (same mechanism as the web client),
 * AND includes the raw JWT as a fallback for servers/branches that do not
 * expose the ticket endpoint. Because tickets are single-use and Socket.IO
 * re-sends its `auth` payload on every (re)connection attempt, `auth` is
 * supplied as a FUNCTION so each attempt fetches a fresh ticket.
 */
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export interface ConnectOptions {
  /** Resolves tickets; defaults to the authenticated REST endpoint. */
  getTicket?: () => Promise<{ ticket: string; expiresInMs: number }>;
}

export async function connectSocket(opts: ConnectOptions = {}): Promise<Socket> {
  if (socket?.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const fetchTicket = opts.getTicket ?? (() => authApi.socketTicket());

  const buildAuth = async (): Promise<Record<string, unknown>> => {
    const token = getAuthToken() ?? undefined;
    let ticket: string | undefined;
    try {
      const res = await fetchTicket();
      ticket = res?.ticket;
    } catch {
      // Ticket unavailable (older backend / not authenticated yet) — the
      // server still accepts the JWT in `auth.token`.
      ticket = undefined;
    }
    return { ticket, token };
  };

  socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    // Prefer a direct websocket (matching the web client) so the long-lived
    // voice/audio session does not sit on HTTP long-polling, which is far more
    // prone to drops on mobile networks. Every engine.io attempt starts with
    // `transports[0]`, and without `tryAllTransports` a failed websocket never
    // retries the next transport (engine.io `_onError` shifts the list only
    // when this flag is on) — that stuck mobile clients on "websocket error"
    // behind carriers/proxies that block the upgrade.
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 20000,
    auth: (cb: (data: Record<string, unknown>) => void) => {
      buildAuth()
        .then((data) => cb(data))
        .catch(() => cb({ token: getAuthToken() ?? undefined }));
    },
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.auth = {};
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
  if (!socket || !socket.connected) return;
  if (ack) socket.emit(event, payload ?? {}, ack);
  else socket.emit(event, payload ?? {});
}
