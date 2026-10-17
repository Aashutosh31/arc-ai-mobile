import type { AuthIdentity } from '@/types/api';

import { http } from './client';

export interface GoogleStatus {
  success: boolean;
  connected: boolean;
  message?: string;
}

export const googleApi = {
  calendarAuthUrl: async (): Promise<string> => {
    const { data } = await http.get<{ success: boolean; url: string }>(
      '/google/auth-url',
    );
    return data.url;
  },
  status: async (): Promise<GoogleStatus> => {
    const { data } = await http.get<GoogleStatus>('/google/status');
    return data;
  },
};

export interface GoogleSessionResult {
  success: boolean;
  user: AuthIdentity | null;
  token?: string;
}

export const mcpApi = {
  listServers: async () => {
    const { data } = await http.get('/mcp/servers');
    return data;
  },
  connect: async (id: string) => {
    const { data } = await http.post(`/mcp/servers/${id}/connect`);
    return data;
  },
  disconnect: async (id: string) => {
    const { data } = await http.post(`/mcp/servers/${id}/disconnect`);
    return data;
  },
  tools: async (id: string) => {
    const { data } = await http.get(`/mcp/servers/${id}/tools`);
    return data;
  },
};
