import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface VoiceSettings {
  provider: 'server' | 'browser';
  voice: string;
  rate: number;
  streamingEnabled: boolean;
  fallbackEnabled: boolean;
}

export const VOICE_SETTINGS_DEFAULTS: VoiceSettings = {
  provider: 'server',
  voice: 'Kore',
  rate: 1.0,
  streamingEnabled: true,
  fallbackEnabled: true,
};

interface SettingsState {
  voice: VoiceSettings;
  memoryLearningEnabled: boolean;
  hapticsEnabled: boolean;
  setVoice: (patch: Partial<VoiceSettings>) => void;
  setMemoryLearningEnabled: (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voice: { ...VOICE_SETTINGS_DEFAULTS },
      memoryLearningEnabled: true,
      hapticsEnabled: true,
      setVoice: (patch) =>
        set((s) => ({ voice: { ...s.voice, ...patch } })),
      setMemoryLearningEnabled: (v) => set({ memoryLearningEnabled: v }),
      setHapticsEnabled: (v) => set({ hapticsEnabled: v }),
    }),
    {
      name: 'arc.settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
