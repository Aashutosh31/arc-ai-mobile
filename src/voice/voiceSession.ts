import { requestRecordingPermissionsAsync, type AudioStreamBuffer } from 'expo-audio';

import { VOICE_STREAM_FORMAT } from '@/constants/config';
import { VoiceInteractionMachine } from '@/lib/voice/voiceInteractionMachine';
import { SOCKET_EVENTS } from '@/socket/events';
import { emitEvent } from '@/socket/socketClient';
import { useDiagnosticsStore } from '@/store/diagnosticsStore';
import { useVoiceStore } from '@/store/voiceStore';
import { resamplePcm16 } from '@/voice/pcm';
import { stopGeneration, submitTurn } from '@/chat/chatController';

const MAX_FRAMES = 1200;
const MAX_QUEUED = 400;

let sessionId: string | null = null;
let seq = -1;
let pendingStart = false;
let pendingCommit = false;
let framesSent = 0;
const queued: { seq: number; bytes: Uint8Array }[] = [];

function resetSession() {
  sessionId = null;
  seq = -1;
  pendingStart = false;
  pendingCommit = false;
  framesSent = 0;
  queued.length = 0;
}

function drainQueue() {
  if (!sessionId) return;
  const pending = queued.splice(0, queued.length);
  for (const frame of pending) {
    emitEvent(SOCKET_EVENTS.sttAudio, {
      sessionId,
      seq: frame.seq,
      format: {
        encoding: VOICE_STREAM_FORMAT.encoding,
        sampleRate: VOICE_STREAM_FORMAT.sampleRate,
        channels: VOICE_STREAM_FORMAT.channels,
      },
      // Sent as a plain byte array, NOT an ArrayBuffer/typed array: React
      // Native forbids building a Blob from binary, which engine.io's polling
      // transport does when binary is sent. The server accepts number arrays.
      audio: Array.from(frame.bytes),
    });
  }
}

function commit() {
  if (sessionId) {
    emitEvent(SOCKET_EVENTS.sttCommit, { sessionId });
  } else if (pendingStart) {
    pendingCommit = true;
  }
}

function cancel(reason: string) {
  if (sessionId) emitEvent(SOCKET_EVENTS.sttCancel, { sessionId, reason });
  resetSession();
}

function finishCapture(reason: string) {
  useVoiceStore.getState().setCaptureActive(false);
  if (reason === 'processing') {
    commit();
    return;
  }
  cancel(reason);
}

export const voiceMachine = new VoiceInteractionMachine({
  actions: {
    onStateChange: (state) => {
      useVoiceStore.getState().setMode(state);
      if (state === 'idle') useVoiceStore.getState().setActive(false);
    },
    startCapture: () => {
      resetSession();
      useVoiceStore.getState().setActive(true);
      useVoiceStore.getState().setCaptureActive(true);
      useVoiceStore.getState().setInterim('');
      pendingStart = true;
      emitEvent(SOCKET_EVENTS.sttStart, {});
    },
    stopCapture: (reason) => finishCapture(reason),
    interruptGeneration: () => {
      stopGeneration();
    },
  },
});

/** Start listening (requests mic permission first), stop-and-commit, or barge-in. */
export async function toggleVoice(): Promise<void> {
  const store = useVoiceStore.getState();
  if (!store.active) {
    try {
      const perm = await requestRecordingPermissionsAsync();
      store.setMicPermission(perm.granted ? 'granted' : 'denied');
      if (!perm.granted) {
        store.setError('Microphone permission is required for voice mode.');
        return;
      }
      store.setError(null);
      voiceMachine.activate();
    } catch (err) {
      store.setError('Could not start voice mode.');
      useDiagnosticsStore.getState().record(err);
    }
    return;
  }
  if (store.mode === 'listening') {
    voiceMachine.onUtteranceSubmitted(voiceMachine.turn);
    return;
  }
  if (store.mode === 'speaking') {
    voiceMachine.bargeIn();
    return;
  }
  voiceMachine.deactivate();
}

export function deactivateVoice(): void {
  voiceMachine.deactivate();
}

