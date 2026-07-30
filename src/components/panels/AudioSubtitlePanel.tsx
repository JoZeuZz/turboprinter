// webui-react/src/components/panels/AudioSubtitlePanel.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause } from "lucide-react";
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
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [playTimeout, setPlayTimeout] = useState<any>(null);

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

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
      if (playTimeout) {
        clearTimeout(playTimeout);
      }
    };
  }, [audioElement, playTimeout]);

  const togglePlayBgm = (url: string) => {
    if (previewTrack === url) {
      if (audioElement) {
        audioElement.pause();
      }
      if (playTimeout) {
        clearTimeout(playTimeout);
      }
      setPreviewTrack(null);
      setAudioElement(null);
      setPlayTimeout(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      if (playTimeout) {
        clearTimeout(playTimeout);
      }

      const audio = new Audio(url);
      audio.volume = 0.4;
      setPreviewTrack(url);
      setAudioElement(audio);

      audio.play().catch((err) => console.log("Audio play error:", err));

      const timeoutId = setTimeout(() => {
        audio.pause();
        setPreviewTrack(null);
        setAudioElement(null);
      }, 6000); // 6-second preview limit

      setPlayTimeout(timeoutId);

      audio.onended = () => {
        clearTimeout(timeoutId);
        setPreviewTrack(null);
        setAudioElement(null);
      };
    }
  };

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

      {/* Manual Track Selection List with Preview */}
      {bgmFiles.length > 0 && (
        <div className="flex flex-col gap-1.5 -mt-1 pb-1">
          <label className="text-xs font-semibold text-foreground/80">
            Escuchar fragmento (6s) y seleccionar:
          </label>
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
            {bgmFiles.map((file) => {
              const isSelected = store.bgm_type === "file" && store.bgm_file === file.file;
              const isPlaying = previewTrack === file.file;

              return (
                <div
                  key={file.file}
                  onClick={() => {
                    store.set("bgm_type", "file");
                    store.set("bgm_file", file.file);
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "border-accent bg-accent/5 shadow-[0_0_8px_rgba(var(--accent-rgb),0.12)]"
                      : "border-border bg-surface-2 hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayBgm(file.file);
                      }}
                      className={`flex items-center justify-center w-7 h-7 rounded-full transition-all shrink-0 ${
                        isPlaying
                          ? "bg-accent text-accent-foreground animate-pulse"
                          : "bg-surface-3 text-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                      title="Escuchar fragmento (6s)"
                    >
                      {isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 ml-0.5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-[9px] text-muted truncate">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? "border-accent bg-accent"
                          : "border-muted"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BGM Volume */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 transition-all">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>{t("audioSubtitle.bgmVolume")}</span>
            <span className="text-[10px] text-muted font-normal">
              (0% - 100%)
            </span>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const current = Math.round((store.bgm_volume ?? 0.2) * 100);
                const next = Math.max(0, current - 1);
                store.set("bgm_volume", +(next / 100).toFixed(2));
              }}
              className="w-6 h-6 rounded border border-border bg-surface-2 hover:bg-accent/10 hover:border-accent text-xs font-bold text-foreground flex items-center justify-center transition-colors"
              title="Disminuir 1%"
            >
              -
            </button>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round((store.bgm_volume ?? 0.2) * 100)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val)) return;
                  const clamped = Math.min(100, Math.max(0, val));
                  store.set("bgm_volume", +(clamped / 100).toFixed(2));
                }}
                className="w-14 h-7 text-center text-xs font-bold font-mono rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent pr-3"
              />
              <span className="absolute right-1.5 text-[10px] font-semibold text-muted pointer-events-none">
                %
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const current = Math.round((store.bgm_volume ?? 0.2) * 100);
                const next = Math.min(100, current + 1);
                store.set("bgm_volume", +(next / 100).toFixed(2));
              }}
              className="w-6 h-6 rounded border border-border bg-surface-2 hover:bg-accent/10 hover:border-accent text-xs font-bold text-foreground flex items-center justify-center transition-colors"
              title="Aumentar 1%"
            >
              +
            </button>
          </div>
        </div>

        {/* Continuous Smooth Slider */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={store.bgm_volume ?? 0.2}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            store.set("bgm_volume", +(val.toFixed(2)));
          }}
          className="w-full h-2 rounded-full appearance-none bg-border cursor-pointer accent-accent"
        />

        {/* Quick Presets */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <span className="text-[10px] text-muted font-medium">Presets:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { label: "1%", val: 0.01 },
              { label: "2%", val: 0.02 },
              { label: "5% (Suave)", val: 0.05 },
              { label: "10%", val: 0.1 },
              { label: "15% (Ideal)", val: 0.15 },
              { label: "20%", val: 0.2 },
              { label: "25%", val: 0.25 },
              { label: "40%", val: 0.4 },
            ].map((p) => {
              const isActive = Math.abs((store.bgm_volume ?? 0.2) - p.val) < 0.01;
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => store.set("bgm_volume", p.val)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-all ${
                    isActive
                      ? "bg-accent text-accent-foreground border-accent font-semibold shadow-xs"
                      : "bg-surface-2 text-muted hover:text-foreground border-border hover:border-accent/40"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
