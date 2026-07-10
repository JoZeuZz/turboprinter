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
import { videoApi } from "../api/video";
import { pollTask } from "../api/polling";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED, type TaskStatus } from "../api/types";
import { useProjectStore } from "../store/useProjectStore";
import {
  finalVideoUrls,
  isFinalVideoUrl,
  useProjectWorkspaceStore,
} from "../store/useProjectWorkspaceStore";
import { useVideoStore } from "../store/useVideoStore";
import i18n from "../i18n";

const PANEL_MAP = {
  script:     <ScriptPanel />,
  config:     <VideoConfigPanel />,
  generating: <GeneratingPanel />,
  review:     <ReviewPanel />,
  editor:     <EditorPanel />,
  rendering:  <RenderingPanel />,
  done:       <DonePanel />,
} as const;

function taskError(status: TaskStatus): string {
  const logs = status.logs ?? [];
  return logs.length > 0 ? logs[logs.length - 1] : i18n.t("errors.taskFailed");
}

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

        const videoUrls = [...new Set((state.videos ?? []).filter(isFinalVideoUrl))];
        if (videoUrls.length > 0) {
          useProjectWorkspaceStore.setState({
            videoUrls: [...new Set(videoUrls)],
            panel: "review",
          });
        } else {
          void videoApi
            .getTask(id)
            .then((taskStatus) => {
              if (cancelled) return;

              const finalVideos = finalVideoUrls(taskStatus);
              if (finalVideos.length > 0) {
                useProjectWorkspaceStore.setState({
                  taskId: id,
                  taskStatus,
                  videoUrls: finalVideos,
                  panel: "review",
                  error: null,
                });
                return;
              }

              if (taskStatus.state === TASK_STATE_FAILED) {
                useProjectWorkspaceStore.setState({
                  taskId: id,
                  taskStatus,
                  videoUrls: [],
                  panel: "config",
                  error: taskError(taskStatus),
                });
                return;
              }

              if (taskStatus.state !== TASK_STATE_COMPLETE) {
                useProjectWorkspaceStore.setState({
                  taskId: id,
                  taskStatus,
                  videoUrls: [],
                  panel: "generating",
                  error: null,
                });

                void pollTask(id, (nextStatus) => {
                  if (!cancelled) {
                    useProjectWorkspaceStore.setState({ taskId: id, taskStatus: nextStatus });
                  }
                })
                  .then((completedStatus) => {
                    if (cancelled) return;
                    const completedVideos = finalVideoUrls(completedStatus);
                    useProjectWorkspaceStore.setState(
                      completedVideos.length > 0
                        ? {
                            taskId: id,
                            taskStatus: completedStatus,
                            videoUrls: completedVideos,
                            panel: "review",
                            error: null,
                          }
                        : {
                            taskId: id,
                            taskStatus: completedStatus,
                            videoUrls: [],
                            panel: "config",
                            error: i18n.t("errors.noFinalVideo"),
                          }
                    );
                  })
                  .catch((error) => {
                    if (!cancelled) {
                      useProjectWorkspaceStore.setState({
                        taskId: id,
                        videoUrls: [],
                        panel: "config",
                        error: error instanceof Error ? error.message : i18n.t("errors.taskFailed"),
                      });
                    }
                  });
                return;
              }

              useProjectWorkspaceStore.setState({
                taskId: id,
                taskStatus,
                videoUrls: [],
                panel: "config",
                error: i18n.t("errors.noFinalVideo"),
              });
            })
            .catch(() => {
              if (!cancelled) {
                setPanel(state.has_timeline ? "review" : "script");
              }
            });
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
