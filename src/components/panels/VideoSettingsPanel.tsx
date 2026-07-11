// webui-react/src/components/panels/VideoSettingsPanel.tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Select, Slider, Checkbox, Collapsible } from "../ui";
import { useVideoStore } from "../../store/useVideoStore";
import { useConfigStore } from "../../store/useConfigStore";
import { videoApi } from "../../api/video";
import type { VideoAspect, VideoConcatMode, VideoTransitionMode } from "../../api/types";

export function VideoSettingsPanel() {
  const { t } = useTranslation();
  const store = useVideoStore();
  const { config } = useConfigStore();

  const [localVideos, setLocalVideos] = useState<{ name: string; size: number; path: string }[]>([]);
  const [loadingLocalVideos, setLoadingLocalVideos] = useState(false);
  const [localVideosError, setLocalVideosError] = useState<string | null>(null);

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

      <div className={`rounded-lg border border-border bg-surface p-4 space-y-3 transition-all ${store.video_source !== "local" ? "opacity-50 pointer-events-none select-none bg-surface/40" : ""}`}>
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
