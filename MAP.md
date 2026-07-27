# INSTRUCCIONES DE INICIO

```markdown

Hola. Actúa como un desarrollador experto Full-Stack especializado en React, TypeScript y Node.js/Express.

Acabo de abrir mi proyecto "MoneyPrinter Turbo" en este entorno de desarrollo.

  

Para comenzar, lee y procesa este archivo (`MAP.md`) detenidamente. Este documento contiene la arquitectura completa, el mapa de archivos clave, los flujos de estado y las reglas de diseño del proyecto.

  

Por favor:

1. No inventes código ni asumas dependencias que no estén listadas aquí.

2. Mantén las respuestas técnicas concisas y al grano.

3. Respeta estrictamente los patrones de estado (useProjectStore, useProjectWorkspaceStore) y renderizado (FFmpeg en backend con estilos ASS).

  

Confirma únicamente que has absorbido y comprendido el contexto del mapa del proyecto y pregúntame cuál es la tarea en la que trabajaremos hoy.

```

  

---

# MAPA DEL PROYECTO: MoneyPrinter Turbo


Este archivo sirve como el **punto único de verdad (Single Source of Truth)** para que cualquier modelo de IA (ChatGPT, Claude, Gemini, modelos locales en VS Code, etc.) entienda instantáneamente el contexto del proyecto sin necesidad de consumir miles de tokens leyendo archivos completos.

  

---

## 1. RESUMEN DE ARQUITECTURA

El proyecto es una aplicación **Full-Stack** que genera videos automáticos en formato vertical (TikTok/Reels) oaxp (YouTube) basados en inteligencia artificial o guiones personalizados, permitiendo una edición interactiva por clips en una línea de tiempo antes del renderizado final.


```

       [ CLIENTE: React + Vite ]

                  │

                  ▼ (Store local y persistente)

   ┌────────────────────────────────────────────────────────┐

   │ • useProjectWorkspaceStore (Navegación de paneles:      │

   │   script -> config -> editor -> done)                  │

   │ • useProjectStore (Estado del pipeline del backend)    │

   │ • useVideoStore (Configuración visual y subtítulos)    │

   └──────────────────────┬─────────────────────────────────┘

                          │

                          ▼ (Peticiones REST a Puerto 3000)

       [ SERVIDOR: Node.js + Express (server.ts) ]

                  │

                  ├─► [ Procesamiento de Guion y Estructura ]

                  ├─► [ Descarga y Unicidad de Videos (Pexels) ]

                  ├─► [ Generación de Audio y Sincronización ]

                  │

                  ▼ (Llamadas a FFmpeg del sistema)

       [ MOTOR DE RENDERIZADO: FFmpeg CLI ]

                  │

                  ├─► Concatenación de clips de video

                  ├─► Mezcla de voz (TTS) + música de fondo (BGM)

                  └─► Quemado de subtítulos dinámicos (ASS/SRT)

```


---

## 2. MAPA DE ARCHIVOS CLAVE Y SU PROPÓSITO

> El glosario canónico de términos está en `CONTEXT.md`.

### Frontend (`/src`)

*   `src/pages/Workspace.tsx`: El orquestador principal de la mesa de trabajo. Maneja la carga de proyectos y despacha la navegación entre pantallas basándose en si existe una línea de tiempo (`has_timeline`).

*   `src/pages/Dashboard.tsx`: Lista de proyectos guardados y entrada para creación de nuevos videos.

*   `src/store/useProjectWorkspaceStore.ts`: Controla el panel visual activo (`panel`: `"script" | "config" | "editor" | "done"`) y almacena las URLs de los videos listos.

*   `src/store/useProjectStore.ts`: Orquesta las llamadas asíncronas al backend para el pipeline paso a paso:

    1.  `plan`: Genera el plan de escenas y el guion.

    2.  `narration`: Genera los audios de narración correspondientes.

    3.  `buildTimeline`: Diseña la pista de video clip por clip.

    4.  `render`: Llama al servidor para ejecutar FFmpeg y compilar el video final.

*   `src/store/useVideoStore.ts`: Almacena las preferencias visuales del usuario (estilos de subtítulos, fuente, colores, tamaño, tipo de caja de fondo, etc.).

*   `src/components/panels/EditorPanel.tsx`: Interfaz de la "Pantalla de Revisión". Permite visualizar la línea de tiempo, cambiar clips individuales, previsualizar segmentos y enviar a renderizar.

*   `src/components/panels/DonePanel.tsx`: Pantalla de video finalizado. Incluye un botón para **"Volver a Revisión"** que permite regresar al `EditorPanel` sin perder progreso.

  

### Backend (`/server.ts`)

