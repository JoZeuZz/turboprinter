import fs from "fs";
import os from "os";
import path from "path";

interface MigrationResult {
  migrated: string[];
  preserved: string[];
  conflicts: string[];
  envChanged: boolean;
  tomlChanged: boolean;
}

type MigrateLocalConfig = (options: {
  envPath: string;
  tomlPath: string;
  apply: boolean;
}) => MigrationResult;

const loadMigrateLocalConfig = async (): Promise<MigrateLocalConfig | undefined> => {
  const modulePath = "../../server/localConfigMigration";
  try {
    const module = await import(/* @vite-ignore */ modulePath) as {
      migrateLocalConfig?: MigrateLocalConfig;
    };
    return module.migrateLocalConfig;
  } catch {
    return undefined;
  }
};

let dir: string;
let envPath: string;
let tomlPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "local-config-migration-"));
  envPath = path.join(dir, ".env");
  tomlPath = path.join(dir, "config.toml");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("migrateLocalConfig", () => {
  it("moves secrets to env, preserves all Pexels keys, and clears TOML", async () => {
    fs.writeFileSync(envPath, "GEMINI_API_KEY=fake-existing\nUNRELATED=keep-me\n");
    fs.writeFileSync(tomlPath, [
      "[app]",
      'llm_provider = "gemini"',
      'llm_fallback_providers = ["deepseek", "gemini"]',
      'llm_request_timeout_seconds = 90',
      'pexels_api_keys = ["fake-pexels-one", "fake-pexels-two"]',
      'groq_api_key = "fake-groq"',
      'groq_base_url = "https://groq.invalid/v1"',
      'groq_model_name = "groq-model"',
      'gemini_api_key = "fake-existing"',
      'gemini_model_name = "gemini-model"',
      'deepseek_api_key = "fake-deepseek"',
      'deepseek_base_url = "https://deepseek.invalid"',
      'deepseek_model_name = "deepseek-model"',
      'redis_password = "fake-redis"',
      "[azure]",
      'speech_key = "fake-azure"',
      "[siliconflow]",
      'api_key = "fake-siliconflow"',
    ].join("\n"));
    const migrateLocalConfig = await loadMigrateLocalConfig();
    expect(migrateLocalConfig).toBeTypeOf("function");

    const result = migrateLocalConfig?.({ envPath, tomlPath, apply: true });

    expect(result?.conflicts).toEqual([]);
    expect(result?.migrated).toEqual(expect.arrayContaining([
      "GROQ_API_KEY",
      "DEEPSEEK_API_KEY",
      "AZURE_SPEECH_KEY",
      "SILICONFLOW_API_KEY",
      "PEXELS_API_KEYS",
    ]));
    expect(JSON.stringify(result)).not.toContain("fake-");

    const env = fs.readFileSync(envPath, "utf8");
    expect(env).toContain("UNRELATED=keep-me");
    expect(env).toContain("LLM_PROVIDER=groq");
    expect(env).toContain("LLM_FALLBACK_PROVIDERS=gemini,deepseek");
    expect(env).toContain("LLM_REQUEST_TIMEOUT_SECONDS=90");
    expect(env).toContain("GROQ_API_KEY=fake-groq");
    expect(env).toContain("DEEPSEEK_API_KEY=fake-deepseek");
    expect(env).toContain("PEXELS_API_KEY=fake-pexels-one");
    expect(env).toContain("PEXELS_API_KEYS=fake-pexels-one,fake-pexels-two");

    const toml = fs.readFileSync(tomlPath, "utf8");
    expect(toml).toContain('llm_provider = "groq"');
    expect(toml).toContain('llm_fallback_providers = ["gemini", "deepseek"]');
    expect(toml).toContain('groq_api_key = ""');
    expect(toml).toContain('deepseek_api_key = ""');
    expect(toml).toContain("pexels_api_keys = []");
    expect(fs.statSync(envPath).mode & 0o777).toBe(0o600);
  });

  it("reports conflicts and writes neither file", async () => {
    fs.writeFileSync(envPath, "GROQ_API_KEY=fake-env\n");
    fs.writeFileSync(tomlPath, '[app]\ngroq_api_key = "fake-toml"\n');
    const beforeEnv = fs.readFileSync(envPath, "utf8");
    const beforeToml = fs.readFileSync(tomlPath, "utf8");
    const migrateLocalConfig = await loadMigrateLocalConfig();
    expect(migrateLocalConfig).toBeTypeOf("function");

    const result = migrateLocalConfig?.({ envPath, tomlPath, apply: true });

    expect(result?.conflicts).toEqual(["GROQ_API_KEY"]);
    expect(JSON.stringify(result)).not.toContain("fake-");
    expect(fs.readFileSync(envPath, "utf8")).toBe(beforeEnv);
    expect(fs.readFileSync(tomlPath, "utf8")).toBe(beforeToml);
  });

  it("check mode reports changes without writing files", async () => {
    fs.writeFileSync(envPath, "");
    fs.writeFileSync(tomlPath, '[app]\ndeepseek_api_key = "fake-deepseek"\n');
    const beforeEnv = fs.readFileSync(envPath, "utf8");
    const beforeToml = fs.readFileSync(tomlPath, "utf8");
    const migrateLocalConfig = await loadMigrateLocalConfig();
    expect(migrateLocalConfig).toBeTypeOf("function");

    const result = migrateLocalConfig?.({ envPath, tomlPath, apply: false });

    expect(result).toMatchObject({ envChanged: true, tomlChanged: true, conflicts: [] });
    expect(JSON.stringify(result)).not.toContain("fake-deepseek");
    expect(fs.readFileSync(envPath, "utf8")).toBe(beforeEnv);
    expect(fs.readFileSync(tomlPath, "utf8")).toBe(beforeToml);
  });
});
