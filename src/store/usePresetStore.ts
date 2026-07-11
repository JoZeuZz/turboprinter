import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type VideoAspect, type VideoConcatMode, type VideoTransitionMode, type TtsProvider } from "../api/types";

export interface VideoPreset {
  id: string;
  name: string;
  isSystem?: boolean; // System presets cannot be deleted/renamed, only duplicated or customized
  
  // Video options
  video_aspect: VideoAspect;
  video_concat_mode: VideoConcatMode;
  video_transition_mode: VideoTransitionMode | null;
  video_clip_duration: number;
  match_materials_to_script: boolean;
  video_source: string;
  local_video_files: string[];
  
  // Audio options
  tts_provider: TtsProvider;
  voice_name: string;
  voice_volume: number;
  voice_rate: number;
  bgm_type: string;
  bgm_file: string;
  bgm_volume: number;
  
  // Subtitle options
  subtitle_enabled: boolean;
  subtitle_position: string;
  custom_position: number;
  font_name: string;
  font_size: number;
  text_fore_color: string;
  stroke_color: string;
  stroke_width: number;
  text_background_color: string | boolean;
  rounded_subtitle_background: boolean;
}

// System-defined presets
const SYSTEM_PRESETS: VideoPreset[] = [
  {
    id: "system-terror",
    name: "terror", // translate dynamically in UI or fallback
    isSystem: true,
    video_aspect: "9:16",
    video_concat_mode: "random",
    video_transition_mode: "FadeIn",
    video_clip_duration: 6,
    match_materials_to_script: true,
    video_source: "pexels",
    local_video_files: [],
    tts_provider: "azure-tts-v1",
    voice_name: "es-ES-AlvaroNeural",
    voice_volume: 1.0,
    voice_rate: 0.90,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.15,
    subtitle_enabled: true,
    subtitle_position: "center",
    custom_position: 50,
    font_name: "Charm-Bold.ttf",
    font_size: 65,
    text_fore_color: "#FF3B30",
    stroke_color: "#000000",
    stroke_width: 2.5,
    text_background_color: false,
    rounded_subtitle_background: false,
  },
  {
    id: "system-facts",
    name: "facts",
    isSystem: true,
    video_aspect: "9:16",
    video_concat_mode: "sequential",
    video_transition_mode: "SlideIn",
    video_clip_duration: 4,
    match_materials_to_script: true,
    video_source: "pexels",
    local_video_files: [],
    tts_provider: "azure-tts-v1",
    voice_name: "es-MX-JorgeNeural",
    voice_volume: 1.0,
    voice_rate: 1.15,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.20,
    subtitle_enabled: true,
    subtitle_position: "custom",
    custom_position: 55,
    font_name: "UTM Kabel KT.ttf",
    font_size: 70,
    text_fore_color: "#FFD60A",
    stroke_color: "#000000",
    stroke_width: 3.0,
    text_background_color: "#000000",
    rounded_subtitle_background: true,
  },
  {
    id: "system-mystery",
    name: "mystery",
    isSystem: true,
    video_aspect: "16:9",
    video_concat_mode: "random",
    video_transition_mode: "FadeIn",
    video_clip_duration: 7,
    match_materials_to_script: true,
    video_source: "pexels",
    local_video_files: [],
    tts_provider: "azure-tts-v1",
    voice_name: "es-MX-AlvaroNeural",
    voice_volume: 1.0,
    voice_rate: 0.95,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.12,
    subtitle_enabled: true,
    subtitle_position: "bottom",
    custom_position: 70,
    font_name: "STHeitiMedium.ttc",
    font_size: 50,
    text_fore_color: "#E5E5EA",
    stroke_color: "#1C1C1E",
    stroke_width: 2.0,
    text_background_color: false,
    rounded_subtitle_background: false,
  },
  {
    id: "system-meditation",
    name: "meditation",
    isSystem: true,
    video_aspect: "16:9",
    video_concat_mode: "random",
    video_transition_mode: "FadeIn",
    video_clip_duration: 8,
    match_materials_to_script: false,
    video_source: "pexels",
    local_video_files: [],
    tts_provider: "azure-tts-v1",
    voice_name: "es-ES-ElviraNeural",
    voice_volume: 0.8,
    voice_rate: 0.85,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.35,
    subtitle_enabled: true,
    subtitle_position: "bottom",
    custom_position: 75,
    font_name: "Charm-Regular.ttf",
    font_size: 55,
    text_fore_color: "#F0F4C3",
    stroke_color: "#37474F",
    stroke_width: 1.0,
    text_background_color: false,
    rounded_subtitle_background: false,
  },
];

interface PresetStoreState {
  presets: VideoPreset[];
  activePresetId: string | null;
  defaultPresetId: string | null;
  
  // Actions
  setActivePresetId: (id: string | null) => void;
  setDefaultPresetId: (id: string | null) => void;
  savePreset: (name: string, values: Omit<VideoPreset, "id" | "name" | "isSystem">) => string;
  updatePreset: (id: string, values: Partial<Omit<VideoPreset, "id" | "isSystem">>) => void;
  duplicatePreset: (id: string, copyLabel: string) => string;
  deletePreset: (id: string) => void;
  resetPresets: () => void;
}

export const usePresetStore = create<PresetStoreState>()(
  persist(
    (set, get) => ({
      presets: SYSTEM_PRESETS,
      activePresetId: null,
      defaultPresetId: null,

      setActivePresetId: (id) => set({ activePresetId: id }),
      
      setDefaultPresetId: (id) => set({ defaultPresetId: id }),

      savePreset: (name, values) => {
        const id = "custom-" + Date.now();
        const newPreset: VideoPreset = {
          ...values,
          id,
          name,
          isSystem: false,
        };
        set((state) => ({
          presets: [...state.presets, newPreset],
          activePresetId: id,
        }));
        return id;
      },

      updatePreset: (id, values) => {
        set((state) => ({
          presets: state.presets.map((p) => {
            if (p.id === id) {
              // System presets can't be renamed, but their configuration can be modified or we can update custom presets fully.
              if (p.isSystem) {
                return { ...p, ...values, name: p.name }; // Keep system name untranslated
              }
              return { ...p, ...values };
            }
            return p;
          }),
        }));
      },

      duplicatePreset: (id, copyLabel) => {
        const source = get().presets.find((p) => p.id === id);
        if (!source) return "";
        
        const newId = "custom-" + Date.now();
        const baseName = source.isSystem ? source.name : source.name;
        const newPreset: VideoPreset = {
          ...source,
          id: newId,
          name: `${baseName}${copyLabel}`,
          isSystem: false, // Duplicated presets are always custom
        };
        
        set((state) => ({
          presets: [...state.presets, newPreset],
          activePresetId: newId,
        }));
        return newId;
      },

      deletePreset: (id) => {
        set((state) => {
          const nextPresets = state.presets.filter((p) => p.id !== id);
          const nextActive = state.activePresetId === id ? null : state.activePresetId;
          const nextDefault = state.defaultPresetId === id ? null : state.defaultPresetId;
          return {
            presets: nextPresets,
            activePresetId: nextActive,
            defaultPresetId: nextDefault,
          };
        });
      },

      resetPresets: () => {
        set({
          presets: SYSTEM_PRESETS,
          activePresetId: null,
          defaultPresetId: null,
        });
      },
    }),
    {
      name: "mpt-presets",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
