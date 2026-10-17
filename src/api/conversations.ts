import type { ChatMessage, Conversation, MessagesPage } from '@/types/api';

import { http } from './client';

export const conversationsApi = {
  list: async (workspaceId?: string | null): Promise<Conversation[]> => {
    const params = workspaceId ? { workspaceId } : undefined;
    const { data } = await http.get<Conversation[]>('/conversations', { params });
    return data;
  },
  create: async (
    title?: string,
    workspaceId?: string | null,
  ): Promise<Conversation> => {
    const { data } = await http.post<Conversation>('/conversations', {
      title,
      workspaceId: workspaceId ?? undefined,
    });
    return data;
  },
  get: async (
    conversationId: string,
    workspaceId?: string | null,
  ): Promise<{ conversation: Conversation; messages: ChatMessage[] }> => {
    const params = workspaceId ? { workspaceId } : undefined;
    const { data } = await http.get(`/conversations/${conversationId}`, { params });
    return data;
  },
  messages: async (
    conversationId: string,
    opts: {
      limit?: number;
      skip?: number;
      before?: string;
      workspaceId?: string | null;
    } = {},
  ): Promise<MessagesPage> => {
    const { data } = await http.get<MessagesPage>(
      `/conversations/${conversationId}/messages`,
      { params: opts },
    );
    return data;
  },
  update: async (
    conversationId: string,
    patch: { title?: string; pinned?: boolean; workspaceId?: string | null },
  ): Promise<Conversation> => {
    const { data } = await http.patch(`/conversations/${conversationId}`, patch);
    return data;
  },
  archive: async (conversationId: string): Promise<{ success: boolean }> => {
    const { data } = await http.delete(`/conversations/${conversationId}`);
    return data;
  },
};
