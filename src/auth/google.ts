import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

/**
 * Google OAuth via the system auth browser.
 *
 * The backend exposes `/auth/google/url`; after consent it deep-links back to
 * the app with a one-time `ticket`, which is exchanged for a mobile session.
 * Any failure is surfaced through the auth store's error channel.
 */
export async function signInWithGoogle(): Promise<void> {
  const set = useAuthStore.setState;
  try {
    const redirectUrl = Linking.createURL('auth');
    const url = await authApi.googleUrl(redirectUrl);
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
    if (result.type !== 'success' || !result.url) return;

    const parsed = Linking.parse(result.url);
    const params = parsed.queryParams ?? {};
    const ticket = typeof params.ticket === 'string' ? params.ticket : null;
    if (!ticket) {
      set({ error: 'Google sign-in did not return a session ticket.' });
      return;
    }
    const res = await authApi.exchangeSession(ticket);
    if (res.user) {
      useAuthStore.getState().completeAuth({ ...res.user, token: res.token ?? undefined });
    } else {
      set({ error: 'Google sign-in could not establish a session.' });
    }
  } catch (err) {
    set({ error: err instanceof Error ? err.message : 'Google sign-in failed.' });
    throw err;
  }
}

/** Link a Google account to the current signed-in user. */
export async function linkGoogleAccount(): Promise<boolean> {
  const set = useAuthStore.setState;
  try {
    const redirectUrl = Linking.createURL('auth-link');
    const url = await authApi.googleLinkUrl(redirectUrl);
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
    if (result.type !== 'success' || !result.url) return false;
    const parsed = Linking.parse(result.url);
    const params = parsed.queryParams ?? {};
    const linked = params.linked === 'true' || params.success === 'true';
    if (linked) await useAuthStore.getState().refreshMe();
    return linked;
  } catch {
    set({ error: 'Could not link Google account.' });
    return false;
  }
}
