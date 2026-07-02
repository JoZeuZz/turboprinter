import { useEffect, useState } from "react";
import { Clock3, PlusCircle, Settings } from "lucide-react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";

interface ProjectRow {
  project_id: string;
  topic: string | null;
  updated_at: string;
}

export function ProjectSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: activeProjectId } = useParams();
  const { drafts, currentDraftId, startDraft, selectDraft } = useProjectHistoryStore();
  const workspaceReset = useProjectWorkspaceStore((s) => s.reset);
  const setTopic = useProjectWorkspaceStore((s) => s.setTopic);
  const projectReset = useProjectStore((s) => s.reset);
  const videoReset = useVideoStore((s) => s.reset);
  const setVideo = useVideoStore((s) => s.set);
  const taskId = useProjectWorkspaceStore((s) => s.taskId);
  const taskState = useProjectWorkspaceStore((s) => s.taskStatus?.state);
  const topic = useProjectWorkspaceStore((s) => s.topic);
  const [projects, setProjects] = useState<ProjectRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    projectsApi
      .listProjects(30)
      .then((response) => {
        if (!cancelled) {
          setProjects(response.projects);
        }
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && error.status === 404) {
          setProjects([]);
        }
      });

    return () => {
      cancelled = true;
    };
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
          New Project
        </button>

        <div className="mt-2 space-y-0.5" id="recent-projects">
          {rows.map((project) => {
              const isDraft = "kind" in project && project.kind === "draft";
              const isActive = isDraft
                ? location.pathname === "/project/new" &&
                  currentDraftId === project.project_id
                : project.project_id === activeProjectId;
              return (
                <button
                  key={project.project_id}
                  onClick={() =>
                    isDraft
                      ? handleOpenDraft(project.project_id)
                      : navigate(`/project/${project.project_id}`)
                  }
                  className={`group flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-surface-2 text-foreground"
                      : "text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                  title={project.topic ?? project.project_id}
                >
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/45 group-hover:text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {project.topic || project.project_id}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-foreground/40">
                      {isDraft ? "Borrador" : new Date(project.updated_at).toLocaleDateString()}
                    </span>
                  </span>
                </button>
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
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
