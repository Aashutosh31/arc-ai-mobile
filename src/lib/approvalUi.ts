// Pure UI-state model for the server-authoritative approval flow.
// Ported from the web client (client/src/lib/approvalUi.js).
//
// Single source of truth is a per-approval record mirroring the transport
// payload (safe preview metadata only — never args, credentials or outputs).
// Terminal status is decided by the SERVER ack; local expiry is display-only.

export const SERVER_STATES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export const UI_STATES = {
  PENDING: 'pending',
  BUSY: 'busy',
  APPROVED: 'approved',
  DENIED: 'denied',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  ERROR: 'error',
} as const;

export type UiState = (typeof UI_STATES)[keyof typeof UI_STATES];
export type ApprovalDecision = 'approve' | 'deny';

const TERMINAL_UI = new Set<string>([
  UI_STATES.APPROVED,
  UI_STATES.DENIED,
  UI_STATES.EXPIRED,
  UI_STATES.CANCELLED,
]);

const ALLOWED_FIELDS = [
  'approvalId',
  'executionId',
  'capabilityId',
  'toolName',
  'source',
  'risk',
  'scope',
  'reason',
  'expiresAt',
  'state',
] as const;

export interface ApprovalRecord {
  approvalId: string;
  receivedAt: number;
  uiState: UiState;
  pendingDecision: ApprovalDecision | null;
  resolvedAt: number | null;
  error: string | null;
  expiresAtMs?: number | null;
  executionId?: string;
  capabilityId?: string;
  toolName?: string;
  source?: string;
  risk?: string;
  scope?: string;
  reason?: string;
  state?: string;
  status?: UiState;
}

export type ApprovalMap = Record<string, ApprovalRecord>;

export interface ApprovalAck {
  ok: boolean;
  reason?: string | null;
  state?: string | null;
}

const parseExpiryMs = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string' && value) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
};

export const normalizeApprovalRequest = (
  payload: unknown,
): ApprovalRecord | null => {
  const src = (payload && typeof payload === 'object' ? payload : {}) as Record<
    string,
    unknown
  >;
  const approvalId =
    typeof src.approvalId === 'string' && src.approvalId ? src.approvalId : null;
  if (!approvalId) return null;
  const record: ApprovalRecord = {
    approvalId,
    receivedAt: Date.now(),
    uiState: UI_STATES.PENDING,
    pendingDecision: null,
    resolvedAt: null,
    error: null,
  };
  for (const field of ALLOWED_FIELDS) {
    if (field === 'approvalId') continue;
    const value = src[field];
    if (value === undefined || value === null) continue;
    if (field === 'expiresAt') {
      record.expiresAtMs = parseExpiryMs(value);
      continue;
    }
    (record as unknown as Record<string, unknown>)[field] = String(value);
  }
  return record;
};

const serverStateToUi = (state: unknown): UiState | null => {
  switch (String(state || '').toUpperCase()) {
    case SERVER_STATES.APPROVED:
      return UI_STATES.APPROVED;
    case SERVER_STATES.DENIED:
      return UI_STATES.DENIED;
    case SERVER_STATES.EXPIRED:
      return UI_STATES.EXPIRED;
    case SERVER_STATES.CANCELLED:
      return UI_STATES.CANCELLED;
    case SERVER_STATES.PENDING:
      return UI_STATES.PENDING;
    default:
      return null;
  }
};

export const isTerminalStatus = (status: string) => TERMINAL_UI.has(status);

export const requestAdd = (map: ApprovalMap, record: ApprovalRecord | null): ApprovalMap => {
  if (!record || !record.approvalId) return map;
  const existing = map[record.approvalId];
  return {
    ...map,
    [record.approvalId]: {
      ...record,
      receivedAt: existing ? existing.receivedAt : record.receivedAt || Date.now(),
      uiState: existing ? existing.uiState : UI_STATES.PENDING,
      pendingDecision: existing ? existing.pendingDecision : null,
      resolvedAt: existing ? existing.resolvedAt : null,
      error: existing ? existing.error : null,
    },
  };
};

export const resolveStart = (
  map: ApprovalMap,
  approvalId: string,
  decision: string,
): ApprovalMap => {
  const record = map[approvalId];
  if (!record) return map;
  const normalizedDecision: ApprovalDecision | null =
    decision === 'approve' || decision === 'deny' ? decision : null;
  if (!normalizedDecision) return map;
  if (record.uiState !== UI_STATES.PENDING) return map;
  return {
    ...map,
    [approvalId]: {
      ...record,
      uiState: UI_STATES.BUSY,
      pendingDecision: normalizedDecision,
    },
  };
};

const applyServerState = (
  map: ApprovalMap,
  approvalId: string,
  state: string,
  note: string | null,
): ApprovalMap => {
  const record = map[approvalId];
  const ui = serverStateToUi(state);
  if (!ui) return map;
  return {
    ...map,
    [approvalId]: {
      ...record,
      uiState: ui,
      state,
      pendingDecision: null,
      resolvedAt: Date.now(),
      error: note || null,
    },
  };
};

