// webui-react/src/api/types.ts
export type VideoConcatMode = "random" | "sequential";
export type VideoTransitionMode =
  | "Shuffle"
  | "FadeIn"
  | "FadeOut"
  | "SlideIn"
  | "SlideOut"
  | null;
export type VideoAspect = "16:9" | "9:16" | "1:1";

export interface VideoParams {
  video_subject: string;
  video_script?: string;
  video_terms?: string | string[] | null;
  video_aspect?: VideoAspect;
  video_concat_mode?: VideoConcatMode;
  video_transition_mode?: VideoTransitionMode;
  video_clip_duration?: number;
  match_materials_to_script?: boolean;
  video_count?: number;
  video_source?: string;
  video_language?: string;
  voice_name?: string;
  voice_volume?: number;
  voice_rate?: number;
  bgm_type?: string;
  bgm_file?: string;
  bgm_volume?: number;
  subtitle_enabled?: boolean;
  subtitle_position?: string;
  custom_position?: number;
  font_name?: string;
  text_fore_color?: string;
  text_background_color?: boolean | string;
  rounded_subtitle_background?: boolean;
  font_size?: number;
  stroke_color?: string;
  stroke_width?: number;
  n_threads?: number;
  paragraph_number?: number;
  video_script_prompt?: string;
  custom_system_prompt?: string;
}

export const TASK_STATE_FAILED = -1 as const;
export const TASK_STATE_COMPLETE = 1 as const;
export const TASK_STATE_PROCESSING = 4 as const;

export interface TaskStatus {
  state: number;
  progress: number;
  videos: string[];
  combined_videos: string[];
}

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface CreateTaskResponse {
  task_id: string;
}

export interface UiConfig {
  video_sources: string[];
  subtitle_position_default: string;
  custom_position_default: number;
}

export interface BgmFile {
  name: string;
  size: number;
  file: string;
}
