import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';
import type { ToolCall } from '@/types/api';

const MAX_DETAIL = 4000;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const inline = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? '' : 's'}]`;
  const json = JSON.stringify(value);
  if (!json) return '—';
  return json.length > 80 ? `${json.slice(0, 77)}…` : json;
};

const pretty = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  try {
    const json = JSON.stringify(value, null, 2);
    if (!json) return String(value);
    return json.length > MAX_DETAIL ? `${json.slice(0, MAX_DETAIL)}\n…` : json;
  } catch {
    return String(value);
  }
};

/** Display name for a tool id: `create_calendar_event` → `Create calendar event`. */
const toolTitle = (name: string): string => {
  const cleaned = String(name || 'tool')
    .replace(/[_.]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Tool';
};

/** One-line argument preview from the persisted `{ summary }` shape. */
const argumentSummary = (input: unknown): string => {
  const record = asRecord(input);
  if (record) {
    if (typeof record.summary === 'string' && record.summary.trim()) {
      return record.summary.trim();
    }
    const pairs = Object.entries(record)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${inline(value)}`);
    if (pairs.length > 0) return pairs.join(' · ');
    return 'No arguments';
  }
  if (typeof input === 'string' && input.trim()) return input.trim();
  return 'No arguments';
};

const hasResult = (output: unknown): boolean => {
  if (output === null || output === undefined) return false;
  const record = asRecord(output);
  if (record) {
    if (record.summarized === true) return false;
    return Object.keys(record).length > 0;
  }
  if (Array.isArray(output)) return output.length > 0;
  return String(output).trim().length > 0;
};

export function ToolCallList({ calls }: { calls?: ToolCall[] }) {
  if (!calls || calls.length === 0) return null;
  return (
    <View style={styles.list}>
      {calls.map((call, index) => (
        <ToolCallCard key={`${call.toolName || 'tool'}-${index}`} call={call} />
      ))}
    </View>
  );
}

function ToolCallCard({ call }: { call: ToolCall }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const status = call.status ?? 'pending';
  const tone =
    status === 'success'
      ? theme.success
      : status === 'failed'
        ? theme.destructive
        : theme.warning;
  const statusLabel =
    status === 'success' ? 'Succeeded' : status === 'failed' ? 'Failed' : 'Pending';
  const showResult = hasResult(call.output);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderRadius: theme.radii.md },
      ]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${toolTitle(call.toolName)}, ${statusLabel}. ${open ? 'Collapse' : 'Expand'} details`}>
        <View style={styles.header}>
          <View style={[styles.iconChip, { backgroundColor: `${tone}18` }]}>
            <Ionicons name="build-outline" size={12} color={tone} />
          </View>
          <View style={styles.headerText}>
            <ThemedText variant="body" style={styles.toolName} numberOfLines={1}>
              {toolTitle(call.toolName)}
            </ThemedText>
            <ThemedText variant="caption" color={theme.foregroundMuted} numberOfLines={1}>
              {argumentSummary(call.input)}
            </ThemedText>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${tone}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: tone }]} />
            <ThemedText variant="caption" color={tone} style={styles.statusText}>
              {statusLabel}
            </ThemedText>
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.foregroundMuted}
          />
        </View>
      </Pressable>

      {open ? (
        <View style={[styles.details, { borderTopColor: theme.border }]}>
          <ThemedText variant="label" color={theme.foregroundMuted}>
            Arguments
          </ThemedText>
          <Text style={[styles.code, { color: theme.foreground }]} selectable>
            {pretty(call.input)}
          </Text>
          {showResult ? (
            <>
              <ThemedText variant="label" color={theme.foregroundMuted} style={styles.resultLabel}>
                Result
              </ThemedText>
              <Text style={[styles.code, { color: theme.foreground }]} selectable>
                {pretty(call.output)}
              </Text>
            </>
          ) : (
            <ThemedText variant="caption" color={theme.foregroundMuted} style={styles.resultLabel}>
              Result recorded in the Executions panel.
            </ThemedText>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.xs, marginBottom: Spacing.sm },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  iconChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  toolName: { fontSize: FontSize.sm, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.5,
  },
  resultLabel: { marginTop: Spacing.xs },
});
