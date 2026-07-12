// webui-react/src/components/editor/VideoPreview.tsx
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTime } from "../../lib/time";
import type { TimelineItem } from "../../api/types";
import { useVideoStore } from "../../store/useVideoStore";
import { useProjectStore } from "../../store/useProjectStore";
import { getSubtitleFontFamily, getSubtitleFontWeight } from "../subtitles/SubtitleFontGallery";

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
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });

  const projectStore = useProjectStore();
  const subtitleTrack = projectStore.project?.tracks.find((t) => t.type === "subtitle");
  const subtitleItems = subtitleTrack?.items ?? [];

  const videoAspect = useVideoStore((s) => s.video_aspect) ?? "9:16";

  useEffect(() => {
    setPlayingId(selectedId ?? items[0]?.id ?? null);
  }, [selectedId, items]);

  useEffect(() => {
    if (playing) void videoRef.current?.play();
  }, [playingId]);

  const currentIndex = items.findIndex((item) => item.id === playingId);
  const currentItem = currentIndex >= 0 ? items[currentIndex] : null;
  const src = currentItem?.asset_url ?? undefined;

  const globalTime = currentItem ? currentItem.start_sec + clipTime : 0;
  const activeSubtitle = subtitleItems.find(
    (item) => globalTime >= item.start_sec && globalTime < (item.start_sec + item.duration_sec)
  );

  const subtitleEnabled = useVideoStore((s) => s.subtitle_enabled) ?? true;
  const subtitlePosition = useVideoStore((s) => s.subtitle_position) ?? "bottom";
  const customPosition = useVideoStore((s) => s.custom_position) ?? 70;
  const fontName = useVideoStore((s) => s.font_name) ?? "STHeitiMedium.ttc";
  const fontSize = useVideoStore((s) => s.font_size) ?? 60;
  const textColor = useVideoStore((s) => s.text_fore_color) ?? "#FFFFFF";
  const strokeColor = useVideoStore((s) => s.stroke_color) ?? "#000000";
  const strokeWidth = useVideoStore((s) => s.stroke_width) ?? 1.5;
  const textBackgroundColor = useVideoStore((s) => s.text_background_color) ?? true;
  const roundedBackground = useVideoStore((s) => s.rounded_subtitle_background) ?? false;

  useEffect(() => {
    if (!videoRef.current) return;
    
    const updateDims = () => {
      if (videoRef.current) {
        setVideoDims({
          width: videoRef.current.clientWidth,
          height: videoRef.current.clientHeight,
        });
      }
    };

    const observer = new ResizeObserver(updateDims);
    observer.observe(videoRef.current);
    
    updateDims();
    
    return () => observer.disconnect();
  }, [src]);

  // We compute the scale relative to 1920px height of rendering.
  const videoHeight = videoDims.height || 400;
  const scale = videoHeight / 1920;

  const fontNameStyle = getSubtitleFontFamily(fontName);
  const fontWeightStyle = getSubtitleFontWeight(fontName);
  const fontSizePx = Math.max(12, fontSize * scale);
  const strokePx = Math.max(0, strokeWidth * scale);

  let positionStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: "86%",
    textAlign: "center",
    pointerEvents: "none",
    zIndex: 10,
  };

  if (subtitlePosition === "top") {
    positionStyle.top = `${8}%`;
  } else if (subtitlePosition === "center" || subtitlePosition === "middle") {
    positionStyle.top = "50%";
    positionStyle.transform = "translate(-50%, -50%)";
  } else if (subtitlePosition === "custom") {
    positionStyle.top = `${customPosition}%`;
  } else {
    positionStyle.bottom = `${8}%`;
  }

  let bgStyle: React.CSSProperties = {
    backgroundColor: "transparent",
  };
  if (textBackgroundColor === true) {
    bgStyle.backgroundColor = "rgba(0, 0, 0, 0.5)";
  } else if (typeof textBackgroundColor === "string" && textBackgroundColor.trim()) {
    bgStyle.backgroundColor = textBackgroundColor;
  }

  const borderStyleClass = roundedBackground ? "rounded-xl" : "rounded-sm";

  const textShadowStyle = strokePx > 0
    ? `-${strokePx}px -${strokePx}px 0 ${strokeColor},
       ${strokePx}px -${strokePx}px 0 ${strokeColor},
       -${strokePx}px ${strokePx}px 0 ${strokeColor},
       ${strokePx}px ${strokePx}px 0 ${strokeColor},
       0px -${strokePx}px 0 ${strokeColor},
       0px ${strokePx}px 0 ${strokeColor},
       -${strokePx}px 0px 0 ${strokeColor},
       ${strokePx}px 0px 0 ${strokeColor},
       0 1px 4px rgba(0,0,0,0.5)`
    : "0 1px 2px rgba(0,0,0,0.45)";

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

  let maxWidthClass = "max-w-5xl";
  if (videoAspect === "9:16") {
    maxWidthClass = "max-w-[500px]";
  } else if (videoAspect === "1:1") {
    maxWidthClass = "max-w-[680px]";
  }

  return (
    <div className={`flex flex-col bg-black rounded-lg overflow-hidden shadow-lg shadow-black/40 h-full w-full mx-auto ${maxWidthClass}`}>
      {src ? (
        <div className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            data-testid="video-preview"
            src={src}
            {...{ referrerPolicy: "no-referrer" }}
            className="w-full h-full object-contain"
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setClipDuration(videoRef.current?.duration ?? 0)}
          />
          {subtitleEnabled && activeSubtitle && activeSubtitle.text && (
            <div style={positionStyle}>
              <div
                className={`inline-block max-w-full px-3 py-1.5 leading-tight ${borderStyleClass}`}
                style={bgStyle}
              >
                <span
                  className="block break-words"
                  style={{
                    color: textColor,
                    fontFamily: fontNameStyle,
                    fontWeight: fontWeightStyle,
                    fontSize: `${fontSizePx}px`,
                    textShadow: textShadowStyle,
                  }}
                >
                  {activeSubtitle.text}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full flex-1 flex items-center justify-center bg-surface text-muted text-sm min-h-[200px]">
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
