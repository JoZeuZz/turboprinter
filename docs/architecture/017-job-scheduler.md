# 017 — Scheduler y cola durable de jobs

> Este documento (`docs/architecture/017-job-scheduler.md`) cubre la
> arquitectura completa del feature; `README_PERSONAL_FORK.md` (secciones
> `## 3d. Job scheduler (jobs)` y `## 8. systemd services`) cubre cómo
> configurarlo y desplegar el worker en el LXC.

## Motivación

TurboPrinter arma proyectos encadenando pasos manuales vía HTTP (`/plan`,
`/media/search`, `/narration`, `/timeline/build`, `/render`), y el render
usa `FastAPI BackgroundTasks`. `BackgroundTasks` muere si el proceso API se
reinicia, no permite programar trabajo a futuro (`scheduled_at`) y no
sobrevive a un despliegue. Para operar como Content Automation Lab sin
depender de clicks manuales ni de una request HTTP viva, hace falta una
cola durable persistida en base de datos, un worker separado que la
consuma, reintentos con backoff, y un job que encadene el pipeline
completo (plan → media → narración → timeline → preflight → render).

## Decisión: cola SQLite propia, sin Celery/Redis

Se usa una tabla `jobs` sobre la capa de base de datos operacional ya
existente (`app/infrastructure/database/`, ver
`docs/architecture/016-operational-database.md`) en vez de Celery/RQ con
Redis como broker:

- El proyecto ya corre en un LXC personal con 1-3 workers como mucho; no
  hay necesidad de un broker distribuido.
- CLAUDE.md pide explícitamente no introducir una dependencia obligatoria
  adicional (Redis) para un flujo que puede resolverse con la DB que ya
  existe.
- SQLite con WAL y `busy_timeout` (ya configurado en
  `app/infrastructure/database/engine.py`) serializa escritores lo
  suficiente para dar exclusividad de claim entre 1-3 procesos worker sin
  broker externo.

El costo es que no hay retry granular por sub-tarea ni cancelación
cooperativa de un job en ejecución — ver "No incluido en esta fase".

## Arquitectura

```
app/infrastructure/database/
  schema.py                    # Table jobs
  migrations/
    m0002_jobs.py               # schema.jobs.create(checkfirst=True)
  repositories/
    jobs.py                     # JobRepository(Repository[Job])

app/domain/operational/
  models.py                     # class Job(BaseModel)

app/workers/
  jobs.py                       # run_forever(), _execute(), _backoff_seconds()
  handlers.py                   # HANDLERS: dict[str, Callable[[Job], None]]

app/application/services/
  project_lifecycle.py          # create_project(...) — reusado por endpoints y handler

app/controllers/v1/
  jobs.py                       # 5 endpoints: CRUD+cancel de jobs + run-full-pipeline

app/models/
  job_schema.py                 # JobCreateRequest, RunFullPipelineRequest, JOB_TYPES

webui-react/src/
  api/jobs.ts
  store/useJobsStore.ts
  pages/Jobs.tsx
```

`Job` (`app/domain/operational/models.py`) sigue el mismo estilo que
`ProjectRun`: pydantic, `id`/timestamps con `default_factory`,
`payload_json` como string JSON (mismo patrón que `metadata_json` en el
resto de tablas operacionales — se serializa/deserializa en el borde, en
los controllers y handlers, nunca dentro del modelo ni del repositorio
genérico). `type` es uno de 7 valores conocidos
(`generate_project`, `plan_project`, `search_media`,
`synthesize_narration`, `build_timeline`, `render_project`,
`full_project_pipeline`), validados en el endpoint `POST /jobs` contra el
`frozenset JOB_TYPES` de `app/models/job_schema.py` (no se modela como
`Enum` en la tabla, columna `String` libre — igual que `status` en
`project_runs`).

## Decisión de locking: claim atómico, sin tabla de locks

`JobRepository.claim_next()` (`app/infrastructure/database/repositories/jobs.py`)
implementa el claim así, dentro de una única transacción
(`engine().begin()`):

1. `SELECT id` del job `pending` más antiguo con `scheduled_at <= now`
   (opcionalmente filtrado por `type`).
2. `UPDATE jobs SET status='running', started_at=now, attempts=attempts+1
   WHERE id=<id> AND status='pending'`.
3. Si `rowcount != 1`, otro worker ganó la fila entre el paso 1 y el 2 —
   se devuelve `None` (el siguiente poll intentará con otra fila).
4. Si `rowcount == 1`, se vuelve a leer la fila y se devuelve como `Job`.

