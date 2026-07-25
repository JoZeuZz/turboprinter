import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProjectsRepo, projectsDbPath } from "../../server/projectsRepo";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "projects-repo-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createProjectsRepo", () => {
  it("starts empty when no db file exists", () => {
    const repo = createProjectsRepo(tmpDir);
    expect(repo.size).toBe(0);
    expect(repo.get("p1")).toBeUndefined();
  });

  it("set persists explicitly: a fresh repo over the same dir reads the project back", () => {
    const repo = createProjectsRepo(tmpDir);
    repo.set("p1", { project_id: "p1", topic: "gatos" });

    expect(fs.existsSync(projectsDbPath(tmpDir))).toBe(true);

    const reopened = createProjectsRepo(tmpDir);
    expect(reopened.get("p1")).toEqual({ project_id: "p1", topic: "gatos" });
  });

  it("delete removes the project and persists the removal", () => {
    const repo = createProjectsRepo(tmpDir);
    repo.set("p1", { project_id: "p1" });
    repo.set("p2", { project_id: "p2" });

    expect(repo.delete("p1")).toBe(true);
    expect(repo.delete("missing")).toBe(false);

    const reopened = createProjectsRepo(tmpDir);
    expect(reopened.get("p1")).toBeUndefined();
    expect(reopened.get("p2")).toEqual({ project_id: "p2" });
  });

  it("survives a corrupt db file by starting empty instead of throwing", () => {
    fs.mkdirSync(path.dirname(projectsDbPath(tmpDir)), { recursive: true });
    fs.writeFileSync(projectsDbPath(tmpDir), "{not json", "utf8");

    const repo = createProjectsRepo(tmpDir);
    expect(repo.size).toBe(0);
  });

  it("exposes entries and values for iteration", () => {
    const repo = createProjectsRepo(tmpDir);
    repo.set("a", { project_id: "a" });
    repo.set("b", { project_id: "b" });

    expect(Array.from(repo.entries()).map(([k]) => k).sort()).toEqual(["a", "b"]);
    expect(Array.from(repo.values()).map((p) => p.project_id).sort()).toEqual(["a", "b"]);
    expect(repo.size).toBe(2);
  });
});
