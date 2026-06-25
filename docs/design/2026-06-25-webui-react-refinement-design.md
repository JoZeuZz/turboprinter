# WebUI React — Refinamiento UI (Opción A: Parches incrementales)

**Fecha:** 2026-06-25  
**Alcance:** webui-react + endpoint backend de voces  
**Rama destino:** `main` (fork personal)

---

## 1. Contexto

El webui-react actual tiene cinco problemas concretos:

1. **Estado perdido al navegar** — `useVideoStore` y `useProjectWorkspaceStore` usan Zustand sin persistencia. Navegar a Settings y volver resetea el panel a "script" y borra el proyecto activo.
2. **TTS provider faltante** — Solo hay un selector de voz hardcodeado (voces Azure). Streamlit ofrece Azure V1, Azure V2, SiliconFlow, Gemini TTS, MiMo TTS con listas dinámicas por proveedor.
3. **Sin reordenamiento visual de clips** — `ReviewPanel` permite excluir clips pero no reordenarlos. El `EditorPanel` tiene una Timeline estática sin interacción.
4. **Sin preview de clips** — No hay forma de ver el contenido de un clip antes de renderizar.
5. **UI inconsistente** — Mezcla de `<input>` raw y componentes estilizados; espaciado y tipografía variables.

---

## 2. Decisiones de diseño

| Decisión | Elección |
|---|---|
| Enfoque general | Opción A: parches incrementales (diff mínimo, sin romper tests) |
| Reordenamiento | Grid drag & drop con miniaturas |
| Preview de clips | Modal con `<video>` usando `source_url` del clip (sin backend) |
| Persistencia | `sessionStorage` via `zustand/persist` |
| Voces TTS | Endpoint backend nuevo; frontend fetch dinámico |
| UI | Pulir existente (misma paleta dark, sin rediseño estructural) |

---

## 3. Arquitectura y componentes

### 3.1 Persistencia de estado

**Archivos afectados:** `src/store/useVideoStore.ts`, `src/store/useProjectWorkspaceStore.ts`, `src/store/useProjectStore.ts`

Envolver los tres stores con `persist` de `zustand/middleware`:

```
useVideoStore       → persist en sessionStorage, key "mpt-video"
                      persiste: todos los campos VideoParams
useProjectWorkspaceStore → persist en sessionStorage, key "mpt-workspace"  
                      persiste: panel, topic, taskId, videoUrls, error
                      excluye: taskStatus (estado efímero de polling)
useProjectStore     → persist en sessionStorage, key "mpt-project"
                      persiste: projectId, project
                      excluye: mode, renderStatus, timelineValidation
```

Al cargar con `taskId` existente y panel "generating", el componente `GeneratingPanel` debe reanudar el polling automáticamente (ya está implícito si el panel se restaura a "generating").

### 3.2 Endpoint backend de voces

**Archivo nuevo:** `app/controllers/v1/video.py` (ruta adicional en el router existente)

```
GET /api/v1/voices?provider={provider}
```

Parámetro `provider`: `azure-tts-v1` | `azure-tts-v2` | `siliconflow` | `gemini-tts` | `mimo-tts` | `no-voice`

Respuesta:
```json
{
  "voices": [
    { "value": "es-ES-AlvaroNeural", "label": "es-ES Álvaro (Male)" }
  ]
}
```

Implementación: llama a las funciones existentes en `app/services/voice.py` (`get_all_azure_voices`, `get_siliconflow_voices`, etc.). Para Azure, filtra por "V2" en el nombre según el provider seleccionado. Para `no-voice`, retorna lista vacía.

**Archivo nuevo en API client:** `src/api/voice.ts` — función `getVoices(provider: string)`.

**Tipo nuevo en `src/api/types.ts`:**
```ts
export const TTS_PROVIDERS = [
  { value: "no-voice", label: "Sin voz" },
  { value: "azure-tts-v1", label: "Azure TTS V1" },
  { value: "azure-tts-v2", label: "Azure TTS V2" },
  { value: "siliconflow", label: "SiliconFlow TTS" },
  { value: "gemini-tts", label: "Google Gemini TTS" },
  { value: "mimo-tts", label: "Xiaomi MiMo TTS" },
] as const;

export type TtsProvider = typeof TTS_PROVIDERS[number]["value"];

export interface VoiceOption {
  value: string;
  label: string;
}
```

