// webui-react/src/components/panels/ScriptPanel.tsx
import { useState } from "react";
import { Wand2, Sparkles, RefreshCw, Image, Cpu, Laptop, ExternalLink, Download, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { Button, Input, Select, Textarea, Collapsible } from "../ui";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useVideoStore } from "../../store/useVideoStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { llmApi } from "../../api/llm";
import { deriveShortTitle } from "../../lib/videoNaming";
import { usePresetStore } from "../../store/usePresetStore";
import { applyPresetToStore } from "../presets/PresetManager";

const NICHE_SYSTEM_PROMPTS: Record<string, string> = {
  terror: `Actúa como un guionista profesional de terror psicológico y misterio especializado en crear suspense de alta retención para formatos verticales de sesenta segundos como TikTok y YouTube Shorts. Tu único objetivo es redactar un guion que mantenga al espectador sin parpadear.

Sigue rigurosamente las siguientes directrices técnicas de escritura:
- No incluyas ningún tipo de acotaciones técnicas, sugerencias de efectos de sonido, descripciones de escenas visuales ni nombres de locutores entre paréntesis o corchetes. El output que generes debe consistir única y exclusivamente en el texto continuo que será leído de manera literal por el motor de síntesis de voz (TTS).
- Estructura el relato de forma que cada párrafo tenga una extensión estricta de entre 45 y 55 palabras (aproximadamente de 15 a 20 segundos de lectura por párrafo). La longitud total del guion debe crecer de manera lineal y proporcional con el número de párrafos solicitado, manteniendo la consistencia en el tamaño de cada párrafo.
- Utiliza una sintaxis basada en frases extremadamente cortas y contundentes. Evita cláusulas subordinadas o explicaciones largas.
- El gancho de los primeros dos segundos de vídeo debe ser directo e inquietante, apelando a miedos universales o a secretos perturbadores que involucren al espectador de inmediato.
- Emplea un tono de narración sombrío, clínico y perturbador, seleccionando palabras que evoquen aislamiento, oscuridad y duda psicológica.
- El guion debe terminar en un punto de máxima tensión, con un giro final inesperado o una advertencia que deje una sensación de inquietud prolongada, fomentando que el usuario repita la reproducción del vídeo de forma involuntaria.

Genera el guion en idioma español a continuación:`,

  comedy: `Actúa como un comediante de stand-up comedy y guionista satírico especializado en crear micro-relatos cómicos altamente virales para redes sociales móviles de formato vertical. Tu misión es redactar un guion cómico de ritmo rápido basado en observaciones absurdas de la vida diaria.

Sigue rigurosamente las siguientes directrices técnicas de escritura:
- Proporciona única y exclusivamente las líneas de diálogo que procesará el sintetizador de voz (TTS). No agregues notas como "(risas)", "(pausa)", "(sonido de aplauso)", ni indicaciones sobre la expresión física del narrador.
- Limita la extensión de cada párrafo individual a un rango estricto de entre 40 y 50 palabras para garantizar una lectura ágil y rápida (aproximadamente de 12 a 15 segundos por párrafo). El guion debe incrementar su longitud y profundidad de forma lineal y proporcional con la cantidad de párrafos requerida.
- Estructura el guion de tal manera que haya un remate de humor (punchline) cada doce o quince palabras, manteniendo el dinamismo de la narración de inicio a fin.
- El gancho de apertura en los primeros tres segundos de vídeo debe plantear una queja o una observación mundana pero exagerada hasta el absurdo absoluto.
- Utiliza una voz narrativa que proyecte sarcasmo, ligereza e incredulidad, recurriendo a comparaciones locas o jerga común de internet que conecte con la juventud de manera orgánica.
- El final del vídeo debe ser abrupto y divertido, cerrando con una conclusión ridícula que empuje a los espectadores a compartir el contenido o a quejarse en la sección de comentarios sobre la veracidad de la anécdota.

Genera el guion en idioma español a continuación:`,

  curiosities: `Actúa como un divulgador científico y educativo especializado en la producción de píldoras informativas de alta retención cognitiva para canales de YouTube Shorts y TikTok. Tu objetivo es redactar un guion que exponga datos reales, sorprendentes y poco conocidos del universo, la ciencia o la historia.

Sigue rigurosamente las siguientes directrices técnicas de escritura:
- El texto generado debe estar libre de introducciones del tipo "Hola a todos", títulos de secciones, subtítulos de estructura o marcas de producción entre corchetes. Debe ser un flujo limpio de prosa diseñado para ser leído de principio a fin por el motor TTS sin interrupción alguna.
- Ajusta la cantidad de palabras de cada párrafo individual a un rango estricto de entre 45 y 55 palabras para asegurar una lectura informativa y profesional (aproximadamente de 15 a 20 segundos por párrafo). El guion total debe ser proporcionalmente más largo y profundo a mayor número de párrafos solicitados, escalando linealmente.
- Diseña la narrativa bajo la metodología de revelación escalonada: plantea un misterio o contradice una creencia popular en los primeros segundos, explica el mecanismo científico real con analogías sencillas y cierra con una conclusión de alto impacto.
- Integra palabras de alta carga atencional que despierten la curiosidad instantánea del espectador, manteniendo un registro riguroso, informativo y de absoluta precisión científica.
- El gancho inicial debe desafiar el sentido común del espectador de inmediato, logrando que sientan la necesidad de aprender la explicación detrás de la premisa planteada.
- Finaliza el guion con una pregunta abierta o un dato de cierre tan asombroso que invite de forma natural al debate científico en la sección de comentarios.

Genera el guion en idioma español a continuación:`,

  confessions: `Actúa como un adaptador de relatos reales extraídos de foros de confesiones anónimas para vídeos de formato vertical de alta retención. Tu misión es redactar un drama o una revelación interpersonal impactante, escrita de forma urgente y en primera persona del singular.

Sigue rigurosamente las siguientes directrices técnicas de escritura:
- Produce un guion que contenga únicamente las palabras que hablará la voz sintetizada. No incluyas presentaciones iniciales como "Hoy les traigo este caso", firmas del relato ni acotaciones explicativas de la emoción de la voz entre paréntesis.
- Restringe la extensión de cada párrafo individual a un rango de entre 45 y 55 palabras, garantizando una lectura fluida e intensa (aproximadamente de 15 a 20 segundos por párrafo). La longitud total del relato debe crecer de forma lineal y proporcional según la cantidad de párrafos solicitada.
- Escribe toda la narrativa en primera persona del singular, adoptando un tono de confesión de alta urgencia emocional, confidencialidad y sorpresa absoluta.
- La primera frase del guion debe funcionar como un gancho drástico que declare el conflicto principal del drama sin dar explicaciones iniciales, obligando al usuario a quedarse para entender cómo se llegó a ese punto extremo.
- Organiza la revelación del drama de forma dosificada, presentando el detonante, la reacción y el punto de no retorno de la situación personal descrita.
- Concluye el relato de forma abrupta en un momento decisivo de la confrontación o planteando un dilema ético inmediato, de modo que el espectador necesite interactuar con el vídeo para expresar su postura o debatir quién tiene la culpa.

Genera el guion en idioma español a continuación:`
};

