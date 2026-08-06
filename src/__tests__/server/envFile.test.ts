import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { updateEnvFile } from "../../server/envFile";
import * as envFileModule from "../../server/envFile";

let dir: string;
let envPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "envfile-"));
  envPath = path.join(dir, ".env");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.TEST_ENVFILE_KEY;
  delete process.env.TEST_ENVFILE_OTHER;
});

describe("updateEnvFile", () => {
  it("creates the file with the given keys when it does not exist", () => {
    updateEnvFile({ TEST_ENVFILE_KEY: "abc" }, envPath);
    expect(fs.readFileSync(envPath, "utf-8")).toContain("TEST_ENVFILE_KEY=abc");
  });

  it("replaces an existing key in place and keeps other lines", () => {
    fs.writeFileSync(envPath, "OTHER=1\nTEST_ENVFILE_KEY=old\n# comment", "utf-8");
    updateEnvFile({ TEST_ENVFILE_KEY: "new" }, envPath);
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).toContain("OTHER=1");
    expect(content).toContain("TEST_ENVFILE_KEY=new");
    expect(content).toContain("# comment");
    expect(content).not.toContain("old");
  });

  it("appends keys that are not present", () => {
    fs.writeFileSync(envPath, "OTHER=1", "utf-8");
    updateEnvFile({ TEST_ENVFILE_KEY: "x", TEST_ENVFILE_OTHER: "y" }, envPath);
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).toContain("TEST_ENVFILE_KEY=x");
    expect(content).toContain("TEST_ENVFILE_OTHER=y");
  });

  it("updates process.env for every written key", () => {
    updateEnvFile({ TEST_ENVFILE_KEY: "runtime" }, envPath);
    expect(process.env.TEST_ENVFILE_KEY).toBe("runtime");
  });
});

describe("loadEnvFile", () => {
  it("loads a file value when the process variable is absent", () => {
    fs.writeFileSync(envPath, "TEST_ENVFILE_KEY=file-value\n", "utf-8");
    const loadEnvFile = (envFileModule as typeof envFileModule & {
      loadEnvFile?: (filePath: string) => void;
    }).loadEnvFile;

    expect(loadEnvFile).toBeTypeOf("function");
    loadEnvFile?.(envPath);

    expect(process.env.TEST_ENVFILE_KEY).toBe("file-value");
  });

  it("does not overwrite a variable already present in the process", () => {
    fs.writeFileSync(envPath, "TEST_ENVFILE_KEY=file-value\n", "utf-8");
    process.env.TEST_ENVFILE_KEY = "process-value";
    const loadEnvFile = (envFileModule as typeof envFileModule & {
      loadEnvFile?: (filePath: string) => void;
    }).loadEnvFile;

    expect(loadEnvFile).toBeTypeOf("function");
    loadEnvFile?.(envPath);

    expect(process.env.TEST_ENVFILE_KEY).toBe("process-value");
  });
});

describe("LLM environment mapping", () => {
  it("returns Groq, Gemini, and DeepSeek defaults", () => {
    const readLlmSettings = (envFileModule as typeof envFileModule & {
      readLlmSettings?: (env: NodeJS.ProcessEnv) => Record<string, unknown>;
    }).readLlmSettings;
    expect(readLlmSettings).toBeTypeOf("function");

    expect(readLlmSettings?.({})).toMatchObject({
      llm_provider: "groq",
      llm_fallback_providers: ["gemini", "deepseek"],
      llm_request_timeout_seconds: 120,
      groq_model_name: "llama-3.3-70b-versatile",
      gemini_model_name: "gemini-3.1-flash-lite",
      deepseek_model_name: "deepseek-chat",
    });
  });

  it("preserves an explicitly empty fallback list", () => {
    const readLlmSettings = (envFileModule as typeof envFileModule & {
      readLlmSettings?: (env: NodeJS.ProcessEnv) => Record<string, unknown>;
    }).readLlmSettings;
    expect(readLlmSettings?.({ LLM_FALLBACK_PROVIDERS: "" }).llm_fallback_providers).toEqual([]);
  });

  it("maps only supported app patch fields to environment variables", () => {
    const llmEnvUpdatesFromAppPatch = (envFileModule as typeof envFileModule & {
      llmEnvUpdatesFromAppPatch?: (patch: Record<string, unknown>) => Record<string, string>;
    }).llmEnvUpdatesFromAppPatch;
    expect(llmEnvUpdatesFromAppPatch).toBeTypeOf("function");

    expect(llmEnvUpdatesFromAppPatch?.({
      llm_provider: "groq",
      llm_fallback_providers: ["gemini", "deepseek"],
      groq_api_key: "fake-groq",
      deepseek_model_name: "deepseek-model",
      unrelated: "ignored",
    })).toEqual({
      LLM_PROVIDER: "groq",
      LLM_FALLBACK_PROVIDERS: "gemini,deepseek",
      GROQ_API_KEY: "fake-groq",
      DEEPSEEK_MODEL: "deepseek-model",
    });
  });
});