**`useVideoStore`:** añadir campo `tts_provider: TtsProvider` con default `"azure-tts-v1"`. El campo `voice_name` ya existe. **No** añadir `tts_provider` a `VideoParams` (es solo UI config; el backend ya infiere el proveedor del prefijo del `voice_name`).

### 3.3 TTS provider en VideoConfigPanel

**Archivo:** `src/components/panels/VideoConfigPanel.tsx`, tab "audio"

Orden de controles en tab Audio:
1. `Select` TTS Provider (con opciones de `TTS_PROVIDERS`)
2. Al cambiar provider → `useEffect` que llama `voiceApi.getVoices(provider)` y actualiza lista local `voiceOptions`
3. `Select` Voz (opciones dinámicas; reset a `""` al cambiar provider)
4. Slider Voice Volume
5. Slider Voice Rate
6. Select BGM
7. Slider BGM Volume

Si provider es `no-voice`, ocultar los controles de voz (Volume, Rate, Voz).

### 3.4 Reordenamiento de clips con D&D

**Dependencias nuevas:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

**Archivo:** `src/components/panels/ReviewPanel.tsx` — reemplaza el contenido interno

Estado local:
```ts
const [orderedClips, setOrderedClips] = useState<TimelineItem[]>(clips);
const [excluded, setExcluded] = useState<Set<string>>(new Set());
const [previewClip, setPreviewClip] = useState<TimelineItem | null>(null);
```

Cuando `clips` cambia (primer load), sincronizar con `orderedClips`.

**Componente nuevo:** `src/components/panels/SortableClipCard.tsx`
- Props: `clip: TimelineItem`, `excluded: boolean`, `onExclude`, `onPreview`
- Usa `useSortable` de `@dnd-kit/sortable`
- Layout: thumbnail (o placeholder si no hay), badge duración, botón ▶ (preview), botón ✕ (excluir/incluir), handle de drag (icono ⠿ en esquina)
- Estado excluido: opacidad reducida + tachado

Grid wrapper:
```tsx
<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={orderedClips.map(c => c.id)} strategy={rectSortingStrategy}>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {orderedClips.map(clip => <SortableClipCard key={clip.id} ... />)}
    </div>
  </SortableContext>
</DndContext>
```

`handleDragEnd`: reordena `orderedClips` usando `arrayMove` de `@dnd-kit/sortable`.

**Lógica de render:**
```ts
const handleRender = async () => {
  const videoTrackId = videoTrack?.id ?? "";
  let accStart = 0;
  const commands: EditCommand[] = [];

  for (const clip of orderedClips) {
    if (excluded.has(clip.id)) {
      commands.push({ type: "set_timing", track_id: videoTrackId, item_id: clip.id, duration_sec: 0 });
    } else {
      commands.push({ type: "move", track_id: videoTrackId, item_id: clip.id, new_start_sec: accStart });
      accStart += clip.duration_sec;
    }
  }

  await projectStore.applyTimelineCommands({ commands });
  await projectStore.render();
  setPanel("rendering");
};
```

### 3.5 Modal de preview de clip

**Componente nuevo:** `src/components/ui/ClipPreviewModal.tsx`
- Props: `clip: TimelineItem | null`, `onClose: () => void`
- Si `clip === null` → no renderiza nada
- Overlay oscuro fullscreen con click-out para cerrar
- Centro: `<video src={clip.source_url ?? clip.local_path ?? ""} controls autoPlay className="max-h-[70vh] max-w-[90vw] rounded-md" />`
- Título del clip si tiene `text` o fallback al `id`
- Tecla Escape para cerrar (event listener)

Integración: `ReviewPanel` renderiza `<ClipPreviewModal clip={previewClip} onClose={() => setPreviewClip(null)} />` al final.

Exportar desde `src/components/ui/index.ts`.

### 3.6 UI polish

**Objetivo:** consistencia sin cambiar estructura.

1. **Inputs raw → componente `Input`:** en `VideoConfigPanel.tsx` hay dos `<input type="number">` sueltos (Video Count, Font Size). Reemplazar con `<Input type="number" ... />`.

2. **NavBar:** añadir link "Workspace" que navega a `/` cuando no hay proyecto activo, o al proyecto activo (`/project/:id`) cuando `useProjectStore.projectId` existe.

3. **TopicBar:** mostrar badge de estado del proyecto (`useProjectStore.mode`) junto al topic. Badge: `idle`=gris, `loading`=amarillo pulsante, `ready`=verde, `error`=rojo.