*   `server.ts`: El servidor Express de producción unificado.

    *   `app.post("/api/v1/projects/:id/timeline/build")`: Construye la línea de tiempo del proyecto asegurando **completa unicidad de recursos (asset uniqueness)** entre clips de video usando fallback cíclico y hashes.

    *   `app.post("/api/v1/projects/:id/render")`: Orquesta el proceso real de renderizado con FFmpeg.

    *   `fonts.conf`: Archivo xml autogenerado en tiempo de ejecución para inyectar correctamente fuentes cargadas localmente (`public/fonts/` y `resource/fonts/`) en libass de FFmpeg.

### Backend modular (`/src/server`)

*   `render.ts`: pipeline FFmpeg completo (formateo de clips, concat, mezcla de audio, quemado de subtítulos ASS).

*   `pexels.ts`: búsqueda de material y unicidad de clips.

*   `tts.ts`: síntesis de voz (Edge TTS).

*   `llm.ts`: proveedores LLM (Gemini y endpoints OpenAI-compatibles).

*   `projectsRepo.ts`: persistencia en `storage/projects_db.json`.

*   `youtubeChannels.ts`: credenciales OAuth por canal de YouTube.

*   `tiktokCredentials.ts`: credenciales OAuth por cuenta de TikTok.

*   `envFile.ts`: escritura de `.env`.

### Lógica pura compartida (`/src/lib`)

*   `src/lib/subtitleLayout.ts`: el motor único de subtítulos (splitting, geometría, color, emisión ASS/SRT). `generateAss(...)` vive aquí, no en `server.ts`; `server.ts` importa de este módulo (`server.ts:8-12`). Regla del glosario canónico (`CONTEXT.md`): toda lógica de subtítulos vive en `src/lib/subtitleLayout.ts`, nunca duplicada en un adapter.


  

---

## 3. FLUJOS DE ESTADO Y NAVEGACIÓN PRINCIPAL

Es crítico que cualquier IA que modifique el flujo de navegación entienda estas **reglas de negocio**:


1.  **Entrada a Proyectos Existentes**:

    *   Al hacer clic en un proyecto guardado desde el Dashboard, `Workspace.tsx` cargará su estado.

    *   **Regla**: Si el proyecto ya tiene un timeline (`has_timeline === true`), se debe dirigir al usuario siempre a la pantalla intermedia de revisión (`"editor"`), **nunca** directamente a la pantalla de video finalizado (`"done"`). Esto permite que el usuario revise o ajuste sus clips antes de ver el video renderizado.

2.  **Retorno desde Video Finalizado**:

    *   En el `DonePanel.tsx`, el botón de regreso (Scissors / "Volver a Revisión") debe apuntar explícitamente a `"editor"`, permitiendo una navegación fluida hacia atrás para reajustar los clips y volver a renderizar.

  

---

## 4. MOTOR DE SUBTÍTULOS (ESTILOS Y FUENTES)

Para dar soporte a subtítulos estilizados estilo "TikTok":

*   **Fuentes personalizadas**: Los archivos de fuentes residen en `./public/fonts/` y `./resource/fonts/` (ej: `Charm-Bold.ttf`, `UTM_Kabel_KT.ttf`).

*   **Integración con FFmpeg**: El servidor backend escribe un archivo temporal `fonts.conf` apuntando a estos directorios y define las variables de entorno `FONTCONFIG_FILE` y `FONTCONFIG_PATH` antes de que FFmpeg ejecute el filtro `subtitles`.

*   **Filtros ASS**: Los subtítulos se compilan en formato Advanced SubStation Alpha (`.ass`) con dos capas cuando la caja de fondo está habilitada (Capa 0: `BgBox` para la caja negra/translúcida, Capa 1: `Default` para el texto de color frontal con outline fino).

  

---
## 5. DIRECTRICES DE DESARROLLO (Anti-Errores)

Cualquier cambio de código posterior debe cumplir con las siguientes directrices:

  

*   **Evitar Re-renders Infinitos en React**: Nunca actualices un estado de React en el cuerpo principal de un componente. Mantén los arrays de dependencias de `useEffect` con valores primitivos y estables siempre que sea posible.

*   **Seguridad en el Lado del Servidor**: La inicialización de APIs externas o configuraciones locales debe realizarse de forma segura y "lazy" para evitar que el servidor Express se caiga si faltan llaves en el archivo `.env`.

*   **Uso de Tailwind CSS**: Utiliza únicamente utilidades directas de Tailwind. No declares archivos `.css` secundarios ni uses estilos inline que rompan la consistencia estética.

*   **Comunicaciones**: Cuando completes una tarea, descríbela enfocándote en los resultados de diseño o experiencia de usuario, evitando explicaciones excesivamente técnicas sobre rutas de archivos internas o detalles del compilador.