# 016 — Base de datos operacional (SQLite)

## Motivación

TurboPrinter usaba solo filesystem/JSON para workspaces, prompt templates y
proyectos. Esta fase añade una capa de base de datos operacional ligera para
analítica, historial de runs, publicaciones, métricas y experimentos
futuros, sin romper el filesystem existente ni migrar el uso actual.

## Decisión: SQLAlchemy Core, sin ORM

Se usa SQLAlchemy Core (`Engine` + `Table`/`MetaData`, sin sesiones ni
modelos declarativos) en vez de:

- **`sqlite3` stdlib**: obligaría a reescribir SQL a mano por dialecto al
  migrar a Postgres (placeholders, `AUTOINCREMENT` vs `SERIAL`, tipos).
- **SQLAlchemy ORM completo**: sesiones, unit-of-work y relationships son
  más potencia de la necesaria para repositorios CRUD simples, y CLAUDE.md
  pide explícitamente evitar un "ORM gigante".

SQLAlchemy Core da SQL portable cambiando solo el engine URL, sin la carga
de un ORM completo.

## Migraciones propias, no Alembic

Con 12 tablas iniciales, Alembic (`alembic.ini`, `env.py`, carpeta
`versions/`) es más boilerplate del que el proyecto necesita hoy. En su
lugar, `app/infrastructure/database/migrations/` tiene funciones Python
numeradas (`m0001_initial.py`, futuras `m0002_*.py`) trackeadas en una tabla
`schema_migrations`. `runner.apply_pending(engine)` es idempotente. Si el
volumen de migraciones crece, Alembic sigue siendo una opción migrable
después.

## Arquitectura

```
app/infrastructure/database/
  engine.py            # get_engine() singleton memoizado, WAL + busy_timeout
  schema.py             # SQLAlchemy Core Table() de las 12 tablas
  migrations/            # runner.py + m0001_initial.py
  repositories/
    generic.py            # Repository[Model] genérico (create/get/list)
    project_runs.py        # ProjectRunRepository — único wireado a controllers

app/domain/operational/
  models.py              # ProjectRun, VideoOutput, Publication, MetricsSnapshot,
                          # Experiment, ExperimentVariant, DecisionRule, DecisionEvent
```

Los modelos de dominio tienen los mismos nombres de campo que las columnas
de su tabla — eso es lo que permite que `Repository` sea genérico sin una
capa de mapeo por tabla.

## Puente hacia `workspaces`/`prompt_templates`/`prompt_versions`

Estas 3 tablas existen en el esquema (DDL en la migración inicial) pero no
tienen `Repository` instanciado esta fase. `WorkspaceStore` y
`PromptTemplateStore` (filesystem, `app/infrastructure/storage/`) siguen
siendo la fuente de verdad. Razón: los modelos de dominio existentes
(`Workspace` tiene 17 campos — voz, subtítulos, estilo visual, política de
monetización, etc.) no caben en las columnas mínimas del esquema puente
(`id`, `name`, `created_at`, `updated_at`, `metadata_json`). Migrar estas
dos entidades a DB real requiere:

1. Ampliar el esquema de `workspaces`/`prompt_templates`/`prompt_versions`
   para reflejar todos los campos de los modelos de dominio (o decidir qué
   va en columnas propias vs. `metadata_json`).
2. Escribir `WorkspaceRepository`/`PromptTemplateRepository` con esa
   traducción.
3. Decidir si la migración es dual-write (temporal) o de corte directo, y
   cómo migrar los JSON ya existentes en `storage/workspaces/` y
   `storage/prompt_templates/`.

Ese trabajo queda para una fase siguiente.

## Config

```toml
[database]
enabled = true
backend = "sqlite"       # solo "sqlite" soportado por ahora
sqlite_path = "storage/app.db"
```

Tolerante a ausencia total (usa los defaults de arriba). Variables de
entorno: `TURBOPRINTER_DATABASE_ENABLED`, `TURBOPRINTER_DATABASE_BACKEND`.

## Camino a PostgreSQL

No implementado en esta fase. El diseño ya lo deja abierto: `get_engine()`
construye la URL de conexión a partir de `database_backend` +
`database_sqlite_path`; añadir Postgres implica leer credenciales/host
adicionales cuando `database_backend == "postgres"` y construir una URL
`postgresql://...` en vez de `sqlite:///...`. El esquema (`schema.py`) ya
usa tipos SQLAlchemy portables (`String`, `Integer`, `DateTime`, `Text`,
`Boolean`), así que no necesita cambios para funcionar contra Postgres. Las
migraciones sí necesitarán revisión: `metadata.create_all()` es portable,
pero futuras migraciones que usen SQL crudo (`ALTER TABLE`, etc.) tendrán
que evitar sintaxis específica de un dialecto o ramificar por
`engine.dialect.name`.

## No incluido en esta fase

- Migración real de workspaces/prompt templates a DB.
- PostgreSQL real (solo la abstracción).
- Scheduler o consumo automático de `decision_rules`/`experiments`.
- Actualización de `status` en `project_runs` durante el render.
- Videos u otros binarios en DB.

## Endpoint de salud

`GET /api/v1/system/storage` devuelve el estado de la base de datos
(backend, ruta, si está inicializada, versión de esquema, número de tablas)
y del filesystem (directorio de storage, si existe). Ver
`app/controllers/v1/system.py`.
