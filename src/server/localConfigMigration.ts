import fs from "fs";
import path from "path";

export interface MigrationResult {
  migrated: string[];
  preserved: string[];
  conflicts: string[];
  envChanged: boolean;
  tomlChanged: boolean;
}

export interface MigrationOptions {
  envPath: string;
  tomlPath: string;
  apply: boolean;
}

const SECRET_MAPPINGS: Record<string, string> = {
  "app.groq_api_key": "GROQ_API_KEY",
  "app.gemini_api_key": "GEMINI_API_KEY",
  "app.deepseek_api_key": "DEEPSEEK_API_KEY",
  "app.mimo_api_key": "MIMO_API_KEY",
  "app.redis_password": "REDIS_PASSWORD",
  "azure.speech_key": "AZURE_SPEECH_KEY",
  "siliconflow.api_key": "SILICONFLOW_API_KEY",
};

const SECRET_LIST_MAPPINGS: Record<string, string> = {
  "app.pexels_api_keys": "PEXELS_API_KEYS",
  "app.pixabay_api_keys": "PIXABAY_API_KEYS",
  "app.coverr_api_keys": "COVERR_API_KEYS",
};

const NON_SECRET_LLM_MAPPINGS: Record<string, string> = {
  "app.groq_base_url": "GROQ_BASE_URL",
  "app.groq_model_name": "GROQ_MODEL",
  "app.gemini_model_name": "GEMINI_MODEL",
  "app.deepseek_base_url": "DEEPSEEK_BASE_URL",
  "app.deepseek_model_name": "DEEPSEEK_MODEL",
  "app.llm_request_timeout_seconds": "LLM_REQUEST_TIMEOUT_SECONDS",
};

interface TomlAssignment {
  index: number;
  key: string;
  fullKey: string;
  prefix: string;
  value: string;
  comment: string;
}

const stripOuterQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const splitValueAndComment = (value: string): [string, string] => {
  let quote = "";
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    } else if (char === "#" && !quote) {
      return [value.slice(0, index).trimEnd(), value.slice(index).trim()];
    }
  }
  return [value.trimEnd(), ""];
};

const parseTomlAssignments = (lines: string[]): Map<string, TomlAssignment> => {
  const assignments = new Map<string, TomlAssignment>();
  let section = "";

  lines.forEach((line, index) => {
    const sectionMatch = line.trim().match(/^\[([^\]]+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      return;
    }

    const match = line.match(/^(\s*)([A-Za-z_][\w-]*)(\s*=\s*)(.*)$/);
    if (!match) return;
    const [, indent, key, separator, rawValue] = match;
    const [value, comment] = splitValueAndComment(rawValue);
    const fullKey = section ? `${section}.${key}` : key;
    assignments.set(fullKey, {
      index,
      key,
      fullKey,
      prefix: `${indent}${key}${separator}`,
      value,
      comment,
    });
  });
  return assignments;
};

const parseTomlArray = (value: string): string[] => {
  const entries: string[] = [];
  for (const match of value.matchAll(/["']([^"']*)["']/g)) {
    if (match[1]) entries.push(match[1]);
  }
  return entries;
};

const parseEnv = (content: string): Map<string, { index: number; value: string }> => {
  const entries = new Map<string, { index: number; value: string }>();
  content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator < 1) return;
    const key = trimmed.slice(0, separator).trim();
    entries.set(key, {
      index,
      value: stripOuterQuotes(trimmed.slice(separator + 1)),
    });
  });
  return entries;
};

const replaceTomlValue = (
  lines: string[],
  assignment: TomlAssignment,
  value: string
): void => {
  lines[assignment.index] = `${assignment.prefix}${value}${assignment.comment ? ` ${assignment.comment}` : ""}`;
};

const writeAtomic = (filePath: string, content: string, mode: number): string => {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode });
  fs.chmodSync(temporaryPath, mode);
  return temporaryPath;
};

