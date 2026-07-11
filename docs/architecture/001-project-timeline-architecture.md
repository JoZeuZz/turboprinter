# 001 — Project Timeline Architecture (Fases 1-4, spec-001)

## Objetivo

El modo proyecto introduce una fuente de verdad editable: `TimelineProject`. Las
fases actuales son aditivas y no reemplazan el pipeline legacy de generacion,
descarga ni render.

## Flujo standalone actual

```text
ShotPlan
  -> MediaAggregator.select_for_plan()
  -> selected_media.json
  -> TimelineBuilder.build_from_store()
  -> timeline_project.json
```

## Contratos

| Contrato | Rol |
|----------|-----|
| `ShotPlan` | Segmentos narrativos con duracion, intencion visual y queries |
| `MediaCandidate` | Clip normalizado de stock/local con trazabilidad de provider/query/score |
| `TimelineProject` | Tracks e items editables antes del render |
| `RenderSpec` | Configuracion futura para render desde timeline |

## TimelineBuilder

`app/application/services/timeline_builder.py` convierte `ShotPlan + selected_media`
en un `TimelineProject` determinista:

- uno o mas items de video por segmento,
- starts acumulativos sin gaps,
- duraciones desde `end_sec - start_sec` o `target_duration_sec`,
- clips cortos repetidos en partes contiguas con traza en
  `metadata["repeated_media_segments"]`,
- placeholders trazables cuando falta media,
- tracks opcionales para audio narrado y subtitulos,
- persistencia via `ProjectStore.save_timeline()`.

`build_from_store(task_id)` carga `shot_plan.json` y `selected_media.json`, crea el
timeline y escribe `timeline_project.json` en la carpeta de tarea.

## Placeholders

Si un segmento no tiene clip seleccionado, el builder crea un item con
`provider="placeholder"`, `media_id=None` y `local_path=None`. El segmento queda en
`project.metadata["missing_media_segments"]`. Esta fase no falla temprano: Fase 5
debe decidir si sustituye el placeholder o aborta render con error claro.

## Clips cortos

Si un `MediaCandidate.duration_sec` conocido es menor que la duracion del
segmento, el builder repite el mismo clip en items contiguos hasta cubrir todo el
segmento. Cada parte reinicia `trim_start_sec=0.0` y usa `trim_end_sec` igual a
la duracion de esa parte. La repeticion queda en
`project.metadata["repeated_media_segments"]` con `segment_id`, `media_id`,
duracion de origen, duracion objetivo y numero de partes.

Si `duration_sec` es conocido pero no positivo o esta por debajo de la tolerancia
interna, el clip se trata como media invalida: el segmento usa placeholder y la
traza queda en `project.metadata["invalid_media_segments"]`.

## Flags

| Variable | Default | Uso |
|----------|---------|-----|
| `TURBOPRINTER_PROJECT_MODE_ENABLED` | `false` | Habilita factories de modo proyecto |
| `TURBOPRINTER_STRUCTURED_SHOT_PLANNER` | `false` | Habilita ShotPlanner estructurado |
| `TURBOPRINTER_MULTI_PROVIDER_MEDIA` | `false` | Habilita MediaAggregator multi-proveedor |

Cuando `TURBOPRINTER_PROJECT_MODE_ENABLED=false`, `get_timeline_builder()` devuelve
`None`. El pipeline legacy sigue sin cambios.

## Fuera de alcance actual

- Render desde `TimelineProject`.
- Endpoints API de proyecto editable.
- UI manual de revision/reorden/trim.
- OpenCut real.
- Musica contextual y Reddit ingest.
