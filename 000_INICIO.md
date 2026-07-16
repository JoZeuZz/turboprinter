# 🗺️ Mapa de Contenido Principal (MOC)

tags: #moc #index #turboprinter

  

Bienvenido a la bóveda de conocimiento de **MoneyPrinter Turbo**. Este archivo actúa como el núcleo central de navegación para entender todo el sistema. Si estás usando la vista de Grafo de Obsidian, verás cómo este archivo conecta directamente con todos los pilares esenciales del proyecto.

  

---

  

## 🎯 PROPÓSITO DEL PROYECTO

MoneyPrinter Turbo es una plataforma full-stack diseñada para la creación automatizada y edición interactiva de videos cortos (estilo TikTok/Reels) o largos usando Inteligencia Artificial para la planificación de guiones, locución de voz (TTS), búsqueda inteligente de recursos visuales y renderizado nativo con FFmpeg.

  

---

  

## 🧭 PILARES DE LA ARQUITECTURA

  

Para navegar por el proyecto de forma guiada, explora los siguientes mapas especializados:

  

### 📱 1. [[010-FRONTEND|Capa de Cliente (Frontend)]]

*La interfaz interactiva del usuario y sus flujos de estado.*

*   **Tecnologías:** React, Vite, Zustand, Tailwind CSS, Lucide Icons.

*   **Flujo clave:** Gestión dinámica de paneles (`script` ➔ `config` ➔ `editor` ➔ `done`).

*   **Stores de Estado:** [[010-FRONTEND#3. GESTIÓN DE ESTADO (ZUSTAND)|useProjectWorkspaceStore, useProjectStore y useVideoStore]].

  

### ⚙️ 2. [[020-BACKEND|Capa de Servidor (Backend)]]

*El motor lógico, la persistencia local y el procesamiento de video.*

*   **Tecnologías:** Node.js, Express, FFmpeg nativo, File System API.

*   **Flujo clave:** Búsqueda inteligente en Pexels con garantía de [[020-BACKEND#2. ALGORITMO DE UNICIDAD DE CLIPS|Unicidad Absoluta de Assets]], generación de pistas de audio y subtitulación avanzada.

*   **Lógica de Renderizado:** Construcción dinámica de filtros de video y quemado de subtítulos avanzados mediante subtítulos [[020-BACKEND#4. MOTOR DE SUBTÍTULOS AVANZADOS (ASS)|ASS de doble capa]].

  

### 📌 3. [[MAP|Mapa de Referencia Rápida para IA]]

*El archivo condensado con las reglas estrictas de desarrollo y el mapa de archivos para alimentar de forma óptima a cualquier Inteligencia Artificial externa.*

  

---

  

## 📈 CONECTIVIDAD DEL GRAFO (Visualización en Obsidian)

> [!TIP]

> **Consejo para el Grafo:** Si has filtrado `node_modules` y carpetas de build, verás un hermoso triángulo de conectividad pura donde:

> `000-INICIO` ➔ Se conecta a [[010-FRONTEND]] y [[020-BACKEND]]

> [[010-FRONTEND]] ➔ Se conecta con [[020-BACKEND]] (por medio de las llamadas a la API `/api/v1/*`)

> Todos ellos apuntan de vuelta a [[MAP]] para mantener las reglas del desarrollo siempre presentes.