/** PCM helpers for the canonical wire format (pcm16 / 16-bit / LE). */

const B64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

const writeString = (view: DataView, offset: number, str: string) => {
  for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
};

/**
 * Wrap concatenated little-endian PCM16 chunks in a WAV container and return a
 * base64 `data:` URI suitable for expo-audio players.
 */
export function pcm16ToWavDataUri(
  chunks: Uint8Array[],
  sampleRate: number,
  channels = 1,
): string {
  const dataLength = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const byteRate = sampleRate * channels * 2;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  const bytes = new Uint8Array(buffer);
  let offset = 44;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return `data:audio/wav;base64,${bytesToBase64(bytes)}`;
}

/** Normalise any incoming audio payload into a Uint8Array of PCM16 LE bytes. */
export function toPcm16Bytes(payload: unknown): Uint8Array | null {
  if (!payload) return null;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (ArrayBuffer.isView(payload)) {
    return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  }
  if (Array.isArray(payload)) return new Uint8Array(payload);
  const data = (payload as { data?: unknown }).data;
  if (data) return toPcm16Bytes(data);
  return null;
}

/**
 * Linear-resample mono PCM16 LE bytes to `toRate`.
 *
 * The server STT contract expects 24 kHz mono PCM16; the device microphone may
 * deliver a different rate (48 kHz is common), so frames are resampled at the
 * boundary before being put on the wire.
 */
export function resamplePcm16(bytes: Uint8Array, fromRate: number, toRate: number): Uint8Array {
  if (!fromRate || fromRate === toRate || bytes.length < 4) return bytes;
  const inSamples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
  const ratio = toRate / fromRate;
  const outLen = Math.max(1, Math.round(inSamples.length * ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const src = i / ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(inSamples.length - 1, i0 + 1);
    const frac = src - i0;
    out[i] = Math.round(inSamples[i0] * (1 - frac) + inSamples[i1] * frac);
  }
  return new Uint8Array(out.buffer);
}

