export type WorkspacePanel =
  | "script"
  | "config"
  | "generating"
  | "review"
  | "editor"
  | "rendering"
  | "done"
  | "publication";

export interface ProjectSummary {
  project_id: string;
  topic: string;
  panel: WorkspacePanel;
  updated_at: string;
}

export const PANEL_ORDER: WorkspacePanel[] = [
  "script",
  "config",
  "generating",
  "review",
  "done",
  "publication",
];

export const PANEL_LABEL_KEY: Record<WorkspacePanel, string> = {
  script: "pipeline.script",
  config: "pipeline.config",
  generating: "pipeline.generating",
  review: "pipeline.review",
  editor: "pipeline.editor",
  rendering: "pipeline.rendering",
  done: "pipeline.done",
  publication: "pipeline.publication",
};
