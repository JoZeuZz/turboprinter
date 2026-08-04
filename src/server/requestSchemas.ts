// Boundary validation for the two mass-assignment endpoints that merge a
// request body onto live server state with a plain object spread:
// `PUT /api/v1/config` and `PUT /api/v1/projects/:id`. This is
// defense-in-depth alongside the containment checks in pathSafety.ts — even
// a future call site that forgets to re-check a value stays safe if the
// value could never have been attacker-controlled in the first place.
//
// Field lists below were derived from a survey of src/api/projects.ts,
// src/api/config.ts and src/api/types.ts (TimelineProject/EditableConfig)
// plus the actual call sites of projectsApi.replaceTimeline (ScriptPanel.tsx,
// VideoConfigPanel.tsx, useProjectStore.ts) — the frontend spreads the
// project object the server last returned and layers a partial override on
// top, and two call sites (ScriptPanel.tsx) send `topic`/`language` cast
// `as any` since those two fields are stored server-side (see server.ts's
// `p.topic`/`p.language` usage) but are missing from the frontend's
// TimelineProject type. Both are included below so real UI flows keep
// working.
import { z } from "zod";

// A source_url/asset_url/narration_audio_path is either a same-origin
// relative path (starting with "/") or an http(s) URL — never a bare
// traversal string or a non-http(s) scheme (e.g. file://). This mirrors the
// contract render.ts already assumes (see its narration_audio_path
// handling: `startsWith("/") || !includes("://")` is treated as local).
// This does not replace the containment checks in render.ts/pathSafety.ts —
// it's an earlier, cheaper rejection of obviously malformed values.
const mediaUrlSchema = z.string().refine(
  (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
  { message: "must be a relative path or an http(s) URL" }
);

// Anything not spelled out below (thumbnail_url, provider, transition_*,
// text, keywords, ...) is cosmetic/informational and not used server-side
// to build a filesystem path or shell argument, so it stays loosely typed.
export const timelineItemSchema = z.object({
  id: z.string(),
  media_id: z.string().nullable().optional(),
  local_path: z.string().nullable().optional(),
  asset_url: mediaUrlSchema.nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  source_url: mediaUrlSchema.nullable().optional(),
  start_sec: z.number().optional(),
  duration_sec: z.number().optional(),
  end_sec: z.number().nullable().optional(),
  trim_start_sec: z.number().optional(),
  trim_end_sec: z.number().nullable().optional(),
  segment_id: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  transition_in: z.string().nullable().optional(),
  transition_out: z.string().nullable().optional(),
  volume: z.number().nullable().optional(),
  text: z.string().nullable().optional(),
  keywords: z.array(z.string()).optional(),
  part_index: z.number().optional(),
}).passthrough();

export const timelineTrackSchema = z.object({
  id: z.string(),
  type: z.enum(["video", "audio", "subtitle", "overlay"]).optional(),
  name: z.string().optional(),
  items: z.array(timelineItemSchema).optional(),
}).passthrough();

// `shot_plan`, `export` and `metadata` are informational/derived data with
// no filesystem or shell involvement server-side; kept loose rather than
// fully typed (ShotPlan alone has nested segments/music intent that evolve
// independently of this endpoint's security surface).
// `params` is VideoParams — the largest, least-stable part of the project
// shape (video configuration options). Per this plan's maintenance notes,
// kept as an open record rather than fully enumerated: that still stops the
// top-level type-confusion class of bug (e.g. `params` replaced with a
// string) without blocking on typing every nested key.
export const projectPatchSchema = z.object({
  schema_version: z.string().optional(),
  task_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  // Not part of the frontend's TimelineProject type, but legitimately sent
  // (cast `as any`) by ScriptPanel.tsx and read/written server-side as
  // `p.topic`/`p.language`.
  topic: z.string().optional(),
  language: z.string().optional(),
  script: z.string().nullable().optional(),
  shot_plan: z.object({}).passthrough().nullable().optional(),
  tracks: z.array(timelineTrackSchema).optional(),
  export: z.object({}).passthrough().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  narration_audio_path: mediaUrlSchema.nullable().optional(),
}).passthrough();

// Each top-level settings group below is validated only enough to reject
// the type-confusion case cited in the plan (e.g. `youtube` replaced with a
// string instead of an object) while staying permissive about which keys
// exist inside a group, since EditableConfig's non-credential groups
// (app/whisper/azure/siliconflow/ui/quality) evolve independently of this
// endpoint's security surface. `youtube`/`tiktok` carry credential fields,
// so their known keys are spelled out explicitly.
const looseSettingsGroup = () => z.object({}).passthrough();

export const youtubeSettingsSchema = z.object({
  api_key: z.string().optional(),
  channel_name: z.string().optional(),
  is_linked: z.boolean().optional(),
  client_id: z.string().optional(),
}).passthrough();

export const tiktokSettingsSchema = z.object({
  client_id: z.string().optional(),
  client_key: z.string().optional(),
  client_secret: z.string().optional(),
  is_linked: z.boolean().optional(),
  account_name: z.string().optional(),
  channel_name: z.string().optional(),
  verification_filename: z.string().optional(),
  verification_content: z.string().optional(),
}).passthrough();

export const configPatchSchema = z.object({
  app: looseSettingsGroup().optional(),
  whisper: looseSettingsGroup().optional(),
  azure: looseSettingsGroup().optional(),
  siliconflow: looseSettingsGroup().optional(),
  ui: looseSettingsGroup().optional(),
  quality: looseSettingsGroup().optional(),
  youtube: youtubeSettingsSchema.optional(),
  tiktok: tiktokSettingsSchema.optional(),
}).passthrough();
