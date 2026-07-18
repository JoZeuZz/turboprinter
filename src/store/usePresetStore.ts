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
    voice_name: "es-MX-AlvaroNeural",
    voice_volume: 1.0,
    voice_rate: 0.98,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.07,
    subtitle_enabled: true,
    subtitle_position: "bottom",
    custom_position: 70,
    font_name: "STHeitiMedium.ttc",
    font_size: 60,
    text_fore_color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 2.5,
    text_background_color: false,
    rounded_subtitle_background: false,
  },
  {
    id: "system-comedy",
    name: "comedy",
    isSystem: true,
    video_aspect: "9:16",
    video_concat_mode: "random",
    video_transition_mode: "FadeIn",
    video_clip_duration: 5,
    match_materials_to_script: true,
    video_source: "pexels",
    local_video_files: [],
    tts_provider: "azure-tts-v1",
    voice_name: "es-ES-AlvaroNeural",
    voice_volume: 1.0,
    voice_rate: 1.15,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.12,
    subtitle_enabled: true,
    subtitle_position: "bottom",
    custom_position: 70,
    font_name: "UTM Kabel KY.ttf",
    font_size: 60,
    text_fore_color: "#FFD60A",
    stroke_color: "#000000",
    stroke_width: 3.0,
    text_background_color: false,
    rounded_subtitle_background: false,
  },
  {
    id: "system-curiosities",
    name: "curiosities",
    isSystem: true,
    video_aspect: "9:16",
    video_concat_mode: "random",
    video_transition_mode: "FadeIn",
    video_clip_duration: 5,
    match_materials_to_script: true,
    video_source: "pexels",
    local_video_files: [],
    tts_provider: "azure-tts-v1",
    voice_name: "es-MX-JorgeNeural",
    voice_volume: 1.0,
    voice_rate: 1.08,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.10,
    subtitle_enabled: true,
    subtitle_position: "bottom",
    custom_position: 70,
    font_name: "STHeitiMedium.ttc",
    font_size: 60,
    text_fore_color: "#00F0FF",
    stroke_color: "#000000",
    stroke_width: 2.0,
    text_background_color: false,
    rounded_subtitle_background: false,
  },
  {
    id: "system-confessions",
    name: "confessions",
    isSystem: true,
    video_aspect: "9:16",
    video_concat_mode: "random",
    video_transition_mode: "FadeIn",
    video_clip_duration: 5,
    match_materials_to_script: true,
    video_source: "pexels",
    local_video_files: [],
    tts_provider: "azure-tts-v1",
    voice_name: "es-MX-DaliaNeural",
    voice_volume: 1.0,
    voice_rate: 1.10,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.09,
    subtitle_enabled: true,
    subtitle_position: "bottom",
    custom_position: 70,
    font_name: "STHeitiMedium.ttc",
    font_size: 60,
    text_fore_color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 2.0,
    text_background_color: false,
    rounded_subtitle_background: false,
  },
];

interface PresetStoreState {
  presets: VideoPreset[];
  activePresetId: string | null;
  defaultPresetId: string | null;
  autoSaveConfigAfterGeneration: boolean;
  
  // Actions
  setActivePresetId: (id: string | null) => void;
  setDefaultPresetId: (id: string | null) => void;
  setAutoSaveConfigAfterGeneration: (enabled: boolean) => void;
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
      autoSaveConfigAfterGeneration: true,

      setActivePresetId: (id: string | null) => set({ activePresetId: id }),
      
      setDefaultPresetId: (id: string | null) => set({ defaultPresetId: id }),

      setAutoSaveConfigAfterGeneration: (enabled: boolean) => set({ autoSaveConfigAfterGeneration: enabled }),

      savePreset: (name: string, values: Omit<VideoPreset, "id" | "name" | "isSystem">) => {
        const id = "custom-" + Date.now();
        const newPreset: VideoPreset = {
          ...values,
          id,
          name,
          isSystem: false,
        };
        set((state: PresetStoreState) => ({
          presets: [...state.presets, newPreset],
          activePresetId: id,
        }));
        return id;
      },

      updatePreset: (id: string, values: Partial<Omit<VideoPreset, "id" | "isSystem">>) => {
        set((state: PresetStoreState) => ({
          presets: state.presets.map((p: VideoPreset) => {
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

      duplicatePreset: (id: string, copyLabel: string) => {
        const source = get().presets.find((p: VideoPreset) => p.id === id);
        if (!source) return "";
        
        const newId = "custom-" + Date.now();
        const baseName = source.isSystem ? source.name : source.name;
        const newPreset: VideoPreset = {
          ...source,
          id: newId,
          name: `${baseName}${copyLabel}`,
          isSystem: false, // Duplicated presets are always custom
        };
        
        set((state: PresetStoreState) => ({
          presets: [...state.presets, newPreset],
          activePresetId: newId,
        }));
        return newId;
      },

      deletePreset: (id: string) => {
        set((state: PresetStoreState) => {
          const nextPresets = state.presets.filter((p: VideoPreset) => p.id !== id);
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
      merge: (persistedState: any, currentState: any) => {
        if (!persistedState) return currentState;
        // Keep custom presets from persisted state, but replace system presets with current SYSTEM_PRESETS
        const customPresets = (persistedState.presets || []).filter((p: any) => !p.isSystem);
        return {
          ...currentState,
          ...persistedState,
          presets: [...SYSTEM_PRESETS, ...customPresets],
        };
      },
    }
  )
);
