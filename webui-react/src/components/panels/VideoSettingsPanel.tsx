// webui-react/src/components/panels/VideoSettingsPanel.tsx
import { Select, Slider, Checkbox, Collapsible } from "../ui";
import { useVideoStore } from "../../store/useVideoStore";
import { useConfigStore } from "../../store/useConfigStore";
import type { VideoAspect, VideoConcatMode, VideoTransitionMode } from "../../api/types";

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

export function VideoSettingsPanel() {
  const store = useVideoStore();
  const { config } = useConfigStore();

  const videoSourceOptions = (config?.video_sources ?? ["pexels", "pixabay", "local"]).map(
    (s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Video</h2>

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
        onChange={(e) => store.set("video_aspect", e.target.value as VideoAspect)}
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
          <label className="text-xs font-medium text-muted">Video Count</label>
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
          label="Match clips to script"
          checked={store.match_materials_to_script ?? false}
          onChange={(v) => store.set("match_materials_to_script", v)}
        />
      </Collapsible>
    </section>
  );
}
