# MoneyPrinterTurbo 💸 — Rama: `feat/logs-and-video-settings`

Este repositorio es una versión altamente optimizada y personalizada de **MoneyPrinterTurbo**, enfocada en la creación rápida y profesional de **videos verticales de alta retención** (estilo TikTok, Reels y YouTube Shorts) con un flujo de trabajo intuitivo, edición interactiva por clips y renderizado avanzado nativo con FFmpeg.

Este archivo actúa como el **Punto Único de Verdad (Single Source of Truth)**. Documenta con precisión milimétrica qué funcionalidades están completamente implementadas en esta rama (`feat/logs-and-video-settings`), la arquitectura del sistema y una hoja de ruta con propuestas de mejoras que aún no se han desarrollado.

---

## 🧭 Pilares de la Arquitectura

El sistema está estructurado bajo un patrón **Full-Stack unificado** con un cliente en React y un servidor en Express/Node.js que interactúa directamente con el motor de renderizado FFmpeg mediante comandos optimizados.

```
                  [ CLIENTE: React + Vite (Puerto 3000) ]
                                     │
                     (Gestión de Estado Centralizada)
                                     ▼
        ┌────────────────────────────────────────────────────────┐
        │ • useProjectWorkspaceStore (Paneles: script -> config)  │
        │ • useProjectStore (Llamadas al pipeline del backend)   │
        │ • useVideoStore (Estilos de subtítulos y animaciones)  │
        └────────────────────────────┬───────────────────────────┘
                                     │
                        (Peticiones REST a la API)
                                     ▼
                  [ SERVIDOR: Node.js + Express (server.ts) ]
                                     │
             ├─► [ IA: Generación de Guion y Estructuración ]
             ├─► [ Descarga y Unicidad de Videos (Pexels API) ]
             ├─► [ Síntesis de Voz y Sincronización de Audio ]
             │
             ▼ (Generación de Archivos ASS y llamadas a FFmpeg CLI)
                  [ MOTOR DE RENDERIZADO: FFmpeg ]
                                     │
             ├─► Concatenación de clips de video sin saltos
             ├─► Mezcla dinámica de voz (TTS) y música (BGM)
             └─► Quemado de subtítulos dinámicos de alta retención
```

---

## 🎨 Funcionalidades Implementadas en esta Rama

Aquí se detalla lo que ya está **construido, probado y completamente operativo** en esta rama. Cualquier modelo de IA o desarrollador que trabaje aquí puede dar por sentado que las siguientes características funcionan al 100%:

### 1. Sistema de Presets y Nichos de Video
* **Editor Integrado de Presets**: Se ha añadido la capacidad de crear, editar y guardar presets de video personalizados directamente desde la interfaz. Cuenta con botones de **Guardar** y **Cancelar** perfectamente integrados en el panel de configuración visual (`VideoConfigPanel.tsx`).
* **Automatización de Nichos**: Integración de nichos de contenido preconfigurados que ajustan automáticamente la configuración del video y las instrucciones de IA para el guion de acuerdo con la temática (Misterio, Humor, Ciencia, Drama).

### 2. Generación de Guiones de Alta Retención (Gemini)
* **Narrativa en Primera Persona por Defecto**: Todos los guiones automáticos se generan obligatoriamente en **primera persona del singular ("yo", "mi", "me", "mis")** simulando que el narrador cuenta una vivencia real, íntima y directa para atrapar al espectador desde el primer segundo. *(Esta regla se aplica por defecto a menos que el usuario indique lo contrario)*.
* **Control Proporcional de Longitud**: Prompt de Gemini optimizado para garantizar que, a mayor número de párrafos solicitados, el guion crezca en profundidad y extensión proporcionalmente, en lugar de reducir el tamaño o la riqueza de los párrafos individuales.
* **Estimador de Duración**: El panel del guion (`ScriptPanel.tsx`) muestra en tiempo real una estimación precisa de la duración que tomará la narración del texto para una planificación exacta de los 60 segundos del Short.

### 3. Subtítulos Estilo "TikTok" (ASS Avanzado)
* **Animaciones de Alta Retención**: Soporte para subtítulos dinámicos con animaciones fluidas tipo karaoke y previsualización exacta en tiempo real dentro del cliente React.
* **Cajas de Fondo Inteligentes (Rounded/Square)**: Implementación de capas de fondo opacas o traslúcidas configurables. Se solucionó el desplazamiento horizontal en el renderizado final alineando con precisión milimétrica la caja de fondo (`BgBox`) y el texto mediante el posicionamiento de FFmpeg.
* **Protección de Fondo Desactivado**: Se agregó una validación estricta (`blur background class guard`) para garantizar que la caja de fondo no se muestre bajo ninguna circunstancia si el usuario ha desmarcado la opción en la interfaz.

### 4. Sincronización de Audio y Mezcla Dinámica
* **Posicionamiento Absoluto en el Timeline**: Sincronización perfecta de los elementos de audio y subtítulos en la línea de tiempo mediante posicionamiento absoluto en segundos (`start_sec`), evitando desfases o solapamientos entre la voz y el video.
* **Mezcla de Audio Dinámica**: Los valores de velocidad de la voz (TTS rate), volumen de la narración y volumen de la música de fondo (BGM) se aplican de manera dinámica en tiempo real durante la síntesis y la concatenación de audio en el backend.

