import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, ThemedText, TextField } from '@/components/ui';
import { jobsApi, type JobNotification, type JobRun, type JobSummary } from '@/api/jobs';
import { SOCKET_EVENTS } from '@/socket/events';
import { getSocket } from '@/socket/socketClient';
import { useChatStore } from '@/store/chatStore';
import { useExecutionStore, type PlanSummary } from '@/store/executionStore';
import { useTheme } from '@/store/themeStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Spacing } from '@/theme/layout';

const PRESETS = [
  { key: 'daily', label: 'Daily 09:00', cron: '0 9 * * *' },
  { key: 'weekdays', label: 'Weekdays 08:00', cron: '0 8 * * 1-5' },
  { key: 'hourly', label: 'Hourly', cron: '0 * * * *' },
  { key: 'weekly', label: 'Weekly Mon 09:00', cron: '0 9 * * 1' },
];

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  FAILED: 'destructive',
  COMPLETED: 'success',
  CANCELLED: 'muted',
  SUCCEEDED: 'success',
  BLOCKED: 'warning',
  RUNNING: 'primary',
  SKIPPED: 'muted',
};

const defaultTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const defaultOnce = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

const formatWhen = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MiniButton = ({
  label,
  onPress,
  disabled,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'destructive';
}) => {
  const theme = useTheme();
  const color = tone === 'destructive'
    ? theme.destructive
    : tone === 'primary'
      ? theme.primary
      : theme.foregroundMuted;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniButton,
        {
          borderColor: color,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}>
      <ThemedText variant="caption" color={color} style={{ fontWeight: '700' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
};

export function JobsPanel() {
  const theme = useTheme();
  const connection = useChatStore((s) => s.connection);
  const activeWorkspaceId = useWorkspaceStore((s) => s.active?._id ?? null);
  const plans = useExecutionStore((s) => s.plans);
  const setPlans = useExecutionStore((s) => s.setPlans);

  const [collapsed, setCollapsed] = useState(true);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notice, setNotice] = useState<JobNotification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [runsByJob, setRunsByJob] = useState<Record<string, JobRun[]>>({});
  const [showForm, setShowForm] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'schedule' | 'once'>('schedule');
  const [cron, setCron] = useState(PRESETS[0].cron);
  const [runAt, setRunAt] = useState(defaultOnce);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [notifySuccess, setNotifySuccess] = useState(true);
  const [notifyFailure, setNotifyFailure] = useState(true);
  const [creating, setCreating] = useState(false);

  const planOptions = useMemo(
    () => plans.filter((plan) => plan && plan.executionId && (plan.stepCount === undefined || plan.stepCount > 0)),
    [plans],
  );
  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.executionId === selectedPlanId) ?? null,
    [planOptions, selectedPlanId],
  );

  const load = useCallback(async () => {
    try {
      const data = await jobsApi.list(activeWorkspaceId);
      setJobs(data.jobs);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Could not load scheduled jobs.');
    }
  }, [activeWorkspaceId]);

  const loadPlans = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(
      SOCKET_EVENTS.executionList,
      { workspaceId: activeWorkspaceId || 'global', limit: 12 },
      (res: { ok?: boolean; plans?: PlanSummary[] } | undefined) => {
        if (res?.ok) setPlans(Array.isArray(res.plans) ? res.plans : []);
      },
    );
  }, [activeWorkspaceId, setPlans]);

  useEffect(() => {
    // Deferring one tick matches the memory screen's load pattern and keeps
    // the React compiler lint happy: the effect body only schedules work.
    const timer = setTimeout(() => {
      void load();
      loadPlans();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, loadPlans, connection]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onUpdated = (payload: { job?: JobSummary } | undefined) => {
      const job = payload?.job;
      if (!job) return;
      if (String(job.workspaceId ?? 'global') !== String(activeWorkspaceId ?? 'global')) return;
      setJobs((prev) => {
        const index = prev.findIndex((item) => item.jobId === job.jobId);
        if (index === -1) return [job, ...prev];
        const next = [...prev];
        next[index] = { ...next[index], ...job };
        return next;
      });
    };
    const onNotification = (payload: JobNotification | undefined) => {
      if (!payload) return;
      if (String(payload.workspaceId ?? 'global') !== String(activeWorkspaceId ?? 'global')) return;
      setUnreadCount((count) => count + (payload.unread === false ? 0 : 1));
      setNotice(payload);
      void load();
    };

    socket.on(SOCKET_EVENTS.jobUpdated, onUpdated);
    socket.on(SOCKET_EVENTS.jobNotification, onNotification);
    return () => {
      socket.off(SOCKET_EVENTS.jobUpdated, onUpdated);
      socket.off(SOCKET_EVENTS.jobNotification, onNotification);
    };
  }, [activeWorkspaceId, connection, load]);

  const toneColor = (status: string) => {
    const key = STATUS_TONE[status];
    if (key === 'success') return theme.success;
    if (key === 'warning') return theme.warning;
    if (key === 'destructive') return theme.destructive;
    if (key === 'primary') return theme.primary;
    return theme.foregroundMuted;
  };

  const handleMarkRead = async () => {
    try {
      await jobsApi.markNotificationsRead(activeWorkspaceId);
      setUnreadCount(0);
    } catch {
      // The badge simply remains until the next load.
    }
  };

  const handleAction = async (job: JobSummary, action: 'pause' | 'resume' | 'cancel' | 'run') => {
    setBusyId(job.jobId);
    setError(null);
    try {
      if (action === 'pause') await jobsApi.pause(job.jobId, activeWorkspaceId);
      else if (action === 'resume') await jobsApi.resume(job.jobId, activeWorkspaceId);
      else if (action === 'cancel') await jobsApi.cancel(job.jobId, activeWorkspaceId);
      else {
        const result = await jobsApi.runNow(job.jobId, activeWorkspaceId);
        if (result.blocked) setError(result.run?.error || 'This run was blocked by its permission scope.');
      }
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not update this job.');
    } finally {
      setBusyId(null);
      setConfirmCancelId(null);
    }
  };

  const toggleRuns = async (job: JobSummary) => {
    if (runsByJob[job.jobId]) {
      setRunsByJob((prev) => {
        const next = { ...prev };
        delete next[job.jobId];
        return next;
      });
      return;
    }
    setBusyId(job.jobId);
    try {
      const runs = await jobsApi.runs(job.jobId, activeWorkspaceId);
      setRunsByJob((prev) => ({ ...prev, [job.jobId]: runs }));
    } catch (err) {
      setError((err as Error).message || 'Could not load run history.');
    } finally {
      setBusyId(null);
    }
  };

  const startForm = () => {
    setShowForm((value) => !value);
    setError(null);
    if (!selectedPlanId && planOptions[0]) {
      setSelectedPlanId(planOptions[0].executionId);
      setTitle(planOptions[0].title || 'Scheduled job');
    }
  };

  const submit = async () => {
    setError(null);
    if (!selectedPlan) {
      setError('Choose a recent plan to schedule.');
      return;
    }
    if (mode === 'once') {
      const parsed = new Date(runAt);
      if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setError('Enter a future ISO date/time for a one-time job.');
        return;
      }
    }
    setCreating(true);
    try {
      await jobsApi.create({
        workspaceId: activeWorkspaceId ?? undefined,
        sourceExecutionId: selectedPlan.executionId,
        title: title.trim() || selectedPlan.title || 'Scheduled job',
        trigger: mode === 'once'
          ? { type: 'once', runAt: new Date(runAt).toISOString(), timezone }
          : { type: 'schedule', cron: cron.trim(), timezone },
        notifyOn: { success: notifySuccess, failure: notifyFailure },
      });
      setShowForm(false);
      setNotice({
        jobId: '',
        runId: '',
        title: 'Scheduled job created',
        status: 'SUCCEEDED',
        summary: 'It will run inside its read/reversible permission scope.',
        error: null,
        executionId: null,
        occurredAt: new Date().toISOString(),
      });
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not create the scheduled job.');
    } finally {
      setCreating(false);
    }
  };

  const activeCount = jobs.filter((job) => job.status === 'ACTIVE').length;

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setCollapsed((value) => !value)}
        style={styles.header}>
        <Ionicons name="calendar-outline" size={18} color={theme.primary} />
        <ThemedText variant="label" style={{ flex: 1 }}>
          Scheduled jobs{jobs.length ? ` · ${activeCount} active` : ''}
        </ThemedText>
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <ThemedText variant="caption" color={theme.primaryForeground} style={{ fontWeight: '700' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </ThemedText>
          </View>
        ) : null}
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={theme.foregroundMuted}
        />
      </Pressable>

      {!collapsed ? (
        <View style={styles.body}>
          <ThemedText variant="caption" color={theme.foregroundMuted}>
            Scheduled jobs run unattended only for read/reversible capabilities. Consequential
            actions stay interactive.
          </ThemedText>

          {unreadCount > 0 ? (
            <MiniButton label="Mark read" onPress={() => void handleMarkRead()} />
          ) : null}

          {notice ? (
            <View style={[styles.notice, { borderColor: theme.border }]}>
              <ThemedText variant="caption" color={toneColor(notice.status)} style={{ flex: 1 }}>
                {notice.title}
                {notice.summary ? ` — ${notice.summary}` : ''}
                {notice.error ? ` — ${notice.error}` : ''}
              </ThemedText>
              <MiniButton label="Dismiss" onPress={() => setNotice(null)} />
            </View>
          ) : null}

          {!jobs.length ? (
            <ThemedText variant="caption" color={theme.foregroundMuted}>
              No scheduled jobs yet. Run a multi-step task, then schedule that plan here.
            </ThemedText>
          ) : null}

          {jobs.map((job) => {
            const runs = runsByJob[job.jobId];
            const busy = busyId === job.jobId;
            return (
              <View key={job.jobId} style={[styles.job, { borderColor: theme.border }]}>
                <View style={styles.jobTop}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <ThemedText variant="muted" numberOfLines={1} style={{ fontWeight: '700' }}>
                      {job.title}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.foregroundMuted} numberOfLines={1}>
                      {job.trigger.description} · next {formatWhen(job.nextRunAt)}
                      {job.lastRunStatus ? ` · last ${job.lastRunStatus.toLowerCase()}` : ''}
                    </ThemedText>
                    {job.lastError ? (
                      <ThemedText variant="caption" color={theme.destructive} numberOfLines={2}>
                        {job.lastError}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText variant="caption" color={toneColor(job.status)} style={{ fontWeight: '700' }}>
                    {job.status}
                  </ThemedText>
                </View>

                <View style={styles.actions}>
                  {job.status === 'ACTIVE' ? (
                    <MiniButton label="Pause" disabled={busy} onPress={() => void handleAction(job, 'pause')} />
                  ) : null}
                  {job.status === 'PAUSED' || (job.status === 'FAILED' && job.trigger.type !== 'once') ? (
                    <MiniButton label="Resume" tone="primary" disabled={busy} onPress={() => void handleAction(job, 'resume')} />
                  ) : null}
                  {job.status !== 'CANCELLED' && job.status !== 'COMPLETED' ? (
                    <MiniButton
                      label="Run now"
                      tone="primary"
                      disabled={busy || job.lastRunStatus === 'RUNNING'}
                      onPress={() => void handleAction(job, 'run')}
                    />
                  ) : null}
                  <MiniButton label={runs ? 'Hide history' : 'History'} disabled={busy} onPress={() => void toggleRuns(job)} />
                  {job.status !== 'CANCELLED' && job.status !== 'COMPLETED' ? (
                    confirmCancelId === job.jobId ? (
                      <MiniButton label="Confirm cancel" tone="destructive" disabled={busy} onPress={() => void handleAction(job, 'cancel')} />
                    ) : (
                      <MiniButton label="Cancel" tone="destructive" disabled={busy} onPress={() => setConfirmCancelId(job.jobId)} />
                    )
                  ) : null}
                </View>

                {runs ? (
                  <View style={styles.runs}>
                    {!runs.length ? (
                      <ThemedText variant="caption" color={theme.foregroundMuted}>No runs yet.</ThemedText>
                    ) : null}
                    {runs.slice(0, 6).map((run) => (
                      <View key={run.runId} style={styles.run}>
                        <ThemedText variant="caption" color={toneColor(run.status)} style={{ fontWeight: '700' }}>
                          {run.status} · {formatWhen(run.startedAt)} · {run.trigger}
                        </ThemedText>
                        {run.summary ? (
                          <ThemedText variant="caption" color={theme.foregroundMuted} numberOfLines={2}>
                            {run.summary}
                          </ThemedText>
                        ) : null}
                        {run.error ? (
                          <ThemedText variant="caption" color={theme.destructive} numberOfLines={3}>
                            {run.error}
                          </ThemedText>
                        ) : null}
                        {run.evidence.map((item, index) => (
                          <ThemedText
                            key={`${run.runId}-${index}`}
                            variant="caption"
                            color={theme.foregroundSubtle}
                            numberOfLines={2}>
                            {item.label}: {item.value}
                          </ThemedText>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}

          {planOptions.length ? (
            <Button
              label={showForm ? 'Close' : 'New schedule'}
              variant="outline"
              onPress={startForm}
            />
          ) : (
            <ThemedText variant="caption" color={theme.foregroundMuted}>
              Run a multi-step task first — its plan becomes the job definition.
            </ThemedText>
          )}

          {showForm && planOptions.length ? (
            <View style={[styles.form, { borderColor: theme.border }]}>
              <ThemedText variant="label">Plan</ThemedText>
              <View style={styles.chips}>
                {planOptions.slice(0, 6).map((plan) => (
                  <Chip
                    key={plan.executionId}
                    label={plan.title || 'Plan'}
                    active={selectedPlanId === plan.executionId}
                    onPress={() => {
                      setSelectedPlanId(plan.executionId);
                      if (plan.title) setTitle(plan.title);
                    }}
                  />
                ))}
              </View>

              <TextField
                labelText="Title"
                placeholder="Scheduled job title"
                value={title}
                onChangeText={setTitle}
                maxLength={140}
              />

              <ThemedText variant="label">Runs</ThemedText>
              <View style={styles.chips}>
                <Chip label="Recurring" active={mode === 'schedule'} onPress={() => setMode('schedule')} />
                <Chip label="Once" active={mode === 'once'} onPress={() => setMode('once')} />
              </View>

              {mode === 'schedule' ? (
                <>
                  <ThemedText variant="label">Preset</ThemedText>
                  <View style={styles.chips}>
                    {PRESETS.map((preset) => (
                      <Chip
                        key={preset.key}
                        label={preset.label}
                        active={cron === preset.cron}
                        onPress={() => setCron(preset.cron)}
                      />
                    ))}
                  </View>
                  <TextField
                    labelText="Cron"
                    placeholder="0 9 * * *"
                    value={cron}
                    onChangeText={setCron}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : (
                <TextField
                  labelText="Run at (ISO)"
                  placeholder="2026-01-01T09:00:00Z"
                  value={runAt}
                  onChangeText={setRunAt}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}

              <TextField
                labelText="Timezone"
                placeholder="UTC"
                value={timezone}
                onChangeText={setTimezone}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.toggles}>
                <Pressable style={styles.toggle} onPress={() => setNotifySuccess((value) => !value)}>
                  <Ionicons
                    name={notifySuccess ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={notifySuccess ? theme.primary : theme.foregroundMuted}
                  />
                  <ThemedText variant="caption">Notify on success</ThemedText>
                </Pressable>
                <Pressable style={styles.toggle} onPress={() => setNotifyFailure((value) => !value)}>
                  <Ionicons
                    name={notifyFailure ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={notifyFailure ? theme.primary : theme.foregroundMuted}
                  />
                  <ThemedText variant="caption">Notify on failure</ThemedText>
                </Pressable>
              </View>

              <ThemedText variant="caption" color={theme.foregroundMuted}>
                Only read/reversible steps can run unattended. A plan with a consequential tool is
                rejected at creation.
              </ThemedText>

              <Button label={creating ? 'Scheduling…' : 'Schedule job'} onPress={() => void submit()} loading={creating} />
            </View>
          ) : null}

          {error ? (
            <ThemedText variant="caption" color={theme.destructive} numberOfLines={4}>
              {error}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  body: { gap: Spacing.sm },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    padding: Spacing.sm,
  },
  job: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  jobTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'flex-end' },
  runs: { gap: Spacing.xs, paddingTop: Spacing.xs },
  run: { gap: 1, paddingTop: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  miniButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  form: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
