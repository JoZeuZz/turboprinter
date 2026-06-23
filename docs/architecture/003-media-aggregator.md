# 003 — Multi-Provider Media Aggregator (Fase 3, spec-001)

## Objetivo

Fase 3 introduce un agregador de medios multi-proveedor que, dado un `ShotPlan`,
busca candidatos de video en paralelo (Pexels, Pixabay, Coverr y biblioteca local),
los normaliza, los puntúa con heurísticas y selecciona el mejor clip por segmento
aplicando diversidad de proveedor.

El agregador es completamente **opt-in** y **aditivo**: cuando está desactivado el
pipeline legacy (`task.py`, `material.py`, `video.py`) funciona sin cambios.
La integración en `task.py` (descarga y render) queda diferida a Fase 3+.

---

## Flujo de datos

```
ShotPlan
  │
  └─── para cada ShotSegment
          │
          ├─ search_queries → búsqueda paralela en proveedores configurados
          │       │
          │       └─ si sin resultados → fallback_queries (mismo proceso)
          │
          ▼
  [MediaCandidate] por proveedor
          │
          ▼
  normalizar + dedup (por URL/path/id)
          │
          ▼
  MediaRanker.rank(candidatos, RankContext)
          │
          ▼
  mejor candidato (excluye ya usados → diversidad)
          │
          ▼
  selection[segment.id] = chosen
          │
          ▼
  ProjectStore.save_media_candidates(task_id, pool)
  ProjectStore.save_selected_media(task_id, selection)
          │
          ▼
  media_candidates.json + selected_media.json
```

---

## Decisión de diseño: envolver `material.py` y `local_library.py`

### Opciones consideradas

| Opción | Descripción |
|--------|-------------|
| **A — Adapters sobre código existente** | Cada `Provider` envuelve la función de búsqueda ya existente en `material.py` (`search_videos_pexels`, etc.) o `LocalLibrary.search()`. Sin reimplementación de HTTP ni manejo de credenciales. |
| B — Clientes HTTP propios | Un cliente HTTP por API (Pexels, Pixabay, Coverr) con su propia gestión de sesión, paginación y errores. |

### Por qué la opción A

- `material.py` ya maneja autenticación, reintentos, paginación y parsing de respuesta
  para Pexels, Pixabay y Coverr.
- `LocalLibrary` (en `app/services/quality/`) ya ofrece búsqueda por metadatos sobre
  la base SQLite local.
- Un adapter fino evita duplicar lógica HTTP y garantiza que las mejoras upstream
  se propagan automáticamente a los nuevos providers.
- Mantiene la compatibilidad upstream sin modificar `material.py`.

---

## Contrato `MediaProvider` (Protocol)

```python
class MediaProvider(Protocol):
    name: str

    def is_configured(self) -> bool: ...

    def search_videos(
        self,
        query: str,
        orientation: str | None = None,
        min_duration_sec: float | None = None,
        max_results: int = 20,
    ) -> list[MediaCandidate]: ...

    def download(self, candidate: MediaCandidate, target_dir: str) -> MediaCandidate: ...
```

- `is_configured()` devuelve `False` si faltan API keys o la base local no existe;
  el agregador omite silenciosamente los providers no configurados.
- `search_videos()` devuelve candidatos normalizados; un provider que lanza excepción
  es aislado (ver §Aislamiento de fallos).
- `download()` descarga el clip al disco y devuelve el candidato con `local_path` relleno.

### Normalización con `material_info_to_candidate()`

```python
def material_info_to_candidate(
    info: MaterialInfo,
    query: str,
    provider: str,
    license_info: LicenseInfo | None = None,
) -> MediaCandidate:
```

Convierte el `MaterialInfo` legacy (devuelto por `material.py`) a `MediaCandidate`
del dominio. Los campos `width`, `height` y `duration` iguales a `0` se tratan como
desconocidos (`None`), igual que el ranker upstream.

---

## Heurísticas del `MediaRanker`

`MediaRanker.rank(candidates, ctx)` aplica en orden:

| Heurística | Peso | Descripción |
|------------|------|-------------|
| Query match | +2.0 | Overlap de tokens entre `ctx.query` y `tags + title` del candidato. Puntuación proporcional a fracción de tokens coincidentes. |
| Duration fit | +1.5 | `max(0, 1 − |dur_cand − target| / target)`. A mayor ajuste de duración, mayor puntuación. |
| Orientation | +1.0 | `1.0` si coincide, `0.5` si desconocida, `0.3` si no coincide. |
| Resolution | +1.0 | `min(1, width×height / (1920×1080))`. Normalizado al valor FullHD. |
| Preferred provider | +1.0 | Si `cand.provider` está en `ctx.preferred_providers`. |
| Prefer local | +1.5 | Si `ctx.prefer_local=True` y `cand.provider == "local"`. |
| Provider diversity | −1.0 | Penaliza si `cand.provider` ya fue usado en segmentos anteriores. |
| Missing metadata | −0.5 | Penaliza si falta `width`, `height` o `duration_sec`. |

Antes de puntuar, `filter_avoided()` elimina candidatos cuyas `tags` o `title`
contienen alguna cadena de `ctx.must_avoid`.

El resultado es una lista ordenada de mayor a menor puntuación; el agregador toma
el primero cuyo `id` no haya sido ya seleccionado en un segmento previo.

---

## Aislamiento de fallos de proveedor

