// webui-react/src/components/panels/ReviewPanel.tsx
import { useState } from "react";
import { Edit3, Clapperboard } from "lucide-react";
import { Button } from "../ui";
import { ClipGrid } from "./ClipGrid";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

export function ReviewPanel() {
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();
  const [excluded, setExcluded] = useState<string[]>([]);

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const clips = videoTrack?.items ?? [];

  if (projectStore.mode === "disabled") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8 text-center">
        <p className="text-sm text-muted">Review not available — rendering directly</p>
        <p className="text-xs text-muted mt-1">
          Enable project mode on the server to use clip review.
        </p>
        <Button className="mt-4" onClick={() => setPanel("done")}>
          Continue to Done
        </Button>
      </div>
    );
  }

  const handleExclude = (clipId: string) => {
    setExcluded((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
  };

  const totalDuration = clips
    .filter((c) => !excluded.includes(c.id))
    .reduce((sum, c) => sum + c.duration_sec, 0);

  const handleBackToScript = () => setPanel("script");

  const handleRender = async () => {
    await projectStore.render();
    setPanel("rendering");
  };

  return (
    <div className="flex flex-col min-h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Review clips</h2>
          <p className="text-xs text-muted mt-0.5">
            {clips.length} clips · ~{totalDuration.toFixed(0)}s total
            {excluded.length > 0 && ` · ${excluded.length} excluded`}
          </p>
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">No clips found. Build a timeline first.</p>
        </div>
      ) : (
        <ClipGrid clips={clips} excluded={excluded} onExclude={handleExclude} />
      )}

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button variant="ghost" onClick={handleBackToScript}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" />
          ← Back to Script
        </Button>
        <Button onClick={handleRender} className="flex-1">
          <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
          Render Video →
        </Button>
      </div>
    </div>
  );
}
