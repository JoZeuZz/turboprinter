import { useState } from "react";
import { Film, Search, Wand2 } from "lucide-react";
import { Button, Input } from "../components/ui";
import { useProjectStore } from "../store/useProjectStore";

export function Editor() {
  const [topic, setTopic] = useState("");
  const projectStore = useProjectStore();
  const clips = projectStore.project?.tracks.flatMap((track) =>
    track.items.map((item) => ({ ...item, trackName: track.name }))
  ) ?? [];
  const isLoading = projectStore.mode === "loading";
  const hasProject = Boolean(projectStore.projectId);
  const hasValidationError = projectStore.timelineValidation?.valid === false;

  const createProject = () => {
    void projectStore.create({ topic, generate_script: true });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold text-foreground">Project Editor</h1>
          <p className="text-xs text-muted">Project-mode spike: create, plan, build, render.</p>
        </div>
        <div className="text-xs text-muted">{projectStore.projectId ?? "No project"}</div>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[320px_1fr]">
        <section className="space-y-4 rounded-lg border border-border bg-surface/40 p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-border bg-surface p-2">
              <Wand2 className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Create from topic</h2>
          </div>

          <Input
            label="Topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Spanish short video topic"
          />

          <div className="grid gap-2">
            <Button onClick={createProject} disabled={!topic.trim() || isLoading} isLoading={isLoading}>
              Create project
            </Button>
            <Button variant="ghost" onClick={() => void projectStore.plan()} disabled={!hasProject || isLoading}>
              Plan shots
            </Button>
            <Button
              variant="ghost"
              onClick={() => void projectStore.mediaSearch({ orientation: "portrait" })}
              disabled={!hasProject || isLoading}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Search media
            </Button>
            <Button
              variant="ghost"
              onClick={() => void projectStore.buildTimeline({ title: topic || undefined })}
              disabled={!hasProject || isLoading}
            >
              Build timeline
            </Button>
            <Button
              onClick={() => void projectStore.render()}
              disabled={!projectStore.project || isLoading || hasValidationError}
            >
              Render
            </Button>
          </div>

          {projectStore.mode === "disabled" && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              Project mode is disabled. Enable TURBOPRINTER_PROJECT_MODE_ENABLED on the server.
            </div>
          )}
          {projectStore.mode === "error" && projectStore.error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {projectStore.error}
            </div>
          )}
          {projectStore.timelineValidation && (
            <div
              className={`rounded-md border p-3 text-sm ${
                hasValidationError
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : "border-green-500/40 bg-green-500/10 text-green-200"
              }`}
            >
              <p>
                Timeline validation: {projectStore.timelineValidation.valid ? "valid" : "invalid"}
              </p>
              {projectStore.timelineValidation.errors.map((validationError) => (
                <p key={validationError} className="mt-1">
                  {validationError}
                </p>
              ))}
            </div>
          )}
          {projectStore.renderStatus && (
            <p className="text-xs text-muted">
              Render state {projectStore.renderStatus.state}, progress {projectStore.renderStatus.progress}%
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface/40 p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-full border border-border bg-surface p-2">
              <Film className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Timeline clips</h2>
              <p className="text-xs text-muted">Read-only list for this spike.</p>
            </div>
          </div>

          {clips.length === 0 ? (
            <p className="text-sm text-muted">Build a timeline to see clips.</p>
          ) : (
            <ul className="space-y-2">
              {clips.map((clip) => (
                <li key={`${clip.trackName}-${clip.id}`} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{clip.id}</span>
                    <span className="text-xs text-muted">{clip.trackName}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {clip.start_sec.toFixed(1)}s - {(clip.start_sec + clip.duration_sec).toFixed(1)}s
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
