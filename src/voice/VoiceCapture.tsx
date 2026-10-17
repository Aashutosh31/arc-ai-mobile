import { useEffect } from 'react';
import { useAudioStream } from 'expo-audio';

import { VOICE_STREAM_FORMAT } from '@/constants/config';
import { useVoiceStore } from '@/store/voiceStore';
import { sendAudioBuffer } from '@/voice/voiceSession';

/**
 * Mounts only while `captureActive` is true so the native microphone stream is
 * started on listen and released immediately afterwards.
 */
function Capture() {
  const { stream } = useAudioStream({
    channels: 1,
    encoding: 'int16',
    sampleRate: VOICE_STREAM_FORMAT.sampleRate,
    onBuffer: sendAudioBuffer,
  });

  useEffect(() => {
    let mounted = true;
    stream.start().catch(() => {
      if (mounted) useVoiceStore.getState().setError('Failed to start microphone capture.');
    });
    return () => {
      mounted = false;
      try {
        stream.stop();
      } catch {
        // already stopped
      }
    };
  }, [stream]);

  return null;
}

export function VoiceCapture() {
  const captureActive = useVoiceStore((s) => s.captureActive);
  if (!captureActive) return null;
  return <Capture />;
}
