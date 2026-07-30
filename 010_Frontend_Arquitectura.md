# 📱Capa de Cliente (React + Vite)

tags: #frontend #react #zustand #tailwind

  

Este documento detalla la estructura, las pantallas de usuario (paneles) y la lógica de estado que gobiernan la interfaz interactiva de **MoneyPrinter Turbo**.

  

---

  

## 🧭 CONEXIONES DEL SISTEMA

*   Ir al inicio de la bóveda: [[000-INICIO]]

*   Ver cómo interactúa con el servidor: [[020-BACKEND]]

*   Consultar reglas de desarrollo para IA: [[MAP]]

  

---

  

## 1. FLUJO DE TRABAJO (WORKSPACE PANELS)

  

El Workspace principal (`src/pages/Workspace.tsx`) no utiliza un enrutador clásico (como react-router), sino una navegación basada en un **estado secuencial de paneles** almacenado en el store. Esto asegura transiciones fluidas y una experiencia súper enfocada.

  

```

┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐

│  "script"    ├─────►│   "config"   ├─────►│   "editor"   ├─────►│    "done"    │

└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘

 Generar guion o       Ajustar voz,          Línea de tiempo,      Video final.

 pegar texto.          música y estilo.      revisar/cambiar       Botón para

                                             clips y renderizar    volver al editor.

```

  

*   **Punto de entrada de proyectos existentes:** Al reabrir un proyecto guardado, si el proyecto ya cuenta con una línea de tiempo generada (`has_timeline === true`), el sistema lo redirige directamente a la pantalla de **Revisión Intermedia (`"editor"`)**, permitiendo revisar o ajustar los clips antes de gastar recursos de renderizado.

  

---

  

## 2. COMPONENTES CLAVE Y PANELES

  

*   `src/components/panels/ScriptPanel.tsx`: Captura la idea o el guion manual del usuario. Llama al backend para iniciar la fase de planificación (`plan`).

*   `src/components/panels/VideoConfigPanel.tsx`: Panel lateral izquierdo de configuración. Permite seleccionar voces, ajustar volumen de música de fondo, activar/desactivar subtítulos y elegir fuentes/estilos.

*   `src/components/panels/EditorPanel.tsx`: **Mesa de Revisión Intermedia**. Muestra los clips organizados cronológicamente, permitiendo previsualizar el video y la narración asociada a cada escena, así como regenerar clips específicos antes de lanzar el render.

*   `src/components/panels/DonePanel.tsx`: Pantalla de éxito con reproductor de video nativo. Cuenta con el botón de retorno rápido a la mesa de edición (`"editor"`) para realizar correcciones sobre la marcha de forma ágil.

  

---

  

## 3. GESTIÓN DE ESTADO (ZUSTAND STORES)

  

El estado global está altamente optimizado y dividido para evitar re-renders innecesarios:

  

### A. `useProjectWorkspaceStore` (`src/store/useProjectWorkspaceStore.ts`)

*   **Propósito:** Controla el flujo de pantallas y la interfaz de usuario en el workspace.

*   **Variables Clave:**

    *   `panel`: `"script" | "config" | "editor" | "done"` (Controla qué vista se renderiza).

    *   `videoUrls`: Array de URLs con los resultados de video finales.

  

### B. `useProjectStore` (`src/store/useProjectStore.ts`)

*   **Propósito:** Orquesta y ejecuta el pipeline de llamadas asíncronas al servidor.

*   **Métodos Principales:**

    *   `open(projectId)`: Carga el estado del proyecto desde la base de datos o la memoria intermedia del servidor.

    *   `plan(scriptText, topic, duration, style)`: Genera la estructura inicial de escenas.

    *   `narration()`: Genera los audios de voz (TTS).

    *   `buildTimeline()`: Construye los clips sincronizados con los audios de la narración.

    *   `render()`: Dispara la orquestación de FFmpeg en el backend para consolidar el video definitivo.

  

### C. `useVideoStore` (Configurador Estético)

*   **Propósito:** Almacena todos los atributos visuales de los subtítulos de video, tales como:

    *   `font_name` (Fuentes estilizadas cargadas como `Charm-Bold.ttf` o `UTM_Kabel_KT.ttf`).

    *   `text_fore_color` (Color principal de letra).

    *   `text_background_color` / `subtitle_bg_style` (Estilos de caja: sólida, translúcida u opaca).

    *   `rounded_subtitle_background` (Bordes redondeados para subtítulos de fondo).

  

---

  

## 🛡️ PAUTAS PARA PREVENIR ERRORES EN FRONTEND

1.  **Evitar Loops de Re-renderizado:** En componentes interactivos complejos, nunca actualices el estado del store directamente en el flujo de render del componente. Usa siempre manejadores de eventos o `useEffect` con dependencias primitivas bien controladas.

2.  **Transiciones Limpias:** Al saltar de pantalla, utiliza animaciones ligeras mediante `motion` de `motion/react` para mantener una interfaz elegante y profesional sin sobrecargar el hilo principal.