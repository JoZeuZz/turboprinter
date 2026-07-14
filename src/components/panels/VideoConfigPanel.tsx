// webui-react/src/components/panels/VideoConfigPanel.tsx
import { useState, useEffect } from "react";
import { Eye, Wand2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  TabBar,
  Button,
  Select,
  Slider,
  Checkbox,
  ColorPicker,
  Collapsible,
  Input,
  Textarea,
} from "../ui";
import { usePresetStore } from "../../store/usePresetStore";
import { useVideoStore } from "../../store/useVideoStore";
import { useConfigStore } from "../../store/useConfigStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import { videoApi } from "../../api/video";
import { voiceApi } from "../../api/voice";
import { SubtitleFontGallery } from "../subtitles/SubtitleFontGallery";
import { SubtitlePreview } from "../subtitles/SubtitlePreview";
import { VoiceGallery } from "../voice/VoiceGallery";
import { PresetManager } from "../presets/PresetManager";
import { TTS_PROVIDERS, type TtsProvider } from "../../api/types";
import type {
  VideoAspect,
  VideoConcatMode,
  VideoTransitionMode,
  BgmFile,
} from "../../api/types";

export function VideoConfigPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("video");
  const [bgmFiles, setBgmFiles] = useState<BgmFile[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<{ value: string; label: string }[]>([]);
  const [voiceLoadError, setVoiceLoadError] = useState<string | null>(null);
  const store = useVideoStore();
  const { config } = useConfigStore();

  const [localVideos, setLocalVideos] = useState<{ name: string; size: number; path: string }[]>([]);
  const [loadingLocalVideos, setLoadingLocalVideos] = useState(false);
  const [localVideosError, setLocalVideosError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLoadingLocalVideos(true);
    setLocalVideosError(null);
    videoApi
      .getLocalVideos()
      .then((res) => {
        setLocalVideos(res.files);
      })
      .catch((err) => {
        console.error("Failed to load local videos:", err);
        setLocalVideosError(t("videoSettings.localVideosLoadError"));
      })
      .finally(() => {
        setLoadingLocalVideos(false);
      });
  }, [t]);
  const workspaceStore = useProjectWorkspaceStore();
  const projectStore = useProjectStore();
  const hasReviewVideo = workspaceStore.videoUrls.length > 0;

  const TABS = [
    { key: "video", label: t("panels.videoConfig.tabs.video") },
    { key: "audio", label: t("panels.videoConfig.tabs.audio") },
    { key: "subtitles", label: t("panels.videoConfig.tabs.subtitles") },
  ];

  const ASPECT_OPTIONS = [
    { value: "9:16", label: t("videoSettings.aspectPortrait") },
    { value: "16:9", label: t("videoSettings.aspectLandscape") },
    { value: "1:1", label: t("videoSettings.aspectSquare") },
  ];

  const CONCAT_OPTIONS = [
    { value: "random", label: t("videoSettings.random") },
    { value: "sequential", label: t("videoSettings.sequential") },
  ];

  const TRANSITION_OPTIONS = [
    { value: "", label: t("videoSettings.transitionNone") },
    { value: "Shuffle", label: t("videoSettings.transitionShuffle") },
    { value: "FadeIn", label: t("videoSettings.transitionFadeIn") },
    { value: "FadeOut", label: t("videoSettings.transitionFadeOut") },
    { value: "SlideIn", label: t("videoSettings.transitionSlideIn") },
    { value: "SlideOut", label: t("videoSettings.transitionSlideOut") },
  ];

  const POSITION_OPTIONS = [
    { value: "bottom", label: t("audioSubtitle.positionBottom") },
    { value: "top", label: t("audioSubtitle.positionTop") },
    { value: "center", label: t("audioSubtitle.positionCenter") },
    { value: "custom", label: t("audioSubtitle.positionCustom") },
  ];

  useEffect(() => {
    videoApi.getBgmList().then((r) => setBgmFiles(r.files)).catch(() => {});
  }, []);

  useEffect(() => {
    setVoiceLoadError(null);
    voiceApi
      .getVoices(store.tts_provider)
      .then(setVoiceOptions)
      .catch(() => {
        setVoiceLoadError(t("panels.videoConfig.voiceLoadError"));
      });
  }, [store.tts_provider]);

  const videoSourceOptions = (
    config?.video_sources ?? ["pexels", "pixabay", "local"]
  ).map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

  const bgmOptions = [
    { value: "random", label: t("audioSubtitle.bgmRandom") },
    { value: "", label: t("audioSubtitle.bgmNone") },
    ...bgmFiles.map((f) => ({ value: f.file, label: f.name })),
  ];

  const handleGenerate = async () => {
    console.log("[VideoConfigPanel] handleGenerate triggered");
    setIsSubmitting(true);
    try {
      const autoSaveEnabled = usePresetStore.getState().autoSaveConfigAfterGeneration;
      const params = store.toParams();
      console.log("[VideoConfigPanel] autoSaveConfigAfterGeneration:", autoSaveEnabled);
      console.log("[VideoConfigPanel] Video parameters generated from store:", params);

      if (autoSaveEnabled) {
        localStorage.setItem("mpt-last-generated-config", JSON.stringify(params));
        console.log("[VideoConfigPanel] Saved current parameters to localStorage: mpt-last-generated-config");
      }

      const isProjectMode = projectStore.mode !== "disabled" && projectStore.projectId;
      console.log("[VideoConfigPanel] Checking generation mode:", {
        projectModeEnabled: isProjectMode,
        projectStoreMode: projectStore.mode,
        projectId: projectStore.projectId
      });

      if (isProjectMode) {
        console.log("[VideoConfigPanel] Setting workspace panel to 'generating' for Project Mode");
        workspaceStore.setPanel("generating");
        console.log("[VideoConfigPanel] Dispatching generateViaProjectMode with params");
        await projectStore.generateViaProjectMode(params);
      } else {
        console.log("[VideoConfigPanel] Dispatching standard generateVideo with params");
        await workspaceStore.generateVideo(params);
      }
    } catch (err) {
      console.error("[VideoConfigPanel] Error during handleGenerate:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    workspaceStore.setPanel("script");
  };

  return (
    <section className="grid h-full min-h-0 w-full max-w-5xl mx-auto grid-rows-[auto_auto_minmax(0,1fr)_auto] px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("panels.videoConfig.title")}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
        >
          {t("panels.videoConfig.back")}
        </Button>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-h-0 overflow-hidden py-4">
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
          <div className="h-full min-h-0 overflow-y-auto pr-1 pb-6">
            <div className="min-w-0 space-y-3">
              <PresetManager />

        {tab === "video" && (
          <>
            <Select
              label={t("videoSettings.source")}
              value={store.video_source ?? "pexels"}
              options={videoSourceOptions}
              onChange={(e) => store.set("video_source", e.target.value)}
            />

            <div className={`rounded-lg border border-border bg-surface p-4 space-y-3 mt-1 transition-all ${store.video_source !== "local" ? "opacity-50 pointer-events-none select-none bg-surface/40" : ""}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5 flex-wrap">
                  <span>{t("videoSettings.localVideosTitle")}</span>
                  {store.video_source !== "local" && (
                    <span className="text-[10px] text-yellow-500/80 lowercase normal-case">
                      {t("videoSettings.localVideosDisabledIfNotLocal")}
                    </span>
                  )}
                </h4>
                {localVideos.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={store.video_source !== "local"}
                      onClick={() => store.set("local_video_files", localVideos.map(v => v.name))}
                      className="text-[10px] font-medium text-accent hover:underline focus:outline-none disabled:no-underline disabled:text-muted disabled:cursor-not-allowed"
                    >
                      {t("videoSettings.localVideosSelectAll")}
                    </button>
                    <span className="text-[10px] text-border">|</span>
                    <button
                      type="button"
                      disabled={store.video_source !== "local"}
                      onClick={() => store.set("local_video_files", [])}
                      className="text-[10px] font-medium text-red-400 hover:underline focus:outline-none disabled:no-underline disabled:text-muted disabled:cursor-not-allowed"
                    >
                      {t("videoSettings.localVideosDeselectAll")}
                    </button>
                  </div>
                )}
              </div>

              {loadingLocalVideos && (
                <p className="text-xs text-muted py-2 text-center">
                  {t("videoSettings.localVideosLoading")}
                </p>
              )}

              {localVideosError && (
                <p className="text-xs text-red-400 py-2 text-center">
                  {localVideosError}
                </p>
              )}

              {!loadingLocalVideos && !localVideosError && localVideos.length === 0 && (
                <p className="text-xs text-muted py-2 text-center">
                  {t("videoSettings.localVideosNoneFound")}
                </p>
              )}

              {!loadingLocalVideos && !localVideosError && localVideos.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background divide-y divide-border">
                  {localVideos.map((video) => {
                    const isSelected = (store.local_video_files ?? []).includes(video.name);
                    const sizeInMB = (video.size / (1024 * 1024)).toFixed(2);
                    return (
                      <label
                        key={video.name}
                        className={`flex items-center justify-between p-2 hover:bg-surface cursor-pointer select-none transition-colors ${store.video_source !== "local" ? "cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            disabled={store.video_source !== "local"}
                            checked={isSelected}
                            onChange={() => {
                              const current = store.local_video_files ?? [];
                              if (isSelected) {
                                store.set("local_video_files", current.filter(name => name !== video.name));
                              } else {
                                store.set("local_video_files", [...current, video.name]);
                              }
                            }}
                            className="h-4.5 w-4.5 rounded border-border text-accent focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span className="text-xs font-medium text-foreground truncate">
                            {video.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted shrink-0 ml-4 font-mono">
                          {sizeInMB} MB
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <Select
              label={t("videoSettings.aspectRatio")}
              value={store.video_aspect ?? "9:16"}
              options={ASPECT_OPTIONS}
              onChange={(e) =>
                store.set("video_aspect", e.target.value as VideoAspect)
              }
            />
            <Select
              label={t("videoSettings.clipOrder")}
              value={store.video_concat_mode ?? "random"}
              options={CONCAT_OPTIONS}
              onChange={(e) =>
                store.set("video_concat_mode", e.target.value as VideoConcatMode)
              }
            />
            <Select
              label={t("videoSettings.transition")}
              value={store.video_transition_mode ?? ""}
              options={TRANSITION_OPTIONS}
              onChange={(e) =>
                store.set(
                  "video_transition_mode",
                  (e.target.value || null) as VideoTransitionMode
                )
              }
            />
            <Slider
              label={t("videoSettings.clipDuration")}
              value={store.video_clip_duration ?? 5}
              min={1}
              max={15}
              step={1}
              onChange={(v) => store.set("video_clip_duration", v)}
              displayValue={`${store.video_clip_duration ?? 5}s`}
            />
            <Collapsible title={t("panels.videoConfig.advanced")}>
              <Input
                label={t("videoSettings.count")}
                type="number"
                min={1}
                max={10}
                value={store.video_count ?? 1}
                onChange={(e) =>
                  store.set("video_count", parseInt(e.target.value, 10))
                }
              />
              <Checkbox
                label={t("videoSettings.matchClips")}
                checked={store.match_materials_to_script ?? false}
                onChange={(v) => store.set("match_materials_to_script", v)}
              />
            </Collapsible>
          </>
        )}

        {tab === "audio" && (
          <>
            <Select
              label={t("panels.videoConfig.ttsProvider")}
              value={store.tts_provider}
              options={TTS_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))}
              onChange={(e) => {
                store.set("tts_provider", e.target.value as TtsProvider);
                store.set("voice_name", "");
              }}
            />

            {store.tts_provider !== "no-voice" && (
              <>
                {voiceLoadError && (
                  <p className="text-xs text-red-400">{voiceLoadError}</p>
                )}
                <Textarea
                  label={t("panels.videoConfig.previewText")}
                  placeholder={t("panels.videoConfig.voicePreviewPlaceholder")}
                  value={store.preview_text ?? ""}
                  onChange={(e) => store.set("preview_text", e.target.value)}
                  rows={3}
                />
                <VoiceGallery
                  voices={voiceOptions}
                  selectedVoice={store.voice_name ?? ""}
                  voiceRate={store.voice_rate ?? 1.0}
                  voiceVolume={store.voice_volume ?? 1.0}
                  sampleText={store.preview_text}
                  onSelect={(voiceName) => store.set("voice_name", voiceName)}
                />
                <Slider
                  label={t("audioSubtitle.voiceVolume")}
                  value={store.voice_volume ?? 1.0}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(v) => store.set("voice_volume", v)}
                  displayValue={(store.voice_volume ?? 1.0).toFixed(1)}
                />
                <Slider
                  label={t("audioSubtitle.voiceRate")}
                  value={store.voice_rate ?? 1.0}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => store.set("voice_rate", v)}
                  displayValue={`${(store.voice_rate ?? 1.0).toFixed(1)}×`}
                />
              </>
            )}

            <Select
              label={t("audioSubtitle.backgroundMusic")}
              value={
                store.bgm_file === "" && store.bgm_type === "random"
                  ? "random"
                  : (store.bgm_file ?? "")
              }
              options={bgmOptions}
              onChange={(e) => {
                if (e.target.value === "random") {
                  store.set("bgm_type", "random");
                  store.set("bgm_file", "");
                } else {
                  store.set("bgm_type", "file");
                  store.set("bgm_file", e.target.value);
                }
              }}
            />
            <Slider
              label={t("audioSubtitle.bgmVolume")}
              value={store.bgm_volume ?? 0.2}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => store.set("bgm_volume", v)}
              displayValue={(store.bgm_volume ?? 0.2).toFixed(2)}
            />
          </>
        )}

        {tab === "subtitles" && (
          <>
              <Checkbox
                label={t("audioSubtitle.enableSubtitles")}
                checked={store.subtitle_enabled ?? true}
                onChange={(v) => store.set("subtitle_enabled", v)}
              />
              {store.subtitle_enabled && (
                <Collapsible title={t("panels.videoConfig.subtitleStyle")} defaultOpen>
                  <Select
                    label={t("audioSubtitle.position")}
                    value={store.subtitle_position ?? "bottom"}
                    options={POSITION_OPTIONS}
                    onChange={(e) =>
                      store.set("subtitle_position", e.target.value)
                    }
                  />
                  {store.subtitle_position === "custom" && (
                    <Slider
                      label={t("audioSubtitle.customPositionPercent")}
                      value={store.custom_position ?? 70}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => store.set("custom_position", v)}
                      displayValue={`${store.custom_position ?? 70}%`}
                    />
                  )}
                  <SubtitleFontGallery
                    value={store.font_name ?? "STHeitiMedium.ttc"}
                    onChange={(fontName) => store.set("font_name", fontName)}
                  />
                  <Input
                    label={t("audioSubtitle.fontSize")}
                    type="number"
                    min={20}
                    max={120}
                    value={store.font_size ?? 60}
                    onChange={(e) =>
                      store.set("font_size", parseInt(e.target.value, 10))
                    }
                  />
                  <ColorPicker
                    label={t("audioSubtitle.textColor")}
                    value={store.text_fore_color ?? "#FFFFFF"}
                    onChange={(v) => store.set("text_fore_color", v)}
                  />
                  <ColorPicker
                    label={t("audioSubtitle.strokeColor")}
                    value={store.stroke_color ?? "#000000"}
                    onChange={(v) => store.set("stroke_color", v)}
                  />
                  <Slider
                    label={t("audioSubtitle.strokeWidth")}
                    value={store.stroke_width ?? 1.5}
                    min={0}
                    max={5}
                    step={0.5}
                    onChange={(v) => store.set("stroke_width", v)}
                    displayValue={(store.stroke_width ?? 1.5).toFixed(1)}
                  />
                  <div className="flex flex-col gap-2 bg-surface/30 p-2 rounded-xl border border-border/40">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-between">
                      <Checkbox
                        label={t("panels.videoConfig.subtitleBackground")}
                        checked={store.text_background_color !== false}
                        onChange={(v) =>
                          store.set("text_background_color", v ? "#000000" : false)
                        }
                      />

                      {store.text_background_color !== false && (
                        <label className="flex items-center gap-1 bg-surface border border-border/80 p-0.5 rounded-lg select-none">
                          <button
                            type="button"
                            title="Fondo sólido clásico"
                            className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                              (store.subtitle_bg_style || "solid") === "solid"
                                ? "bg-accent text-white shadow-sm"
                                : "text-muted hover:text-foreground"
                            }`}
                            onClick={() => store.set("subtitle_bg_style", "solid")}
                          >
                            Sólido
                          </button>
                          <button
                            type="button"
                            title="Fondo traslúcido con el color seleccionado"
                            className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                              store.subtitle_bg_style === "translucent"
                                ? "bg-accent text-white shadow-sm"
                                : "text-muted hover:text-foreground"
                            }`}
                            onClick={() => store.set("subtitle_bg_style", "translucent")}
                          >
                            Translúcido
                          </button>
                          <button
                            type="button"
                            title="Efecto de desenfoque de fondo"
                            className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer ${
                              store.subtitle_bg_style === "blur"
                                ? "bg-accent text-white shadow-sm"
                                : "text-muted hover:text-foreground"
                            }`}
                            onClick={() => store.set("subtitle_bg_style", "blur")}
                          >
                            Efecto Blur
                          </button>
                        </label>
                      )}
                    </div>

                    {store.text_background_color !== false && store.subtitle_bg_style !== "blur" && (
                      <div className="animate-fadeIn">
                        <ColorPicker
                          label={t("panels.videoConfig.backgroundColor")}
                          value={
                            typeof store.text_background_color === "string"
                              ? store.text_background_color
                              : "#000000"
                          }
                          onChange={(v) => store.set("text_background_color", v)}
                        />
                      </div>
                    )}
                  </div>
                  <Checkbox
                    label={t("audioSubtitle.roundedBackground")}
                    checked={store.rounded_subtitle_background ?? false}
                    onChange={(v) => store.set("rounded_subtitle_background", v)}
                  />
                </Collapsible>
              )}
          </>
        )}
          </div>
          </div>

          <div className="hidden min-h-0 self-start lg:block">
          <SubtitlePreview
            enabled={store.subtitle_enabled ?? true}
            position={store.subtitle_position ?? "bottom"}
            customPosition={store.custom_position ?? 70}
            fontName={store.font_name ?? "STHeitiMedium.ttc"}
            fontSize={store.font_size ?? 60}
            textColor={store.text_fore_color ?? "#FFFFFF"}
            strokeColor={store.stroke_color ?? "#000000"}
            strokeWidth={store.stroke_width ?? 1.5}
            textBackgroundColor={store.text_background_color ?? true}
            roundedBackground={store.rounded_subtitle_background ?? false}
            subtitleBgStyle={store.subtitle_bg_style ?? "solid"}
            sampleText={store.preview_text || store.video_script}
          />
          </div>
          </div>
      </div>

      <div className="shrink-0 border-t border-border pt-4">
        <div className={hasReviewVideo ? "grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]" : ""}>
        {hasReviewVideo && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => workspaceStore.setPanel("review")}
          >
            <Eye className="mr-2 h-4 w-4" />
            {t("panels.videoConfig.backToReview")}
          </Button>
        )}
        <Button
          className="w-full"
          size="lg"
          onClick={handleGenerate}
          disabled={isSubmitting || !store.video_subject.trim()}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          {t("panels.videoConfig.generate")}
        </Button>
        </div>
      </div>
    </section>
  );
}
