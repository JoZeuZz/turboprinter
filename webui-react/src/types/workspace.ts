export type WorkspacePanel =
  | "script"
  | "config"
  | "generating"
  | "review"
  | "editor"
  | "rendering"
  | "done";

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
];

export const PANEL_LABEL: Record<WorkspacePanel, string> = {
  script: "Script",
  config: "Settings",
  generating: "Generate",
  review: "Review",
  editor: "Edit",
  rendering: "Render",
  done: "Done",
};
