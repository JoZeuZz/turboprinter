// webui-react/src/store/useVideoStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { VideoParams } from "../api/types";
import { type TtsProvider } from "../api/types";

interface VideoStoreExtras {
  tts_provider: TtsProvider;
  preview_text: string;
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
  subtitle_bg_style: "solid",
  subtitle_animation: "pop",
  font_size: 60,
  stroke_color: "#000000",
  stroke_width: 1.5,
  n_threads: 2,
  paragraph_number: 1,
  video_script_prompt: "",
  custom_system_prompt: "",
  local_video_files: [],
  video_niche: "terror",
  is_multi_part: false,
  multi_part_count: 2,
  active_part_index: 1,
  multi_part_scripts: [],
  hook_style: "misterio",
  title_options: [],
  selected_title: "",
  tts_provider: "azure-tts-v1",
  preview_text: "Este es un texto de ejemplo para probar la sintesis de voz.",
};

const getInitialState = (): VideoParams & VideoStoreExtras => {
  let autoSaveEnabled = true;
  try {
    const presetStoreData = localStorage.getItem("mpt-presets");
    if (presetStoreData) {
      const parsed = JSON.parse(presetStoreData);
      if (parsed?.state && parsed.state.autoSaveConfigAfterGeneration !== undefined) {
        autoSaveEnabled = parsed.state.autoSaveConfigAfterGeneration;
      }
    }
  } catch (e) {}

  if (autoSaveEnabled) {
    try {
      const lastGeneratedStr = localStorage.getItem("mpt-last-generated-config");
      if (lastGeneratedStr) {
        const lastGenerated = JSON.parse(lastGeneratedStr);
        return {
          ...DEFAULTS,
          ...lastGenerated,
          video_subject: "",
          video_script: "",
          video_terms: null,
          video_script_prompt: "",
          custom_system_prompt: "",
        };
      }
    } catch (e) {}
  }
  return DEFAULTS;
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
      ...getInitialState(),
      set: (key, value) => set({ [key]: value } as Partial<VideoStoreState>),
      reset: () => {
        let autoSaveEnabled = true;
        try {
          const presetStoreData = localStorage.getItem("mpt-presets");
          if (presetStoreData) {
            const parsed = JSON.parse(presetStoreData);
            if (parsed?.state && parsed.state.autoSaveConfigAfterGeneration !== undefined) {
              autoSaveEnabled = parsed.state.autoSaveConfigAfterGeneration;
            }
          }
        } catch (e) {}

        if (autoSaveEnabled) {
          const lastGeneratedStr = localStorage.getItem("mpt-last-generated-config");
          if (lastGeneratedStr) {
            try {
              const lastGenerated = JSON.parse(lastGeneratedStr);
              set({
                ...DEFAULTS,
                ...lastGenerated,
                video_subject: "",
                video_script: "",
                video_terms: null,
                video_script_prompt: "",
                custom_system_prompt: "",
              });
              return;
            } catch (e) {}
          }
        }
        set({ ...DEFAULTS });
      },
      toParams: (): VideoParams => {
        const {
          set: _s,
          reset: _r,
          toParams: _t,
          tts_provider: _tp,
          preview_text: _pt,
          ...params
        } = get();
        return params as VideoParams;
      },
    }),
    {
      name: "mpt-video",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
