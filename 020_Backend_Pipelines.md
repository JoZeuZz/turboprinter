# ⚙️Capa de Servidor (Node.js + Express)

tags: #backend #express #ffmpeg #node #video

  

Este documento describe la arquitectura del backend unificado (`server.ts`), la lógica de sincronización, la descarga inteligente de assets y el procesamiento gráfico multimedia con **FFmpeg**.

  

---

  

## 🧭 CONEXIONES DEL SISTEMA

*   Ir al inicio de la bóveda: [[000-INICIO]]

*   Ver cómo interactúa con el cliente: [[010-FRONTEND]]

*   Consultar reglas de desarrollo para IA: [[MAP]]

  

---

  

## 1. FLUJO GENERAL DEL RENDERIZADO (PIPELINE)

  

El backend expone puntos de acceso estructurados bajo `/api/v1/projects/*` para ejecutar paso a paso el pipeline de generación de video:

  

```

[ Petición Render ] ➔ [ 1. Preparar Caché ] ➔ [ 2. Generar Audios ] ➔ [ 3. Formatear Videos ]

                                                                             │

[ Salida Final ] ◄── [ 6. Subtítulos ASS ] ◄── [ 5. Mezcla de Audio ] ◄──────┘

```

  

---

  

## 2. ALGORITMO DE UNICIDAD DE CLIPS

  

Durante la construcción del timeline (`/timeline/build`), el backend consulta la API de Pexels para obtener clips de video relacionados con cada segmento. Para garantizar un flujo visual dinámico y evitar repetir el mismo clip a lo largo del video:

  

*   **Identificador de Clip Unico:** Se calcula un hash único o ID para cada video retornado.

*   **Fallback Cíclico:** Si el término de búsqueda devuelve pocos resultados o todos ya han sido asignados, el algoritmo realiza una búsqueda inteligente secundaria o rota cíclicamente sobre los clips disponibles, garantizando que no se repitan videos consecutivos en la línea de tiempo final.

  

---

  

## 3. PROCESAMIENTO DE AUDIO Y VOZ (TTS & BGM)

  

1.  **Narración por Segmentos:** Cada escena o segmento del guion genera un bloque de voz sintética individual (`.mp3` ➔ convertido internamente a `.wav` para procesamiento de audio preciso).

2.  **Sincronización:** El backend calcula la duración exacta de cada bloque de audio para definir la duración del clip de video correspondiente en la línea de tiempo.

3.  **Mezcla Compleja (Audio Mixing):**

    *   La narración de voz y la música de fondo (BGM) se mezclan con volúmenes controlados de manera independiente.

    *   Filtro FFmpeg utilizado: `[1:a]volume=1.0[v];[2:a]volume=0.2[m];[v][m]amix=inputs=2:duration=first[a]`.

  

---

  

## 4. MOTOR DE SUBTÍTULOS AVANZADOS (ASS)

  

Para quemar subtítulos fluidos estilo "TikTok" en el video sin crear bloques negros gigantescos detrás de las letras, el servidor utiliza subtítulos en formato **Advanced SubStation Alpha (`.ass`)**:

  

*   **Fuentes Locales en FFmpeg (fonts.conf):** El backend autogenera un archivo XML de configuración de fuentes (`fonts.conf`) dinámico por tarea de renderizado. En este XML se inyectan las rutas de `./public/fonts/` y `./resource/fonts/` (junto con la ruta de fuentes del sistema `/usr/share/fonts`). Las variables `FONTCONFIG_FILE` y `FONTCONFIG_PATH` se pasan en el entorno de ejecución de FFmpeg para que la librería `libass` renderice las tipografías locales con precisión píxel por píxel.

*   **Subtítulos con Fondo Inteligente (Double-Layer rendering):**

    *   **Capa de Fondo (Layer 0):** Cuando la caja de fondo está habilitada (sólida o translúcida), se crea una capa con estilo `BgBox` (BorderStyle = 3) y canal alfa personalizado para dibujar la caja protectora negra de forma precisa detrás del texto.

    *   **Capa Frontal (Layer 1):** Dibuja el texto del color de primer plano seleccionado (`textColor`), con un fino borde o outline (`strokeColor`) utilizando el estilo `Default` (BorderStyle = 1).

    *   Este sistema de dos capas asegura que el texto conserve su nitidez y el fondo tenga el nivel exacto de opacidad o translucidez requerido sin ensuciar la visual.

  

---

  

## 🛡️ DIRECTRICES DE ROBUSTEZ EN SERVIDOR

1.  **Lazy Initialization de Dependencias:** El SDK de IA o de APIs externas se inicializan únicamente cuando se realiza la llamada al endpoint, evitando caídas automáticas del servidor por variables de entorno faltantes.

2.  **Limpieza de Temporales:** El backend elimina todos los archivos de caché generados intermedios (`formatting_*.mp4`, `concat_*.txt`, etc.) tras el éxito o fallo de la compilación, manteniendo el almacenamiento siempre limpio.