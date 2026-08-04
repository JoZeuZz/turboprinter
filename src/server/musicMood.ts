// Mood-based BGM selection for the "select music automatically" project flow
// (POST /projects/:id/music/select). Classifies the script's tone with the
// existing LLM helper, then matches it against local files in
// PUBLIC_MUSICS_DIR by a filename convention: "<mood>_*.ext" (e.g.
// "upbeat_synthwave.mp3"). Falls back to any available file, or to nothing,
// so a render is never blocked on this step.
import path from "path";
import { generateLlmContent } from "./llm";

export const MOOD_TAGS = ["upbeat", "tense", "calm", "dramatic", "neutral"] as const;
export type MoodTag = typeof MOOD_TAGS[number];

/** Minimal shape this module needs from a getBgmFiles() entry. */
export interface BgmLibraryFile {
  file: string;
  name: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Classifies a script into one of MOOD_TAGS using the project's configured
 * LLM (src/server/llm.ts, provider-agnostic per LLM_PROVIDER). Any failure
 * (network, unexpected output) falls back to "neutral" so BGM selection
 * never blocks a render.
 */
export async function classifyScriptMood(script: string): Promise<MoodTag> {
  try {
    const prompt = `Clasifica el tono de este guion de video corto en EXACTAMENTE una de estas palabras: ${MOOD_TAGS.join(", ")}. Responde solo con la palabra, sin explicación.\n\nGuion:\n${script.slice(0, 2000)}`;
    const result = await generateLlmContent(prompt);
    const tag = result.trim().toLowerCase();
    return (MOOD_TAGS as readonly string[]).includes(tag) ? (tag as MoodTag) : "neutral";
  } catch (err) {
    console.warn("[Music] Mood classification failed, defaulting to neutral:", err);
    return "neutral";
  }
}

/**
 * Picks a local BGM file for a mood tag. Prefers a filename-prefix match
 * ("upbeat_*.mp3" for "upbeat"); falls back to a random file from the
 * library when no file matches the tag; returns null when the library is
 * empty.
 */
export function pickBgmForMood(files: BgmLibraryFile[], mood: MoodTag): BgmLibraryFile | null {
  const matched = files.find(f => path.basename(f.file).toLowerCase().startsWith(mood + "_"));
  if (matched) return matched;
  if (files.length > 0) return files[Math.floor(Math.random() * files.length)];
  return null;
}
