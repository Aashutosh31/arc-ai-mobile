import type { SearchResponse, TtsConfig } from '@/types/api';

import { http } from './client';

export const searchApi = {
  search: async (q: string, limit = 10): Promise<SearchResponse> => {
    const { data } = await http.get<SearchResponse>('/search', {
      params: { q, limit },
    });
    return data;
  },
};

export const voiceApi = {
  ttsConfig: async (): Promise<TtsConfig> => {
    const { data } = await http.get<TtsConfig>('/voice/tts-config');
    return data;
  },
  /** Legacy single-shot transcription (charges 1 credit). */
  transcribe: async (
    audioBase64: string,
    mimeType?: string,
  ): Promise<{ text: string }> => {
    const { data } = await http.post<{ text: string }>('/voice/transcribe', {
      audio: audioBase64,
      mimeType,
    });
    return data;
  },
};