export function ScriptPanel() {
  const { t } = useTranslation();
  const store = useVideoStore();
  const workspaceStore = useProjectWorkspaceStore();
  const projectStore = useProjectStore();
  const updateCurrentDraft = useProjectHistoryStore((s) => s.updateCurrentDraft);
  const removeDraft = useProjectHistoryStore((s) => s.removeDraft);
  const currentDraftId = useProjectHistoryStore((s) => s.currentDraftId);
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailSuccess, setThumbnailSuccess] = useState<string | null>(null);
  const [customThumbnailPrompt, setCustomThumbnailPrompt] = useState(store.thumbnail_prompt || "");
  const [thumbnailAspect, setThumbnailAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [pinokioUrl, setPinokioUrl] = useState("http://127.0.0.1:7860/sdapi/v1/txt2img");

  const selectedThumbnailProvider = store.thumbnail_provider || "gemini";

  const handleGenerateThumbnail = async () => {
    if (!store.video_subject.trim()) {
      setThumbnailError("Por favor introduce un tema para el video antes de generar la miniatura.");
      return;
    }

    setGeneratingThumbnail(true);
    setThumbnailError(null);
    setThumbnailSuccess(null);

    try {
      const res = await llmApi.generateThumbnail({
        video_subject: store.video_subject,
        video_script: store.video_script || "",
        provider: selectedThumbnailProvider,
        custom_prompt: customThumbnailPrompt,
        aspect_ratio: thumbnailAspect,
        pinokio_url: pinokioUrl,
      });

      if (res.thumbnail_url) {
        store.set("thumbnail_url", res.thumbnail_url);
        store.set("thumbnail_prompt", res.prompt_used || customThumbnailPrompt);
        setCustomThumbnailPrompt(res.prompt_used || customThumbnailPrompt);
        const providerLabel =
          selectedThumbnailProvider === "gemini"
            ? "Gemini Imagen 3"
            : selectedThumbnailProvider === "pollinations"
            ? "Pollinations.ai (Gratuito)"
            : "Pinokio Z-Image";
        setThumbnailSuccess(`Miniatura generada con éxito usando ${providerLabel}`);
      } else {
        if (res.configured === false) {
          setThumbnailError(res.message || "El proveedor seleccionado no está configurado.");
        } else {
          setThumbnailError("No se pudo obtener la miniatura.");
        }
      }
    } catch (err: any) {
      console.error("[ScriptPanel] Error al generar miniatura:", err);
      setThumbnailError(err.message || String(err));
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const getWordCount = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const getEstimatedDuration = (text: string) => {
    const words = getWordCount(text);
    const seconds = Math.ceil((words / 140) * 60);
    return seconds;
  };

  // Prefill default niche and prompt on mount if empty
  useState(() => {
    if (!store.video_niche) {
      store.set("video_niche", "terror");
    }
    const currentNiche = store.video_niche || "terror";
    if (!store.custom_system_prompt) {
      store.set("custom_system_prompt", NICHE_SYSTEM_PROMPTS[currentNiche]);
    }
    if (!store.paragraph_number) {
      store.set("paragraph_number", 1);
    }
  });

  const handleContinueToSettings = async () => {
    if (!store.video_subject.trim()) return;
    setIsContinuing(true);
    setError(null);
    try {
      if (projectStore.projectId) {
        console.log("[ScriptPanel] Updating existing project on continue:", projectStore.projectId);
        await projectsApi.replaceTimeline(projectStore.projectId, {
          project_id: projectStore.projectId,
          script: store.video_script ?? "",
          topic: store.video_subject,
          language: store.video_language ?? "es",
          params: store.toParams(),
        } as any);
        await projectStore.open(projectStore.projectId);
      } else {
        console.log("[ScriptPanel] No projectId found. Creating project from manual input...");
        const { project_id } = await projectsApi.createFromScript({
          script: store.video_script ?? "",
          language: store.video_language ?? "es",
          topic: store.video_subject,
        });
        console.log("[ScriptPanel] Project created with ID:", project_id);
        await projectStore.open(project_id);
        removeDraft(currentDraftId);
        navigate(`/project/${project_id}`, { replace: true });
      }
      workspaceStore.setPanel("config");
    } catch (projectError) {
      console.error("[ScriptPanel] Failed to auto-create or update project:", projectError);
      if (!(projectError instanceof ApiError && projectError.status === 404)) {
        setError(projectError instanceof Error ? projectError.message : String(projectError));
      } else {
        useProjectStore.setState({ mode: "disabled" });
        workspaceStore.setPanel("config");
      }
    } finally {
      setIsContinuing(false);
    }
  };

  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    store.set("video_subject", e.target.value);
    workspaceStore.setTopic(e.target.value);
    updateCurrentDraft(e.target.value);
  };

  const [activePartTab, setActivePartTab] = useState<number | "all">(1);

  const multiPartScripts = store.multi_part_scripts ?? [];
  const partsCount = store.multi_part_count || 2;

  const getPartScript = (partNum: number): string => {
    if (multiPartScripts[partNum - 1] !== undefined) {
      return multiPartScripts[partNum - 1];
    }
    // Fallback parse from store.video_script
    if (store.video_script) {
      const parts = store.video_script.split(/---+\s*PARTE\s*\d+\s*---+/i).map((s) => s.trim()).filter(Boolean);
      return parts[partNum - 1] || "";
    }
    return "";
  };

  const handleUpdatePartScript = (partNum: number, newText: string) => {
    const updatedParts = [...multiPartScripts];
    while (updatedParts.length < partsCount) {
      updatedParts.push("");
    }
    updatedParts[partNum - 1] = newText;
    store.set("multi_part_scripts", updatedParts);

    // Rebuild full combined script
    const combined = updatedParts
      .map((script, idx) => (idx === 0 ? script : `--- PARTE ${idx + 1} ---\n\n${script}`))
      .join("\n\n");
    store.set("video_script", combined);
  };

  const targetScriptForDuration = store.is_multi_part
    ? activePartTab === "all"
      ? (store.video_script ?? "")
      : getPartScript(activePartTab as number)
    : (store.video_script ?? "");

  const wordCount = getWordCount(targetScriptForDuration);
  const estimatedSeconds = getEstimatedDuration(targetScriptForDuration);

  const [regeneratingMeta, setRegeneratingMeta] = useState(false);

  const handleRegenerateMetadata = async () => {
    if (!store.video_subject.trim()) return;
    setRegeneratingMeta(true);
    try {
      const { title_options, generated_description, generated_tags } = await llmApi.generateMetadata({
        video_subject: store.video_subject,
        video_script: store.video_script || "",
      });
      if (title_options && title_options.length > 0) {
        store.set("title_options", title_options);
        store.set("selected_title", "");
      }
      if (generated_description) {
        store.set("generated_description", generated_description);
      }
      if (generated_tags) {
        store.set("generated_tags", generated_tags);
      }
    } catch (err: any) {
      console.error("[ScriptPanel] Error regenerating metadata:", err);
    } finally {
      setRegeneratingMeta(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!store.video_subject.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { video_script, multi_part_scripts, title_options, generated_description, generated_tags } = await llmApi.generateScript({
        video_subject: store.video_subject,
        video_language: store.video_language,
        paragraph_number: store.paragraph_number,
        video_script_prompt: store.video_script_prompt,
        custom_system_prompt: store.custom_system_prompt,
        is_multi_part: store.is_multi_part,
        parts_count: store.multi_part_count,
        hook_style: store.hook_style || "misterio",
      });
      store.set("video_script", video_script);
      if (multi_part_scripts && multi_part_scripts.length > 0) {
        store.set("multi_part_scripts", multi_part_scripts);
      } else {
        store.set("multi_part_scripts", [video_script]);
      }
      if (title_options && title_options.length > 0) {
        store.set("title_options", title_options);
        store.set("selected_title", "");
      }
      if (generated_description) {
        store.set("generated_description", generated_description);
      }
      if (generated_tags) {
        store.set("generated_tags", generated_tags);
      }

      const { video_terms } = await llmApi.generateTerms({
        video_subject: store.video_subject,
        video_script: video_script,
        amount: 5,
      });
      store.set("video_terms", video_terms.join(", "));

      // Automatically map niche to system preset and apply its settings
      const presetId = `system-${store.video_niche || "terror"}`;
      const preset = usePresetStore.getState().presets.find((p) => p.id === presetId);
      if (preset) {
        usePresetStore.getState().setActivePresetId(presetId);
        applyPresetToStore(preset, store);
        console.log(`[ScriptPanel] Auto-applied preset for niche: ${store.video_niche} (${presetId})`);
      }

      try {
        if (projectStore.projectId) {
          console.log("[ScriptPanel] Updating existing project after generation:", projectStore.projectId);
          await projectsApi.replaceTimeline(projectStore.projectId, {
            project_id: projectStore.projectId,
            script: video_script,
            topic: store.video_subject,
            language: store.video_language ?? "es",
            params: store.toParams(),
          } as any);
          await projectStore.open(projectStore.projectId);
        } else {
          const { project_id } = await projectsApi.createFromScript({
            script: video_script,
            language: store.video_language,
            topic: store.video_subject,
          });
          await projectStore.open(project_id);
          removeDraft(currentDraftId);
          navigate(`/project/${project_id}`, { replace: true });
        }
      } catch (projectError) {
        if (!(projectError instanceof ApiError && projectError.status === 404)) {
          throw projectError;
        }
        useProjectStore.setState({ mode: "disabled" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("panels.script.failed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="flex h-full w-full max-w-5xl mx-auto flex-col px-6 py-5">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-base font-semibold text-foreground">{t("panels.script.title")}</h2>

      <Input
        label={t("panels.script.topic")}
        placeholder={t("panels.script.subjectPlaceholder")}
        value={store.video_subject}
        onChange={handleTopicChange}
      />

      <Select
        label={t("panels.script.nicheLabel")}
        value={store.video_niche || "terror"}
        options={[
          { value: "terror", label: t("presets.terror") },
          { value: "comedy", label: t("presets.comedy") },
          { value: "curiosities", label: t("presets.curiosities") },
          { value: "confessions", label: t("presets.confessions") },
        ]}
        onChange={(e) => {
          const niche = e.target.value;
          store.set("video_niche", niche);
          if (NICHE_SYSTEM_PROMPTS[niche]) {
            store.set("custom_system_prompt", NICHE_SYSTEM_PROMPTS[niche]);
          }
          store.set("paragraph_number", 1);
        }}
      />

      <Select
        label={t("voice.language")}
        value={store.video_language ?? ""}
        options={[
          { value: "", label: t("panels.script.autoDetect") },
          { value: "en", label: "English" },
          { value: "es", label: "Español" },
          { value: "zh", label: "中文" },
          { value: "fr", label: "Français" },
          { value: "de", label: "Deutsch" },
          { value: "ja", label: "日本語" },
          { value: "ko", label: "한국어" },
          { value: "pt", label: "Português" },
        ]}
        onChange={(e) => store.set("video_language", e.target.value)}
      />

      <Input
        label={t("panels.script.paragraphs")}
        type="number"
        min={1}
        max={10}
        value={store.paragraph_number ?? 1}
        onChange={(e) =>
          store.set("paragraph_number", parseInt(e.target.value, 10))
        }
      />

      {/* Preset de Estilo de Gancho (Single selection toggle) */}
      <div className="space-y-2 rounded-lg border border-border/80 bg-surface/50 p-3.5">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Estilo de Gancho Inicial (Apertura)</span>
          <span className="text-[10px] font-normal text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded">Selecciona 1 estilo</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {[
            { id: "misterio", icon: "🔴", title: "Misterio Impactante" },
            { id: "confesion", icon: "🟡", title: "Confesión en 1ª Persona" },
            { id: "pregunta", icon: "🔵", title: "Pregunta Directa al Espectador" },
            { id: "estandar", icon: "⚪", title: "Estándar del Nicho" },
          ].map((preset) => {
            const isSelected = (store.hook_style || "misterio") === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => store.set("hook_style", preset.id)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-accent bg-accent/15 text-foreground ring-1 ring-accent/50 shadow-xs"
                    : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <span className="text-xs font-bold flex items-center gap-1.5 text-foreground truncate pr-1">
                  <span>{preset.icon}</span> {preset.title}
                </span>
                {isSelected && (
                  <span className="text-[10px] bg-accent/20 text-accent font-semibold px-1.5 py-0.5 rounded shrink-0">
                    Activo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5 rounded-lg border border-border/80 bg-surface/50 p-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>Modo de Historia</span>
          </label>
          <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-md border border-border/40">
            <button
              type="button"
              onClick={() => {
                store.set("is_multi_part", false);
                store.set("multi_part_count", 1);
                store.set("video_count", 1);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all ${
                !store.is_multi_part
                  ? "bg-accent text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Vídeo Único
            </button>
            <button
              type="button"
              onClick={() => {
                store.set("is_multi_part", true);
                store.set("multi_part_count", 2);
                store.set("video_count", 2);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all ${
                store.is_multi_part && (store.multi_part_count ?? 2) === 2
                  ? "bg-accent text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              2 Partes
            </button>
            <button
              type="button"
              onClick={() => {
                store.set("is_multi_part", true);
                store.set("multi_part_count", 3);
                store.set("video_count", 3);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all ${
                store.is_multi_part && store.multi_part_count === 3
                  ? "bg-accent text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              3 Partes
            </button>
          </div>
        </div>

        {store.is_multi_part && (
          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1.5 border-t border-border/40">
            💡 <b>Formato multi-parte:</b> Cada parte tendrá {store.paragraph_number} párrafos. A partir de la Parte 2, la historia comenzará diciendo el título del proyecto y el número de parte (ej: "Título del proyecto, Parte 2...") para dar contexto inmediato desde el segundo 0:00.
          </p>
        )}
      </div>

      {/* Opciones de Títulos Virales Generados (Espacio fijo) */}
      {(() => {
        const hasTitles = store.title_options && store.title_options.length > 0;
        return (
          <div
            className={`space-y-2 rounded-lg border p-3.5 transition-all ${
              hasTitles
                ? "border-accent/40 bg-accent/10 shadow-xs"
                : "border-border/50 bg-surface/30 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className={`h-3.5 w-3.5 ${hasTitles ? "text-accent" : "text-muted-foreground"}`} />
                <span>Opciones de Título Viral Sugeridas (Opcional)</span>
              </label>
              <div className="flex items-center gap-2">
                {hasTitles && (
                  <button
                    type="button"
                    onClick={handleRegenerateMetadata}
                    disabled={regeneratingMeta || generating}
                    className="text-[10px] font-semibold text-accent hover:text-accent/80 flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 border border-accent/30 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${regeneratingMeta ? "animate-spin" : ""}`} />
                    <span>{regeneratingMeta ? "Regenerando..." : "Regenerar Títulos e IA"}</span>
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  {hasTitles ? "Clic para seleccionar/deseleccionar" : "Se generan con el guión"}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              {hasTitles ? (
                <>
                  {store.title_options!.map((option, idx) => {
                    const isSelected = store.selected_title === option;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            store.set("selected_title", "");
                          } else {
                            store.set("selected_title", option);
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "border-accent bg-accent/25 text-foreground font-semibold shadow-xs ring-1 ring-accent/50"
                            : "border-border/60 bg-surface/80 text-muted-foreground hover:bg-surface hover:text-foreground"
                        }`}
                      >
                        <span className="text-xs truncate pr-2">
                          <span className="text-accent font-bold mr-2">#{idx + 1}</span> {option}
                        </span>
                        {isSelected ? (
                          <span className="text-[10px] bg-accent text-white px-2 py-0.5 rounded font-bold shrink-0">Seleccionado</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/80 hover:text-foreground shrink-0 font-medium">Usar</span>
                        )}
                      </button>
                    );
                  })}
                  {!store.selected_title && (
                    <div className="text-[11px] text-muted-foreground bg-secondary/40 border border-border/40 p-2 rounded-lg flex items-center justify-between">
                      <span className="truncate mr-2">
                        ⚪ Ningún título seleccionado (se usará el título original: <strong className="text-foreground">{deriveShortTitle(store.video_subject, "Sin título")}</strong>)
                      </span>
                    </div>
                  )}
                </>
              ) : (
                [1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-secondary/20 text-muted-foreground/50 text-xs pointer-events-none select-none"
                  >
                    <span>
                      <span className="font-bold mr-2 opacity-50">#{num}</span> Título sugerido {num}...
                    </span>
                    <span className="text-[10px] text-muted-foreground/40 font-medium">Pendiente</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}

      <Button
        onClick={handleGenerateScript}
        isLoading={generating}
        disabled={!store.video_subject.trim()}
        className="w-full"
      >
        <Wand2 className="mr-2 h-4 w-4" />
        {t("panels.script.generate")}
      </Button>

      {error && (
        <p className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {store.is_multi_part ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Guion Multi-Parte ({partsCount} Partes)
            </label>
            <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-md border border-border/40">
              {Array.from({ length: partsCount }).map((_, idx) => {
                const partNum = idx + 1;
                const isActive = activePartTab === partNum;
                return (
                  <button
                    key={partNum}
                    type="button"
                    onClick={() => setActivePartTab(partNum)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all ${
                      isActive
                        ? "bg-accent text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Parte {partNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setActivePartTab("all")}
                className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all ${
                  activePartTab === "all"
                    ? "bg-accent text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Ver Todo
              </button>
            </div>
          </div>

          {activePartTab === "all" ? (
            <Textarea
              label="Guión Completo con Marcas de Separación"
              placeholder={t("panels.script.scriptPlaceholder")}
              value={store.video_script ?? ""}
              onChange={(e) => {
                store.set("video_script", e.target.value);
                const parsed = e.target.value
                  .split(/---+\s*PARTE\s*\d+\s*---+/i)
                  .map((p) => p.trim())
                  .filter(Boolean);
                if (parsed.length > 0) {
                  store.set("multi_part_scripts", parsed);
                }
              }}
              rows={10}
            />
          ) : (
            <Textarea
              label={`Guión de la Parte ${activePartTab}`}
              placeholder={`Escribe o edita la historia para la Parte ${activePartTab}...`}
              value={getPartScript(activePartTab as number)}
              onChange={(e) => handleUpdatePartScript(activePartTab as number, e.target.value)}
              rows={8}
            />
          )}
        </div>
      ) : (
        <Textarea
          label={t("panels.script.scriptLabel")}
          placeholder={t("panels.script.scriptPlaceholder")}
          value={store.video_script ?? ""}
          onChange={(e) => store.set("video_script", e.target.value)}
          rows={8}
        />
      )}

      {store.video_script && (
        <div className="rounded-md bg-secondary/30 border border-border/50 p-3 mt-1 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground/90">
              {t("panels.script.estimatedDurationLabel")}
              {store.is_multi_part && typeof activePartTab === "number" && ` (Parte ${activePartTab})`}
              {store.is_multi_part && activePartTab === "all" && " (Total)"}
            </span>
            <span className="font-semibold text-foreground bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-full">
              {estimatedSeconds}s (~{wordCount} {t("panels.script.words")})
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                estimatedSeconds > 120 
                  ? "bg-red-500" 
                  : estimatedSeconds > 90 
                    ? "bg-amber-500" 
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min((estimatedSeconds / 120) * 100, 100)}%` }}
            />
          </div>
          {store.is_multi_part && activePartTab === "all" && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/30 text-[11px] text-muted-foreground">
              {Array.from({ length: partsCount }).map((_, idx) => {
                const pNum = idx + 1;
                const pScript = getPartScript(pNum);
                const pSecs = getEstimatedDuration(pScript);
                const pWords = getWordCount(pScript);
                return (
                  <span key={pNum} className="bg-surface/80 px-2.5 py-1 rounded-md border border-border/50 flex items-center gap-1.5">
                    <span className="font-medium text-foreground">Parte {pNum}:</span>
                    <strong className="text-accent">{pSecs}s</strong>
                    <span className="text-muted-foreground/80">({pWords} palabras)</span>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between text-[10px] text-muted-foreground/80 leading-relaxed">
            <span>{t("panels.script.speedReference")}</span>
            {estimatedSeconds > 90 && (
              <span className="text-amber-500 font-medium">
                {t("panels.script.splitSuggestion")}
              </span>
            )}
          </div>
        </div>
      )}

      <Textarea
        label={t("panels.script.keywords")}
        placeholder={t("panels.script.keywordsPlaceholder")}
        value={typeof store.video_terms === "string" ? store.video_terms : (store.video_terms ?? []).join(", ")}
        onChange={(e) => store.set("video_terms", e.target.value)}
        rows={2}
      />

      {/* Sección Opcional de Miniatura de YouTube / Redes */}
      <div className="space-y-3 rounded-xl border border-border/80 bg-surface/60 p-4 shadow-xs my-2">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <label className="text-xs font-bold text-foreground flex items-center gap-2">
            <Image className="h-4 w-4 text-accent" />
            <span>Generación de Miniatura para YouTube (Opcional)</span>
          </label>
          <span className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
            3 Proveedores Disponibles
          </span>
        </div>

        {/* Proveedor Selector Tabs */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Modelo / Proveedor de Generación:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => store.set("thumbnail_provider", "gemini")}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                selectedThumbnailProvider === "gemini"
                  ? "border-accent bg-accent/15 text-foreground ring-1 ring-accent/50 font-semibold shadow-xs"
                  : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-bold truncate">Gemini Imagen 3</p>
                  <p className="text-[9px] text-muted-foreground truncate">Por defecto (Activo)</p>
                </div>
              </div>
              {selectedThumbnailProvider === "gemini" && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded shrink-0">
                  Activo
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => store.set("thumbnail_provider", "pollinations")}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                selectedThumbnailProvider === "pollinations"
                  ? "border-accent bg-accent/15 text-foreground ring-1 ring-accent/50 font-semibold shadow-xs"
                  : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Cpu className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-bold truncate">Pollinations.ai</p>
                  <p className="text-[9px] text-muted-foreground truncate">Gratuito y rápido</p>
                </div>
              </div>
              {selectedThumbnailProvider === "pollinations" && (
                <span className="text-[9px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded shrink-0">
                  Gratis
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => store.set("thumbnail_provider", "pinokio")}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                selectedThumbnailProvider === "pinokio"
                  ? "border-accent bg-accent/15 text-foreground ring-1 ring-accent/50 font-semibold shadow-xs"
                  : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Laptop className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-bold truncate">Pinokio (Z-Image)</p>
                  <p className="text-[9px] text-muted-foreground truncate">Workflow Local</p>
                </div>
              </div>
              {selectedThumbnailProvider === "pinokio" && (
                <span className="text-[9px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded shrink-0">
                  Local
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Configuración adicional si se elige Pinokio */}
        {selectedThumbnailProvider === "pinokio" && (
          <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/50 space-y-1.5">
            <Input
              label="URL Endpoint Local de Pinokio / ComfyUI"
              value={pinokioUrl}
              onChange={(e) => setPinokioUrl(e.target.value)}
              placeholder="http://127.0.0.1:7860/sdapi/v1/txt2img"
              className="text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Asegúrate de iniciar tu flujo en Pinokio (Z-Image) con el servidor activo en el puerto 7860 u 8000.
            </p>
          </div>
        )}

        {/* Controles de Proporción y Prompt */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <Select
            label="Formato de Imagen"
            value={thumbnailAspect}
            options={[
              { value: "16:9", label: "16:9 (YouTube Horizontal)" },
              { value: "9:16", label: "9:16 (Shorts / TikTok)" },
              { value: "1:1", label: "1:1 (Cuadrado)" },
            ]}
            onChange={(e) => setThumbnailAspect(e.target.value as any)}
            className="text-xs"
          />

          <div className="sm:col-span-2 space-y-1">
            <Input
              label="Prompt Personalizado para la Miniatura (Opcional)"
              placeholder="Ej: A mysterious dark alley with dramatic lighting, 4k photorealistic..."
              value={customThumbnailPrompt}
              onChange={(e) => setCustomThumbnailPrompt(e.target.value)}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Dejar en blanco para autogenerar un prompt optimizado basado en el tema y guión.
            </p>
          </div>
        </div>

        {/* Botón de Generación */}
        <Button
          onClick={handleGenerateThumbnail}
          isLoading={generatingThumbnail}
          disabled={!store.video_subject.trim() || generatingThumbnail}
          className="w-full bg-accent/90 hover:bg-accent text-accent-foreground font-semibold text-xs py-2"
        >
          {generatingThumbnail ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando miniatura con {selectedThumbnailProvider === "gemini" ? "Gemini Imagen 3" : selectedThumbnailProvider === "pollinations" ? "Pollinations.ai" : "Pinokio"}...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar Miniatura con {selectedThumbnailProvider === "gemini" ? "Gemini Imagen 3" : selectedThumbnailProvider === "pollinations" ? "Pollinations.ai (Gratuito)" : "Pinokio (Z-Image)"}
            </>
          )}
        </Button>

        {thumbnailError && (
          <p className="rounded-md bg-red-900/20 border border-red-800/80 px-3 py-2 text-xs text-red-400">
            ❌ {thumbnailError}
          </p>
        )}

        {thumbnailSuccess && (
          <p className="rounded-md bg-emerald-900/20 border border-emerald-800/80 px-3 py-2 text-xs text-emerald-400 font-medium">
            ✅ {thumbnailSuccess}
          </p>
        )}

        {/* Tarjeta de Miniatura Generada */}
        {store.thumbnail_url && (
          <div className="mt-3 p-3 rounded-xl border border-accent/30 bg-neutral-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Miniatura Lista para YouTube</span>
              </span>
              <span className="text-[10px] text-muted-foreground capitalize">
                Proveedor: <strong className="text-foreground">{store.thumbnail_provider || "gemini"}</strong>
              </span>
            </div>

            <div className="relative w-full rounded-lg overflow-hidden border border-neutral-800 bg-black flex items-center justify-center max-h-[260px] group">
              <img
                src={store.thumbnail_url}
                alt="Miniatura para YouTube"
                className="w-full h-full object-contain max-h-[250px] block rounded-md transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a
                  href={store.thumbnail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-black/80 hover:bg-black text-white text-xs flex items-center gap-1 border border-white/20"
                  title="Ver tamaño completo"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={store.thumbnail_url}
                  download="miniatura_youtube.jpg"
                  className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs flex items-center gap-1 font-medium"
                  title="Descargar miniatura"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                Prompt: {store.thumbnail_prompt || "Autogenerado"}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerateThumbnail}
                  disabled={generatingThumbnail}
                  className="text-[10px] font-medium text-accent hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.set("thumbnail_url", "");
                    store.set("thumbnail_prompt", "");
                    setThumbnailSuccess(null);
                  }}
                  className="text-[10px] font-medium text-red-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Collapsible title={t("panels.script.advancedPrompt")}>
        <Textarea
          label={t("panels.script.scriptPromptLabel")}
          placeholder={t("panels.script.extraInstructionsPlaceholder")}
          value={store.video_script_prompt ?? ""}
          onChange={(e) => store.set("video_script_prompt", e.target.value)}
          rows={3}
        />
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              {t("panels.script.systemPromptLabel")}
            </label>
            <button
              type="button"
              onClick={() => {
                const currentNiche = store.video_niche || "terror";
                if (NICHE_SYSTEM_PROMPTS[currentNiche]) {
                  store.set("custom_system_prompt", NICHE_SYSTEM_PROMPTS[currentNiche]);
                }
              }}
              className="text-[11px] text-accent hover:underline font-medium"
            >
              Restablecer al prompt predeterminado de {store.video_niche || "terror"}
            </button>
          </div>
          <Textarea
            placeholder={t("panels.script.systemPromptPlaceholder")}
            value={store.custom_system_prompt ?? ""}
            onChange={(e) => store.set("custom_system_prompt", e.target.value)}
            rows={7}
            className="font-mono text-xs leading-relaxed"
          />
        </div>
      </Collapsible>

        </div>
      </div>

      <div className="w-full max-w-2xl pt-4 border-t border-border flex justify-end">
        <Button
          disabled={isContinuing || !store.video_subject.trim()}
          onClick={handleContinueToSettings}
          isLoading={isContinuing}
        >
          {t("panels.script.continueToSettings")}
        </Button>
      </div>
    </section>
  );
}
