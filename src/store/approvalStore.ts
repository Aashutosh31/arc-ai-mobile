import { create } from 'zustand';

import {
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

    emitEvent(
      SOCKET_EVENTS.approvalResolve,
      { approvalId, decision },
      (...args: unknown[]) => {
        const ack: ApprovalAck = normalizeAckArgs(args);
        set((s) => ({ approvals: reconcileAck(s.approvals, approvalId, ack) }));
      },
    );
  },

  tick: (now = Date.now()) => {
    const next = applyExpiryTick(get().approvals, now);
    if (next !== get().approvals) set({ approvals: next });
  },

  reset: () => set({ approvals: {} }),
}));