Nota de implementación: el diseño original contemplaba un único
`UPDATE ... WHERE id = (SELECT ...) RETURNING *`, pero el Dockerfile del
proyecto usa `python:3.11-slim-bullseye`, que trae SQLite 3.34.1, y
`RETURNING` requiere SQLite ≥ 3.35. Por eso la implementación real separa
`SELECT` + `UPDATE ... WHERE status='pending'` con verificación de
`rowcount`, dentro de la misma transacción — misma garantía de exclusión
mutua (SQLite serializa transacciones de escritura vía WAL +
`busy_timeout=5000`, ya configurados en `engine.py`), sin depender de una
sintaxis que la versión de SQLite en producción no soporta.

No hace falta una tabla de locks aparte ni `SELECT ... FOR UPDATE` (que
SQLite no soporta): si dos procesos worker llaman `claim_next()` "a la
vez", ambos pueden hacer el `SELECT` inicial y ver el mismo candidato,
pero solo uno consigue el lock de escritura de SQLite para su `UPDATE`;
cuando el segundo ejecuta el suyo, la fila ya no matchea
`status='pending'` y su `rowcount` es 0. Suficiente para el caso de uso
real: 1-3 procesos worker en un LXC personal, no un cluster.

`cancel(job_id)` usa el mismo patrón (`UPDATE ... WHERE id=? AND
status='pending'`, chequeo de `rowcount`) para garantizar que solo se
cancela un job que sigue `pending`; si ya está `running` (o en cualquier
otro estado), la fila afectada es 0, el endpoint recibe `None` y responde
409.

## Worker

`app/workers/jobs.py`, ejecutable con `uv run python -m app.workers.jobs`:

- `run_forever(poll_interval=None)`: loop infinito. Si `claim_next()` no
  devuelve nada, duerme `poll_interval` (o `config.jobs_poll_interval_sec`,
  default 5s) y reintenta. Si devuelve un job, lo ejecuta.
- `_execute(repo, job)`: llama a `HANDLERS[job.type](job)`. Si el handler
  lanza cualquier excepción, la captura, loguea y llama
  `repo.mark_failed_or_retry(job.id, error=str(exc),
  backoff_seconds=_backoff_seconds(job.attempts))`. Si el handler termina
  sin excepción, llama `repo.mark_completed(job.id)`.
- `_backoff_seconds(attempts) = min(30 * 2 ** max(attempts - 1, 0), 600)`
  — backoff exponencial (30s, 60s, 120s, 240s, ...) con tope de 600s (10
  min). Constante en código, sin config nueva.

Loop secuencial, **1 job a la vez por proceso** (decisión validada con el
usuario, no un detalle accidental): no hay pool de threads ni async, cada
handler puede tardar minutos (render). Correr un segundo worker es
lanzar un segundo proceso — el locking en DB evita que se pisen entre sí,
pero cada proceso individual sigue siendo secuencial.

Una excepción de handler nunca tumba el loop del worker: `_execute` la
atrapa por job individual, así que un job roto no bloquea los siguientes
ni mata el proceso.

## Handlers

`app/workers/handlers.py`, registro `HANDLERS: dict[str, Callable[[Job],
None]]` con 7 entradas. Cada handler deserializa `job.payload_json`,
resuelve un `FilesystemProjectStore()` y llama **directo** a los mismos
servicios de aplicación que usan los endpoints REST equivalentes
(`ShotPlanner`, `MediaAggregator`, `legacy_task.generate_audio` /
`generate_subtitle`, `TimelineBuilder`, `ProjectPreflightService`,
`render_project_from_store`) — no reimplementa lógica de negocio.

### `full_project_pipeline`: reintento todo-o-nada

`handle_full_project_pipeline` encadena plan → media → narración →
timeline → preflight → render en una sola función. Si cualquier paso
lanza (incluidos los errores de preflight, que se convierten
explícitamente en `RuntimeError`), la excepción se propaga hasta
`_execute`, que marca el job para reintento (o `failed` si se agotaron
los intentos). El reintento vuelve a ejecutar **el pipeline completo
desde el plan**, no desde el paso que falló.

Es una decisión deliberada, no una limitación pasada por alto: encadenar
sub-jobs con estado intermedio (guardar en qué paso quedó, reanudar solo
desde ahí) es más complejo — requeriría persistir puntos de control por
paso y manejar reentradas parciales (¿qué pasa si `search_media` ya corrió
pero `synthesize_narration` fallaba a mitad?). El costo de recalcular
pasos que ya habían salido bien (por ejemplo, volver a buscar media si el
fallo real fue en el render) se acepta a cambio de un modelo de reintento
mucho más simple y fácil de razonar. Para pipelines más largos o costosos
esto podría revisarse en una fase futura.

