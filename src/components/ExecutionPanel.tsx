import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { useExecutionStore, type StepStatus } from '@/store/executionStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

const statusIcon: Record<StepStatus, keyof typeof Ionicons.glyphMap> = {
  PLANNED: 'ellipse-outline',
  RUNNING: 'sync-outline',
  COMPLETED: 'checkmark-circle',
  FAILED: 'close-circle',
  CANCELLED: 'remove-circle-outline',
  BLOCKED: 'lock-closed-outline',
};

export function ExecutionPanel() {
  const theme = useTheme();
  const executions = useExecutionStore((s) => s.executions);
  const [collapsed, setCollapsed] = useState(false);

  if (!executions.length) return null;

  const tone = (status: StepStatus | string) => {
    if (status === 'COMPLETED') return theme.success;
    if (status === 'FAILED' || status === 'BLOCKED') return theme.destructive;
    if (status === 'RUNNING') return theme.primary;
    return theme.foregroundMuted;
  };

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable style={styles.header} onPress={() => setCollapsed((v) => !v)}>
        <Ionicons name="git-network-outline" size={16} color={theme.accent} />
        <ThemedText variant="label" style={{ flex: 1 }}>
          Agent activity ({executions.length})
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
});
