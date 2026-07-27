// Backend-only helper: replace secret values in the config object with a
// sentinel before it crosses the HTTP boundary, and ignore the sentinel when
// it comes back in on a write. The client only PUTs fields the user actually
// edited (see changedSettings in src/pages/Settings.tsx), so an untouched
// secret is never sent back and the server keeps its stored value.

export const SECRET_SENTINEL = "__SAVED__";

/**
 * Dotted paths into the config `settings` object whose values are credentials.
 * Values at these paths are replaced with SECRET_SENTINEL on read and ignored
 * on write when they equal the sentinel.
 */
export const SECRET_PATHS: readonly string[] = [
  "youtube.api_key", // holds YOUTUBE_CLIENT_SECRET despite the name
  "tiktok.client_secret",
  "app.gemini_api_key",
  "app.pexels_api_keys", // array
  "app.pixabay_api_keys", // array
  "app.coverr_api_keys", // array
  "app.upload_post_api_key",
  "siliconflow.api_key",
];

type PlainRecord = Record<string, unknown>;

const isPlainRecord = (value: unknown): value is PlainRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const getAtPath = (obj: PlainRecord, dottedPath: string): unknown => {
  const segments = dottedPath.split(".");
  let current: unknown = obj;
  for (const segment of segments) {
    if (!isPlainRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
};

const setAtPath = (obj: PlainRecord, dottedPath: string, value: unknown): void => {
  const segments = dottedPath.split(".");
  let current: PlainRecord = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const next = current[segments[i]];
    if (!isPlainRecord(next)) return;
    current = next;
  }
  current[segments[segments.length - 1]] = value;
};

const deleteAtPath = (obj: PlainRecord, dottedPath: string): void => {
  const segments = dottedPath.split(".");
  let current: PlainRecord = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const next = current[segments[i]];
    if (!isPlainRecord(next)) return;
    current = next;
  }
  delete current[segments[segments.length - 1]];
};

/** Deep-clones `settings` and replaces every populated secret with the sentinel. */
export const maskSecrets = <T>(settings: T): T => {
  const clone = deepClone(settings);
  if (!isPlainRecord(clone)) return clone;
  for (const path of SECRET_PATHS) {
    const value = getAtPath(clone, path);
    if (typeof value === "string" && value.length > 0) {
      setAtPath(clone, path, SECRET_SENTINEL);
    } else if (Array.isArray(value) && value.length > 0) {
      setAtPath(clone, path, [SECRET_SENTINEL]);
    }
  }
  return clone;
};

/** Strips any secret field whose incoming value is the sentinel. */
export const stripSentinelSecrets = <T>(body: T): T => {
  const clone = deepClone(body);
  if (!isPlainRecord(clone)) return clone;
  for (const path of SECRET_PATHS) {
    const value = getAtPath(clone, path);
    const isSentinelString = value === SECRET_SENTINEL;
    const isSentinelArray =
      Array.isArray(value) && value.length === 1 && value[0] === SECRET_SENTINEL;
    if (isSentinelString || isSentinelArray) {
      deleteAtPath(clone, path);
    }
  }
  return clone;
};
