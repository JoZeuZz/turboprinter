// Repository for the project database (storage/projects_db.json).
// Persistence is part of the contract: set() and delete() write to disk
// explicitly — replacing the old pattern of a Map with monkeypatched
// set/delete that saved as a hidden side effect.

import fs from "fs";
import path from "path";

export interface ProjectsRepo {
  get(id: string): any | undefined;
  set(id: string, project: any): void;
  delete(id: string): boolean;
  entries(): IterableIterator<[string, any]>;
  values(): IterableIterator<any>;
  readonly size: number;
}

export const projectsDbPath = (rootDir: string): string =>
  path.join(rootDir, "storage", "projects_db.json");

export function createProjectsRepo(rootDir: string = process.cwd()): ProjectsRepo {
  const dbPath = projectsDbPath(rootDir);
  const map = new Map<string, any>();

  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) {
      const parsed = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
      for (const [k, v] of Object.entries(parsed)) {
        map.set(k, v);
      }
    }
  } catch (err) {
    console.error("Error loading projects from file, using empty map:", err);
  }

  const persist = () => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(Object.fromEntries(map), null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving projects to file:", err);
    }
  };

  return {
    get: (id) => map.get(id),
    set: (id, project) => {
      map.set(id, project);
      persist();
    },
    delete: (id) => {
      const existed = map.delete(id);
      if (existed) {
        persist();
      }
      return existed;
    },
    entries: () => map.entries(),
    values: () => map.values(),
    get size() {
      return map.size;
    },
  };
}