## Endpoints API

`app/controllers/v1/jobs.py`, montado en `app/router.py`. Gateados por
`config.jobs_enabled` (404 si está apagado, mismo patrón que otras
features opt-in del fork):

- **`POST /api/v1/jobs`** — crea un job. Body `JobCreateRequest {type: str,
  workspace_id?, project_id?, payload: dict = {}, scheduled_at?: datetime,
  max_attempts: int = 3}`. 400 si `type` no está en `JOB_TYPES` (los 7
  conocidos).
- **`GET /api/v1/jobs`** — lista con filtros `status?, type?,
  workspace_id?, project_id?, limit: int = 50, offset: int = 0`, orden
  por `created_at` descendente.
- **`GET /api/v1/jobs/{job_id}`** — 404 si no existe.
- **`POST /api/v1/jobs/{job_id}/cancel`** — cancela un job `pending`; 404
  si no existe, 409 si ya no está `pending` (running/completed/failed/
  cancelled).
- **`POST /api/v1/workspaces/{workspace_id}/run-full-pipeline`** — body
  `RunFullPipelineRequest {project_id?, topic?, script?, language: str =
  "es", voice_name: str = "", voice_rate: float = 1.0, subtitle_enabled:
  bool = True, visual_style?, orientation?, allow_preflight_warnings: bool
  = False, scheduled_at?}`. Requiere `project_id` existente **o**
  (`topic` o `script`) — 400 si faltan ambos. Si no hay `project_id`, crea
  el proyecto con el helper `create_project(...)`
  (`app/application/services/project_lifecycle.py`, extraído de la lógica
  ya usada por `create_from_topic`/`create_from_script` para no
  triplicarla). Encola un job `full_project_pipeline` y devuelve
  `{job_id, project_id}`.

Todas las respuestas van envueltas en `BaseProjectResponse`, como el
resto de controllers v1.

## Config `[jobs]`

```toml
[jobs]
enabled = false
poll_interval_sec = 5
default_max_attempts = 3
```

Tolerante a ausencia total de la sección (usa los defaults de arriba,
`app/config/config.py:302-304`). Variable de entorno:
`TURBOPRINTER_JOBS_ENABLED` (mismo patrón `_env_bool_or_config` que el
resto de flags del fork). No depende de Redis ni de Celery.

`enabled = false` es el default: con la sección ausente o apagada, los 5
endpoints de `/api/v1/jobs*` y `/api/v1/workspaces/{id}/run-full-pipeline`
devuelven 404, y el flujo existente de render vía `BackgroundTasks` sigue
funcionando exactamente igual que antes de esta fase.

## Frontend (`webui-react`)

- `src/api/jobs.ts`: cliente fetch (`listJobs`, `getJob`, `createJob`,
  `cancelJob`, `runFullPipeline`), mismo patrón que `src/api/projects.ts`.
- `src/store/useJobsStore.ts`: store zustand con refresco periódico.
- `src/pages/Jobs.tsx`, montado en `/jobs` (`App.tsx`): panel con la cola
  agrupada por estado (pending, running, completed, failed).

## No incluido en esta fase

- **Cancelación cooperativa** de un job `running`: solo se puede cancelar
  un job que sigue `pending`. Cancelar un `running` responde 409 — no hay
  mecanismo para interrumpir un handler ya en ejecución (por ejemplo, un
  render a mitad de camino).
- **Reintento granular por sub-paso** dentro de `full_project_pipeline`:
  ver la sección de arriba — el reintento siempre es del pipeline
  completo, no hay checkpointing intermedio.
- **Concurrencia múltiple por proceso worker:** el locking en DB sí es
  seguro para varios *procesos* worker corriendo en paralelo, pero cada
  proceso individual sigue ejecutando 1 job a la vez, secuencialmente (sin
  pool de threads/async).
- **Publicación a YouTube / otras plataformas.**
- **Migrar el render manual existente de `BackgroundTasks` a jobs:** el
  flujo manual (`/plan`, `/media/search`, `/narration`,
  `/timeline/build`, `/render` uno por uno vía HTTP) sigue igual; los
  jobs son un camino alternativo opt-in vía `run-full-pipeline` (o los
  handlers individuales), no un reemplazo forzado.
- **Celery, Redis o un scheduler cron más complejo:** ver la sección de
  Decisión arriba — descartados deliberadamente por simplicidad y para no
  introducir una dependencia de infraestructura obligatoria en un
  despliegue LXC personal.
