// webui-react/src/components/panels/EditorPanel.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { VideoPreview } from "../editor/VideoPreview";
import { ClipInspector } from "../editor/ClipInspector";
import { Timeline } from "../editor/Timeline";
import { Button } from "../ui";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { promptTemplatesApi } from "../../api/promptTemplates";
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
  const { setPanel } = useProjectWorkspaceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [templateInfo, setTemplateInfo] = useState<{ name: string; version: number } | null>(null);

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const audioTrack = projectStore.project?.tracks.find((t) => t.type === "audio");
  const subtitleTrack = projectStore.project?.tracks.find((t) => t.type === "subtitle");
  const items: TimelineItem[] = videoTrack?.items ?? [];

  const selectedClip = items.find((c) => c.id === selectedId) ?? null;

  const handleTrimChange = (id: string, start: number, end: number | null) => {
    void projectStore.applyTimelineCommands({
      commands: [
        {
          type: "trim",
          track_id: videoTrack?.id ?? "",
          item_id: id,
          trim_start_sec: start,
          trim_end_sec: end,
        },
      ],
    });
  };

  const handleRemove = (id: string) => {
    void projectStore.applyTimelineCommands({
      commands: [
        {
          type: "move",
          track_id: videoTrack?.id ?? "",
          item_id: id,
          new_start_sec: -1,
        },
      ],
    });
    if (selectedId === id) setSelectedId(null);
  };

  const handleReorder = (commands: EditCommand[]) => {
    void projectStore.applyTimelineCommands({ commands });
  };

  const handleRender = async () => {
    try {
      const result = await projectStore.runPreflight();
      if (!result.valid) return;
      void projectStore.render({
        allow_preflight_warnings: result.warnings.length > 0,
      });
      setPanel("rendering");
    } catch {
      // projectStore.runPreflight already recorded the error via fail()
    }
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

  useEffect(() => {
    if (projectStore.project) {
      void projectStore.runPreflight().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStore.project]);

  useEffect(() => {
    const templateId = projectStore.projectMeta?.prompt_template_id;
    const versionId = projectStore.projectMeta?.prompt_version_id;
    if (!templateId) {
      setTemplateInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ template }, { versions }] = await Promise.all([
          promptTemplatesApi.get(templateId),
          promptTemplatesApi.listVersions(templateId),
        ]);
        const version = versions.find((v) => v.id === versionId);
        if (!cancelled) {
          setTemplateInfo({ name: template.name, version: version?.version ?? 0 });
        }
      } catch {
        if (!cancelled) setTemplateInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectStore.projectMeta?.prompt_template_id, projectStore.projectMeta?.prompt_version_id]);

  if (projectStore.mode === "disabled") {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm p-8 text-center">
        {t("editor.notAvailable")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {templateInfo && (
        <p className="px-4 py-1 text-[11px] text-muted border-b border-border">
          {t("editor.promptTemplateUsed", { name: templateInfo.name, version: templateInfo.version })}
        </p>
      )}
      {/* Top: preview + inspector */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[3] p-4">
          <VideoPreview items={items} selectedId={selectedId} onTimeUpdate={setCurrentTime} />
        </div>
        <div className="flex-[2] border-l border-border overflow-y-auto">
          <ClipInspector
            clip={selectedClip}
            onTrimChange={handleTrimChange}
            onRemove={handleRemove}
          />
        </div>
      </div>

      {/* Bottom: timeline */}
      <Timeline
        videoTrack={videoTrack}
        audioTrack={audioTrack}
        subtitleTrack={subtitleTrack}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onReorder={handleReorder}
        currentTime={currentTime}
      />

      {projectStore.preflightResult && !projectStore.preflightResult.valid && (
        <div className="border-t border-border bg-red-950/40 px-4 py-2 text-xs text-red-300">
          <p className="font-semibold">{t("editor.preflightErrorsTitle")}</p>
          <ul className="list-disc pl-4">
            {projectStore.preflightResult.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {projectStore.preflightResult?.valid && projectStore.preflightResult.warnings.length > 0 && (
        <div className="border-t border-border bg-amber-950/40 px-4 py-2 text-xs text-amber-300">
          <p className="font-semibold">{t("editor.preflightWarningsTitle")}</p>
          <ul className="list-disc pl-4">
            {projectStore.preflightResult.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setPanel("review")}>
          {t("editor.backToReview")}
        </Button>
        <Button size="sm" onClick={handleRender}>
          {t("editor.render")}
        </Button>
      </div>
    </div>
  );
}
