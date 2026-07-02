import { useEffect, useRef, useState } from "react";
import { Clock3, PlusCircle, Settings } from "lucide-react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";
import { SidebarRowMenu } from "./SidebarRowMenu";

interface ProjectRow {
  project_id: string;
  topic: string | null;
  updated_at: string;
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
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/45 group-hover:text-accent" />
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
                        <span className="mt-0.5 block text-[10px] text-foreground/40">
                          {isDraft ? t("sidebar.draft") : new Date(project.updated_at).toLocaleDateString()}
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
