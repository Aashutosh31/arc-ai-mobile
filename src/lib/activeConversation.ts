/**
 * Remembers which conversation the user was viewing so it can be restored on
 * the next cold start.
 *
 * Messages previously lived only in memory: killing the app dropped the active
 * conversation and the user reopened to an empty chat even though the thread
 * was safely stored server-side. The id is persisted (not the messages) so the
 * history is re-fetched from the API on launch, keeping it authoritative.
 */
import { deleteSecure, getSecure, setSecure, STORAGE_KEYS } from '@/lib/storage';

export async function loadActiveConversationId(): Promise<string | null> {
  try {
    const raw = await getSecure(STORAGE_KEYS.activeConversation);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export async function saveActiveConversationId(id: string | null): Promise<void> {
  try {
    if (id) await setSecure(STORAGE_KEYS.activeConversation, id);
    else await deleteSecure(STORAGE_KEYS.activeConversation);
  } catch {
    // best-effort
  }
}
