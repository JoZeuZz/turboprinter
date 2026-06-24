// webui-react/src/components/panels/ResultArea.tsx
import { useTaskStore } from "../../store/useTaskStore";
import { TASK_STATE_COMPLETE } from "../../api/types";

export function ResultArea() {
  const { status } = useTaskStore();

  if (status?.state !== TASK_STATE_COMPLETE) return null;

  const videos = [...(status.combined_videos ?? []), ...(status.videos ?? [])];
  const unique = [...new Set(videos)];

  if (unique.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">Results</h3>
      {unique.map((url) => (
        <div key={url} className="rounded-md overflow-hidden border border-border bg-surface">
          <video
            src={url}
            controls
            className="w-full max-h-[480px] object-contain"
          />
          <div className="px-3 py-2">
            <a
              href={url}
              download
              className="text-xs text-accent hover:text-accent-hover underline"
            >
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