### 5. Estructura de Archivos Limpia y Unicidad de Recursos
* **Carpetas por Nicho/Tema**: Los recursos y renders del proyecto ya no se esparcen de forma caótica en `storage/renders`. Ahora se organizan automáticamente en subcarpetas temáticas basadas en el nicho activo, manteniendo el espacio de trabajo impecable.
* **Unicidad Absoluta de Clips**: Algoritmo que previene la selección de clips duplicados en la línea de tiempo mediante hashing y fallback cíclico de recursos de video, asegurando que cada escena sea única y visualmente atractiva.

### 6. Flujo de Navegación Profesional e Intuitivo
* **Navegación Fluida Bidireccional**: Enlace total entre el Editor de Clips (`EditorPanel.tsx`) y la pantalla de video finalizado (`DonePanel.tsx`). El usuario puede presionar el botón de **"Volver a Revisión"** (icono de tijeras) en cualquier momento para afinar detalles de los clips y volver a renderizar sin perder su configuración previa.
* **Retorno Inteligente desde Dashboard**: Al abrir un proyecto guardado desde el Dashboard que ya tiene un timeline construido (`has_timeline === true`), el sistema redirige automáticamente al usuario a la pantalla de revisión intermedia (`"editor"`) en lugar de mandarlo al inicio del flujo.

---

## 📂 Mapa de Archivos Críticos

* 💻 `src/pages/Workspace.tsx`: Orquestador de vistas del cliente. Controla la redirección inteligente basada en el estado del proyecto.
* 💻 `src/components/panels/VideoConfigPanel.tsx`: Panel para configurar dimensiones, presets y voces. Contiene la interfaz de edición e integración de botones Guardar/Cancelar.
* 💻 `src/components/panels/ScriptPanel.tsx`: Vista de generación del guion por IA, estimación de duración y configuración de primera persona por defecto.
* 💻 `src/components/panels/EditorPanel.tsx`: Mesa de trabajo con línea de tiempo interactiva, previsualización de clips y botón de renderizado.
* 💻 `src/components/panels/DonePanel.tsx`: Reproductor del video final renderizado y botón de retorno inteligente ("Volver a Revisión").
* 💻 `src/store/useVideoStore.ts`: Almacena y maneja el estado de los subtítulos, colores, fuentes, animaciones y estilos de fondo.
* ⚙️ `server.ts`: Servidor Express de producción. Maneja la orquestación de renderizado, prompts de Gemini optimizados, unicidad de clips, escritura de subtítulos ASS y llamadas a FFmpeg.

---

## 🚀 Guía de Desarrollo y Comandos Rápidos

Si necesitas reiniciar, verificar o probar esta rama de manera local y limpia:

### 1. Limpieza y Reinstalación de Dependencias
```bash
# Limpiar e instalar todas las dependencias declaradas en el package.json
npm install
```

### 2. Validación de Calidad y Tipos (Linter)
```bash
# Ejecutar verificación rápida de sintaxis y tipos sin compilar
npm run lint
```

### 3. Compilación de Producción
```bash
# Compilar la aplicación React y el bundle del servidor Express
npm run build
```

### 4. Ejecución en Desarrollo
```bash
# Iniciar el servidor de desarrollo local integrado en el puerto 3000
npm run dev
```

---

## 🗺️ Hoja de Ruta: Propuestas de Próximas Mejoras (No Implementadas)

Para continuar elevando la calidad del proyecto en el futuro, se recomiendan las siguientes implementaciones que **aún no se han desarrollado** en la rama actual:

| Propuesta | Descripción | Impacto | Complejidad |
| :--- | :--- | :--- | :--- |
| 🎵 **Selección de Música por IA** | Gemini analiza el guion generado, determina el "mood" emocional (ej: tenso, alegre, motivacional) y selecciona automáticamente la pista de música de fondo idónea de nuestra biblioteca local. | Alto (Inmersión) | Media |
| ✍️ **Edición de Subtítulos en el Timeline** | Permitir al usuario hacer doble clic directamente sobre un bloque de subtítulo en la línea de tiempo interactiva de `EditorPanel` para corregir palabras mal transcritas o ajustar la sincronización. | Crítico (Edición) | Alta |
| 👥 **Locución Multivoz (Diálogos)** | Soporte para guiones con diálogos o múltiples personajes, asignando diferentes voces de síntesis (ej: una voz masculina y una femenina) a párrafos específicos marcados en el guion. | Alto (Dinamicidad) | Alta |
| 🖼️ **Generador de Miniaturas Integrado** | Incorporar un botón en la pantalla de video finalizado (`DonePanel`) que utilice IA para autogenerar tres opciones de portadas/miniaturas llamativas basadas en el tema del video para su descarga directa. | Medio (Retención) | Media |
| 🌀 **Transiciones de Clip Avanzadas** | Permitir la aplicación de efectos de transición (desvanecimientos, zooms o barridos) entre los clips individuales desde el editor de línea de tiempo antes de enviar a renderizar. | Alto (Visual) | Alta |

---

*Desarrollado y mantenido con foco en la retención de audiencia, optimización de renderizado y flujos de trabajo profesionales de contenido vertical.*
