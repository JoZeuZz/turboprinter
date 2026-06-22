# 002 — Structured Shot Planner (Fase 2)

## Objetivo

Fase 2 introduce un planificador de planos estructurado que, dado el guion de un
video corto, genera un `ShotPlan` JSON: segmentos con texto de narración,
duración, `visual_goal` y `search_queries` para las APIs de stock.

El planner es completamente **opt-in** y **aditivo**: cuando está desactivado el
pipeline legacy (`task.py`, `material.py`, `video.py`) funciona sin cambios.
La integración en `task.py` queda diferida a Fase 3+.

---

## Flujo de datos

```
script (str)
    │
    ▼
_build_prompt()
    │ prompt str
    ▼
StructuredLLMProvider.generate_structured(prompt, ShotPlan)
    │
    ├─── OK ──────────────────────────────────────────────────────────────────┐
    │                                                                          │
    └─── error ──▶ _repair_prompt() ──▶ generate_structured() [intento 2]    │
                       │                                                       │
                       ├─── OK ───────────────────────────────────────────────┤
                       │                                                       │
                       └─── error ──▶ heuristic_shot_plan() [fallback local] ─┤
                                                                               │
                                                                    ShotPlan ◀─┘
                                                                        │
                                                          result.model_copy(task_id=…)
                                                                        │
                                                    ProjectStore.save_shot_plan(task_id, plan)
                                                                        │
                                                               shot_plan.json
```

---

## Decisión de diseño: litellm como gateway único

### Opciones consideradas

| Opción | Descripción |
|--------|-------------|
| **A — litellm gateway único** | Un adaptador (`LiteLLMStructuredProvider`) que delega en litellm; la selección de modelo es un string (e.g. `ollama/mistral`, `deepseek/deepseek-chat`). |
| B — Adaptadores por proveedor | Un adaptador por proveedor (OpenAI, Ollama, DeepSeek…) con su propio cliente HTTP. |

### Por qué litellm (opción A)

- litellm 1.86.2 ya estaba instalado (upstream lo usa para capability checks).
- `litellm.supports_response_schema(model)` detecta automáticamente si el modelo
  soporta `response_format=<schema>` (salida JSON Schema nativa) o solo JSON mode.
- Un único gateway evita N clientes HTTP y N formatos de error distintos.
- Nuevos modelos (Ollama local, OpenRouter, LM Studio) se añaden cambiando
  únicamente `litellm_model_name` en `config.toml`, sin código nuevo.
- Compatible con el requisito del fork: sin dependencia obligatoria de OpenAI/Anthropic.

---

## Contratos públicos

### `StructuredLLMProvider` (Protocol)

```python
class StructuredLLMProvider(Protocol):
    def capabilities(self, model: str | None = None) -> LLMCapabilities: ...

    def generate_structured(
        self,
        prompt: str,
        schema: type[T],           # subclase de pydantic.BaseModel
        model: str | None = None,
        temperature: float = 0.4,
    ) -> T: ...
```

`LLMCapabilities`:

```python
class LLMCapabilities(BaseModel):
    supports_json_mode: bool
    supports_json_schema: bool
    supports_tools: bool = False
    supports_vision: bool = False
    max_context_tokens: int | None = None
```

### `LiteLLMStructuredProvider` (implementación concreta)

- Resuelve el modelo desde `model=` o desde `config.app['litellm_model_name']`.
- Si `litellm.supports_response_schema(model)` → usa `response_format=schema`
  (salida JSON Schema nativa validada por litellm).
- Si no → usa `response_format={"type": "json_object"}` + `schema.model_validate_json()`.
- En ambos casos devuelve una instancia Pydantic validada del schema solicitado.
- Lanza `ValueError` si el modelo no está configurado o la respuesta está vacía.

### `ShotPlanner`

```python
class ShotPlanner:
    def __init__(self, provider: StructuredLLMProvider, store: ProjectStore | None = None): ...

    def plan(
        self,
        script: str,
        language: str,
        target_duration_sec: float | None = None,
        topic: str | None = None,
        visual_style: str | None = None,
        task_id: str | None = None,
    ) -> ShotPlan: ...
```

Ciclo interno: intento 1 → intento 2 con prompt de reparación → fallback heurístico.
Si `store` y `task_id` están presentes, persiste el plan antes de devolverlo.

