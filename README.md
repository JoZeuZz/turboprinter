# MoneyPrinter Turbo 💸

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-20-339933?logo=node.js&logoColor=white)
![CI](https://github.com/JoZeuZz/turboprinter/actions/workflows/ci.yml/badge.svg)

Generador de video vertical de alta retención (TikTok, Reels, YouTube Shorts) impulsado por IA: guion, voz, material visual, subtítulos y publicación, con edición interactiva por clips antes del render final con FFmpeg.

Fork personal en español de [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo), reescrito de Python/Streamlit a TypeScript (React + Express).

## Características

**Guion y planificación**
- Generación de guion con IA (Gemini o cualquier endpoint compatible con OpenAI, incluido LM Studio en local), en primera persona por defecto para maximizar retención.
- Nichos de contenido preconfigurados (misterio, humor, ciencia, drama) que ajustan tono y estructura del guion.
- Presets de video reutilizables, editables desde la interfaz.

**Material visual**
- Búsqueda automática de clips en Pexels con unicidad garantizada: ningún clip se repite dentro de la misma línea de tiempo.
- Biblioteca de video local como alternativa o complemento a Pexels.

**Voz y música**
- Síntesis de voz con Edge TTS, con velocidad y volumen ajustables.
- Selección de música de fondo por IA según el mood del guion, o manual.

**Subtítulos**
- Subtítulos estilo TikTok en formato ASS: animaciones tipo karaoke, cajas de fondo configurables y previsualización en tiempo real idéntica al render final.

**Edición**
- Editor de línea de tiempo por clips: reordenar, sustituir y previsualizar segmentos antes de renderizar.
- Transiciones configurables entre clips.
- Ida y vuelta fluida entre edición y video finalizado sin perder progreso.

**Publicación**
- Subida directa a YouTube y TikTok vía OAuth, con título, descripción SEO y hashtags generados por IA.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Cliente | React 18, Vite 6, TypeScript, Tailwind CSS, Zustand, i18next (es/en) |
| Servidor | Node 20, Express (`server.ts`) |
| Render | FFmpeg CLI (concatenación, mezcla de audio, subtítulos ASS) |
| IA | Gemini (`@google/genai`) o cualquier endpoint compatible con OpenAI |
| Publicación | YouTube Data API (`googleapis`), TikTok API |

## Requisitos

- Node.js 20
- `ffmpeg` y `ffprobe` en el `PATH`
- Clave de [Pexels](https://www.pexels.com/api/) para búsqueda de material
- Clave de Gemini, o un endpoint OpenAI-compatible (por ejemplo LM Studio en local)

## Inicio rápido

```bash
git clone https://github.com/JoZeuZz/turboprinter.git
cd turboprinter
npm install
cp .env.example .env   # completa tus claves, ver Configuración
npm run dev             # http://localhost:3000
```

## Configuración

Variables LLM principales en `.env`:

| Variable | Uso |
|---|---|
| `PEXELS_API_KEY` | Búsqueda de material en Pexels |
| `LLM_PROVIDER` | Proveedor principal. Por defecto: `groq` |
| `LLM_FALLBACK_PROVIDERS` | Orden de fallback. Por defecto: `gemini,deepseek` |
| `LLM_REQUEST_TIMEOUT_SECONDS` | Timeout total de cada solicitud. Por defecto: `120` |
| `GROQ_API_KEY` | Credencial del proveedor principal Groq |
| `GEMINI_API_KEY` | Credencial del primer fallback Gemini |
| `DEEPSEEK_API_KEY` | Credencial del segundo fallback DeepSeek |

La cadena avanza al siguiente proveedor ante errores de red, timeout, HTTP `429` o HTTP `5xx`. Otros errores HTTP `4xx` detienen la solicitud porque suelen indicar una petición o configuración inválida.

`openai` y `lmstudio` siguen disponibles mediante selección explícita con `OPENAI_API_BASE`, `OPENAI_API_KEY` y `OPENAI_MODEL`; no forman parte de la cadena predeterminada. Guarda credenciales solo en `.env`, nunca en `config.toml`.

Guía completa de variables, despliegue en LXC/Proxmox y hardening de seguridad: [README_PERSONAL_FORK.md](README_PERSONAL_FORK.md).

## Desarrollo

```bash
npm run lint    # tsc --noEmit
npm test        # vitest run
npm run build   # build de producción (cliente + servidor)
```

Mapa de arquitectura y convenciones: [MAP.md](MAP.md). Glosario de dominio: [CONTEXT.md](CONTEXT.md).

## Roadmap

Ideas todavía sin implementar:

| Propuesta | Descripción |
|---|---|
| Edición de subtítulos en la línea de tiempo | Corregir texto o resincronizar un cue directamente desde el editor, sin regenerar la narración. |
| Locución multivoz | Asignar distintas voces TTS a diálogos o personajes dentro de un mismo guion. |
| Miniaturas generadas por IA | Generar portadas alternativas para el video final a partir del tema del guion. |

## Licencia

[MIT](LICENSE). Fork de [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo).
