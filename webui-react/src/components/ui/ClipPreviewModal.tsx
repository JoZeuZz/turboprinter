// webui-react/src/components/ui/ClipPreviewModal.tsx
import { useEffect } from "react";
import { X } from "lucide-react";
import type { TimelineItem } from "../../api/types";

interface ClipPreviewModalProps {
  clip: TimelineItem | null;
  onClose: () => void;
}

export function ClipPreviewModal({ clip, onClose }: ClipPreviewModalProps) {
  useEffect(() => {
    if (!clip) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [clip, onClose]);

  if (!clip) return null;

  const src = clip.source_url ?? clip.local_path ?? null;

  return (
    <div
      data-testid="modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full px-1">
          <span className="text-sm text-foreground truncate max-w-[80vw]">
            {clip.text ?? clip.id}
          </span>
          <button
            onClick={onClose}
            className="ml-4 rounded-md p-1 text-muted hover:text-foreground hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {src ? (
          <video
            data-testid="preview-video"
            src={src}
            controls
            autoPlay
            className="max-h-[70vh] max-w-[90vw] rounded-md bg-black"
          />
        ) : (
          <div className="flex h-48 w-80 items-center justify-center rounded-md bg-surface text-sm text-muted">
            Preview no disponible
          </div>
        )}
      </div>
    </div>
  );
}
