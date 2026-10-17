import { create } from 'zustand';

import { authApi } from '@/api/auth';
import { extractApiError } from '@/api/client';
import { setAuthToken } from '@/api/tokenHolder';
import { getSecure, STORAGE_KEYS, setSecure, deleteSecure } from '@/lib/storage';
import type { AuthIdentity } from '@/types/api';

interface AuthState {
  status: 'loading' | 'guest' | 'authenticated' | 'unauthenticated';
  identity: AuthIdentity | null;
  token: string | null;
  credits: number;
  error: string | null;
  busy: boolean;

  bootstrap: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  setCredits: (credits: number) => void;
  completeAuth: (res: AuthIdentity & { token?: string }) => void;
  logout: () => Promise<void>;
}

function persistIdentity(identity: AuthIdentity | null, token: string | null) {
  setAuthToken(token);
  if (token) void setSecure(STORAGE_KEYS.token, token);
  else void deleteSecure(STORAGE_KEYS.token);
  if (identity) void setSecure(STORAGE_KEYS.identity, JSON.stringify(identity));
  else void deleteSecure(STORAGE_KEYS.identity);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  identity: null,
  token: null,
  credits: 0,
  error: null,
  busy: false,

  bootstrap: async () => {
    const token = await getSecure(STORAGE_KEYS.token);
    const rawIdentity = await getSecure(STORAGE_KEYS.identity);
    if (!token) {
      set({ status: 'unauthenticated', identity: null, token: null });
      return;
    }
    setAuthToken(token);
    const cached: AuthIdentity | null = rawIdentity ? JSON.parse(rawIdentity) : null;
    // Optimistically trust the cached identity, then verify with /auth/me.
    set({
      status: cached?.authType === 'guest' ? 'guest' : 'authenticated',
      identity: cached,
      token,
      credits: cached?.creditsRemaining ?? 0,
    });
    try {
      const me = await authApi.me();
      const next: AuthIdentity = { ...me, token };
      persistIdentity(next, token);
      set({
        status: next.authType === 'guest' ? 'guest' : 'authenticated',
        identity: next,
        credits: next.creditsRemaining ?? 0,
        error: null,
      });
    } catch (err) {
      const e = extractApiError(err);
      // Stale guest sessions / bad tokens → clear and fall back to fresh guest.
      if (e.status === 401) {
        persistIdentity(null, null);
        set({ status: 'unauthenticated', identity: null, token: null });
      }
    }
  },

  continueAsGuest: async () => {
    set({ busy: true, error: null });
    try {
      const res = await authApi.guest();
      const token = res.token ?? null;
      const identity: AuthIdentity = { ...res, token: undefined };
      persistIdentity(identity, token);
      set({
        status: 'guest',
        identity,
        token,
        credits: res.creditsRemaining ?? 0,
        busy: false,
      });
    } catch (err) {
      set({ busy: false, error: extractApiError(err).message });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ busy: true, error: null });
    try {
      const res = await authApi.login(email, password);
      const token = res.token ?? null;
      const identity: AuthIdentity = { ...res, token: undefined };
      persistIdentity(identity, token);
      set({
        status: 'authenticated',
        identity,
        token,
        credits: res.creditsRemaining ?? 0,
        busy: false,
      });
    } catch (err) {
      set({ busy: false, error: extractApiError(err).message });
      throw err;
    }
  },

  register: async (username, email, password) => {
    set({ busy: true, error: null });
    try {
      const res = await authApi.register(username, email, password);
      const token = res.token ?? null;
      const identity: AuthIdentity = { ...res, token: undefined };
      persistIdentity(identity, token);
      set({
        status: 'authenticated',
        identity,
        token,
        credits: res.creditsRemaining ?? 0,
        busy: false,
      });
    } catch (err) {
      set({ busy: false, error: extractApiError(err).message });
      throw err;
    }
  },

  refreshMe: async () => {
    if (!get().token) return;
    try {
      const me = await authApi.me();
      const next: AuthIdentity = { ...me, token: get().token ?? undefined };
      persistIdentity(next, get().token);
      set({ identity: next, credits: next.creditsRemaining ?? get().credits });
    } catch {
      // ignore silent refresh failures
    }
  },

  setCredits: (credits) => {
    const identity = get().identity;
    const next = identity ? { ...identity, creditsRemaining: credits } : identity;
    if (next) persistIdentity(next, get().token);
    set({ credits, identity: next });
  },

  completeAuth: (res) => {
    const token = res.token ?? get().token ?? null;
    const identity: AuthIdentity = { ...res, token: undefined };
    persistIdentity(identity, token);
    set({
      status: identity.authType === 'guest' ? 'guest' : 'authenticated',
      identity,
      token,
      credits: identity.creditsRemaining ?? 0,
      error: null,
      busy: false,
    });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort
    }
    persistIdentity(null, null);
    set({ status: 'unauthenticated', identity: null, token: null, credits: 0 });
  },
}));
