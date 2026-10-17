import type { MemoryDashboard, MemoryFact, SemanticMemory } from '@/types/api';

import { http } from './client';

export const memoryApi = {
  dashboard: async (workspaceId?: string | null): Promise<MemoryDashboard> => {
    const params = workspaceId ? { workspaceId } : undefined;
    const { data } = await http.get<MemoryDashboard>('/memory', { params });
    return data;
  },
  setLearningEnabled: async (memoryLearningEnabled: boolean) => {
    const { data } = await http.patch('/memory/preferences', {
      memoryLearningEnabled,
    });
    return data;
  },
  updateFact: async (
    memoryId: string,
    patch: { fact?: string; category?: string; pinned?: boolean },
  ): Promise<MemoryFact> => {
    const { data } = await http.patch(`/memory/facts/${memoryId}`, patch);
    return data;
  },
  deleteFact: async (memoryId: string): Promise<{ deletedCount: number }> => {
    const { data } = await http.delete(`/memory/facts/${memoryId}`);
    return data;
  },
  updateSemantic: async (
    memoryId: string,
    patch: { query?: string; response?: string; tags?: string[]; pinned?: boolean },
  ): Promise<SemanticMemory> => {
    const { data } = await http.patch(`/memory/semantic/${memoryId}`, patch);
    return data;
  },
  deleteSemantic: async (memoryId: string): Promise<{ deletedCount: number }> => {
    const { data } = await http.delete(`/memory/semantic/${memoryId}`);
    return data;
  },
};
