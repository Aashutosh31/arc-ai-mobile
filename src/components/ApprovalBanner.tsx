import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/ui';
import {
  UI_STATES,
  canDecide,
  displayStatus,
  formatExpiry,
  listApprovals,
  riskLabel,
  riskTone,
  scopeLabel,
  sourceLabel,
} from '@/lib/approvalUi';
import { useApprovalStore } from '@/store/approvalStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

export function ApprovalBanner() {
  const theme = useTheme();
  const approvals = useApprovalStore((s) => s.approvals);
  const decide = useApprovalStore((s) => s.decide);
  const tick = useApprovalStore((s) => s.tick);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const update = () => {
      setNow(Date.now());
      tick();
    };
    const first = setTimeout(update, 0);
    const t = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [tick]);

  const records = listApprovals(approvals, now).filter(
    (r) => (r.uiState || UI_STATES.PENDING) !== UI_STATES.APPROVED &&
      (r.uiState || UI_STATES.PENDING) !== UI_STATES.DENIED &&
      (r.uiState || UI_STATES.PENDING) !== UI_STATES.EXPIRED &&
      (r.uiState || UI_STATES.PENDING) !== UI_STATES.CANCELLED,
  );

  if (!records.length) return null;

  return (
    <View style={{ gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm }}>
      {records.slice(0, 3).map((record) => {
        const tone = riskTone(record.risk);
        const toneColor =
          tone === 'destructive' ? theme.destructive : tone === 'warning' ? theme.warning : theme.accent;
        const status = displayStatus(record, now);
        const decidable = canDecide(record, now);
        const expiry = formatExpiry(record, now);
        return (
          <View
            key={record.approvalId}
            style={[styles.card, { borderColor: toneColor, backgroundColor: theme.surfaceOverlay }]}>
            <View style={styles.header}>
              <Ionicons name="shield-half-outline" size={18} color={toneColor} />
              <ThemedText variant="body" style={{ flex: 1, fontWeight: '700' }}>
                Approval required
              </ThemedText>
              <ThemedText variant="caption" color={toneColor}>
                {riskLabel(record.risk)}
              </ThemedText>
            </View>

            <ThemedText variant="muted">
              {record.toolName || record.capabilityId || 'A tool'} wants to run
              {record.source ? ` (${sourceLabel(record.source)})` : ''}.
            </ThemedText>
            {scopeLabel(record.scope) ? (
              <ThemedText variant="caption">{scopeLabel(record.scope)}</ThemedText>
            ) : null}
            {record.reason ? (
              <ThemedText variant="caption" color={theme.foregroundSubtle}>
                {record.reason}
              </ThemedText>
            ) : null}

            {expiry ? (
              <ThemedText variant="caption" color={theme.warning}>
                {expiry}
              </ThemedText>
            ) : null}

            {decidable ? (
              <View style={styles.actions}>
                <Button
                  label="Deny"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => decide(record.approvalId, 'deny')}
                />
                <Button
                  label="Approve"
                  variant={tone === 'destructive' ? 'destructive' : 'primary'}
                  style={{ flex: 1 }}
                  onPress={() => decide(record.approvalId, 'approve')}
                />
              </View>
            ) : (
              <View style={styles.statusRow}>
                <Ionicons
                  name={
                    status === UI_STATES.BUSY
                      ? 'time-outline'
                      : status === UI_STATES.EXPIRED
                        ? 'alert-circle-outline'
                        : 'information-circle-outline'
                  }
                  size={14}
                  color={theme.foregroundMuted}
                />
                <ThemedText variant="caption" style={{ flex: 1 }}>
                  {status === UI_STATES.BUSY
                    ? 'Sending decision…'
                    : record.error || `Status: ${status}`}
                </ThemedText>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
});
