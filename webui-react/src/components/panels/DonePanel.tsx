// webui-react/src/components/panels/DonePanel.tsx
import { Download, RotateCcw, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";

export function DonePanel() {
  const { videoUrls, reset, setPanel } = useProjectWorkspaceStore();
  const videoReset = useVideoStore((s) => s.reset);
  const navigate = useNavigate();

  const handleStartOver = () => {
    reset();
    videoReset();
    navigate("/");
  };

  const handleMakeAnother = () => {
    reset();
    setPanel("script");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <h2 className="text-sm font-semibold text-foreground">Video ready</h2>
        </div>

        {videoUrls.length === 0 && (
          <p className="text-xs text-muted">No videos were produced.</p>
        )}

        {videoUrls.map((url) => (
          <div
            key={url}
            className="rounded-lg overflow-hidden border border-border bg-surface"
          >
            <video
              src={url}
              controls
              className="w-full max-h-[480px] object-contain"
            />
            <div className="flex items-center gap-2 px-3 py-2">
              <a
                href={url}
                download
                className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={handleStartOver} size="sm">
            ← Start Over
          </Button>
          <Button onClick={handleMakeAnother} size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Make Another →
          </Button>
        </div>
      </div>
    </div>
  );
}
