// webui-react/src/store/useVideoStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { VideoParams } from "../api/types";
import { type TtsProvider } from "../api/types";

interface VideoStoreExtras {
  tts_provider: TtsProvider;
}

const DEFAULTS: VideoParams & VideoStoreExtras = {
  video_subject: "",
  video_script: "",
  video_terms: null,
  video_aspect: "9:16",
  video_concat_mode: "random",
  video_transition_mode: null,
  video_clip_duration: 5,
  match_materials_to_script: false,
  video_count: 1,
  video_source: "pexels",
  video_language: "",
  voice_name: "",
  voice_volume: 1.0,
  voice_rate: 1.0,
  bgm_type: "random",
  bgm_file: "",
  bgm_volume: 0.2,
  subtitle_enabled: true,
  subtitle_position: "bottom",
  custom_position: 70.0,
  font_name: "STHeitiMedium.ttc",
  text_fore_color: "#FFFFFF",
  text_background_color: true,
  rounded_subtitle_background: false,
  font_size: 60,
  stroke_color: "#000000",
  stroke_width: 1.5,
  n_threads: 2,
  paragraph_number: 1,
  video_script_prompt: "",
  custom_system_prompt: "",
  tts_provider: "azure-tts-v1",
};

interface VideoStoreState extends VideoParams, VideoStoreExtras {
  set: <K extends keyof (VideoParams & VideoStoreExtras)>(
    key: K,
    value: (VideoParams & VideoStoreExtras)[K]
  ) => void;
  reset: () => void;
  toParams: () => VideoParams;
}

export const useVideoStore = create<VideoStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<VideoStoreState>),
      reset: () => set({ ...DEFAULTS }),
      toParams: (): VideoParams => {
        const { set: _s, reset: _r, toParams: _t, tts_provider: _tp, ...params } = get();
        return params as VideoParams;
      },
    }),
    {
      name: "mpt-video",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
