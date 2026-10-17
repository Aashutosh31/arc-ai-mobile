import type { Workspace } from '@/types/api';

import { http } from './client';

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => {
    const { data } = await http.get<{ workspaces: Workspace[] }>('/workspaces');
    return data.workspaces ?? [];
  },
  active: async (workspaceId?: string | null): Promise<Workspace | null> => {
    const params = workspaceId ? { workspaceId } : undefined;
    const { data } = await http.get<{ workspace: Workspace | null }>(
      '/workspaces/active',
      { params },
    );
    return data.workspace ?? null;
  },
  get: async (workspaceId: string): Promise<Workspace> => {
    const { data } = await http.get<{ workspace: Workspace }>(
      `/workspaces/${workspaceId}`,
    );
    return data.workspace;
  },
  create: async (input: {
    name: string;
    description?: string;
    visibility?: string;
  }): Promise<Workspace> => {
    const { data } = await http.post<{ workspace: Workspace }>('/workspaces', input);
    return data.workspace;
  },
  update: async (
    workspaceId: string,
    patch: Partial<Pick<Workspace, 'name' | 'description' | 'visibility'>> & {
      settings?: Record<string, unknown>;
    },
  ): Promise<Workspace> => {
    const { data } = await http.put<{ workspace: Workspace }>(
      `/workspaces/${workspaceId}`,
      patch,
    );
    return data.workspace;
  },
  archive: async (workspaceId: string): Promise<void> => {
    await http.delete(`/workspaces/${workspaceId}`);
  },
};
