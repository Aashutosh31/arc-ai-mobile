import { useEffect } from 'react';
import { setAudioModeAsync, useAudioStream } from 'expo-audio';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useDiagnosticsStore } from '@/store/diagnosticsStore';
import { useVoiceStore } from '@/store/voiceStore';
import { sendAudioBuffer } from '@/voice/voiceSession';

/**
 * Hardware-friendly capture rate. The server expects 24 kHz PCM16, but not all
 * Android devices can open an AudioRecord at 24 kHz, so we capture at the
 * device-native 48 kHz and resample down in `sendAudioBuffer`.
 */
const CAPTURE_SAMPLE_RATE = 48000;

/**
 * Mounts only while `captureActive` is true so the native microphone stream is
 * started on listen and released immediately afterwards.
 */
function Capture() {
  const { stream } = useAudioStream({
    channels: 1,
    encoding: 'int16',
    sampleRate: CAPTURE_SAMPLE_RATE,
    onBuffer: sendAudioBuffer,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Recording requires the audio session to allow recording on Android.
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await stream.start();
      } catch (err) {
        if (mounted) {
          useVoiceStore.getState().setError('Failed to start microphone capture.');
          useDiagnosticsStore.getState().record(err);
        }
      }
    })();
    return () => {
      mounted = false;
      try {
        stream.stop();
      } catch {
        // already stopped
      }
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [stream]);

  return null;
}

export function VoiceCapture() {
  const captureActive = useVoiceStore((s) => s.captureActive);
  if (!captureActive) return null;
  return (
    <ErrorBoundary compact onReset={() => useVoiceStore.getState().setCaptureActive(false)}>
      <Capture />
    </ErrorBoundary>
  );
}
