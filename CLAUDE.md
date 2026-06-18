# CLAUDE.md

## Contexto del proyecto

Este repositorio es un fork personal de MoneyPrinterTurbo orientado a:
- vídeo corto en español
- máxima calidad audiovisual razonable
- despliegue personal en LXC/Proxmox
- mantener compatibilidad con upstream

La capa `Personal Quality Stack` es opcional. Si `[quality].enabled = false`, el comportamiento debe seguir siendo equivalente a upstream.

## Reglas operativas

- Explora primero, planea después, cambia al final.
- Antes de editar: revisa `git status`, rama actual y archivos relacionados.
- Prefiere módulos nuevos, adaptadores y flags antes que reescrituras grandes.
- No rompas WebUI, API ni CLI existentes.
- No elimines funcionalidad de upstream salvo instrucción explícita.
- Todo cambio nuevo debe ser revisable en diffs pequeños.
- Todo cambio personal debe quedar documentado en `README_PERSONAL_FORK.md` si afecta uso o despliegue.

## Git y commits

- No hagas commit sin solicitud explícita del usuario.
- Antes de proponer commit, muestra:
  - `git status --short`
  - resumen de archivos cambiados
  - mensaje de commit propuesto
- Nunca agregues trailers `Co-Authored-By`, `Co-authored-by`, `Generated with Claude Code` ni otra atribución AI.
- No hagas push sin solicitud explícita.
- Evita reescribir historia publicada salvo instrucción explícita.

## Estrategia de sincronización con upstream

- `main` debe mantenerse lo más cerca posible de upstream.
- El trabajo personal vive en ramas como:
  - `personal/quality-stack`
  - `personal/observability`
  - `personal/security`
  - `personal/lxc-deploy`
- Cuando un cambio pueda vivir en `app/services/quality/`, hazlo ahí antes de tocar archivos grandes de upstream.
- Si hay conflicto con upstream, prioriza re-aplicar hooks pequeños sobre reescribir archivos enteros.

## Prioridades técnicas

Prioridad alta:
- render final
- subtítulos premium
- selección de materiales
- observabilidad
- CI y tests de la capa quality

Prioridad media:
- ranking semántico opcional
- hardening para despliegue detrás de proxy
- TTS local opcional

## Restricciones de runtime

No diseñes funciones que dependan obligatoriamente de:
- OpenAI API
- Anthropic API

Sí prioriza:
- Ollama
- providers OpenAI-compatible configurables
- Pollinations si ya está soportado
- guiones pegados manualmente
- biblioteca local de materiales

## Reglas de implementación

- Usa `pyproject.toml` como fuente de dependencias.
- Mantén compatibilidad `>=3.11,<3.13`.
- No introduzcas dependencia GPU-obligatoria.
- Si agregas dependencias, explica por qué no bastaban las existentes.
- Los cambios de config deben ser tolerantes a claves ausentes.
- Si una mejora no está lista para todos los entornos, déjala opt-in.

## Validación mínima

Después de cambios relevantes, intenta ejecutar:
- `uv lock --check`
- `uv run python -m compileall app webui`
- `uv run pytest`
- `uv run python cli.py --help`

Si algo no se puede validar por entorno, dilo explícitamente.

## Reglas específicas del fork

- No toques `.gitignore` para volver a ignorar `CLAUDE.md` o `.claude/settings.json` si ya fueron versionados.
- Mantén `README_PERSONAL_FORK.md` actualizado.
- Si tocas render o subtítulos, añade o actualiza tests de `test/services/test_quality_*`.
- Si tocas observabilidad, evita introducir ruido en la UI principal; usa paneles avanzados o debug mode.
