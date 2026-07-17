// webui-react/src/components/panels/AudioSubtitlePanel.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  Slider,
  Checkbox,
  ColorPicker,
  Collapsible,
} from "../ui";
import { useVideoStore } from "../../store/useVideoStore";
import { videoApi } from "../../api/video";
import { SubtitleFontGallery } from "../subtitles/SubtitleFontGallery";
import { VoiceGallery } from "../voice/VoiceGallery";
import type { BgmFile } from "../../api/types";

const VOICE_OPTIONS = [
  { value: "", label: "Default" },
  { value: "es-ES-AlvaroNeural", label: "es-ES Álvaro (Male)" },
  { value: "es-ES-ElviraNeural", label: "es-ES Elvira (Female)" },
  { value: "es-MX-DaliaNeural", label: "es-MX Dalia (Female)" },
  { value: "es-MX-JorgeNeural", label: "es-MX Jorge (Male)" },
  { value: "en-US-JennyNeural", label: "en-US Jenny (Female)" },
  { value: "en-US-GuyNeural", label: "en-US Guy (Male)" },
  { value: "zh-CN-XiaoxiaoNeural", label: "zh-CN Xiaoxiao (Female)" },
  { value: "zh-CN-YunxiNeural", label: "zh-CN Yunxi (Male)" },
];

export function AudioSubtitlePanel() {
  const { t } = useTranslation();
  const store = useVideoStore();
  const [bgmFiles, setBgmFiles] = useState<BgmFile[]>([]);

  const POSITION_OPTIONS = [
    { value: "bottom", label: t("audioSubtitle.positionBottom") },
    { value: "center", label: t("audioSubtitle.positionCenter") },
    { value: "top", label: t("audioSubtitle.positionTop") },
    { value: "custom", label: t("audioSubtitle.positionCustom") },
  ];

  const ANIMATION_OPTIONS = [
    { value: "none", label: "Ninguna" },
    { value: "pop", label: "Efecto Pop (TikTok / Rebote)" },
    { value: "rotate", label: "Giro Dinámico (Tilt Pop)" },
  ];

  useEffect(() => {
    videoApi.getBgmList().then((r) => setBgmFiles(r.files)).catch(() => {});
  }, []);

  const bgmOptions = [
    { value: "random", label: t("audioSubtitle.bgmRandom") },
    { value: "contextual", label: "AI Contextual (Auto-select by script tone)" },
    { value: "", label: t("audioSubtitle.bgmNone") },
    ...bgmFiles.map((f) => ({ value: f.file, label: f.name })),
  ];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">{t("audioSubtitle.title")}</h2>

      {/* Voice */}
      <VoiceGallery
        voices={VOICE_OPTIONS.filter((voice) => voice.value)}
        selectedVoice={store.voice_name ?? ""}
        voiceRate={store.voice_rate ?? 1.0}
        voiceVolume={store.voice_volume ?? 1.0}
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

      {/* BGM */}
      <Select
        label={t("audioSubtitle.backgroundMusic")}
        value={
          store.bgm_file === "" && store.bgm_type === "random"
            ? "random"
            : store.bgm_type === "contextual"
            ? "contextual"
            : (store.bgm_file ?? "")
        }
        options={bgmOptions}
        onChange={(e) => {
          if (e.target.value === "random") {
            store.set("bgm_type", "random");
            store.set("bgm_file", "");
          } else if (e.target.value === "contextual") {
            store.set("bgm_type", "contextual");
            store.set("bgm_file", "");
          } else {
            store.set("bgm_type", "file");
            store.set("bgm_file", e.target.value);
          }
        }}
      />

      {store.bgm_type === "contextual" && (
        <p className="text-[11px] text-accent font-medium leading-relaxed -mt-2 pb-1">
          ✨ <strong>AI Contextual (Option B) Active:</strong> The system matches background soundtracks based on your script, topics, and mood automatically.
        </p>
      )}
      {store.bgm_type === "file" && store.bgm_file && (
        <p className="text-[11px] text-muted font-medium leading-relaxed -mt-2 pb-1">
          🎵 <strong>Manual (Option A) Active:</strong> You have selected a specific background track.
        </p>
      )}

      <Slider
        label={t("audioSubtitle.bgmVolume")}
        value={store.bgm_volume ?? 0.2}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => store.set("bgm_volume", v)}
        displayValue={(store.bgm_volume ?? 0.2).toFixed(2)}
      />

      {/* Subtitles */}
      <Checkbox
        label={t("audioSubtitle.enableSubtitles")}
        checked={store.subtitle_enabled ?? true}
        onChange={(v) => store.set("subtitle_enabled", v)}
      />

      {store.subtitle_enabled && (
        <Collapsible title={t("audioSubtitle.subtitleStyle")} defaultOpen>
          <Select
            label={t("audioSubtitle.position")}
            value={store.subtitle_position ?? "bottom"}
            options={POSITION_OPTIONS}
            onChange={(e) => store.set("subtitle_position", e.target.value)}
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t("audioSubtitle.fontSize")}</label>
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
            label={t("audioSubtitle.roundedBackground")}
            checked={store.rounded_subtitle_background ?? false}
            onChange={(v) => store.set("rounded_subtitle_background", v)}
          />

          <Select
            label="Animación de Subtítulos (ASS)"
            value={store.subtitle_animation ?? "pop"}
            options={ANIMATION_OPTIONS}
            onChange={(e) =>
              store.set("subtitle_animation", e.target.value as any)
            }
          />
        </Collapsible>
      )}
    </section>
  );
}
