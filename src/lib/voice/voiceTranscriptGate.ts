// Transcript gating decision. Ported from the web client
// (client/src/utils/voiceTranscriptGate.js).

export interface TranscriptGateInput {
  text?: string;
  needsClarification?: boolean;
  destructive?: { verb?: string; [k: string]: unknown } | null;
  reason?: string | null;
}

export const shouldGateTranscript = (data: string | TranscriptGateInput | null): boolean => {
  const raw = typeof data === 'string' ? { text: data } : data || {};
  const text = String(raw?.text || '').trim();
  if (!text) return false;
  return Boolean(raw?.needsClarification);
};

export const transcriptGateReason = (
  data: string | TranscriptGateInput | null,
): string | null => {
  const raw = typeof data === 'string' ? { text: data } : data || {};
  if (!shouldGateTranscript(raw)) return null;
  if (raw?.destructive) return `destructive-command:${raw.destructive.verb}`;
  if (raw?.reason) return String(raw.reason);
  return 'requires-confirmation';
};
