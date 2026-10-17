import { create } from 'zustand';

export type StepStatus =
  | 'PLANNED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED';

export interface ExecutionStep {
  stepId: string;
  tool: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
}

export interface Execution {
  executionId: string;
  title: string;
  status: string;
  workspaceId?: string | null;
  steps: ExecutionStep[];
  reason?: string;
  updatedAt: number;
}

interface ExecutionState {
  executions: Execution[];
  upsertCreated: (p: { executionId: string; title?: string; steps?: { id: string; tool: string; status?: StepStatus }[]; workspaceId?: string | null }) => void;
  setStarted: (p: { executionId: string; workspaceId?: string | null }) => void;
  stepStarted: (p: { executionId: string; stepId: string; tool?: string }) => void;
  stepCompleted: (p: { executionId: string; stepId: string; status: StepStatus; result?: unknown; tool?: string }) => void;
  stepFailed: (p: { executionId: string; stepId: string; error?: string }) => void;
  setBlocked: (p: { executionId: string; reason?: string }) => void;
  setCompleted: (p: { executionId: string; status?: string; reason?: string }) => void;
  replanSuggested: (p: { executionId: string | null; tool: string; reason: string }) => void;
  reset: () => void;
}

const mutate = (
  executions: Execution[],
  executionId: string,
  fn: (exec: Execution) => Execution,
): Execution[] => {
  const idx = executions.findIndex((e) => e.executionId === executionId);
  if (idx === -1) return executions;
  const next = [...executions];
  next[idx] = fn(next[idx]);
  return next;
};

export const useExecutionStore = create<ExecutionState>((set) => ({
  executions: [],

  upsertCreated: ({ executionId, title, steps, workspaceId }) =>
    set((s) => {
      const existing = s.executions.find((e) => e.executionId === executionId);
      const mappedSteps: ExecutionStep[] = (steps ?? []).map((st) => ({
        stepId: st.id,
        tool: st.tool,
        status: st.status ?? 'PLANNED',
      }));
      if (existing) {
        return {
          executions: mutate(s.executions, executionId, (e) => ({
            ...e,
            title: title || e.title,
            steps: mappedSteps.length ? mappedSteps : e.steps,
            workspaceId: workspaceId ?? e.workspaceId,
            updatedAt: Date.now(),
          })),
        };
      }
      return {
        executions: [
          {
            executionId,
            title: title || 'Execution',
            status: 'CREATED',
            workspaceId: workspaceId ?? null,
            steps: mappedSteps,
            updatedAt: Date.now(),
          },
          ...s.executions,
        ],
      };
    }),

  setStarted: ({ executionId, workspaceId }) =>
    set((s) => ({
      executions: mutate(s.executions, executionId, (e) => ({
        ...e,
        status: 'RUNNING',
        workspaceId: workspaceId ?? e.workspaceId,
        updatedAt: Date.now(),
      })),
    })),

  stepStarted: ({ executionId, stepId, tool }) =>
    set((s) => ({
      executions: mutate(s.executions, executionId, (e) => ({
        ...e,
        steps: e.steps.some((x) => x.stepId === stepId)
          ? e.steps.map((x) =>
              x.stepId === stepId ? { ...x, status: 'RUNNING', tool: tool || x.tool } : x,
            )
          : [...e.steps, { stepId, tool: tool || 'tool', status: 'RUNNING' }],
        updatedAt: Date.now(),
      })),
    })),

  stepCompleted: ({ executionId, stepId, status, result, tool }) =>
    set((s) => ({
      executions: mutate(s.executions, executionId, (e) => ({
        ...e,
        steps: e.steps.map((x) =>
          x.stepId === stepId
            ? { ...x, status: status || 'COMPLETED', result, tool: tool || x.tool }
            : x,
        ),
        updatedAt: Date.now(),
      })),
    })),

  stepFailed: ({ executionId, stepId, error }) =>
    set((s) => ({
      executions: mutate(s.executions, executionId, (e) => ({
        ...e,
        steps: e.steps.map((x) =>
          x.stepId === stepId ? { ...x, status: 'FAILED', error } : x,
        ),
        updatedAt: Date.now(),
      })),
    })),

  setBlocked: ({ executionId, reason }) =>
    set((s) => ({
      executions: mutate(s.executions, executionId, (e) => ({
        ...e,
        status: 'BLOCKED',
        reason,
        updatedAt: Date.now(),
      })),
    })),

  setCompleted: ({ executionId, status, reason }) =>
    set((s) => ({
      executions: mutate(s.executions, executionId, (e) => ({
        ...e,
        status: status || 'COMPLETED',
        reason,
        updatedAt: Date.now(),
      })),
    })),

  replanSuggested: ({ executionId, tool, reason }) =>
    set((s) => {
      if (!executionId) return s;
      return {
        executions: mutate(s.executions, executionId, (e) => ({
          ...e,
          reason: `Replan suggested: ${tool} (${reason})`,
          updatedAt: Date.now(),
        })),
      };
    }),

  reset: () => set({ executions: [] }),
}));
