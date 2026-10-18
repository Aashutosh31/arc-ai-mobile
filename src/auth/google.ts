import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

/**
 * Google OAuth via the system auth browser.
 *
 * The backend exposes `/auth/google/url`; after consent it redirects back to
 * the app at `arcaimobile://auth?ticket=...`. Depending on the device the
 * redirect is delivered EITHER through the in-app browser session
 * (`openAuthSessionAsync` returns `result.url`) OR as an OS deep link that
 * opens the app on the `/auth` route (`src/app/auth.tsx`). Both paths funnel
 * into `exchangeGoogleTicket`, which is idempotent so the one-time ticket is
 * never consumed twice.
 */
export function parseTicketFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const params = Linking.parse(url).queryParams ?? {};
    return typeof params.ticket === 'string' && params.ticket ? params.ticket : null;
  } catch {
    return null;
  }
}

let settledTicket: string | null = null;
let exchangeInFlight: { ticket: string; promise: Promise<boolean> } | null = null;

/** Exchange a one-time Google ticket for a mobile session (at most once). */
export async function exchangeGoogleTicket(ticket: string | null | undefined): Promise<boolean> {
  if (!ticket) return false;
  if (ticket === settledTicket) return true;
  if (exchangeInFlight && exchangeInFlight.ticket === ticket) {
    return exchangeInFlight.promise;
  }
  const promise = (async () => {
    try {
      const res = await authApi.exchangeSession(ticket);
      if (res.user) {
        settledTicket = ticket;
        useAuthStore.getState().completeAuth({ ...res.user, token: res.token ?? undefined });
        return true;
      }
      useAuthStore.setState({ error: 'Google sign-in could not establish a session.' });
      return false;
    } catch (err) {
      useAuthStore.setState({
        error: err instanceof Error ? err.message : 'Google sign-in failed.',
      });
      return false;
    } finally {
      if (exchangeInFlight?.ticket === ticket) exchangeInFlight = null;
    }
  })();
  exchangeInFlight = { ticket, promise };
  return promise;
}

/** Complete sign-in from a raw redirect URL (in-app browser or deep link). */
export async function completeGoogleAuthFromUrl(
  url: string | null | undefined,
): Promise<boolean> {
  const ticket = parseTicketFromUrl(url);
  if (!ticket) {
    useAuthStore.setState({ error: 'Google sign-in did not return a session ticket.' });
    return false;
  }
  return exchangeGoogleTicket(ticket);
}

export async function signInWithGoogle(): Promise<void> {
  const set = useAuthStore.setState;
  try {
    const redirectUrl = Linking.createURL('auth');
    const url = await authApi.googleUrl(redirectUrl);
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
    // When the session is not captured here, the OS delivers the redirect as a
    // deep link instead and the `/auth` route completes the exchange.
    if (result.type !== 'success' || !result.url) return;
    await completeGoogleAuthFromUrl(result.url);
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
