// webui-react/src/components/panels/ScriptPanel.tsx
import { useState } from "react";
import { Wand2 } from "lucide-react";
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

  const handleGenerateScript = async () => {
    if (!store.video_subject.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { video_script, multi_part_scripts } = await llmApi.generateScript({
        video_subject: store.video_subject,
        video_language: store.video_language,
        paragraph_number: store.paragraph_number,
        video_script_prompt: store.video_script_prompt,
        custom_system_prompt: store.custom_system_prompt,
        is_multi_part: store.is_multi_part,
        parts_count: store.multi_part_count,
      });
      store.set("video_script", video_script);
      if (multi_part_scripts && multi_part_scripts.length > 0) {
        store.set("multi_part_scripts", multi_part_scripts);
      } else {
        store.set("multi_part_scripts", [video_script]);
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
