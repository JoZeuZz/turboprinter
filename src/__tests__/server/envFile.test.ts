import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { updateEnvFile } from "../../server/envFile";

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
