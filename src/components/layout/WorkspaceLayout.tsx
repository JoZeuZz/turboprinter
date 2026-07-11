import { Outlet } from "react-router-dom";
import { ProjectSidebar } from "./ProjectSidebar";
import { TopicBar } from "./TopicBar";
import { PipelineBar } from "./PipelineBar";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { PANEL_ORDER } from "../../types/workspace";
import type { WorkspacePanel } from "../../types/workspace";

function completedPanels(current: WorkspacePanel): WorkspacePanel[] {
  const idx = PANEL_ORDER.indexOf(current);
  return PANEL_ORDER.slice(0, idx) as WorkspacePanel[];
}

export function WorkspaceLayout() {
  const { panel } = useProjectWorkspaceStore();
  return (
    <div className="flex h-screen overflow-hidden">
      <ProjectSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopicBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <PipelineBar
          currentPanel={panel}
          completedPanels={completedPanels(panel)}
        />
      </div>
    </div>
  );
}