export const migrateLocalConfig = ({
  envPath,
  tomlPath,
  apply,
}: MigrationOptions): MigrationResult => {
  const originalEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const originalToml = fs.readFileSync(tomlPath, "utf8");
  const envLines = originalEnv.split(/\r?\n/);
  const tomlLines = originalToml.split(/\r?\n/);
  const envEntries = parseEnv(originalEnv);
  const tomlAssignments = parseTomlAssignments(tomlLines);
  const migrated = new Set<string>();
  const preserved = new Set<string>();
  const conflicts = new Set<string>();

  const setEnv = (key: string, value: string, detectConflict: boolean): void => {
    if (!value) return;
    const current = envEntries.get(key);
    if (current?.value) {
      if (detectConflict && current.value !== value) conflicts.add(key);
      else preserved.add(key);
      return;
    }

    if (current) {
      envLines[current.index] = `${key}=${value}`;
      current.value = value;
    } else {
      if (envLines.length === 1 && envLines[0] === "") envLines.length = 0;
      envLines.push(`${key}=${value}`);
      envEntries.set(key, { index: envLines.length - 1, value });
    }
    migrated.add(key);
  };

  for (const [fullKey, envKey] of Object.entries(SECRET_MAPPINGS)) {
    const assignment = tomlAssignments.get(fullKey);
    if (!assignment) continue;
    const value = stripOuterQuotes(assignment.value);
    if (value) {
      setEnv(envKey, value, true);
      replaceTomlValue(tomlLines, assignment, '""');
    }
  }

  for (const [fullKey, envKey] of Object.entries(SECRET_LIST_MAPPINGS)) {
    const assignment = tomlAssignments.get(fullKey);
    if (!assignment) continue;
    const values = parseTomlArray(assignment.value);
    if (values.length > 0) {
      setEnv(envKey, values.join(","), true);
      if (fullKey === "app.pexels_api_keys" && !envEntries.get("PEXELS_API_KEY")?.value) {
        setEnv("PEXELS_API_KEY", values[0], false);
      }
      replaceTomlValue(tomlLines, assignment, "[]");
    }
  }

  for (const [fullKey, envKey] of Object.entries(NON_SECRET_LLM_MAPPINGS)) {
    const assignment = tomlAssignments.get(fullKey);
    if (!assignment) continue;
    setEnv(envKey, stripOuterQuotes(assignment.value), false);
  }

  setEnv("LLM_PROVIDER", "groq", false);
  setEnv("LLM_FALLBACK_PROVIDERS", "gemini,deepseek", false);
  if (!envEntries.get("LLM_REQUEST_TIMEOUT_SECONDS")?.value) {
    setEnv("LLM_REQUEST_TIMEOUT_SECONDS", "120", false);
  }

  const providerAssignment = tomlAssignments.get("app.llm_provider");
  if (providerAssignment) replaceTomlValue(tomlLines, providerAssignment, '"groq"');
  const fallbackAssignment = tomlAssignments.get("app.llm_fallback_providers");
  if (fallbackAssignment) {
    replaceTomlValue(tomlLines, fallbackAssignment, '["gemini", "deepseek"]');
  }

  const marker = "# TypeScript runtime consumes LLM settings from .env; legacy non-secret options remain for reference.";
  if (!tomlLines.includes(marker)) {
    const appSection = tomlLines.findIndex((line) => line.trim() === "[app]");
    tomlLines.splice(appSection >= 0 ? appSection : 0, 0, marker);
  }

  const candidateEnv = `${envLines.join("\n").replace(/\n+$/, "")}\n`;
  const candidateToml = `${tomlLines.join("\n").replace(/\n+$/, "")}\n`;
  const result: MigrationResult = {
    migrated: [...migrated].sort(),
    preserved: [...preserved].sort(),
    conflicts: [...conflicts].sort(),
    envChanged: candidateEnv !== originalEnv,
    tomlChanged: candidateToml !== originalToml,
  };

  if (!apply || result.conflicts.length > 0) return result;

  const envMode = 0o600;
  const tomlMode = fs.statSync(tomlPath).mode & 0o777;
  let envTemporary = "";
  let tomlTemporary = "";
  let envRenamed = false;
  let tomlRenamed = false;
  try {
    if (result.envChanged) envTemporary = writeAtomic(envPath, candidateEnv, envMode);
    if (result.tomlChanged) tomlTemporary = writeAtomic(tomlPath, candidateToml, tomlMode);
    if (envTemporary) {
      fs.renameSync(envTemporary, envPath);
      envRenamed = true;
      envTemporary = "";
    }
    if (tomlTemporary) {
      fs.renameSync(tomlTemporary, tomlPath);
      tomlRenamed = true;
      tomlTemporary = "";
    }
  } catch (error) {
    if (envRenamed) {
      const restore = writeAtomic(envPath, originalEnv, envMode);
      fs.renameSync(restore, envPath);
    }
    if (tomlRenamed) {
      const restore = writeAtomic(tomlPath, originalToml, tomlMode);
      fs.renameSync(restore, tomlPath);
    }
    throw error;
  } finally {
    if (envTemporary && fs.existsSync(envTemporary)) fs.unlinkSync(envTemporary);
    if (tomlTemporary && fs.existsSync(tomlTemporary)) fs.unlinkSync(tomlTemporary);
  }

  return result;
};
