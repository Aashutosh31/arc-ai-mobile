import { useChatStore } from '@/store/chatStore';
import { useExecutionStore } from '@/store/executionStore';

/** Clear the composer for a fresh conversation; the server assigns the id. */
export function startNewChat(): void {
  useChatStore.getState().reset();
  useExecutionStore.getState().reset();
}
