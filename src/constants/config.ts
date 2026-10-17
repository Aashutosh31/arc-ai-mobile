/**
 * Single source of truth for API / Socket.IO endpoints (mobile).
 *
 * Mirrors the web client's `client/src/config.js` intent: REST and Socket.IO
 * point at the same ARC-AI backend. Unlike the browser build there is no
 * same-origin proxy for the cookie path, so the app authenticates with the
 * Bearer token returned in the auth response bodies (see `src/api/client.ts`).
 *
 * Configure with EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL in `.env`.
 */

const DEFAULT_HOST = 'https://arc-ai-backend.onrender.com';

function normalize(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/+$/, '');
}

/** scheme://host[:port] — strips any path/query so socket URLs stay clean. */
function originOf(url: string): string {
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)/i.exec(url.trim());
  return match ? match[1] : url;
}

/** Base origin for REST calls (no trailing slash). */
export const API_URL = normalize(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_HOST;

/** Origin for the Socket.IO connection (never carries a path). */
export const SOCKET_URL = originOf(
  normalize(process.env.EXPO_PUBLIC_SOCKET_URL) ?? API_URL,
);

/** Every REST route is mounted under /api on the server. */
export const API_BASE = `${originOf(API_URL)}/api`;

/** Socket.IO default path. */
export const SOCKET_PATH = '/socket.io';

export const APP_NAME = 'ARC-AI';
export const APP_TAGLINE = 'Autonomous Real-time Conversational Agent';

/** Canonical PCM wire format used by both STT (input) and TTS (output). */
export const VOICE_STREAM_FORMAT = {
  encoding: 'pcm16',
  codec: 'pcm_s16le',
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
  endianness: 'le',
} as const;

export type VoiceStreamFormat = typeof VOICE_STREAM_FORMAT;
