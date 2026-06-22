# SPEC-004 — Timeline Builder automatico

> Fase 4 de [spec-001](spec-001.md). Continua [spec-003](spec-003-media-aggregator.md). Diseno aprobado por spec maestro.

## Objetivo

Convertir un `ShotPlan` y una seleccion de `MediaCandidate` en un `TimelineProject` persistible, determinista y validado, sin tocar renderer ni pipeline legacy.

Esta fase es standalone: entrega builder, tests y documentacion. No modifica `app/services/task.py`, `app/services/video.py`, `app/services/material.py` ni flujo `video_source` legacy. Render desde timeline queda para Fase 5.

## Decisiones

- `TimelineProject` es fuente de verdad editable; builder no renderiza.
- Duraciones: usar `end_sec - start_sec` si ambos son validos; si no, `target_duration_sec`.
- Starts: acumulativos por orden de segmentos para evitar gaps/overlaps accidentales.
- Seleccion: aceptar `dict[segment_id, MediaCandidate]` o lista con `candidate.segment_id`.
- Clips cortos: si `candidate.duration_sec` es conocido y menor que la duracion del segmento, repetir el mismo candidato en items contiguos y registrar `metadata["repeated_media_segments"]`.
- Media invalida: si `candidate.duration_sec` es conocido pero no positivo o sub-epsilon, usar placeholder y registrar `metadata["invalid_media_segments"]`.
- Segmento sin media: crear placeholder trazable (`provider="placeholder"`, sin `local_path`) y registrar `metadata["missing_media_segments"]`.
- Audio/subtitulos: crear tracks simples opcionales si se pasan paths; no mezclar ni quemar subtitulos.
- Factory usa flag existente `TURBOPRINTER_PROJECT_MODE_ENABLED`, default `false`; no se agrega flag nuevo.

## Modelos existentes

- `app/domain/planning/models.py`: `ShotPlan`, `ShotSegment`.
- `app/domain/media/models.py`: `MediaCandidate`.
- `app/domain/projects/models.py`: `TimelineProject`, `TimelineTrack`, `TimelineItem`, `ExportSettings`.
- `app/domain/projects/validators.py`: `validate_no_gaps`, `validate_no_overlaps`.
- `app/infrastructure/storage/base.py`: `ProjectStore` con `save/load_shot_plan`, `save/load_selected_media`, `save/load_timeline`.
- `app/config/config.py`: `project_mode_enabled`.

## API objetivo

```python
class TimelineBuilder:
    def __init__(self, store: ProjectStore | None = None): ...

    def build(
        self,
        shot_plan: ShotPlan,
        selected_media: dict[str, MediaCandidate] | list[MediaCandidate],
        task_id: str | None = None,
        title: str | None = None,
        export: ExportSettings | None = None,
        narration_audio_path: str | None = None,
        subtitle_path: str | None = None,
    ) -> TimelineProject: ...

    def build_from_store(
        self,
        task_id: str,
        title: str | None = None,
        export: ExportSettings | None = None,
        narration_audio_path: str | None = None,
        subtitle_path: str | None = None,
    ) -> TimelineProject: ...

def get_timeline_builder(store: ProjectStore | None = None) -> TimelineBuilder | None: ...
```

## Criterios de aceptacion

- [ ] Dado un `ShotPlan` y candidatos fake, se construye timeline valido.
- [ ] Duracion total coincide con suma de segmentos.
- [ ] Timeline se guarda y carga via `ProjectStore`.
- [ ] Tests cubren no gaps/no overlaps.
- [ ] Clips seleccionados mas cortos que el segmento se repiten sin gaps/overlaps y quedan trazados en metadata.
- [ ] Clips con duracion conocida no positiva o sub-epsilon se reemplazan por placeholder y quedan trazados como invalidos.
- [ ] Segmentos sin clip no crashean; quedan como placeholders trazables.
- [ ] Flujo legacy intacto: no tocar `task.py`, `material.py`, `video.py`.

## Fuera de alcance

- Descargar media real si `local_path` falta.
- Render desde `TimelineProject`.
- Endpoints API.
- UI manual. Si se disena UI en fase posterior, usar skill `frontend-design` si existe en entorno.
- Musica contextual, Reddit ingest, OpenCut real.

## Validacion

- `uv run python -m compileall app`
- `uv run pytest test/services/test_timeline_builder.py -v`
- `uv run pytest test/domain/test_timeline_project.py test/infrastructure/test_project_store.py test/services/test_timeline_builder.py -v`
- `uv run python cli.py --help`
- `uv lock --check`
