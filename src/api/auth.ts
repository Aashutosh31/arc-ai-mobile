import type { AuthIdentity } from '@/types/api';

import { http } from './client';

export interface AuthResult extends AuthIdentity {
  token?: string;
  message?: string;
}

export const authApi = {
  guest: async (): Promise<AuthResult> => {
    const { data } = await http.post<AuthResult>('/auth/guest');
    return data;
  },
  login: async (email: string, password: string): Promise<AuthResult> => {
    const { data } = await http.post<AuthResult>('/auth/login', { email, password });
    return data;
  },
  register: async (
    username: string,
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    const { data } = await http.post<AuthResult>('/auth/register', {
      username,
      email,
      password,
    });
    return data;
  },
  me: async (): Promise<AuthResult> => {
    const { data } = await http.get<AuthResult>('/auth/me');
    return data;
  },
  logout: async (): Promise<void> => {
    await http.post('/auth/logout');
  },
  googleUrl: async (redirect?: string): Promise<string> => {
    const { data } = await http.get<{ success: boolean; url: string }>('/auth/google/url', {
      params: redirect ? { redirect } : undefined,
    });
    return data.url;
  },
  googleLinkUrl: async (redirect?: string): Promise<string> => {
    const { data } = await http.get<{ success: boolean; url: string }>('/auth/google/link-url', {
      params: redirect ? { redirect } : undefined,
    });
    return data.url;
  },
  exchangeSession: async (
    ticket: string,
  ): Promise<{ success: boolean; user: AuthResult | null; token?: string }> => {
    const { data } = await http.post('/auth/session', { ticket });
    return data;
  },
  socketTicket: async (): Promise<{ ticket: string; expiresInMs: number }> => {
    const { data } = await http.get<{ ticket: string; expiresInMs: number }>(
      '/auth/socket-ticket',
    );
    return data;
  },
};
