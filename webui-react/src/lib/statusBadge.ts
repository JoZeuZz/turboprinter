import type { WorkspacePanel } from "../types/workspace";

export type StatusKind =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "error" }
  | { kind: "phase"; panel: WorkspacePanel };

export function resolveStatus(mode: string, panel: WorkspacePanel): StatusKind {
  if (mode === "loading") return { kind: "loading" };
  if (mode === "disabled") return { kind: "offline" };
  if (mode === "error") return { kind: "error" };
  return { kind: "phase", panel };
}
