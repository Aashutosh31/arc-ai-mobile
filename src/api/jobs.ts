import { http } from './client';

export interface JobTrigger {
  type: 'schedule' | 'once';
  cron: string | null;
  runAt: string | null;
  timezone: string;
  description: string;
}

export interface JobSummary {
  jobId: string;
  title: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED' | 'FAILED';
  workspaceId?: string | null;
  trigger: JobTrigger;
  action: {
    type: string;
    stepCount: number;
    steps: { tool: string }[];
    sourceExecutionId?: string | null;
  };
  riskCeiling: 'read' | 'reversible';
  notifyOn: { success: boolean; failure: boolean };
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  runCount: number;
  consecutiveFailures: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface JobEvidence {
  label: string;
  value: string;
}

export interface JobRun {
  runId: string;
  jobId: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED' | 'CANCELLED' | 'SKIPPED';
  trigger: 'schedule' | 'manual' | 'resume';
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  executionId: string | null;
  summary: string;
  error: string | null;
  evidence: JobEvidence[];
  notificationRead: boolean;
  createdAt: string | null;
}

export interface JobNotification {
  jobId: string;
  runId: string;
  workspaceId?: string | null;
  title: string;
  status: JobRun['status'];
  summary: string;
  error: string | null;
  executionId: string | null;
  occurredAt: string;
  unread?: boolean;
}

const workspaceParams = (workspaceId?: string | null) =>
  workspaceId ? { workspaceId } : undefined;

export const jobsApi = {
  list: async (workspaceId?: string | null): Promise<{ jobs: JobSummary[]; unreadCount: number }> => {
    const { data } = await http.get<{ jobs: JobSummary[]; unreadCount: number }>('/jobs', {
      params: workspaceParams(workspaceId),
    });
    return { jobs: data.jobs ?? [], unreadCount: data.unreadCount ?? 0 };
  },
  create: async (
    payload: {
      workspaceId?: string;
      sourceExecutionId: string;
      title?: string;
      trigger: { type: 'schedule' | 'once'; cron?: string; runAt?: string; timezone: string };
      notifyOn?: { success: boolean; failure: boolean };
    },
  ): Promise<JobSummary> => {
    const { data } = await http.post<{ job: JobSummary }>('/jobs', payload);
    return data.job;
  },
  pause: async (jobId: string, workspaceId?: string | null): Promise<JobSummary> => {
    const { data } = await http.post<{ job: JobSummary }>(`/jobs/${jobId}/pause`, {
      workspaceId: workspaceId ?? undefined,
    });
    return data.job;
  },
  resume: async (jobId: string, workspaceId?: string | null): Promise<JobSummary> => {
    const { data } = await http.post<{ job: JobSummary }>(`/jobs/${jobId}/resume`, {
      workspaceId: workspaceId ?? undefined,
    });
    return data.job;
  },
  cancel: async (jobId: string, workspaceId?: string | null): Promise<JobSummary> => {
    const { data } = await http.post<{ job: JobSummary }>(`/jobs/${jobId}/cancel`, {
      workspaceId: workspaceId ?? undefined,
    });
    return data.job;
  },
  runNow: async (jobId: string, workspaceId?: string | null): Promise<{ run: JobRun | null; blocked: boolean }> => {
    const { data } = await http.post<{ run: JobRun | null; blocked: boolean }>(
      `/jobs/${jobId}/run`,
      { workspaceId: workspaceId ?? undefined },
    );
    return { run: data.run ?? null, blocked: Boolean(data.blocked) };
  },
  runs: async (jobId: string, workspaceId?: string | null, limit = 10): Promise<JobRun[]> => {
    const { data } = await http.get<{ runs: JobRun[] }>(`/jobs/${jobId}/runs`, {
      params: { ...(workspaceParams(workspaceId) ?? {}), limit },
    });
    return data.runs ?? [];
  },
  markNotificationsRead: async (workspaceId?: string | null): Promise<number> => {
    const { data } = await http.post<{ updated: number }>('/jobs/notifications/read', {
      workspaceId: workspaceId ?? undefined,
    });
    return data.updated ?? 0;
  },
};

export default jobsApi;
