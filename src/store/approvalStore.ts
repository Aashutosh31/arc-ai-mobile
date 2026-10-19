import { create } from 'zustand';

import {
  ackOfError,
  applyExpiryTick,
  normalizeAckArgs,
  normalizeApprovalRequest,
  reconcileAck,
  requestAdd,
  resolveStart,
  type ApprovalAck,
  type ApprovalMap,
} from '@/lib/approvalUi';
import { SOCKET_EVENTS } from '@/socket/events';
import { emitEvent } from '@/socket/socketClient';

/** Bug B-10 parity with web (ApprovalContext): a lost ack reverts to pending. */
const ACK_TIMEOUT_MS = 6000;

interface ApprovalState {
  approvals: ApprovalMap;
  addRequest: (payload: unknown) => void;
  decide: (approvalId: string, decision: 'approve' | 'deny') => void;
  tick: (now?: number) => void;
  reset: () => void;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  approvals: {},

  addRequest: (payload) => {
    const record = normalizeApprovalRequest(payload);
    if (!record) return;
    set((s) => ({ approvals: requestAdd(s.approvals, record) }));
  },

  decide: (approvalId, decision) => {
    const started = resolveStart(get().approvals, approvalId, decision);
    if (started === get().approvals) return;
    set({ approvals: started });

    // Bug B-10: the record already flipped to BUSY, so a silently dropped
    // emit (offline / transport down) used to wedge "Sending decision…"
    // forever. emitEvent now reports the drop (B-16) and a lost/late ack
    // times out — both roll the card back to a retryable pending state
    // (a later resolve self-heals via the server's already_resolved result).
    let settled = false;
    const settle = (ack: ApprovalAck) => {
      if (settled) return;
      settled = true;
      if (ackTimer) clearTimeout(ackTimer);
      set((s) => ({ approvals: reconcileAck(s.approvals, approvalId, ack) }));
    };
    const ackTimer = setTimeout(() => settle(ackOfError()), ACK_TIMEOUT_MS);

    const sent = emitEvent(
      SOCKET_EVENTS.approvalResolve,
      { approvalId, decision },
      (...args: unknown[]) => {
        settle(normalizeAckArgs(args));
      },
    );
    if (!sent) settle(ackOfError('network'));
  },

  tick: (now = Date.now()) => {
    const next = applyExpiryTick(get().approvals, now);
    if (next !== get().approvals) set({ approvals: next });
  },

  reset: () => set({ approvals: {} }),
}));
