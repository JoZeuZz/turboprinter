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

  it("throws on a corrupt db file instead of starting empty", () => {
    fs.mkdirSync(path.dirname(projectsDbPath(tmpDir)), { recursive: true });
    fs.writeFileSync(projectsDbPath(tmpDir), "{not json", "utf8");

    expect(() => createProjectsRepo(tmpDir)).toThrow(/no es JSON válido/);
  });

  it("leaves a corrupt db file untouched so it can still be repaired by hand", () => {
    fs.mkdirSync(path.dirname(projectsDbPath(tmpDir)), { recursive: true });
    fs.writeFileSync(projectsDbPath(tmpDir), "{not json", "utf8");

    expect(() => createProjectsRepo(tmpDir)).toThrow();
    expect(fs.readFileSync(projectsDbPath(tmpDir), "utf8")).toBe("{not json");
  });

  it("throws when the db file parses to something that is not an object", () => {
    fs.mkdirSync(path.dirname(projectsDbPath(tmpDir)), { recursive: true });
    fs.writeFileSync(projectsDbPath(tmpDir), "[1, 2, 3]", "utf8");

    expect(() => createProjectsRepo(tmpDir)).toThrow(/objeto JSON/);
  });

  it("leaves no temp file behind after a successful write", () => {
    const repo = createProjectsRepo(tmpDir);
    repo.set("p1", { project_id: "p1" });

    const storageDir = path.dirname(projectsDbPath(tmpDir));
    const leftovers = fs.readdirSync(storageDir).filter((f) => f.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("writes valid, re-readable JSON on every set", () => {
    const repo = createProjectsRepo(tmpDir);
    repo.set("p1", { project_id: "p1", topic: "gatos" });
    repo.set("p2", { project_id: "p2", topic: "perros" });

    const onDisk = JSON.parse(fs.readFileSync(projectsDbPath(tmpDir), "utf8"));
    expect(Object.keys(onDisk).sort()).toEqual(["p1", "p2"]);
  });

  it("throws instead of silently losing data when the write fails", () => {
    const repo = createProjectsRepo(tmpDir);
    repo.set("p1", { project_id: "p1" });

    // Convertir la ruta de la base en un directorio hace que rename(2) falle
    // con EISDIR pase lo que pase, también como root — a diferencia de los bits
    // de permiso, que root ignora.
    const dbPath = projectsDbPath(tmpDir);
    fs.unlinkSync(dbPath);
    fs.mkdirSync(dbPath);

    expect(() => repo.set("p2", { project_id: "p2" })).toThrow(/No se pudo guardar/);
  });

  it("cleans up the temp file when the write fails", () => {
    const repo = createProjectsRepo(tmpDir);
    repo.set("p1", { project_id: "p1" });

    const dbPath = projectsDbPath(tmpDir);
    fs.unlinkSync(dbPath);
    fs.mkdirSync(dbPath);

    expect(() => repo.set("p2", { project_id: "p2" })).toThrow();

    const storageDir = path.dirname(dbPath);
    const leftovers = fs.readdirSync(storageDir).filter((f) => f.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
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
