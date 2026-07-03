// webui-react/src/components/editor/VideoPreview.tsx
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../api/types";

interface VideoPreviewProps {
  items: TimelineItem[];
  selectedId: string | null;
}

export function VideoPreview({ items, selectedId }: VideoPreviewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(selectedId ?? items[0]?.id ?? null);

  useEffect(() => {
    if (selectedId) setPlayingId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (playing) void videoRef.current?.play();
  }, [playingId]);

  const currentIndex = items.findIndex((item) => item.id === playingId);
  const currentItem = currentIndex >= 0 ? items[currentIndex] : null;
  const src = currentItem?.asset_url ?? undefined;

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleEnded = () => {
    const nextItem = items[currentIndex + 1];
    if (nextItem) {
      setPlayingId(nextItem.id);
    } else {
      setPlaying(false);
    }
  };

  return (
    <div className="flex flex-col bg-black rounded-lg overflow-hidden">
      {src ? (
        <video
          ref={videoRef}
          data-testid="video-preview"
          src={src}
          className="w-full max-h-64 object-contain"
          onEnded={handleEnded}
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center bg-surface text-muted text-sm">
          {t("editor.previewEmpty")}
        </div>
      )}
      <div className="flex items-center justify-center gap-3 py-2 bg-surface">
        <button
          onClick={() => {
            if (videoRef.current) videoRef.current.currentTime = 0;
          }}
          className="text-muted hover:text-foreground"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => {
            if (videoRef.current) videoRef.current.currentTime += 5;
          }}
          className="text-muted hover:text-foreground"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