4. **Tipografía consistente:** auditar que todos los `label` usen `text-xs font-medium text-muted` (igual al componente `Input`).

5. **`AudioSubtitlePanel`:** este componente es un duplicado del tab Audio/Subtitles de `VideoConfigPanel`. Queda como está (no se usa en el flujo principal); no borrar para no romper imports.

---

## 4. Flujo de datos TTS

```
usuario selecciona provider
  → set tts_provider en useVideoStore (solo UI)
  → useEffect dispara GET /api/v1/voices?provider=xxx
  → voiceOptions actualiza
  → store.set("voice_name", "") si el voice actual no está en nueva lista
backend recibe VideoParams con voice_name="siliconflow:FunAudioLLM/CosyVoice2-0.5B:alex-Male"
  → app/services/voice.py infiere proveedor por prefijo
```

---

## 5. Flujo de reordenamiento

```
ReviewPanel monta
  → orderedClips = clips del videoTrack
usuario D&D
  → handleDragEnd → arrayMove → orderedClips actualiza (estado local)
usuario excluye clip
  → excluded.add(id) → card muestra opacidad reducida
usuario click ▶
  → previewClip = clip → ClipPreviewModal abre
usuario click Renderizar
  → genera EditCommand[] (move + set_timing)
  → applyTimelineCommands → render() → panel "rendering"
```

---

## 6. Errores y casos límite

- Si `clip.source_url` y `clip.local_path` son null → modal muestra mensaje "Preview no disponible" en lugar del `<video>`.
- Si `getVoices` falla → `voiceOptions` cae a la lista hardcodeada de Azure V1 actual; se muestra error toast o texto inline.
- Si `projectStore.mode === "disabled"` → `ReviewPanel` muestra el mensaje existente (no cambia).
- Si `orderedClips` está vacío tras montar → mensaje "Sin clips. Construye un timeline primero." (igual al actual).
- `applyTimelineCommands` con lista vacía de commands → no llamar (guard antes de la llamada).

---

## 7. Testing

- `ReviewPanel.test.tsx`: actualizar para cubrir D&D (simular `DragEndEvent`), exclusión y lógica de comandos generados.
- `ClipPreviewModal`: test de renderizado condicional (null clip → no monta video, clip con source_url → video con src correcto, Escape → onClose).
- `SortableClipCard`: test de renderizado con y sin `excluded`.
- Backend: test unitario de `GET /api/v1/voices` en `test/` para cada provider.
- Stores persistidos: test que verifica que el estado sobrevive re-creación del store (simular sessionStorage).

---

## 8. Archivos que cambian

| Archivo | Tipo de cambio |
|---|---|
| `app/controllers/v1/video.py` | añadir ruta GET /api/v1/voices |
| `webui-react/src/api/types.ts` | añadir TTS_PROVIDERS, TtsProvider, VoiceOption |
| `webui-react/src/api/voice.ts` | nuevo — getVoices() |
| `webui-react/src/store/useVideoStore.ts` | añadir tts_provider, persist |
| `webui-react/src/store/useProjectWorkspaceStore.ts` | persist (excluye taskStatus) |
| `webui-react/src/store/useProjectStore.ts` | persist (excluye mode, renderStatus) |
| `webui-react/src/components/panels/VideoConfigPanel.tsx` | TTS provider + voces dinámicas, fix inputs raw |
| `webui-react/src/components/panels/ReviewPanel.tsx` | D&D, preview, lógica render con comandos |
| `webui-react/src/components/panels/SortableClipCard.tsx` | nuevo |
| `webui-react/src/components/ui/ClipPreviewModal.tsx` | nuevo |
| `webui-react/src/components/ui/index.ts` | exportar ClipPreviewModal |
| `webui-react/src/components/layout/NavBar.tsx` | link workspace activo |
| `webui-react/src/components/layout/TopicBar.tsx` | badge estado proyecto |
| `webui-react/package.json` / `package-lock.json` | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |

---

## 9. Fuera de alcance

- Rediseño visual completo (nueva paleta, nueva tipografía).
- Timeline horizontal estilo editor de video.
- Preview render del servidor (endpoint de preview de baja calidad).
- Reordenamiento de la pista de audio/subtítulos.
- Drag entre múltiples tracks.
- `AudioSubtitlePanel` (componente no usado en flujo principal; se deja como está).
