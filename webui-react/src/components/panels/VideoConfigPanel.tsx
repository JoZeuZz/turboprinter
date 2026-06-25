// webui-react/src/components/panels/VideoConfigPanel.tsx
import { useState, useEffect } from "react";
import { Wand2 } from "lucide-react";
import {
  TabBar,
  Button,
  Select,
  Slider,
  Checkbox,
  ColorPicker,
  Collapsible,
} from "../ui";
import { useVideoStore } from "../../store/useVideoStore";
import { useConfigStore } from "../../store/useConfigStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { videoApi } from "../../api/video";
import { voiceApi } from "../../api/voice";
import { TTS_PROVIDERS, type TtsProvider } from "../../api/types";
import type {
  VideoAspect,
  VideoConcatMode,
  VideoTransitionMode,
  BgmFile,
} from "../../api/types";

const TABS = [
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "subtitles", label: "Subtitles" },
];

const ASPECT_OPTIONS = [
  { value: "9:16", label: "Portrait 9:16" },
  { value: "16:9", label: "Landscape 16:9" },
  { value: "1:1", label: "Square 1:1" },
];

const CONCAT_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "sequential", label: "Sequential" },
];

const TRANSITION_OPTIONS = [
  { value: "", label: "None" },
  { value: "Shuffle", label: "Shuffle" },
  { value: "FadeIn", label: "Fade In" },
  { value: "FadeOut", label: "Fade Out" },
  { value: "SlideIn", label: "Slide In" },
  { value: "SlideOut", label: "Slide Out" },
];


const FONT_OPTIONS = [
  { value: "STHeitiMedium.ttc", label: "STHeitiMedium (default)" },
  { value: "NotoSansHans-Medium.ttf", label: "NotoSans Han" },
  { value: "HarmonyOS_Sans_SC_Medium.ttf", label: "HarmonyOS Sans" },
];

const POSITION_OPTIONS = [
  { value: "bottom", label: "Bottom" },
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "custom", label: "Custom %" },
];

export function VideoConfigPanel() {
  const [tab, setTab] = useState("video");
  const [bgmFiles, setBgmFiles] = useState<BgmFile[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<{ value: string; label: string }[]>([]);
  const [voiceLoadError, setVoiceLoadError] = useState<string | null>(null);
  const store = useVideoStore();
  const { config } = useConfigStore();
  const workspaceStore = useProjectWorkspaceStore();

  useEffect(() => {
    videoApi.getBgmList().then((r) => setBgmFiles(r.files)).catch(() => {});
  }, []);

  useEffect(() => {
    setVoiceLoadError(null);
    voiceApi
      .getVoices(store.tts_provider)
      .then(setVoiceOptions)
      .catch(() => {
        setVoiceLoadError("No se pudieron cargar las voces");
      });
  }, [store.tts_provider]);

  const videoSourceOptions = (
    config?.video_sources ?? ["pexels", "pixabay", "local"]
  ).map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

  const bgmOptions = [
    { value: "random", label: "Random" },
    { value: "", label: "None" },
    ...bgmFiles.map((f) => ({ value: f.file, label: f.name })),
  ];

  const handleGenerate = () => {
    void workspaceStore.generateVideo(store.toParams());
  };

  return (
    <section className="flex flex-col h-full max-w-xl mx-auto w-full px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">
          Configure your video
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => workspaceStore.setPanel("script")}
        >
          ← Back
        </Button>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {tab === "video" && (
          <>
            <Select
              label="Source"
              value={store.video_source ?? "pexels"}
              options={videoSourceOptions}
              onChange={(e) => store.set("video_source", e.target.value)}
            />
            <Select
              label="Aspect Ratio"
              value={store.video_aspect ?? "9:16"}
              options={ASPECT_OPTIONS}
              onChange={(e) =>
                store.set("video_aspect", e.target.value as VideoAspect)
              }
            />
            <Select
              label="Clip Order"
              value={store.video_concat_mode ?? "random"}
              options={CONCAT_OPTIONS}
              onChange={(e) =>
                store.set("video_concat_mode", e.target.value as VideoConcatMode)
              }
            />
            <Select
              label="Transition"
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
              label="Clip Duration (s)"
              value={store.video_clip_duration ?? 5}
              min={1}
              max={15}
              step={1}
              onChange={(v) => store.set("video_clip_duration", v)}
              displayValue={`${store.video_clip_duration ?? 5}s`}
            />
            <Collapsible title="Advanced">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">
                  Video Count
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={store.video_count ?? 1}
                  onChange={(e) =>
                    store.set("video_count", parseInt(e.target.value, 10))
                  }
                  className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <Checkbox
                label="Match clips to script"
                checked={store.match_materials_to_script ?? false}
                onChange={(v) => store.set("match_materials_to_script", v)}
              />
            </Collapsible>
          </>
        )}

        {tab === "audio" && (
          <>
            <Select
              label="TTS Provider"
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
                <Select
                  label="Voice"
                  value={store.voice_name ?? ""}
                  options={[{ value: "", label: "Default" }, ...voiceOptions]}
                  onChange={(e) => store.set("voice_name", e.target.value)}
                />
                <Slider
                  label="Voice Volume"
                  value={store.voice_volume ?? 1.0}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(v) => store.set("voice_volume", v)}
                  displayValue={(store.voice_volume ?? 1.0).toFixed(1)}
                />
                <Slider
                  label="Voice Rate"
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
              label="Background Music"
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
              label="BGM Volume"
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
              label="Enable subtitles"
              checked={store.subtitle_enabled ?? true}
              onChange={(v) => store.set("subtitle_enabled", v)}
            />
            {store.subtitle_enabled && (
              <Collapsible title="Subtitle Style" defaultOpen>
                <Select
                  label="Position"
                  value={store.subtitle_position ?? "bottom"}
                  options={POSITION_OPTIONS}
                  onChange={(e) =>
                    store.set("subtitle_position", e.target.value)
                  }
                />
                {store.subtitle_position === "custom" && (
                  <Slider
                    label="Custom Position %"
                    value={store.custom_position ?? 70}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => store.set("custom_position", v)}
                    displayValue={`${store.custom_position ?? 70}%`}
                  />
                )}
                <Select
                  label="Font"
                  value={store.font_name ?? "STHeitiMedium.ttc"}
                  options={FONT_OPTIONS}
                  onChange={(e) => store.set("font_name", e.target.value)}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">
                    Font Size
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={120}
                    value={store.font_size ?? 60}
                    onChange={(e) =>
                      store.set("font_size", parseInt(e.target.value, 10))
                    }
                    className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <ColorPicker
                  label="Text Color"
                  value={store.text_fore_color ?? "#FFFFFF"}
                  onChange={(v) => store.set("text_fore_color", v)}
                />
                <ColorPicker
                  label="Stroke Color"
                  value={store.stroke_color ?? "#000000"}
                  onChange={(v) => store.set("stroke_color", v)}
                />
                <Slider
                  label="Stroke Width"
                  value={store.stroke_width ?? 1.5}
                  min={0}
                  max={5}
                  step={0.5}
                  onChange={(v) => store.set("stroke_width", v)}
                  displayValue={(store.stroke_width ?? 1.5).toFixed(1)}
                />
                <Checkbox
                  label="Rounded background"
                  checked={store.rounded_subtitle_background ?? false}
                  onChange={(v) => store.set("rounded_subtitle_background", v)}
                />
              </Collapsible>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <Button
          className="w-full"
          size="lg"
          onClick={handleGenerate}
          disabled={!store.video_subject.trim()}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Video
        </Button>
      </div>
    </section>
  );
}
