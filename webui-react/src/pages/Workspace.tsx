// webui-react/src/pages/Workspace.tsx
import { ScriptPanel } from "../components/panels/ScriptPanel";
import { VideoConfigPanel } from "../components/panels/VideoConfigPanel";
import { GeneratingPanel } from "../components/panels/GeneratingPanel";
import { ReviewPanel } from "../components/panels/ReviewPanel";
import { EditorPanel } from "../components/panels/EditorPanel";
import { RenderingPanel } from "../components/panels/RenderingPanel";
import { DonePanel } from "../components/panels/DonePanel";
import { useProjectWorkspaceStore } from "../store/useProjectWorkspaceStore";

const PANEL_MAP = {
  script:     <ScriptPanel />,
  config:     <VideoConfigPanel />,
  generating: <GeneratingPanel />,
  review:     <ReviewPanel />,
  editor:     <EditorPanel />,
  rendering:  <RenderingPanel />,
  done:       <DonePanel />,
} as const;

export function Workspace() {
  const { panel } = useProjectWorkspaceStore();
  return (
    <div className="flex flex-col h-full">
      {PANEL_MAP[panel]}
    </div>
  );
}
