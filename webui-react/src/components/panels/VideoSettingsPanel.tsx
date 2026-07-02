// webui-react/src/components/panels/VideoSettingsPanel.tsx
import { useTranslation } from "react-i18next";
import { Select, Slider, Checkbox, Collapsible } from "../ui";
import { useVideoStore } from "../../store/useVideoStore";
import { useConfigStore } from "../../store/useConfigStore";
import type { VideoAspect, VideoConcatMode, VideoTransitionMode } from "../../api/types";

export function VideoSettingsPanel() {
  const { t } = useTranslation();
  const store = useVideoStore();
  const { config } = useConfigStore();

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

  const videoSourceOptions = (config?.video_sources ?? ["pexels", "pixabay", "local"]).map(
    (s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">{t("videoSettings.title")}</h2>

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
        onChange={(e) => store.set("video_aspect", e.target.value as VideoAspect)}
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

      <Collapsible title={t("videoSettings.advanced")}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">{t("videoSettings.count")}</label>
          <input
            type="number"
            min={1}
            max={10}
            value={store.video_count ?? 1}
            onChange={(e) => store.set("video_count", parseInt(e.target.value, 10))}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <Checkbox
          label={t("videoSettings.matchClips")}
          checked={store.match_materials_to_script ?? false}
          onChange={(v) => store.set("match_materials_to_script", v)}
        />
      </Collapsible>
    </section>
  );
}
