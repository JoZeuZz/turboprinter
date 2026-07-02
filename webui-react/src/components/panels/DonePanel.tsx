// webui-react/src/components/panels/DonePanel.tsx
import { Download, RotateCcw, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

export function DonePanel() {
  const { t } = useTranslation();
  const { videoUrls, reset, setPanel } = useProjectWorkspaceStore();

  const handleBack = () => {
    setPanel("config");
  };

  const handleMakeAnother = () => {
    reset();
    setPanel("script");
  };

  return (
    <div className="flex h-full w-full max-w-5xl mx-auto flex-col justify-start px-6 py-5">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <h2 className="text-sm font-semibold text-foreground">{t("panels.done.ready")}</h2>
        </div>

        {videoUrls.length === 0 && (
          <p className="text-xs text-muted">{t("panels.done.none")}</p>
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
          <Button variant="ghost" onClick={handleBack} size="sm">
            ← Back
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
