// Containment helpers for anything a request body can influence before it
// becomes a filesystem path or a shell argument. Pure: path arithmetic only,
// no I/O — callers do their own fs checks after the value is accepted.
//
// The contracts here mirror what the server itself produces:
//   - media filenames are basenames of files in storage/local_videos/
//   - project_folder_name is "<theme>/<name>" as emitted by sanitizeFolderName
import path from "path";

/** Video containers the local library accepts. Mirrors the filter used in
 *  src/server/render.ts when listing storage/local_videos. */
export const MEDIA_EXTENSIONS = [".mp4", ".mkv", ".avi", ".mov", ".webm"];

/**
 * True when `name` is a bare filename safe to join onto a media directory:
 * no directory separators, no traversal, no NUL, and a known video extension.
 */
export function isSafeMediaFilename(name: unknown): name is string {
  if (typeof name !== "string") return false;
  if (name.length === 0 || name.length > 255) return false;
  if (name.includes("\0")) return false;
  if (name !== path.basename(name)) return false;
  if (name === "." || name === "..") return false;
  return MEDIA_EXTENSIONS.includes(path.extname(name).toLowerCase());
}

/**
 * Resolves `candidate` (absolute or relative to `baseDir`) and returns the
 * absolute path only if it stays inside `baseDir`. Returns null otherwise.
 * Unlike path.join, traversal segments are rejected rather than normalized
 * away silently.
 */
export function resolveWithinDir(baseDir: string, candidate: unknown): string | null {
  if (typeof candidate !== "string" || candidate.length === 0) return null;
  if (candidate.includes("\0")) return null;
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, candidate);
  if (resolved === base) return resolved;
  return resolved.startsWith(base + path.sep) ? resolved : null;
}

/**
 * True when `name` has the exact shape this server generates for a proyecto's
 * folder: two "/"-separated segments of [a-z0-9_], each 1..40 characters.
 * See sanitizeFolderName in server.ts.
 */
export function isSafeProjectFolderName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const segments = name.split("/");
  if (segments.length !== 2) return false;
  return segments.every((segment) => /^[a-z0-9_]{1,40}$/.test(segment));
}
