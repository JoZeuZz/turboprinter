import { useEffect, useRef, useState } from "react";
import { Clock3, LoaderCircle, PlusCircle, Settings } from "lucide-react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { videoApi } from "../../api/video";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";
import { useJobsStore } from "../../store/useJobsStore";
import {
  TASK_STATE_COMPLETE,
  TASK_STATE_FAILED,
  type Job,
  type TaskSummary,
} from "../../api/types";
import { SidebarRowMenu } from "./SidebarRowMenu";

interface ProjectRow {
  project_id: string;
  topic: string | null;
  updated_at: string;
}

type ActiveJobStatus = "pending" | "running";

interface JobQueueIndicator {
  position: number;
  status: ActiveJobStatus;
}

const JOB_REFRESH_INTERVAL_MS = 3000;

function isActiveProjectJob(job: Job): job is Job & { project_id: string; status: ActiveJobStatus } {
  return Boolean(job.project_id) && (job.status === "pending" || job.status === "running");
}

function jobTime(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function queueIndicatorsByProject(
  jobs: Job[],
  legacyTasks: TaskSummary[]
): Map<string, JobQueueIndicator> {
  const indicators = new Map<string, JobQueueIndicator>();
  const activeJobs = jobs.filter(isActiveProjectJob).sort(
    (left, right) =>
      Number(right.status === "running") - Number(left.status === "running") ||
      jobTime(left.scheduled_at) - jobTime(right.scheduled_at) ||
      jobTime(left.created_at) - jobTime(right.created_at)
  );

  const runningJobs = activeJobs.filter((job) => job.status === "running");
  const pendingJobs = activeJobs.filter((job) => job.status === "pending");
  const legacyRunningTasks = legacyTasks
    .filter(
      (task) =>
        task.state !== TASK_STATE_COMPLETE && task.state !== TASK_STATE_FAILED
    )
    .map((task) => ({ project_id: task.task_id, status: "running" as const }));

  [...runningJobs, ...legacyRunningTasks, ...pendingJobs].forEach((job) => {
    // A project can be retried or queued twice; show its next active run only.
    if (!indicators.has(job.project_id)) {
      indicators.set(job.project_id, {
        position: indicators.size + 1,
        status: job.status,
      });
    }
  });

  return indicators;
}

export function ProjectSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: activeProjectId } = useParams();
  const { drafts, currentDraftId, startDraft, selectDraft, renameDraft, duplicateDraft, removeDraft } =
    useProjectHistoryStore();
  const workspaceReset = useProjectWorkspaceStore((s) => s.reset);
  const setTopic = useProjectWorkspaceStore((s) => s.setTopic);
  const projectReset = useProjectStore((s) => s.reset);
  const videoReset = useVideoStore((s) => s.reset);
  const setVideo = useVideoStore((s) => s.set);
  const taskId = useProjectWorkspaceStore((s) => s.taskId);
  const taskState = useProjectWorkspaceStore((s) => s.taskStatus?.state);
  const topic = useProjectWorkspaceStore((s) => s.topic);
  const jobs = useJobsStore((s) => s.jobs);
  const refreshJobs = useJobsStore((s) => s.refresh);
  const [legacyTasks, setLegacyTasks] = useState<TaskSummary[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Tracks whether the in-progress rename has already been resolved (committed
  // or cancelled) so that the Escape->setRenamingId(null)->onBlur chain and the
  // Enter->commitRename->setRenamingId(null)->onBlur chain don't double-fire.
  const renameResolutionRef = useRef<"idle" | "committed" | "cancelled">("idle");

  const refreshProjects = () => {
    projectsApi
      .listProjects(30)
      .then((response) => setProjects(response.projects))
      .catch((error) => {
        if (error instanceof ApiError && error.status === 404) setProjects([]);
      });
  };

  useEffect(() => {
    refreshProjects();
  }, [location.pathname, taskId, taskState, topic]);

  useEffect(() => {
    let mounted = true;
    const refreshQueue = () => {
      // Jobs are optional in this installation. Legacy tasks remain visible
      // while the durable worker is disabled or before the server is restarted.
      void refreshJobs();
      void videoApi
        .listTasks()
        .then((response) => {
          if (mounted) setLegacyTasks(response.tasks);
        })
        .catch(() => {
          if (mounted) setLegacyTasks([]);
        });
    };

    refreshQueue();
    const interval = window.setInterval(refreshQueue, JOB_REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [refreshJobs]);

  const handleNew = () => {
    workspaceReset();
    projectReset();
    videoReset();
    startDraft();
    setTopic("Untitled project");
    setVideo("video_subject", "");
    navigate("/project/new");
  };

  const handleOpenDraft = (draftId: string) => {
    const draft = selectDraft(draftId);
    if (!draft) {
      return;
    }
    workspaceReset();
    projectReset();
    videoReset();
    setTopic(draft.topic);
    setVideo("video_subject", draft.topic === "Untitled project" ? "" : draft.topic);
    navigate("/project/new");
  };

  const rows = [
    ...drafts,
    ...projects.filter(
      (project) => !drafts.some((draft) => draft.project_id === project.project_id)
    ),
  ].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
  const queueIndicators = queueIndicatorsByProject(jobs, legacyTasks);

  const commitRename = (id: string, isDraft: boolean) => {
    // Guard against double-commit: Enter already resolved this rename and the
    // blur that follows the resulting unmount should be a no-op.
    if (renameResolutionRef.current !== "idle") return;
    renameResolutionRef.current = "committed";
    const value = renameValue.trim();
    setRenamingId(null);
    if (!value) return;
    if (isDraft) {
      renameDraft(id, value);
    } else {
      projectsApi.renameProject(id, value).then(refreshProjects).catch(() => {});
    }
  };

  const cancelRename = () => {
    // Escape resolves the rename as cancelled so the blur triggered by the
    // input unmounting skips commitRename entirely, discarding the edit.
    renameResolutionRef.current = "cancelled";
    setRenamingId(null);
  };

  const handleDuplicate = (id: string, isDraft: boolean) => {
    if (isDraft) {
      duplicateDraft(id);
    } else {
      projectsApi
        .duplicateProject(id)
        .then((res) => {
          refreshProjects();
          navigate(`/project/${res.project_id}`);
        })
        .catch(() => {});
    }
  };

  const handleDelete = (id: string, isDraft: boolean) => {
    const wasActive = isDraft
      ? currentDraftId === id
      : id === activeProjectId;
    if (isDraft) {
      // Drafts are local-only; no API call, so the reset+navigate can stay
      // synchronous.
      removeDraft(id);
      if (wasActive) {
        workspaceReset();
        projectReset();
        videoReset();
        navigate("/project/new");
      }
      return;
    }
    projectsApi
      .deleteProject(id)
      .then(() => {
        refreshProjects();
        if (wasActive) {
          workspaceReset();
          projectReset();
          videoReset();
          navigate("/project/new");
        }
      })
      .catch(() => {
        // Delete failed: re-sync the sidebar so the row reappears, and skip
        // the reset+navigate so the user isn't bounced with no feedback.
        refreshProjects();
      });
  };

  return (
    <nav className="flex h-screen w-48 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent text-xs font-bold text-white">
          TP
        </div>
        <span className="text-sm font-semibold text-foreground truncate">TurboPrinter</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={handleNew}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
        >
          <PlusCircle className="h-4 w-4 text-accent shrink-0" />
          {t("sidebar.newProject")}
        </button>

        <div className="mt-2 space-y-0.5" id="recent-projects">
          {rows.map((project) => {
              const isDraft = "kind" in project && project.kind === "draft";
              const isActive = isDraft
                ? location.pathname === "/project/new" &&
                  currentDraftId === project.project_id
                : project.project_id === activeProjectId;
              const openRow = () =>
                isDraft
                  ? handleOpenDraft(project.project_id)
                  : navigate(`/project/${project.project_id}`);
              const queueIndicator = isDraft
                ? undefined
                : queueIndicators.get(project.project_id);
              return (
                <div
                  key={project.project_id}
                  role="button"
                  tabIndex={0}
                  data-testid="sidebar-row"
                  aria-current={isActive ? "true" : undefined}
                  onClick={openRow}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openRow();
                    }
                  }}
                  className={`group flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-surface-2 text-foreground"
                      : "text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                  title={project.topic ?? project.project_id}
                >
                  {queueIndicator ? (
                    <LoaderCircle
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-accent ${
                        queueIndicator.status === "running" ? "animate-spin" : "animate-pulse"
                      }`}
                      aria-hidden="true"
                    />
                  ) : (
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/45 group-hover:text-accent" />
                  )}
                  <span className="min-w-0 flex-1">
                    {renamingId === project.project_id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(project.project_id, isDraft);
                          if (e.key === "Escape") cancelRename();
                        }}
                        onBlur={() => commitRename(project.project_id, isDraft)}
                        className="w-full rounded bg-surface-2 px-1 text-sm text-foreground outline-none"
                      />
                    ) : (
                      <>
                        <span className="block truncate">{project.topic || project.project_id}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-foreground/40">
                          <span>{isDraft ? t("sidebar.draft") : new Date(project.updated_at).toLocaleDateString()}</span>
                          {queueIndicator && (
                            <span
                              role="status"
                              aria-label={t(
                                queueIndicator.status === "running"
                                  ? "sidebar.jobRunning"
                                  : "sidebar.jobQueued",
                                { position: queueIndicator.position }
                              )}
                              className="rounded-full border border-accent/35 bg-accent/10 px-1.5 py-px font-medium tabular-nums text-accent"
                            >
                              #{queueIndicator.position}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </span>
                  <SidebarRowMenu
                    label={project.topic || project.project_id}
                    onRename={() => {
                      renameResolutionRef.current = "idle";
                      setRenameValue(project.topic || "");
                      setRenamingId(project.project_id);
                    }}
                    onDuplicate={() => handleDuplicate(project.project_id, isDraft)}
                    onDelete={() => handleDelete(project.project_id, isDraft)}
                  />
                </div>
              );
            })}
        </div>
      </div>

      <div className="border-t border-border p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground hover:bg-surface-2"
            }`
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          {t("nav.config")}
        </NavLink>
      </div>
    </nav>
  );
}
