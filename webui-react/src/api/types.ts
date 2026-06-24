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

// ─── Project-mode types ───────────────────────────────────────────────────────

// Request bodies
export interface CreateFromTopicRequest {
  topic: string;
  language?: string;
  generate_script?: boolean;
  paragraph_number?: number;
  global_visual_style?: string | null;
  target_duration_sec?: number | null;
}

export interface CreateFromScriptRequest {
  script: string;
  language?: string;
  topic?: string | null;
  global_visual_style?: string | null;
  target_duration_sec?: number | null;
}

export interface CreateFromRedditRequest {
  url?: string | null;
  title?: string | null;
  body?: string | null;
  comments?: string[];
  language?: string;
  topic?: string | null;
}

export interface PlanRequest {
  target_duration_sec?: number | null;
  global_visual_style?: string | null;
}

export interface MediaSearchRequest {
  orientation?: string | null;
  prefer_local?: boolean;
}

export interface TimelineBuildRequest {
  title?: string | null;
  narration_audio_path?: string | null;
  subtitle_path?: string | null;
}

export type EditCommandType = "move" | "trim" | "replace" | "set_timing" | "set_volume";

export interface LicenseInfo {
  type?: string | null;
  commercial_use?: boolean | null;
  attribution_required?: boolean | null;
  source_url?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  usage_notes?: string | null;
  source_terms_url?: string | null;
  training_restricted?: boolean | null;
  redistribution_restricted?: boolean | null;
  unknown_or_provider_specific?: boolean;
}

export interface MediaCandidate {
  id: string;
  provider: string;
  source_url?: string | null;
  download_url?: string | null;
  local_path?: string | null;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  duration_sec?: number | null;
  fps?: number | null;
  query?: string | null;
  title?: string | null;
  tags?: string[];
  license?: LicenseInfo | null;
  score?: number | null;
  score_reasons?: string[];
  segment_id?: string | null;
}

export interface MoveClipCommand {
  type: "move";
  track_id: string;
  item_id: string;
  new_start_sec: number;
}

export interface TrimClipCommand {
  type: "trim";
  track_id: string;
  item_id: string;
  trim_start_sec?: number;
  trim_end_sec?: number | null;
}

export interface ReplaceClipCommand {
  type: "replace";
  track_id: string;
  item_id: string;
  new_candidate: MediaCandidate;
}

export interface SetClipTimingCommand {
  type: "set_timing";
  track_id: string;
  item_id: string;
  duration_sec: number;
}

export interface SetClipVolumeCommand {
  type: "set_volume";
  track_id: string;
  item_id: string;
  volume: number;
}

export type EditCommand =
  | MoveClipCommand
  | TrimClipCommand
  | ReplaceClipCommand
  | SetClipTimingCommand
  | SetClipVolumeCommand;

export interface TimelineCommandsRequest {
  commands: EditCommand[];
}

export interface MusicSelectRequest {
  mood?: string | null;
  energy?: string | null;
  tempo?: string | null;
  style?: string | null;
  avoid?: string[];
  commercial_safe_only?: boolean;
  local_only?: boolean;
  volume?: number;
}

export interface RenderRequest {
  renderer?: "moviepy" | "opencut" | null;
  include_subtitles?: boolean;
  include_background_music?: boolean;
  subtitle_style?: string | null;
  font_name?: string | null;
}

// Domain models
export interface TimelineItem {
  id: string;
  media_id?: string | null;
  local_path?: string | null;
  start_sec: number;
  duration_sec: number;
  trim_start_sec?: number;
  trim_end_sec?: number | null;
  segment_id?: string | null;
  provider?: string | null;
  transition_in?: string | null;
  transition_out?: string | null;
  volume?: number | null;
}

export type TrackType = "video" | "audio" | "subtitle" | "overlay";

export interface TimelineTrack {
  id: string;
  type: TrackType;
  name: string;
  items: TimelineItem[];
}

export interface ExportSettings {
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  audio_codec?: string;
}

export interface MusicIntent {
  mood: string;
  energy: string;
  tempo?: string | null;
  style?: string | null;
  avoid?: string[];
  commercial_use_required?: boolean;
}

export interface ShotSegment {
  id: string;
  order: number;
  narration_text: string;
  start_sec?: number | null;
  end_sec?: number | null;
  target_duration_sec: number;
  visual_goal: string;
  search_queries: string[];
  fallback_queries?: string[];
  preferred_providers?: string[];
  must_avoid?: string[];
  mood?: string | null;
  pacing?: string | null;
}

export interface ShotPlan {
  schema_version?: string;
  task_id?: string | null;
  language: string;
  topic?: string | null;
  script: string;
  total_duration_sec?: number | null;
  segments: ShotSegment[];
  global_visual_style?: string | null;
  music_intent?: MusicIntent | null;
}

export interface TimelineProject {
  schema_version?: string;
  project_id: string;
  task_id?: string | null;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
  script?: string | null;
  shot_plan?: ShotPlan | null;
  tracks: TimelineTrack[];
  export?: ExportSettings;
  metadata?: Record<string, unknown>;
}

export interface MusicTrack {
  id: string;
  provider: string;
  local_path?: string | null;
  url?: string | null;
  title?: string | null;
  tags?: string[];
  duration_sec?: number | null;
  license?: LicenseInfo | null;
  volume?: number | null;
  score?: number | null;
  score_reasons?: string[];
}

export interface ProjectAsset {
  asset_id: string;
  path: string;
}

// Response shapes
export interface CreateProjectResponse {
  project_id: string;
  has_script: boolean;
  source_kind?: string;
}

export interface GetProjectResponse {
  project_id: string;
  has_script: boolean;
  has_shot_plan: boolean;
  has_selected_media: boolean;
  has_timeline: boolean;
  script?: string | null;
  shot_plan?: ShotPlan | null;
  timeline?: TimelineProject | null;
  media_candidates?: MediaCandidate[];
  selected_media?: MediaCandidate[];
  selected_music?: MusicTrack[];
  preview_assets?: ProjectAsset[];
}

export interface PlanProjectResponse {
  project_id: string;
  segment_count: number;
}

export interface MediaSearchResponse {
  project_id: string;
  selected_count: number;
}

export interface TimelineBuildResponse {
  project_id: string;
  track_count: number;
}

export interface TimelineCommandsResponse {
  project_id: string;
  applied: number;
  valid?: boolean;
  errors?: string[];
}

export interface TimelineValidateResponse {
  project_id: string;
  valid: boolean;
  errors?: string[];
}

export interface MusicSelectResponse {
  project_id: string;
  selected?: MusicTrack | null;
  selected_count: number;
}

export interface MusicGetResponse {
  project_id: string;
  tracks: MusicTrack[];
}

export interface ReplaceTimelineResponse {
  project_id: string;
}

export interface RenderStartResponse {
  project_id: string;
  state: number;
}

export interface RenderStatusResponse {
  task_id: string;
  state: number;
  progress: number;
  output_path?: string | null;
  error?: string | null;
}

export interface ListAssetsResponse {
  project_id: string;
  assets: string[];
  preview_assets: ProjectAsset[];
}
