import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { SOCKET_EVENTS } from '@/socket/events';
import { getSocket } from '@/socket/socketClient';
import { useExecutionStore, type PlanSummary, type StepStatus } from '@/store/executionStore';
import { useTheme } from '@/store/themeStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Spacing } from '@/theme/layout';

const statusIcon: Record<StepStatus, keyof typeof Ionicons.glyphMap> = {
  PLANNED: 'ellipse-outline',
  RUNNING: 'sync-outline',
  COMPLETED: 'checkmark-circle',
  FAILED: 'close-circle',
  CANCELLED: 'remove-circle-outline',
  BLOCKED: 'lock-closed-outline',
};

const planIcon = (status: string): keyof typeof Ionicons.glyphMap => {
  const key = String(status || '').toUpperCase();
  if (key === 'RUNNING') return 'sync-outline';
  if (key === 'COMPLETED') return 'checkmark-circle';
  if (key === 'FAILED') return 'close-circle';
  if (key === 'BLOCKED') return 'lock-closed-outline';
  if (key === 'CANCELLED') return 'remove-circle-outline';
  return 'ellipse-outline';
};

export function ExecutionPanel() {
  const theme = useTheme();
  const executions = useExecutionStore((s) => s.executions);
  const plans = useExecutionStore((s) => s.plans);
  const upsertCreated = useExecutionStore((s) => s.upsertCreated);
  const setPlans = useExecutionStore((s) => s.setPlans);
  const activeWorkspaceId = useWorkspaceStore((s) => s.active?._id ?? 'global');
  const [collapsed, setCollapsed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh durable plan history when the panel mounts or the workspace
  // changes, so resumable tasks survive a cold start/reconnect.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(
      SOCKET_EVENTS.executionList,
      { workspaceId: activeWorkspaceId, limit: 12 },
      (res: { ok?: boolean; plans?: PlanSummary[] } | undefined) => {
        if (res?.ok) setPlans(Array.isArray(res.plans) ? res.plans : []);
      },
    );
  }, [activeWorkspaceId, setPlans]);

  if (!executions.length && !plans.length) return null;

  const tone = (status: StepStatus | string) => {
    if (status === 'COMPLETED') return theme.success;
    if (status === 'FAILED' || status === 'BLOCKED') return theme.destructive;
    if (status === 'RUNNING') return theme.primary;
    return theme.foregroundMuted;
  };

  const handleResume = (plan: PlanSummary) => {
    const socket = getSocket();
    if (!socket) {
      setError('Not connected.');
      return;
    }
    setBusyId(plan.executionId);
    setError(null);
    // Seed the live execution immediately so the resumed plan appears in the
    // activity list while the server replays its remaining steps.
    upsertCreated({
      executionId: plan.executionId,
      title: plan.title,
      workspaceId: plan.workspaceId ?? null,
    });
    socket.emit(
      SOCKET_EVENTS.executionResume,
      { executionId: plan.executionId, workspaceId: plan.workspaceId ?? null },
      (res: { ok?: boolean; error?: string } | undefined) => {
        setBusyId(null);
        if (!res?.ok) setError(res?.error || 'Could not resume this task.');
      },
    );
  };

  const liveRunning = (plan: PlanSummary) =>
    executions.some(
      (exec) => exec.executionId === plan.executionId && exec.status === 'RUNNING',
    );

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable style={styles.header} onPress={() => setCollapsed((v) => !v)}>
        <Ionicons name="git-network-outline" size={16} color={theme.accent} />
        <ThemedText variant="label" style={{ flex: 1 }}>
          Agent activity ({executions.length || plans.length})
        </ThemedText>
        <Ionicons name={collapsed ? 'chevron-up' : 'chevron-down'} size={18} color={theme.foregroundMuted} />
      </Pressable>

      {!collapsed
        ? executions.slice(0, 5).map((exec) => (
            <View key={exec.executionId} style={{ gap: Spacing.xs }}>
              <View style={styles.row}>
                <Ionicons name={statusIcon[exec.status === 'RUNNING' ? 'RUNNING' : 'PLANNED']} size={14} color={tone(exec.status)} />
                <ThemedText variant="muted" numberOfLines={1} style={{ flex: 1 }}>
                  {exec.title}
                </ThemedText>
                <ThemedText variant="caption" color={tone(exec.status)}>
                  {exec.status}
                </ThemedText>
              </View>
              {exec.steps.map((step) => (
                <View key={step.stepId} style={styles.stepBlock}>
                  <View style={[styles.stepRow, { borderLeftColor: tone(step.status) }]}>
                    <Ionicons name={statusIcon[step.status]} size={13} color={tone(step.status)} />
                    <ThemedText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                      {step.tool}
                    </ThemedText>
                    <ThemedText variant="caption" color={tone(step.status)}>
                      {step.status}
                    </ThemedText>
                  </View>
                  {step.error ? (
                    <ThemedText
                      variant="caption"
                      color={theme.destructive}
                      numberOfLines={3}
                      style={{ marginLeft: Spacing.xs + Spacing.sm }}>
                      {step.error}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
              {exec.reason ? (
                <ThemedText variant="caption" color={theme.warning} numberOfLines={2}>
                  {exec.reason}
                </ThemedText>
              ) : null}
            </View>
          ))
        : null}

      {!collapsed && plans.length ? (
        <View style={{ gap: Spacing.xs, marginTop: Spacing.sm }}>
          <ThemedText variant="caption" color={theme.foregroundMuted}>
            Recent tasks
          </ThemedText>
          {plans.slice(0, 5).map((plan) => {
            const canResume = Boolean(plan.resumable) && !liveRunning(plan);
            const steps = plan.stepCount ? `${plan.succeeded ?? 0}/${plan.stepCount} steps` : 'no steps';
            return (
              <View key={plan.executionId} style={styles.planRow}>
                <Ionicons name={planIcon(plan.status)} size={14} color={tone(plan.status)} />
                <View style={{ flex: 1, gap: 1 }}>
                  <ThemedText variant="muted" numberOfLines={1}>
                    {plan.title}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.foregroundMuted} numberOfLines={1}>
                    {String(plan.status || 'PLANNED').toLowerCase()} · {steps}
                    {plan.lastError ? ` · ${plan.lastError}` : ''}
                  </ThemedText>
                </View>
                {canResume ? (
                  <Pressable
                    onPress={() => handleResume(plan)}
                    disabled={busyId === plan.executionId}
                    style={[styles.resumeButton, { borderColor: theme.primary }]}>
                    <ThemedText variant="caption" color={theme.primary}>
                      {busyId === plan.executionId ? 'Resuming…' : 'Resume'}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {error ? (
        <ThemedText variant="caption" color={theme.destructive} numberOfLines={2}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
    gap: Spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBlock: { gap: 2 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 2,
    marginLeft: Spacing.xs,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  resumeButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
});
