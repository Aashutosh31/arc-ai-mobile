import { create } from 'zustand';

import type { VoiceState } from '@/lib/voice/voiceInteractionMachine';

export type MicPermission = 'unknown' | 'granted' | 'denied';

interface VoiceStoreState {
  active: boolean;
  captureActive: boolean;
  mode: VoiceState;
  interim: string;
  finalText: string;
  error: string | null;
  micPermission: MicPermission;
  ttsMode: 'server' | 'browser' | 'off' | null;

  setActive: (v: boolean) => void;
  setCaptureActive: (v: boolean) => void;
  setMode: (mode: VoiceState) => void;
  setInterim: (v: string) => void;
  setFinal: (v: string) => void;
  setError: (v: string | null) => void;
  setMicPermission: (v: MicPermission) => void;
  setTtsMode: (v: VoiceStoreState['ttsMode']) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  active: false,
  captureActive: false,
  mode: 'idle',
  interim: '',
  finalText: '',
  error: null,
  micPermission: 'unknown',
  ttsMode: null,

  setActive: (v) => set({ active: v }),
  setCaptureActive: (v) => set({ captureActive: v }),
  setMode: (mode) => set({ mode }),
  setInterim: (v) => set({ interim: v }),
  setFinal: (v) => set({ finalText: v }),
  setError: (v) => set({ error: v }),
  setMicPermission: (v) => set({ micPermission: v }),
  setTtsMode: (v) => set({ ttsMode: v }),
  reset: () =>
    set({
      active: false,
      captureActive: false,
      mode: 'idle',
      interim: '',
      finalText: '',
      error: null,
    }),
}));
