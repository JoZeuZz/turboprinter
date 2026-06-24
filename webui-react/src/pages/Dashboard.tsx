// webui-react/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, Film } from "lucide-react";
import { Button } from "../components/ui";
import { projectsApi } from "../api/projects";
import { useProjectWorkspaceStore } from "../store/useProjectWorkspaceStore";
import { ApiError } from "../api/client";

interface ProjectRow {
  project_id: string;
  topic: string | null;
  updated_at: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const reset = useProjectWorkspaceStore((s) => s.reset);
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
    navigate("/project/new");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Projects</h1>
          <Button onClick={handleNew} size="sm">
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            New Project
          </Button>
        </div>

        {loading && <p className="text-sm text-muted">Loading…</p>}

        {!loading && !projectModeAvailable && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            Project mode disabled on server. Videos will generate without timeline editing.
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-10 text-center">
            <Film className="h-8 w-8 text-muted" />
            <p className="text-sm text-muted">No projects yet</p>
            <Button onClick={handleNew} size="sm">
              Create your first video
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
