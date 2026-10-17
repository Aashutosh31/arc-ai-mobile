import { create } from 'zustand';

/**
 * Lightweight on-device diagnostics.
 *
 * React Native silently kills release builds on unhandled errors, which makes
 * device-only bugs impossible to report. We capture the message/stack here so
 * the app can keep running and surface exactly what went wrong.
 */
export interface FatalError {
  message: string;
  stack?: string;
  at: number;
}

interface DiagnosticsState {
  fatal: FatalError | null;
  record: (err: unknown) => void;
  clear: () => void;
}

function describe(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message || err.name || 'Unknown error', stack: err.stack };
  }
  if (typeof err === 'string') return { message: err };
  try {
    const message = JSON.stringify(err);
    if (message) return { message };
  } catch {
    // fall through
  }
  return { message: String(err) };
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  fatal: null,
  record: (err) => set({ fatal: { ...describe(err), at: Date.now() } }),
  clear: () => set({ fatal: null }),
}));

let installed = false;

type GlobalErrorUtils = {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

/**
 * Route uncaught JS errors into the diagnostics store instead of letting the
 * process die, so the UI can present them for reporting.
 */
export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;
  const errorUtils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;
  const previous = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    useDiagnosticsStore.getState().record(error);
    if (!isFatal) previous?.(error, isFatal);
  });
}