/** Forward a captured PCM buffer to the STT stream (resampled to 24 kHz). */
export function sendAudioBuffer(buffer: AudioStreamBuffer): void {
  // This runs inside a native buffer callback: never let a bad frame throw
  // out of it (that would be an uncaught error on the JS thread).
  try {
    if (!buffer?.data) return;
    if (framesSent >= MAX_FRAMES) return;
    const raw = new Uint8Array(buffer.data);
    const actualRate = buffer.sampleRate || VOICE_STREAM_FORMAT.sampleRate;
    const bytes =
      actualRate === VOICE_STREAM_FORMAT.sampleRate
        ? raw
        : resamplePcm16(raw, actualRate, VOICE_STREAM_FORMAT.sampleRate);

    seq += 1;
    framesSent += 1;
    if (sessionId) {
      emitEvent(SOCKET_EVENTS.sttAudio, {
        sessionId,
        seq,
        format: {
          encoding: VOICE_STREAM_FORMAT.encoding,
          sampleRate: VOICE_STREAM_FORMAT.sampleRate,
          channels: VOICE_STREAM_FORMAT.channels,
        },
        // Byte array, not ArrayBuffer: see note in drainQueue above.
        audio: Array.from(bytes),
      });
    } else {
      queued.push({ seq, bytes });
      if (queued.length > MAX_QUEUED) queued.shift();
    }
  } catch (err) {
    useVoiceStore.getState().setError('Microphone stream error.');
    useDiagnosticsStore.getState().record(err);
  }
}

// ---- Server → client STT routing (called from registerHandlers) -------------

export function notifySttStarted(sid: string): void {
  sessionId = sid || null;
  pendingStart = false;
  useVoiceStore.getState().setError(null);
  if (pendingCommit) {
    pendingCommit = false;
    commit();
  }
  drainQueue();
}

export function notifySttInterim(text: string): void {
  useVoiceStore.getState().setInterim(text || '');
}

export function notifySttSpeechStart(): void {
  useVoiceStore.getState().setInterim('');
}

export function notifySttFinal(text: string, sid?: string): void {
  // Ignore a superseded session's final: it belongs to a turn we already moved on from.
  if (sid && sessionId && sid !== sessionId) return;
  const store = useVoiceStore.getState();
  const transcript = (text || '').trim();
  store.setFinal(transcript);
  store.setInterim('');
  if (!voiceMachine.active) return;

  if (!transcript) {
    // Nothing recognized: return to a live listening cycle instead of stalling
    // in `processing` with a dead STT session.
    if (voiceMachine.state === 'listening') voiceMachine.restartListening('empty transcript');
    else if (voiceMachine.state === 'processing') voiceMachine.onSpeechEnded();
    return;
  }

  // If the server finalized on its own (server-side VAD), the machine is still
  // `listening`; advance it to `processing` so the response-complete path can
  // resume listening even when the reply carries no server TTS.
  if (voiceMachine.state === 'listening') {
    voiceMachine.onUtteranceSubmitted(voiceMachine.turn);
  }
  submitTurn({ text: transcript });
}

export function notifySttEnd(): void {
  resetSession();
}

export function notifySttCancelled(): void {
  resetSession();
  useVoiceStore.getState().setInterim('');
  // Cancels are routine: they fire when TTS starts (capture stops while ARC
  // speaks), on barge-in, or when a session is superseded. Deactivating here
  // used to exit voice mode after the very first reply, so instead just make
  // sure a live listening cycle still has a session to capture into.
  if (voiceMachine.active && voiceMachine.state === 'listening') {
    voiceMachine.restartListening('cancelled; refreshing session');
  }
}

export function notifySttSpeechEnd(sid?: string): void {
  // Ignore a late VAD frame from a superseded session — acting on it would
  // commit the *new* (empty) listening cycle.
  if (sid && sessionId && sid !== sessionId) return;
  // Hands-free commit: the server's VAD heard the speaker stop. Idempotent per
  // turn via the machine's `listening` guard.
  if (voiceMachine.active && voiceMachine.state === 'listening') {
    voiceMachine.onUtteranceSubmitted(voiceMachine.turn);
  }
}

export function notifySttError(message: string): void {
  useVoiceStore.getState().setError(message || 'Speech recognition failed.');
  resetSession();
  // Surface the failure, but leave voice mode cleanly off so the next tap
  // starts a fresh session instead of tapping into a dead `error` state.
  voiceMachine.onError(message);
  voiceMachine.deactivate('error');
}

/** Recover after a socket drop: the server closed our STT session with it. */
export function handleSocketReconnect(): void {
  resetSession();
  useVoiceStore.getState().setInterim('');
  if (voiceMachine.active && voiceMachine.state === 'listening') {
    voiceMachine.restartListening('socket reconnect');
  }
}

// ARC does not speak: text-to-speech OUTPUT was removed on 2026-10-19
// (product decision — ARC must not dictate replies aloud on web or mobile).
// Microphone/STT input is unaffected. A voice turn now always ends on the
// assistant's final TEXT event via `notifyAssistantDone` below, which is the
// only completion signal left (there is no TTS playback to drain first).

/** Resume listening when the assistant response completes in voice mode. */
export function notifyAssistantDone(): void {
  const store = useVoiceStore.getState();
  if (voiceMachine.active && store.mode === 'processing') {
    voiceMachine.onSpeechEnded();
  }
}
