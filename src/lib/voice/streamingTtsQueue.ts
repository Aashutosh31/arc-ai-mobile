// Voice Runtime — bounded streaming TTS queue.
// Ported verbatim from the web client (client/src/utils/streamingTtsQueue.js).
//
// Bounded depth (default 4). Overflow drops the OLDEST pending segment
// (never the one playing). Interrupt cancels the active request via
// AbortSignal, clears pending, and resolves to listening.

export const DEFAULT_QUEUE_DEPTH = 4;

interface QueueItem {
  text: string;
  index: number;
}

export type SynthesizeFn = (
  text: string,
  opts: { signal: AbortSignal; index: number },
) => AsyncIterable<unknown> | { audio?: unknown } | null | undefined;

export class StreamingTtsQueue {
  maxDepth: number;
  pending: QueueItem[] = [];
  activeController: AbortController | null = null;
  activeIndex = 0;
  nextIndex = 0;
  dropped = 0;
  completed = 0;
  cancelled = false;
  onAudio: ((chunk: unknown, index: number) => void) | null = null;
  onEvent: ((event: Record<string, unknown>) => void) | null = null;
  private synthesize: SynthesizeFn | null;

  constructor({
    maxDepth = DEFAULT_QUEUE_DEPTH,
    synthesize = null,
  }: { maxDepth?: number; synthesize?: SynthesizeFn | null } = {}) {
    this.maxDepth = maxDepth;
    this.synthesize = typeof synthesize === 'function' ? synthesize : null;
  }

  get depth() {
    return this.pending.length;
  }

  enqueue(text: string): number {
    const clean = String(text || '').trim();
    if (!clean) return -1;
    if (this.pending.length >= this.maxDepth) {
      this.pending.shift();
      this.dropped += 1;
    }
    const index = this.nextIndex;
    this.nextIndex += 1;
    this.pending.push({ text: clean, index });
    try {
      this.onEvent?.({ type: 'queued', index });
    } catch {
      // telemetry only
    }
    void this._pump();
    return index;
  }

  private async _pump(): Promise<void> {
    if (this.activeController || this.pending.length === 0) return;
    if (!this.synthesize) return;
    const next = this.pending.shift()!;
    const controller = new AbortController();
    this.activeController = controller;
    try {
      this.onEvent?.({ type: 'started', index: next.index });
    } catch {
      // ignore
    }
    try {
      const stream = this.synthesize(next.text, {
        signal: controller.signal,
        index: next.index,
      });
      if (stream && typeof (stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
        for await (const chunk of stream as AsyncIterable<unknown>) {
          if (controller.signal.aborted) break;
          try {
            this.onAudio?.(chunk, next.index);
          } catch {
            // ignore
          }
        }
      } else if (stream && (stream as { audio?: unknown }).audio) {
        try {
          this.onAudio?.((stream as { audio?: unknown }).audio, next.index);
        } catch {
          // ignore
        }
      }
      this.completed += 1;
      try {
        this.onEvent?.({ type: 'completed', index: next.index });
      } catch {
        // ignore
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError' || controller.signal.aborted) {
        try {
          this.onEvent?.({ type: 'cancelled', index: next.index });
        } catch {
          // ignore
        }
      } else {
        try {
          this.onEvent?.({ type: 'error', index: next.index, error });
        } catch {
          // ignore
        }
      }
    } finally {
      if (this.activeController === controller) this.activeController = null;
      this.activeIndex = Math.max(this.activeIndex, next.index + 1);
      if (!this.cancelled) void this._pump();
      this.cancelled = false;
    }
  }

  interrupt(): number {
    this.cancelled = true;
    try {
      this.activeController?.abort();
    } catch {
      // ignore
    }
    this.activeController = null;
    const cleared = this.pending.length;
    this.pending = [];
    try {
      this.onEvent?.({ type: 'interrupted', cleared });
    } catch {
      // ignore
    }
    return cleared;
  }

  reset() {
    this.interrupt();
    this.activeIndex = 0;
    this.nextIndex = 0;
    this.dropped = 0;
    this.completed = 0;
    this.cancelled = false;
  }

  getStats() {
    return {
      pending: this.pending.length,
      dropped: this.dropped,
      completed: this.completed,
      active: Boolean(this.activeController),
    };
  }
}
