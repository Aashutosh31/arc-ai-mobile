// Explicit voice interaction state machine for Advanced Voice Mode.
//
// Half-duplex invariant enforced by this machine:
//   state === 'speaking'  → microphone capture MUST be stopped
//   state === 'listening' → TTS playback MUST NOT be active
//
// States: idle → listening → processing → speaking → listening → ...
// Every listening cycle gets a unique turn id; stale callbacks carrying an
// old turn must be ignored by callers via isTurnValid().
//
// Framework-free and DOM-free — ported verbatim from the web client
// (client/src/utils/voiceInteractionMachine.js).

export const VOICE_INTERACTION_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  INTERRUPTED: 'interrupted',
  ERROR: 'error',
} as const;

export type VoiceState =
  (typeof VOICE_INTERACTION_STATES)[keyof typeof VOICE_INTERACTION_STATES];

export interface VoiceMachineActions {
  onStateChange?: (state: VoiceState) => void;
  startCapture?: (turn: number) => void;
  stopCapture?: (reason: string) => void;
  interruptGeneration?: () => void;
}

export class VoiceInteractionMachine {
  state: VoiceState = VOICE_INTERACTION_STATES.IDLE;
  turn = 0;
  active = false;
  errorMessage: string | null = null;
  private actions: VoiceMachineActions;
  private log: (message: string) => void;

  constructor({
    actions = {},
    log = null,
  }: { actions?: VoiceMachineActions; log?: ((m: string) => void) | null } = {}) {
    this.actions = actions;
    this.log = typeof log === 'function' ? log : () => {};
  }

  private _emit(next: VoiceState, reason?: string) {
    this.state = next;
    this.log(`[Advanced Voice] state: ${next} (turn ${this.turn})${reason ? ` - ${reason}` : ''}`);
    try {
      this.actions.onStateChange?.(next);
    } catch {
      // UI sync must never break the machine
    }
  }

  private _nextTurn() {
    this.turn += 1;
    return this.turn;
  }

  isTurnValid(turn: number) {
    return this.active && turn === this.turn;
  }

  activate(reason = 'activated') {
    this.active = true;
    this.errorMessage = null;
    const turn = this._nextTurn();
    this._emit(VOICE_INTERACTION_STATES.LISTENING, reason);
    try {
      this.actions.startCapture?.(turn);
    } catch {
      // capture failures are reported through onError by the caller
    }
    return turn;
  }

  toggle(): 'activated' | 'barged-in' | 'cancelled' | 'deactivated' {
    if (!this.active || this.state === VOICE_INTERACTION_STATES.IDLE) {
      this.activate();
      return 'activated';
    }
    if (this.state === VOICE_INTERACTION_STATES.SPEAKING) {
      this.bargeIn();
      return 'barged-in';
    }
    if (this.state === VOICE_INTERACTION_STATES.PROCESSING) {
      try {
        this.actions.interruptGeneration?.();
      } catch {
        // ignore
      }
      this.deactivate('cancelled during processing');
      return 'cancelled';
    }
    this.deactivate('toggled off');
    return 'deactivated';
  }

  onUtteranceSubmitted(turn: number) {
    if (!this.isTurnValid(turn) || this.state !== VOICE_INTERACTION_STATES.LISTENING) {
      return false;
    }
    this._nextTurn();
    this._emit(VOICE_INTERACTION_STATES.PROCESSING, 'utterance submitted');
    try {
      this.actions.stopCapture?.('processing');
    } catch {
      // ignore
    }
    return true;
  }

  onSpeechStarted() {
    if (!this.active) return false;
    if (
      this.state !== VOICE_INTERACTION_STATES.PROCESSING &&
      this.state !== VOICE_INTERACTION_STATES.LISTENING
    ) {
      return false;
    }
    this._nextTurn();
    this._emit(VOICE_INTERACTION_STATES.SPEAKING, 'ai speech started');
    try {
      this.actions.stopCapture?.('speaking');
    } catch {
      // ignore
    }
    return true;
  }

  onSpeechEnded() {
    if (!this.active) return false;
    if (
      this.state !== VOICE_INTERACTION_STATES.SPEAKING &&
      this.state !== VOICE_INTERACTION_STATES.PROCESSING
    ) {
      return false;
    }
    const turn = this._nextTurn();
    this._emit(VOICE_INTERACTION_STATES.LISTENING, 'arc finished speaking');
    try {
      this.actions.startCapture?.(turn);
    } catch {
      // capture failures are reported through onError by the caller
    }
    return true;
  }

  restartListening(reason = 'cycle refresh') {
    if (!this.active || this.state !== VOICE_INTERACTION_STATES.LISTENING) {
      return false;
    }
    const turn = this._nextTurn();
    this.log(`[Advanced Voice] state: listening (turn ${turn}) - ${reason}`);
    try {
      this.actions.startCapture?.(turn);
    } catch {
      // capture failures are reported through onError by the caller
    }
    return true;
  }

  bargeIn() {
    if (!this.active || this.state !== VOICE_INTERACTION_STATES.SPEAKING) {
      return false;
    }
    this._emit(VOICE_INTERACTION_STATES.INTERRUPTED, 'user barge-in');
    try {
      this.actions.interruptGeneration?.();
    } catch {
      // ignore
    }
    const turn = this._nextTurn();
    this._emit(VOICE_INTERACTION_STATES.LISTENING, 'barge-in');
    try {
      this.actions.startCapture?.(turn);
    } catch {
      // capture failures are reported through onError by the caller
    }
    return true;
  }

  onError(message?: string) {
    this._nextTurn();
    this.errorMessage = message || 'Voice error';
    this._emit(VOICE_INTERACTION_STATES.ERROR, this.errorMessage);
    try {
      this.actions.stopCapture?.('error');
    } catch {
      // ignore
    }
  }

  deactivate(reason = 'deactivated') {
    this.active = false;
    this._nextTurn();
    this._emit(VOICE_INTERACTION_STATES.IDLE, reason);
    try {
      this.actions.stopCapture?.('deactivated');
    } catch {
      // ignore
    }
  }
}
