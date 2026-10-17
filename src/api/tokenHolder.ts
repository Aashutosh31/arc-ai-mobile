/**
 * In-memory auth token holder.
 *
 * Kept separate from the store so the axios layer (and socket layer) can read
 * the token synchronously without importing React/Zustand. The auth store is
 * the sole writer and mirrors every change to SecureStore.
 */
let currentToken: string | null = null;

export function getAuthToken(): string | null {
  return currentToken;
}

export function setAuthToken(token: string | null): void {
  currentToken = token;
}
