import type { MemoryDashboard, MemoryFact, SemanticMemory } from '@/types/api';

import { http } from './client';

export const memoryApi = {
  dashboard: async (workspaceId?: string | null): Promise<MemoryDashboard> => {
    const params = workspaceId ? { workspaceId } : undefined;
    const { data } = await http.get<MemoryDashboard>('/memory', { params });
    return data;
  },
  setLearningEnabled: async (memoryLearningEnabled: boolean, workspaceId?: string | null) => {
    const { data } = await http.patch('/memory/preferences', {
      memoryLearningEnabled,
      workspaceId: workspaceId ?? undefined,
    });
    return data;
  },
  createFact: async (
    patch: { fact: string; category?: string; layer?: string; pinned?: boolean },
    workspaceId?: string | null,
  ): Promise<MemoryFact> => {
    const { data } = await http.post<MemoryFact>('/memory/facts', {
      ...patch,
      workspaceId: workspaceId ?? undefined,
    });
    return data;
  },
  updateFact: async (
    memoryId: string,
    patch: { fact?: string; category?: string; layer?: string; pinned?: boolean },
    workspaceId?: string | null,
  ): Promise<MemoryFact> => {
    const { data } = await http.patch<MemoryFact>(`/memory/facts/${memoryId}`, {
      ...patch,
      workspaceId: workspaceId ?? undefined,
    });
    return data;
  },
  deleteFact: async (
    memoryId: string,
    workspaceId?: string | null,
  ): Promise<{ deletedCount: number }> => {
    const { data } = await http.delete<{ deletedCount: number }>(
      `/memory/facts/${memoryId}`,
      { params: workspaceId ? { workspaceId } : undefined },
    );
    return data;
  },
  updateSemantic: async (
    memoryId: string,
    patch: { query?: string; response?: string; summary?: string; layer?: string; tags?: string[]; pinned?: boolean },
    workspaceId?: string | null,
  ): Promise<SemanticMemory> => {
    const { data } = await http.patch<SemanticMemory>(`/memory/semantic/${memoryId}`, {
      ...patch,
      workspaceId: workspaceId ?? undefined,
    });
    return data;
  },
  deleteSemantic: async (
    memoryId: string,
    workspaceId?: string | null,
  ): Promise<{ deletedCount: number }> => {
    const { data } = await http.delete<{ deletedCount: number }>(
      `/memory/semantic/${memoryId}`,
      { params: workspaceId ? { workspaceId } : undefined },
    );
    return data;
  },
};
