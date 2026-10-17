import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import * as Speech from 'expo-speech';

import { pcm16ToWavDataUri } from '@/voice/pcm';
import { VOICE_STREAM_FORMAT } from '@/constants/config';

interface TtsChunk {
  uri: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Plays server-streamed PCM TTS.
 *
 * `voice:tts:audio` frames are grouped by `segmentIndex`; each completed
 * segment is wrapped into a WAV data URI and queued. Playback is serial and can
 * be cancelled instantly (barge-in). Empty stream state is tolerated.
 *
 * NOTE: expo-audio has no raw-PCM streaming sink, so segments are played as
 * completed WAVs. Swap `play()` to `react-native-audio-api` in a dev build for
 * sample-accurate streaming without regressions elsewhere.
 */
class TtsPlayer {
  private player: AudioPlayer | null = null;
  private queue: TtsChunk[] = [];
  private playing = false;
  private currentStreamId: string | null = null;
  private currentSegment = -1;
  private listeners = new Set<(speaking: boolean) => void>();
  private speechFallbackActive = false;

  onSpeakingChange(fn: (speaking: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emitSpeaking(v: boolean) {
    this.listeners.forEach((fn) => {
      try {
        fn(v);
      } catch {
        // ignore listener errors
      }
    });
  }

  async beginStream(streamId: string, sampleRate: number = VOICE_STREAM_FORMAT.sampleRate) {
    await this.cancel();
    this.currentStreamId = streamId;
    this.currentSegment = -1;
    this.sampleRate = sampleRate;
  }

  private sampleRate: number = VOICE_STREAM_FORMAT.sampleRate;

  /**
   * Receive a raw PCM16 frame. Frames carry `segmentIndex`; when it advances we
   * finalise the previous segment and enqueue it for playback.
   */
  pushFrame(
    streamId: string,
    bytes: Uint8Array,
    segmentIndex?: number,
    sampleRate: number = VOICE_STREAM_FORMAT.sampleRate,
  ) {
    if (streamId && this.currentStreamId && streamId !== this.currentStreamId) return;
    if (
      typeof segmentIndex === 'number' &&
      segmentIndex !== this.currentSegment &&
      this.currentSegment !== -1
    ) {
      this.flushSegment();
    }
    if (typeof segmentIndex === 'number') this.currentSegment = segmentIndex;
    this.sampleRate = sampleRate;
    this.segmentChunks.push(bytes);
    this.segmentBytes += bytes.length;
    if (this.segmentBytes >= TtsPlayer.AUTO_FLUSH_BYTES) this.flushSegment();
  }

  private static AUTO_FLUSH_BYTES = 32000;
  private segmentChunks: Uint8Array[] = [];
  private segmentBytes = 0;

  private flushSegment() {
    if (!this.segmentChunks.length) return;
    const uri = pcm16ToWavDataUri(this.segmentChunks, this.sampleRate, 1);
    this.segmentChunks = [];
    this.segmentBytes = 0;
    this.queue.push({ uri });
    void this.pump();
  }

  endStream(streamId?: string) {
    if (streamId && this.currentStreamId && streamId !== this.currentStreamId) return;
    this.flushSegment();
    this.currentStreamId = null;
  }

  async cancel(): Promise<void> {
    this.queue = [];
    this.segmentChunks = [];
    this.segmentBytes = 0;
    this.currentSegment = -1;
    this.currentStreamId = null;
    if (this.speechFallbackActive) {
      this.speechFallbackActive = false;
      try {
        Speech.stop();
      } catch {
        // ignore
      }
    }
    if (this.player) {
      try {
        this.player.pause();
      } catch {
        // ignore
      }
    }
    this.playing = false;
    this.emitSpeaking(false);
  }

  /** Local TTS fallback (e.g. when the server sends a text-only response). */
  async speakText(text: string, opts: { rate?: number } = {}) {
    const clean = (text || '').trim();
    if (!clean) return;
    await this.cancel();
    this.speechFallbackActive = true;
    this.emitSpeaking(true);
    try {
      await Speech.speak(clean, {
        rate: opts.rate ?? 1,
        onDone: () => {
          this.speechFallbackActive = false;
          this.emitSpeaking(false);
        },
        onStopped: () => {
          this.speechFallbackActive = false;
          this.emitSpeaking(false);
        },
        onError: () => {
          this.speechFallbackActive = false;
          this.emitSpeaking(false);
        },
      });
    } catch {
      this.speechFallbackActive = false;
      this.emitSpeaking(false);
    }
  }

  private ensurePlayer(): AudioPlayer {
    if (!this.player) {
      const player = createAudioPlayer(null);
      player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (status.didJustFinish) {
          this.playing = false;
          void this.pump();
        }
      });
      this.player = player;
      void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    }
    return this.player;
  }

  private async pump(): Promise<void> {
    if (this.playing) return;
    const next = this.queue.shift();
    if (!next) {
      this.emitSpeaking(false);
      return;
    }
    this.playing = true;
    this.emitSpeaking(true);
    try {
      const player = this.ensurePlayer();
      player.replace(next.uri);
      await sleep(20);
      player.play();
    } catch {
      this.playing = false;
      void this.pump();
    }
  }
}

export const ttsPlayer = new TtsPlayer();
