import { create } from 'zustand';

import { workspacesApi } from '@/api/workspaces';
import { getSocket } from '@/socket/socketClient';
import { SOCKET_EVENTS } from '@/socket/events';
import type { Workspace } from '@/types/api';

interface WorkspaceState {
  workspaces: Workspace[];
  active: Workspace | null;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  switchTo: (workspaceId: string) => void;
  create: (input: { name: string; description?: string }) => Promise<Workspace>;
  archive: (workspaceId: string) => Promise<void>;
  setActive: (workspace: Workspace | null) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  active: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [workspaces, active] = await Promise.all([
        workspacesApi.list(),
        workspacesApi.active(get().active?._id ?? null),
      ]);
      set({ workspaces, active, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load workspaces',
      });
    }
  },

  switchTo: (workspaceId) => {
    const socket = getSocket();
    if (socket) socket.emit(SOCKET_EVENTS.workspaceSwitch, { workspaceId });
    const next = get().workspaces.find((w) => w._id === workspaceId) ?? null;
    if (next) set({ active: next });
  },

  create: async (input) => {
    const workspace = await workspacesApi.create(input);
    set((s) => ({ workspaces: [workspace, ...s.workspaces], active: workspace }));
    const socket = getSocket();
    if (socket) socket.emit(SOCKET_EVENTS.workspaceSwitch, { workspaceId: workspace._id });
    return workspace;
  },

  archive: async (workspaceId) => {
    await workspacesApi.archive(workspaceId);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w._id !== workspaceId),
      active: s.active?._id === workspaceId ? null : s.active,
    }));
  },

  setActive: (workspace) => set({ active: workspace }),

  reset: () => set({ workspaces: [], active: null, loading: false, error: null }),
}));
