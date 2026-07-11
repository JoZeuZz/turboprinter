// webui-react/src/pages/Workspace.tsx
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { ScriptPanel } from "../components/panels/ScriptPanel";
import { VideoConfigPanel } from "../components/panels/VideoConfigPanel";
import { GeneratingPanel } from "../components/panels/GeneratingPanel";
import { ReviewPanel } from "../components/panels/ReviewPanel";
import { EditorPanel } from "../components/panels/EditorPanel";
import { RenderingPanel } from "../components/panels/RenderingPanel";
import { DonePanel } from "../components/panels/DonePanel";
import { useProjectStore } from "../store/useProjectStore";
import { useProjectWorkspaceStore } from "../store/useProjectWorkspaceStore";
import { useVideoStore } from "../store/useVideoStore";

const PANEL_MAP = {
  script:     <ScriptPanel />,
  config:     <VideoConfigPanel />,
  generating: <GeneratingPanel />,
  review:     <ReviewPanel />,
  editor:     <EditorPanel />,
  rendering:  <RenderingPanel />,
  done:       <DonePanel />,
} as const;

export function Workspace() {
  const { id } = useParams();
  const { panel, setPanel, setTopic } = useProjectWorkspaceStore();
  const openProject = useProjectStore((s) => s.open);
  const setVideo = useVideoStore((s) => s.set);

  useEffect(() => {
    if (!id) {
      return;
    }

    // A project opened by id must not inherit a previous generation's task
    // markers (the workspace store persists them in sessionStorage).
    useProjectWorkspaceStore.setState({ taskId: null, taskStatus: null });

    let cancelled = false;

    openProject(id)
      .then((state) => {
        if (cancelled) {
          return;
        }

        const topic =
          state.topic ||
          state.params?.video_subject ||
          state.timeline?.title ||
          state.shot_plan?.topic ||
          state.script?.split(/\r?\n/)[0]?.slice(0, 80) ||
          id;

        setTopic(topic);
        if (state.params) {
          Object.entries(state.params).forEach(([key, value]) => {
            setVideo(key as Parameters<typeof setVideo>[0], value as never);
          });
        } else {
          setVideo("video_subject", topic);
          setVideo("video_script", state.script ?? state.timeline?.script ?? "");
        }

        const videoUrls = state.videos?.length
          ? state.videos
          : state.combined_videos ?? [];
        if (videoUrls.length > 0) {
          useProjectWorkspaceStore.setState({
            videoUrls: [...new Set(videoUrls)],
            panel: "review",
          });
        } else {
          setPanel(state.has_timeline ? "review" : "script");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPanel("script");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, openProject, setPanel, setTopic, setVideo]);

  return (
    <div className="flex flex-col h-full">
      {PANEL_MAP[panel]}
    </div>
  );
}
