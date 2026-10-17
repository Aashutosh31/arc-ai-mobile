import { create } from 'zustand';

export interface PendingDocument {
  name: string;
  type: string;
  base64: string;
}

interface ComposerState {
  pendingImage: string | null;
  pendingDocument: PendingDocument | null;
  setPendingImage: (v: string | null) => void;
  setPendingDocument: (v: PendingDocument | null) => void;
  clear: () => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  pendingImage: null,
  pendingDocument: null,
  setPendingImage: (v) => set({ pendingImage: v }),
  setPendingDocument: (v) => set({ pendingDocument: v }),
  clear: () => set({ pendingImage: null, pendingDocument: null }),
}));
