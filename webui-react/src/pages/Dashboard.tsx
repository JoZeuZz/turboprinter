// webui-react/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, Film } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui";
import { projectsApi } from "../api/projects";
import { useProjectStore } from "../store/useProjectStore";
import { useProjectWorkspaceStore } from "../store/useProjectWorkspaceStore";
import { useVideoStore } from "../store/useVideoStore";
import { ApiError } from "../api/client";

interface ProjectRow {
  project_id: string;
  topic: string | null;
  updated_at: string;
}

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reset = useProjectWorkspaceStore((s) => s.reset);
  const resetProject = useProjectStore((s) => s.reset);
  const resetVideo = useVideoStore((s) => s.reset);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectModeAvailable, setProjectModeAvailable] = useState(true);

  useEffect(() => {
    projectsApi
      .listProjects()
      .then((r) => setProjects(r.projects))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setProjectModeAvailable(false);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleNew = () => {
    reset();
    resetProject();
    resetVideo();
    navigate("/project/new");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">{t("dashboard.projects")}</h1>
          <Button onClick={handleNew} size="sm">
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            {t("sidebar.newProject")}
          </Button>
        </div>

        {loading && <p className="text-sm text-muted">{t("common.loading")}</p>}

        {!loading && !projectModeAvailable && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            {t("dashboard.projectModeDisabled")}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-10 text-center">
            <Film className="h-8 w-8 text-muted" />
            <p className="text-sm text-muted">{t("dashboard.noProjects")}</p>
            <Button onClick={handleNew} size="sm">
              {t("dashboard.createFirst")}
            </Button>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.project_id}>
                <button
                  onClick={() => navigate(`/project/${p.project_id}`)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="text-sm text-foreground truncate">
                    {p.topic ?? p.project_id}
                  </span>
                  <span className="ml-4 shrink-0 text-xs text-muted">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
