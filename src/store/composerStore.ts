import { create } from 'zustand';

export interface PendingDocument {
  name: string;
  type: string;
  base64: string;
}

interface ComposerState {
  pendingImage: string | null;
  pendingDocument: PendingDocument | null;
  /** Composer text (also the injection point for a tool's "Try it"). */
  text: string;
  setPendingImage: (v: string | null) => void;
  setPendingDocument: (v: PendingDocument | null) => void;
  setText: (v: string) => void;
  clear: () => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  pendingImage: null,
  pendingDocument: null,
  text: '',
  setPendingImage: (v) => set({ pendingImage: v }),
  setPendingDocument: (v) => set({ pendingDocument: v }),
  setText: (v) => set({ text: v }),
  clear: () => set({ pendingImage: null, pendingDocument: null }),
}));
