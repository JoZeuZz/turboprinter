// webui-react/src/components/panels/ReviewPanel.tsx
import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Clapperboard, SlidersHorizontal, Youtube, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "../ui";
import { ClipPreviewModal } from "../ui/ClipPreviewModal";
import { SortableClipCard } from "./SortableClipCard";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useConfigStore } from "../../store/useConfigStore";
import type { TimelineItem, EditCommand } from "../../api/types";

export function ReviewPanel() {
  const { t } = useTranslation();
  const projectStore = useProjectStore();
  const { setPanel, videoUrls } = useProjectWorkspaceStore();
  const { config } = useConfigStore();

  const isYoutubeLinked = !!config?.settings?.youtube?.is_linked;
  const youtubeChannel = config?.settings?.youtube?.channel_name || "";

  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const sourceClips = videoTrack?.items ?? [];

  const [orderedClips, setOrderedClips] = useState<TimelineItem[]>(sourceClips);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [previewClip, setPreviewClip] = useState<TimelineItem | null>(null);

  // Sync orderedClips when project loads
  useEffect(() => {
    setOrderedClips(sourceClips);
  }, [sourceClips.length]);

  const handleYoutubeUpload = () => {
    if (!isYoutubeLinked) return;
    setUploadStatus("uploading");
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploadStatus("success");
          return 100;
        }
        return prev + 10;
      });
    }, 250);
  };

  if (projectStore.mode === "disabled" || !projectStore.project) {
    const finalVideo = videoUrls[0];

    return (
      <div className="flex h-full w-full max-w-4xl mx-auto flex-col items-center justify-start gap-6 px-6 py-8 text-center">
        <div className="space-y-2 max-w-xl">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t("panels.review.taskReviewTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("panels.review.taskReviewDescription")}</p>
        </div>

        {finalVideo ? (
          <div className="w-full max-w-sm sm:max-w-md rounded-2xl overflow-hidden border border-border bg-neutral-900/60 shadow-2xl p-2 transition-all duration-300 hover:shadow-accent/5 hover:border-accent/20">
            <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center aspect-[9/16] max-h-[500px]">
              <video src={finalVideo} controls {...{ referrerpolicy: "no-referrer" }} className="w-full h-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[300px] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-sm text-muted-foreground gap-3">
            <Clapperboard className="h-10 w-10 text-muted/40 animate-pulse" />
            <span>{t("panels.done.none")}</span>
          </div>
        )}

        {finalVideo && (
          <div className="w-full max-w-md space-y-4">
            {/* YouTube Upload Status Card */}
            {uploadStatus !== "idle" && (
              <div className={`rounded-xl border p-4 text-left transition-all duration-300 ${
                uploadStatus === "uploading" 
                  ? "bg-accent/5 border-accent/20" 
                  : "bg-green-500/5 border-green-500/20"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">
                    {uploadStatus === "uploading" 
                      ? t("panels.review.uploadingToYoutube", { progress: uploadProgress })
                      : t("panels.review.uploadSuccess")
                    }
                  </span>
                  {uploadStatus === "uploading" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
                {uploadStatus === "uploading" ? (
                  <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-accent h-full transition-all duration-300 ease-out" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("panels.review.uploadChannelInfo", { channel: youtubeChannel })}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <Button 
                variant="ghost" 
                onClick={() => setPanel("config")}
                className="flex items-center justify-center gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {t("panels.review.editSettings")}
              </Button>

              <Button
                onClick={handleYoutubeUpload}
                disabled={!isYoutubeLinked || uploadStatus === "uploading" || uploadStatus === "success"}
                className={`flex-1 flex items-center justify-center gap-2 font-medium ${
                  isYoutubeLinked 
                    ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500" 
                    : "bg-muted/50 text-muted-foreground cursor-not-allowed hover:bg-muted/50 border border-border"
                }`}
                title={!isYoutubeLinked ? t("panels.review.notLinkedYoutube") : undefined}
              >
                <Youtube className="h-4 w-4" />
                {uploadStatus === "success" 
                  ? t("panels.review.uploadSuccess") 
                  : uploadStatus === "uploading"
                  ? t("panels.review.uploadingToYoutube", { progress: uploadProgress })
                  : t("panels.review.uploadToYoutube")
                }
              </Button>

              <Button 
                onClick={() => setPanel("done")} 
                className="flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("panels.review.continueToDone")}
              </Button>
            </div>

            {!isYoutubeLinked && (
              <p className="text-xs text-muted-foreground text-center bg-muted/30 py-2 px-4 rounded-lg border border-border/50 max-w-sm mx-auto">
                ℹ️ {t("panels.review.notLinkedYoutube")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedClips((clips) => {
        const oldIndex = clips.findIndex((c) => c.id === active.id);
        const newIndex = clips.findIndex((c) => c.id === over.id);
        return arrayMove(clips, oldIndex, newIndex);
      });
    }
  };

  const handleExclude = (clipId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  const totalDuration = orderedClips
    .filter((c) => !excluded.has(c.id))
    .reduce((sum, c) => sum + c.duration_sec, 0);

  const handleRender = async () => {
    const trackId = videoTrack?.id ?? "";
    let accStart = 0;
    const commands: EditCommand[] = [];

    for (const clip of orderedClips) {
      if (excluded.has(clip.id)) {
        commands.push({
          type: "set_timing",
          track_id: trackId,
          item_id: clip.id,
          duration_sec: 0,
        });
      } else {
        commands.push({
          type: "move",
          track_id: trackId,
          item_id: clip.id,
          new_start_sec: accStart,
        });
        accStart += clip.duration_sec;
      }
    }

    if (commands.length > 0) {
      await projectStore.applyTimelineCommands({ commands });
    }
    await projectStore.render();
    setPanel("rendering");
  };

  return (
    <div className="flex h-full w-full max-w-5xl mx-auto flex-col gap-4 px-6 py-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("panels.review.reviewClips")}</h2>
          <p className="text-xs text-muted mt-0.5">
            {orderedClips.length} clips · ~{totalDuration.toFixed(0)}s total
            {excluded.size > 0 && ` · ${excluded.size} excluded`}
          </p>
        </div>
      </div>

      {orderedClips.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">{t("panels.review.noClips")}</p>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={orderedClips.map((c) => c.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {orderedClips.map((clip) => (
                <SortableClipCard
                  key={clip.id}
                  clip={clip}
                  excluded={excluded.has(clip.id)}
                  onExclude={handleExclude}
                  onPreview={setPreviewClip}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button variant="ghost" onClick={() => setPanel("script")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {t("panels.review.backToScript")}
        </Button>
        <Button onClick={handleRender} className="flex-1">
          <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
          {t("panels.review.renderVideo")}
        </Button>
      </div>

      <ClipPreviewModal
        clip={previewClip}
        onClose={() => setPreviewClip(null)}
      />
    </div>
  );
}
