// webui-react/src/pages/AutoFlow.tsx
import { useEffect } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "../components/ui";
import { ScriptPanel } from "../components/panels/ScriptPanel";
import { VideoSettingsPanel } from "../components/panels/VideoSettingsPanel";
import { AudioSubtitlePanel } from "../components/panels/AudioSubtitlePanel";
import { ProgressArea } from "../components/panels/ProgressArea";
import { ResultArea } from "../components/panels/ResultArea";
import { useVideoStore } from "../store/useVideoStore";
import { useTaskStore } from "../store/useTaskStore";
import { useConfigStore } from "../store/useConfigStore";
import { videoApi } from "../api/video";
import { configApi } from "../api/config";
import { pollTask } from "../api/polling";

export function AutoFlow() {
  const videoStore = useVideoStore();
  const taskStore = useTaskStore();
  const configStore = useConfigStore();

  useEffect(() => {
    configApi.get().then(configStore.setConfig).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (taskStore.isRunning) return;
    taskStore.reset();
    taskStore.setRunning(true);

    try {
      const { task_id } = await videoApi.createTask(videoStore.toParams());
      taskStore.setTaskId(task_id);
      await pollTask(task_id, taskStore.updateStatus);
    } catch (e) {
      taskStore.setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      taskStore.setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-foreground">Auto Generate</h1>
        <Button
          onClick={handleGenerate}
          isLoading={taskStore.isRunning}
          disabled={!videoStore.video_subject.trim()}
          size="sm"
        >
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          Generate
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-0 divide-x divide-border min-h-full">
          <div className="p-6 overflow-y-auto">
            <ScriptPanel />
          </div>
          <div className="p-6 overflow-y-auto">
            <VideoSettingsPanel />
          </div>
          <div className="p-6 overflow-y-auto">
            <AudioSubtitlePanel />
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 space-y-4">
          <ProgressArea />
          <ResultArea />
        </div>
      </div>
    </div>
  );
}
