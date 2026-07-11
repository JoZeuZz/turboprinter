// webui-react/src/api/voice.ts
import { apiBlobFetch, apiFetch } from "./client";
import type { TtsProvider, VoiceOption, VoicesResponse } from "./types";

export const voiceApi = {
  getVoices: (provider: TtsProvider): Promise<VoiceOption[]> =>
    apiFetch<VoicesResponse>(`/voices?provider=${encodeURIComponent(provider)}`).then(
      (r) => r.voices
    ),
  previewVoice: (params: {
    voice_name: string;
    text: string;
    voice_rate: number;
    voice_volume: number;
  }): Promise<Blob> =>
    apiBlobFetch("/voices/preview", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
