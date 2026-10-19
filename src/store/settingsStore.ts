import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingsState {
  memoryLearningEnabled: boolean;
  hapticsEnabled: boolean;
  setMemoryLearningEnabled: (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      memoryLearningEnabled: true,
      hapticsEnabled: true,
      setMemoryLearningEnabled: (v) => set({ memoryLearningEnabled: v }),
      setHapticsEnabled: (v) => set({ hapticsEnabled: v }),
    }),
    {
      name: 'arc.settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