```python
with ThreadPoolExecutor(max_workers=4) as ex:
    futs = {ex.submit(p.search_videos, ...): p for p in active_providers}
    for fut in as_completed(futs):
        try:
            results.extend(fut.result())
        except Exception as exc:
            logger.warning(f"[media] provider {p.name} failed for '{query}': {exc!r}")
```

- Cada provider corre en un hilo separado dentro de un `ThreadPoolExecutor`.
- Si un future lanza excepción (timeout, credencial inválida, API down), se registra
  una advertencia y los demás providers continúan.
- El agregador no relanza el error; un provider caído nunca bloquea la búsqueda.

---

## Persistencia

| Archivo | Dónde | Contenido |
|---------|-------|-----------|
| `media_candidates.json` | `storage/tasks/{task_id}/` | Pool completo de `MediaCandidate` segmentado por `segment_id` (deduplicado por segmento). |
| `selected_media.json` | `storage/tasks/{task_id}/` | Lista de `MediaCandidate` seleccionados, uno por `segment_id`. |

El pool persistido conserva `segment_id` también para candidatos no seleccionados,
porque el editor manual y el endpoint `replace` solo permiten reemplazar por
candidatos registrados para el mismo segmento.

Métodos en `FilesystemProjectStore`:
- `save_media_candidates(task_id, candidates)` / `load_media_candidates(task_id)`
- `save_selected_media(task_id, selected)` / `load_selected_media(task_id)`

## License metadata

`LicenseInfo` stores traceable provider terms instead of a single optimistic flag.
Fields include `commercial_use`, `attribution_required`, `license_name`,
`license_url`, `usage_notes`, `source_terms_url`, `training_restricted`,
`redistribution_restricted`, and `unknown_or_provider_specific`.

Provider notes:

- Pexels and Pixabay include their current public license/terms URLs and keep
  `commercial_use=True` / `attribution_required=False` metadata.
- Coverr is marked `type="provider_specific"` with
  `unknown_or_provider_specific=True`; the system does not claim universal
  commercial/no-attribution safety for Coverr.

This metadata is informational and must not be treated as legal advice. Users
should review source terms before publication.

---

## Flag de activación

| Variable de entorno | Tipo | Valor por defecto | Descripción |
|---------------------|------|-------------------|-------------|
| `TURBOPRINTER_MULTI_PROVIDER_MEDIA` | bool (`"true"` / `"false"`) | `false` | Activa el agregador multi-proveedor |

Leída en `app/config/config.py` como `config.multi_provider_media_enabled`.

Factory:

```python
def get_media_aggregator(store: ProjectStore | None = None) -> MediaAggregator | None:
    """Devuelve None cuando el flag está off (por defecto)."""
    if not getattr(config, "multi_provider_media_enabled", False):
        return None
    providers = [PexelsProvider(), PixabayProvider(), CoverrProvider(), LocalLibraryProvider()]
    return MediaAggregator([p for p in providers if p.is_configured()], store=store)
```

Cuando `get_media_aggregator()` devuelve `None`, ninguna instancia del agregador se
crea. Los providers con API key ausente se excluyen automáticamente. Si ningún
provider está configurado y la biblioteca local no existe, el agregador es inerte.

---

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `app/infrastructure/media_providers/base.py` | `MediaProvider` Protocol, `material_info_to_candidate()` |
| `app/infrastructure/media_providers/stock_providers.py` | `PexelsProvider`, `PixabayProvider`, `CoverrProvider` (adapters sobre `material.py`) |
| `app/infrastructure/media_providers/local_provider.py` | `LocalLibraryProvider` (adapter sobre `local_library.py`) |
| `app/domain/media/scoring.py` | `RankContext`, `MediaRanker` |
| `app/domain/media/models.py` | `MediaCandidate`, `LicenseInfo` |
| `app/application/services/media_aggregator.py` | `MediaAggregator`, `get_media_aggregator()` |
| `app/infrastructure/storage/base.py` | `ProjectStore` Protocol (`save_selected_media`, `load_selected_media`, …) |
| `app/infrastructure/storage/filesystem.py` | `FilesystemProjectStore` (implementación) |
| `app/config/config.py` | `multi_provider_media_enabled` flag |
| `test/services/test_media_providers.py` | Tests unitarios de stock providers (fake HTTP) |
| `test/services/test_local_provider.py` | Tests unitarios de `LocalLibraryProvider` |
| `test/services/test_media_ranker.py` | Tests unitarios de `MediaRanker` |
| `test/services/test_media_aggregator.py` | Tests de `MediaAggregator` con `FakeProvider` |
| `test/services/test_selected_media_store.py` | Tests de persistencia `save/load_selected_media` |

---

## Fuera de ámbito (Fase 3, spec-001)

- **Integración en `task.py` / `download_videos`:** el pipeline legacy no llama al
  agregador todavía. La descarga y uso de los clips seleccionados es responsabilidad
  de un step posterior.
- **Ranking semántico:** la puntuación actual es léxica (overlap de tokens). Un
  ranking basado en embeddings o modelos de visión es trabajo futuro.
- **TimelineBuilder (Plan 4):** la construcción del `TimelineProject` a partir de la
  selección de medios se define en Plan 4 y no se aborda aquí.
- **WebUI/CLI:** no hay flag en Streamlit ni en `cli.py`; el agregador solo se
  activa vía variable de entorno.
