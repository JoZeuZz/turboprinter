// Repository for the project database (storage/projects_db.json).
// Persistence is part of the contract: set() and delete() write to disk
// explicitly — replacing the old pattern of a Map with monkeypatched
// set/delete that saved as a hidden side effect.
//
// Durability rules:
//   - Writes are atomic (temp file + rename), so a crash mid-write leaves the
//     previous database intact rather than a truncated one.
//   - A write failure throws. Reporting success after failing to persist is
//     how a full disk becomes silent data loss.
//   - A corrupt database throws at construction instead of starting empty.
//     Starting empty would let the next set() overwrite the only copy.

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

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const raw = fs.readFileSync(dbPath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // Arrancar con un mapa vacío sería peor que fallar: el primer set()
      // persistiría ese vacío encima del fichero y borraría definitivamente
      // todos los proyectos que aún se podrían recuperar a mano.
      throw new Error(
        `La base de proyectos ${dbPath} no es JSON válido y no se ha modificado. ` +
        `Repárala o muévela a un lado antes de arrancar. Detalle: ${(err as Error).message}`
      );
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `La base de proyectos ${dbPath} debería ser un objeto JSON y no lo es. ` +
        `Repárala o muévela a un lado antes de arrancar.`
      );
    }
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      map.set(k, v);
    }
  }

  // Escritura atómica: se escribe un temporal en el mismo directorio y se
  // renombra encima. rename(2) es atómico dentro del mismo sistema de ficheros,
  // así que un corte de luz o un SIGKILL deja el fichero anterior intacto en
  // lugar de uno truncado. writeFileSync directo trunca antes de escribir y
  // esa ventana se lleva por delante todos los proyectos.
  const persist = () => {
    const tmpPath = `${dbPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(Object.fromEntries(map), null, 2), "utf-8");
      fs.renameSync(tmpPath, dbPath);
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {
        // El temporal quedó huérfano; no es motivo para tumbar la petición.
      }
      // Persistir es parte del contrato de set()/delete(): si falla, el llamante
      // debe enterarse en vez de creer que sus datos están a salvo.
      throw new Error(`No se pudo guardar la base de proyectos en ${dbPath}: ${(err as Error).message}`);
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