export const reconcileAck = (
  map: ApprovalMap,
  approvalId: string,
  ack: ApprovalAck,
): ApprovalMap => {
  const record = map[approvalId];
  if (!record) return map;
  const ackState = ack && typeof ack.state === 'string' ? ack.state.toUpperCase() : null;
  const ok = ack && ack.ok === true;

  if (ok && ackState) return applyServerState(map, approvalId, ackState, null);
  if (!ok && ackState) return applyServerState(map, approvalId, ackState, ack.reason || null);
  if (!ok && ack && (ack.reason === 'network' || ack.reason === 'no-ack')) {
    return {
      ...map,
      [approvalId]: {
        ...record,
        uiState: UI_STATES.PENDING,
        pendingDecision: null,
        error: 'Could not confirm with the server — please retry.',
      },
    };
  }
  return {
    ...map,
    [approvalId]: {
      ...record,
      uiState: UI_STATES.ERROR,
      pendingDecision: null,
      error:
        ack && ack.reason ? `Approval failed: ${ack.reason}.` : 'Approval could not be sent.',
    },
  };
};

export const applyExpiryTick = (map: ApprovalMap, now: number): ApprovalMap => {
  let changed = false;
  const next: ApprovalMap = {};
  for (const id of Object.keys(map)) {
    const record = map[id];
    if (
      record.uiState === UI_STATES.PENDING &&
      record.expiresAtMs != null &&
      now >= record.expiresAtMs
    ) {
      next[id] = {
        ...record,
        uiState: UI_STATES.EXPIRED,
        resolvedAt: record.resolvedAt || now,
      };
      changed = true;
    } else {
      next[id] = record;
    }
  }
  return changed ? next : map;
};

export const displayStatus = (
  record: ApprovalRecord | undefined,
  now: number,
): UiState | null => {
  if (!record) return null;
  const status = record.uiState || UI_STATES.PENDING;
  if (
    status === UI_STATES.PENDING &&
    record.expiresAtMs != null &&
    now >= record.expiresAtMs
  ) {
    return UI_STATES.EXPIRED;
  }
  return status;
};

export const canDecide = (record: ApprovalRecord | undefined, now: number): boolean => {
  if (!record) return false;
  if ((record.uiState || UI_STATES.PENDING) !== UI_STATES.PENDING) return false;
  if (record.expiresAtMs != null && now >= record.expiresAtMs) return false;
  return true;
};

export const formatExpiry = (
  record: ApprovalRecord | undefined,
  now: number,
): string | null => {
  if (!record) return null;
  if (displayStatus(record, now) === UI_STATES.EXPIRED) return 'Expired';
  if (record.expiresAtMs == null) return null;
  const seconds = Math.max(0, Math.ceil((record.expiresAtMs - now) / 1000));
  if (seconds <= 0) return 'Expiring';
  return `Expires in ${seconds}s`;
};

export type ApprovalTone = 'destructive' | 'warning' | 'default';

export const riskTone = (risk: unknown): ApprovalTone => {
  const normalized = String(risk || '').toLowerCase();
  if (normalized === 'high') return 'destructive';
  if (normalized === 'medium') return 'warning';
  return 'default';
};

export const riskLabel = (risk: unknown): string => {
  const normalized = String(risk || '').toLowerCase();
  if (normalized === 'high') return 'High risk';
  if (normalized === 'medium') return 'Moderate risk';
  if (normalized === 'low') return 'Low risk';
  return 'Risk unknown';
};

export const scopeLabel = (scope: unknown): string | null => {
  const normalized = String(scope || '').toLowerCase();
  if (normalized === 'read') return 'Reads data only';
  if (normalized === 'reversible') return 'Reversible action';
  if (normalized === 'consequential') return 'Has lasting external effects';
  return null;
};

export const sourceLabel = (source: unknown): string | null => {
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'native') return 'Native tool';
  if (normalized === 'mcp') return 'MCP tool';
  return (source as string) || null;
};

export const listApprovals = (map: ApprovalMap, now: number): ApprovalRecord[] =>
  Object.keys(map || {})
    .map((id) => ({ ...map[id], status: displayStatus(map[id], now) ?? undefined }))
    .sort(
      (a, b) =>
        (b.receivedAt || 0) - (a.receivedAt || 0) || a.approvalId.localeCompare(b.approvalId),
    );

export const pendingCount = (map: ApprovalMap, now: number): number =>
  Object.keys(map || {}).reduce(
    (count, id) => (displayStatus(map[id], now) === UI_STATES.PENDING ? count + 1 : count),
    0,
  );

export const ackOfError = (err?: unknown): ApprovalAck => ({
  ok: false,
  reason: err ? 'network' : 'no-ack',
});

export const ackOfResponse = (resp: unknown): ApprovalAck => {
  if (resp && typeof resp === 'object' && typeof (resp as ApprovalAck).ok === 'boolean') {
    const r = resp as ApprovalAck;
    return { ok: r.ok, reason: r.reason || null, state: r.state || null };
  }
  return ackOfError();
};

export const normalizeAckArgs = (args: unknown): ApprovalAck => {
  const list = Array.isArray(args) ? args : [args];
  for (const arg of list) {
    if (arg && typeof arg === 'object' && typeof (arg as ApprovalAck).ok === 'boolean') {
      return ackOfResponse(arg);
    }
  }
  return ackOfError();
};
