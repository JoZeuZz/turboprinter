// webui-react/src/api/voice.ts
import { apiFetch } from "./client";
import type { TtsProvider, VoiceOption, VoicesResponse } from "./types";

export const voiceApi = {
  getVoices: (provider: TtsProvider): Promise<VoiceOption[]> =>
    apiFetch<VoicesResponse>(`/voices?provider=${encodeURIComponent(provider)}`).then(
      (r) => r.voices
    ),
};
