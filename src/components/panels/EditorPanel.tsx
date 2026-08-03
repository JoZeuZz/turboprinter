// webui-react/src/components/panels/EditorPanel.tsx
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { VideoPreview } from "../editor/VideoPreview";
import { ClipInspector } from "../editor/ClipInspector";
import { Timeline } from "../editor/Timeline";
import { Button } from "../ui";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";
import { getClipsForPart, getNormalizedItemsForPart } from "../../lib/partUtils";
import { videoApi } from "../../api/video";
import type { EditCommand, TimelineItem } from "../../api/types";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function EditorPanel() {
  const { t } = useTranslation();
  const projectStore = useProjectStore();
  const videoStore = useVideoStore();
  const { setPanel, videoUrls, activePartIndex, setActivePartIndex } = useProjectWorkspaceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const [outroStatus, setOutroStatus] = useState<{ exists: boolean; url: string | null; filename: string }>({
    exists: false,
    url: null,
    filename: "outro.mp4",
  });
  const [outroEnabled, setOutroEnabled] = useState(true);

  const isMultiPart = Boolean((videoStore.is_multi_part && (videoStore.multi_part_count ?? 1) > 1) || videoUrls.length > 1);
  const multiPartCount = isMultiPart ? (videoStore.multi_part_count || videoUrls.length || 2) : 1;
  const [selectedPart, setSelectedPart] = useState<number | "all">(activePartIndex || 1);

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const audioTrack = projectStore.project?.tracks.find((t) => t.type === "audio");
  const subtitleTrack = projectStore.project?.tracks.find((t) => t.type === "subtitle");

  const rawVideoItems: TimelineItem[] = videoTrack?.items ?? [];
  const rawAudioItems: TimelineItem[] = audioTrack?.items ?? [];
  const rawSubItems: TimelineItem[] = subtitleTrack?.items ?? [];

  // Load Outro Status
  useEffect(() => {
    videoApi
      .getOutroStatus()
      .then((res) => {
        if (res) setOutroStatus(res);
      })
      .catch((err) => {
        console.error("[EditorPanel] Failed to load outro status:", err);
      });
  }, []);

  // Ensure clip_outro is in videoTrack if outroEnabled is true, or remove if false
  const syncOutroClip = useCallback(
    (enabled: boolean) => {
      if (!videoTrack) return;
      const hasOutro = rawVideoItems.some((c) => c.id === "clip_outro" || c.asset_url?.includes("outro"));
      if (enabled && !hasOutro) {
        const totalDur = rawVideoItems.reduce((acc, c) => Math.max(acc, (c.start_sec || 0) + (c.duration_sec || 0)), 0);
        void projectStore.applyTimelineCommands({
          commands: [
            {
              type: "move",
              track_id: videoTrack.id,
              item_id: "clip_outro",
              new_start_sec: totalDur,
            },
          ],
        });
      } else if (!enabled && hasOutro) {
        const outroItem = rawVideoItems.find((c) => c.id === "clip_outro" || c.asset_url?.includes("outro"));
        if (outroItem) {
          void projectStore.applyTimelineCommands({
            commands: [
              {
                type: "move",
                track_id: videoTrack.id,
                item_id: outroItem.id,
                new_start_sec: -1,
              },
            ],
          });
        }
      }
    },
    [videoTrack, rawVideoItems, projectStore]
  );

  useEffect(() => {
    if (videoTrack && rawVideoItems.length > 0) {
      const hasOutro = rawVideoItems.some((c) => c.id === "clip_outro" || c.asset_url?.includes("outro"));
      if (outroEnabled && !hasOutro) {
        syncOutroClip(true);
      }
    }
  }, [videoTrack, rawVideoItems.length, outroEnabled, syncOutroClip]);

  const partVideoClips = getClipsForPart(rawVideoItems, selectedPart, multiPartCount);
  const partAudioClips = getClipsForPart(rawAudioItems, selectedPart, multiPartCount);
  const partSubClips = getClipsForPart(rawSubItems, selectedPart, multiPartCount);

  const allPartStarts = [
    ...partVideoClips.map((c) => c.start_sec ?? 0),
    ...partAudioClips.map((c) => c.start_sec ?? 0),
    ...partSubClips.map((c) => c.start_sec ?? 0),
  ];
  const partOffsetSec = (selectedPart !== "all" && allPartStarts.length > 0)
    ? Math.min(...allPartStarts)
    : 0;

  const videoItems = getNormalizedItemsForPart(rawVideoItems, selectedPart, multiPartCount, partOffsetSec);
  const audioItems = getNormalizedItemsForPart(rawAudioItems, selectedPart, multiPartCount, partOffsetSec);
  const subItems = getNormalizedItemsForPart(rawSubItems, selectedPart, multiPartCount, partOffsetSec);

  const scopedVideoTrack = videoTrack ? { ...videoTrack, items: videoItems } : undefined;
  const scopedAudioTrack = audioTrack ? { ...audioTrack, items: audioItems } : undefined;
  const scopedSubtitleTrack = subtitleTrack ? { ...subtitleTrack, items: subItems } : undefined;

  const allClips = [
    ...videoItems,
    ...audioItems,
    ...subItems,
  ];
  const selectedClip = allClips.find((c) => c.id === selectedId) ?? null;

  const handleTrimChange = (id: string, start: number, end: number | null) => {
    const track = [videoTrack, audioTrack, subtitleTrack].find(
      (t) => t?.items.some((item) => item.id === id)
    );
    if (!track) return;
    void projectStore.applyTimelineCommands({
      commands: [
        {
          type: "trim",
          track_id: track.id,
          item_id: id,
          trim_start_sec: start,
          trim_end_sec: end,
        },
      ],
    });
  };

  const handleRemove = (id: string) => {
    const track = [videoTrack, audioTrack, subtitleTrack].find(
      (t) => t?.items.some((item) => item.id === id)
    );
    if (!track) return;
    void projectStore.applyTimelineCommands({
      commands: [
        {
          type: "move",
          track_id: track.id,
          item_id: id,
          new_start_sec: -1,
        },
      ],
    });
    if (selectedId === id) setSelectedId(null);
  };

  const handleDuplicate = async (id: string) => {
    const track = [videoTrack, audioTrack, subtitleTrack].find(
      (t) => t?.items.some((item) => item.id === id)
    );
    if (!track) return;
    const newItemId = `${id}_dup_${Math.random().toString(36).substring(2, 6)}`;
    await projectStore.applyTimelineCommands({
      commands: [
        {
          type: "duplicate",
          track_id: track.id,
          item_id: id,
          new_item_id: newItemId,
        },
      ],
    });
    setSelectedId(newItemId);
  };

  const handleReorder = (commands: EditCommand[]) => {
    void projectStore.applyTimelineCommands({ commands });
  };

  const handleRender = () => {
    void projectStore.render();
    setPanel("rendering");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleRemove(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, videoTrack?.id]);

  if (projectStore.mode === "disabled") {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm p-8 text-center">
        {t("editor.notAvailable")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Controls Header: Outro & Multi-part */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="outro-enabled-editor"
            className="h-4 w-4 rounded border-border bg-surface-3 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
            checked={outroEnabled && rawVideoItems.some((c) => c.id === "clip_outro" || c.asset_url?.includes("outro"))}
            onChange={(e) => {
              const checked = e.target.checked;
              setOutroEnabled(checked);
              syncOutroClip(checked);
            }}
          />
          <label htmlFor="outro-enabled-editor" className="font-semibold text-foreground cursor-pointer whitespace-nowrap flex items-center gap-1.5">
            <span>🎬 Outro / Cierre</span>
            {outroStatus.exists ? (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-medium px-2 py-0.5 rounded border border-emerald-500/30">
                Listo (outro.mp4)
              </span>
            ) : (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 font-medium px-2 py-0.5 rounded border border-amber-500/20" title="Ubica tu video en public/assets/outro.mp4">
                Default (outro.mp4)
              </span>
            )}
          </label>
        </div>

        {/* Multi-part navigation header if isMultiPart */}
        {isMultiPart && multiPartCount > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              Parte ({multiPartCount} Partes):
            </span>
            <div className="flex items-center gap-1 bg-surface-3 p-0.5 rounded-lg border border-border">
              {Array.from({ length: multiPartCount }).map((_, idx) => {
                const partNum = idx + 1;
                const isActive = selectedPart === partNum;
                return (
                  <button
                    key={partNum}
                    type="button"
                    onClick={() => {
                      setSelectedPart(partNum);
                      setActivePartIndex(partNum);
                    }}
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded transition-all ${
                      isActive
                        ? "bg-accent text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Parte {partNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedPart("all")}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded transition-all ${
                  selectedPart === "all"
                    ? "bg-accent text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Ver Todo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top: preview + inspector */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-[3] p-3 flex flex-col items-center justify-center h-full min-h-0 w-full overflow-hidden">
          <VideoPreview
            items={videoItems}
            subtitleItems={subItems}
            audioItems={audioItems}
            selectedPart={selectedPart}
            partOffsetSec={partOffsetSec}
            selectedId={selectedId}
            onTimeUpdate={setCurrentTime}
          />
        </div>
        <div className="flex-[2] border-l border-border overflow-y-auto">
          <ClipInspector
            clip={selectedClip}
            onTrimChange={handleTrimChange}
            onRemove={handleRemove}
            onDuplicate={handleDuplicate}
          />
        </div>
      </div>

      {/* Bottom: timeline */}
      <Timeline
        videoTrack={scopedVideoTrack}
        audioTrack={scopedAudioTrack}
        subtitleTrack={scopedSubtitleTrack}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onReorder={handleReorder}
        currentTime={currentTime}
      />

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setPanel("config")}>
          {t("editor.backToConfig") || "← Volver a Configuración"}
        </Button>
        <div className="flex items-center gap-2">
          {videoUrls && videoUrls.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPanel("done")} className="flex items-center gap-1.5 border-accent/20 text-accent hover:bg-accent/10">
              <Eye className="h-3.5 w-3.5" />
              {t("editor.viewFinalVideo") || "Ver video final"}
            </Button>
          )}
          <Button size="sm" onClick={handleRender}>
            {t("editor.render")}
          </Button>
        </div>
      </div>
    </div>
  );
}
