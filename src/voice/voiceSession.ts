import { requestRecordingPermissionsAsync, type AudioStreamBuffer } from 'expo-audio';

import { VOICE_STREAM_FORMAT } from '@/constants/config';
import { VoiceInteractionMachine } from '@/lib/voice/voiceInteractionMachine';
import { SOCKET_EVENTS } from '@/socket/events';
import { emitEvent } from '@/socket/socketClient';
import { useDiagnosticsStore } from '@/store/diagnosticsStore';
import { useVoiceStore } from '@/store/voiceStore';
import { resamplePcm16 } from '@/voice/pcm';
import { ttsPlayer } from '@/voice/ttsPlayer';
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
      void ttsPlayer.cancel();
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

export function notifySttFinal(text: string): void {
  useVoiceStore.getState().setFinal(text || '');
  useVoiceStore.getState().setInterim('');
  if (voiceMachine.active && text) {
    submitTurn({ text });
  }
}

export function notifySttEnd(): void {
  resetSession();
}

export function notifySttCancelled(): void {
  resetSession();
  useVoiceStore.getState().setInterim('');
  if (voiceMachine.active && voiceMachine.state !== 'listening') {
    voiceMachine.deactivate('cancelled');
  }
}

export function notifySttError(message: string): void {
  useVoiceStore.getState().setError(message || 'Speech recognition failed.');
  resetSession();
  voiceMachine.onError(message);
}

let ttsEndAwaitingDrain = false;

export function notifyTtsStarted(): void {
  ttsEndAwaitingDrain = false;
  voiceMachine.onSpeechStarted();
}

// The server finished SENDING the TTS stream, but the device may still be
// playing buffered segments. Reopening the mic here would let it transcribe
// ARC's own voice (an echo loop the user hears as a second voice), so the turn
// only ends once playback actually drains — see the listener below.
export function notifyTtsEnded(): void {
  if (!voiceMachine.active) {
    ttsEndAwaitingDrain = false;
    return;
  }
  if (ttsPlayer.isSpeaking()) {
    ttsEndAwaitingDrain = true;
    return;
  }
  voiceMachine.onSpeechEnded();
}

// Playback drained: safe to resume listening now that ARC is silent.
ttsPlayer.onSpeakingChange((speaking) => {
  if (speaking || !ttsEndAwaitingDrain) return;
  ttsEndAwaitingDrain = false;
  if (voiceMachine.active) voiceMachine.onSpeechEnded();
});

/** Resume listening when a text-only response completes in voice mode. */
export function notifyAssistantDone(): void {
  const store = useVoiceStore.getState();
  if (voiceMachine.active && store.mode === 'processing') {
    voiceMachine.onSpeechEnded();
  }
}