### `ShotPlan` / `ShotSegment` (dominio)

Definidos en `app/domain/planning/models.py`.

```
ShotPlan
  schema_version: "1.0"
  task_id: str | None
  language: str
  topic: str | None
  script: str
  total_duration_sec: float | None
  segments: list[ShotSegment]   # ordenados por .order; mínimo 1
  global_visual_style: str | None
  music_intent: MusicIntent | None

ShotSegment
  id: str
  order: int
  narration_text: str
  start_sec / end_sec: float | None
  target_duration_sec: float
  visual_goal: str
  search_queries: list[str]     # mínimo 1 (validador Pydantic)
  fallback_queries: list[str]
  preferred_providers: list[str]
  must_avoid: list[str]
  mood / pacing: str | None
```

---

## Fallback heurístico (`heuristic_shot_plan`)

Determinista, sin red, sin LLM. Se activa cuando los dos intentos LLM fallan.

1. **Split por oraciones:** `re.split(r"[.!?]+", script)`.
2. **Duración uniforme:** `total_duration_sec / n` segundos por segmento (si no se
   pasa `target_duration_sec`, se asumen 5 s por segmento).
3. **`search_queries`:** palabras con longitud > 3, excluyendo stopwords del
   español, deduplicadas y limitadas a 5; si el resultado es vacío, usa `topic`
   o `"cinematic background"`.
4. **`visual_goal`:** `"visual support for: {narration_text[:60]}"`.

La función también puede llamarse directamente (no requiere un `ShotPlanner`).

---

## Flag de activación

| Variable de entorno | Tipo | Valor por defecto | Descripción |
|---------------------|------|-------------------|-------------|
| `TURBOPRINTER_STRUCTURED_SHOT_PLANNER` | bool (`"true"` / `"false"`) | `false` | Activa el Shot Planner estructurado |

Leída en `app/config/config.py` como `config.structured_shot_planner_enabled`.

Factory:

```python
def get_shot_planner(store: ProjectStore | None = None) -> ShotPlanner | None:
    """Devuelve None cuando el flag está off (por defecto)."""
    if not getattr(config, "structured_shot_planner_enabled", False):
        return None
    return ShotPlanner(LiteLLMStructuredProvider(), store=store)
```

Cuando `get_shot_planner()` devuelve `None`, ninguna instancia del planner se
crea y el comportamiento del pipeline es idéntico a upstream.

---

## Requisitos de configuración

Para que `LiteLLMStructuredProvider` funcione, `config.toml` debe incluir:

```toml
[app]
litellm_model_name = "ollama/mistral"   # o cualquier string válido litellm
```

Sin este campo y sin pasar `model=` explícito, `generate_structured()` lanza
`ValueError` y el `ShotPlanner` degrada al fallback heurístico.

---

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `app/infrastructure/llm/structured_output.py` | `StructuredLLMProvider` Protocol, `LiteLLMStructuredProvider`, `LLMCapabilities` |
| `app/application/services/shot_planner.py` | `heuristic_shot_plan()`, `ShotPlanner`, `get_shot_planner()` |
| `app/domain/planning/models.py` | `ShotPlan`, `ShotSegment`, `MusicIntent` |
| `app/infrastructure/storage/base.py` | `ProjectStore` Protocol (`save_shot_plan`, `load_shot_plan`, …) |
| `app/config/config.py` | `structured_shot_planner_enabled` flag |
| `test/services/test_structured_output.py` | Tests unitarios de `LiteLLMStructuredProvider` |
| `test/services/test_shot_planner.py` | Tests unitarios de `ShotPlanner` y `heuristic_shot_plan` |

---

## Fuera de ámbito (Fase 2)

- **Integración en `task.py`:** el pipeline legacy no llama al planner todavía.
  La integración (y el routing condicional) es responsabilidad de Fase 3+.
- **Agregador de medios (Fase 3+):** el `ShotPlan` generado aquí es la entrada
  para el futuro agregador que buscará y descargará clips para cada segmento.
- **Edición de timeline:** `TimelineProject` y los edit commands del dominio
  (`app/domain/editing/`) son parte de Plan 1 y no se modifican aquí.
- **WebUI/CLI:** no hay flag en Streamlit ni en `cli.py`; el planner solo se
  activa vía variable de entorno por ahora.
