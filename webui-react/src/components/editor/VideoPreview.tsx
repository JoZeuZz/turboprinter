// webui-react/src/components/editor/VideoPreview.tsx
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTime } from "../../lib/time";
import type { TimelineItem } from "../../api/types";

interface VideoPreviewProps {
  items: TimelineItem[];
  selectedId: string | null;
  onTimeUpdate?: (globalTimeSec: number) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function VideoPreview({ items, selectedId, onTimeUpdate }: VideoPreviewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(selectedId ?? items[0]?.id ?? null);
  const [clipTime, setClipTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(0);

  useEffect(() => {
    setPlayingId(selectedId ?? items[0]?.id ?? null);
  }, [selectedId, items]);

  useEffect(() => {
    if (playing) void videoRef.current?.play();
  }, [playingId]);

  const currentIndex = items.findIndex((item) => item.id === playingId);
  const currentItem = currentIndex >= 0 ? items[currentIndex] : null;
  const src = currentItem?.asset_url ?? undefined;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

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

  const handleTimeUpdate = () => {
    const t = videoRef.current?.currentTime ?? 0;
    setClipTime(t);
    if (currentItem) onTimeUpdate?.(currentItem.start_sec + t);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setClipTime(t);
  };

  return (
    <div className="flex flex-col bg-black rounded-lg overflow-hidden shadow-lg shadow-black/40">
      {src ? (
        <video
          ref={videoRef}
          data-testid="video-preview"
          src={src}
          className="w-full max-h-[420px] bg-black object-contain"
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setClipDuration(videoRef.current?.duration ?? 0)}
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center bg-surface text-muted text-sm">
          {t("editor.previewEmpty")}
        </div>
      )}

      {src && (
        <div className="flex items-center gap-2 px-3 pt-2 bg-surface">
          <span className="text-[10px] tabular-nums text-muted w-9">{formatTime(clipTime)}</span>
          <input
            type="range"
            min={0}
            max={clipDuration || currentItem?.duration_sec || 0}
            step={0.05}
            value={clipTime}
            onChange={handleSeek}
            data-testid="video-seek"
            className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
          />
          <span className="text-[10px] tabular-nums text-muted w-9 text-right">
            {formatTime(clipDuration || currentItem?.duration_sec || 0)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 py-2 bg-surface">
        <button
          onClick={() => {
            if (videoRef.current) videoRef.current.currentTime = 0;
          }}
          className="text-muted hover:text-foreground transition-colors"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => {
            if (videoRef.current) videoRef.current.currentTime += 5;
          }}
          className="text-muted hover:text-foreground transition-colors"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
