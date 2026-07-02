// webui-react/src/components/panels/VideoConfigPanel.tsx
import { useState, useEffect } from "react";
import { Wand2 } from "lucide-react";
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
import { useVideoStore } from "../../store/useVideoStore";
import { useConfigStore } from "../../store/useConfigStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { videoApi } from "../../api/video";
import { voiceApi } from "../../api/voice";
import { SubtitleFontGallery } from "../subtitles/SubtitleFontGallery";
import { SubtitlePreview } from "../subtitles/SubtitlePreview";
import { VoiceGallery } from "../voice/VoiceGallery";
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
  const workspaceStore = useProjectWorkspaceStore();

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

  const handleGenerate = () => {
    void workspaceStore.generateVideo(store.toParams());
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
          onClick={() => workspaceStore.setPanel("script")}
        >
          {t("panels.videoConfig.back")}
        </Button>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-h-0 overflow-hidden py-4">
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
          <div className="h-full min-h-0 overflow-y-auto pr-1 pb-6">
            <div className="min-w-0 space-y-3">
        {tab === "video" && (
          <>
            <Select
              label={t("videoSettings.source")}
              value={store.video_source ?? "pexels"}
              options={videoSourceOptions}
              onChange={(e) => store.set("video_source", e.target.value)}
            />
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
                  <Checkbox
                    label={t("panels.videoConfig.subtitleBackground")}
                    checked={store.text_background_color !== false}
                    onChange={(v) =>
                      store.set("text_background_color", v ? "#000000" : false)
                    }
                  />
                  {store.text_background_color !== false && (
                    <ColorPicker
                      label={t("panels.videoConfig.backgroundColor")}
                      value={
                        typeof store.text_background_color === "string"
                          ? store.text_background_color
                          : "#000000"
                      }
                      onChange={(v) => store.set("text_background_color", v)}
                    />
                  )}
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
            sampleText={store.preview_text || store.video_script}
          />
          </div>
          </div>
      </div>

      <div className="shrink-0 border-t border-border pt-4">
        <Button
          className="w-full"
          size="lg"
          onClick={handleGenerate}
          disabled={!store.video_subject.trim()}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {t("panels.videoConfig.generate")}
        </Button>
      </div>
    </section>
  );
}
