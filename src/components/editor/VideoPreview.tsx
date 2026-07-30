// webui-react/src/components/editor/VideoPreview.tsx
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { formatTime } from "../../lib/time";
import type { TimelineItem } from "../../api/types";
import { useVideoStore } from "../../store/useVideoStore";
import { useProjectStore } from "../../store/useProjectStore";
import { getSubtitleFontFamily, getSubtitleFontWeight } from "../subtitles/SubtitleFontGallery";

interface VideoPreviewProps {
  items: TimelineItem[];
  subtitleItems?: TimelineItem[];
  audioItems?: TimelineItem[];
  selectedPart?: number | "all";
  partOffsetSec?: number;
  selectedId: string | null;
  onTimeUpdate?: (globalTimeSec: number) => void;
  renderedVideoUrl?: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function VideoPreview({
  items,
  subtitleItems: propsSubtitleItems,
  audioItems: _propsAudioItems,
  selectedPart,
  partOffsetSec = 0,
  selectedId,
  onTimeUpdate,
  renderedVideoUrl,
}: VideoPreviewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(selectedId ?? items[0]?.id ?? null);
  const [clipTime, setClipTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(0);
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });
  const [useRenderedMode, setUseRenderedMode] = useState<boolean>(!!renderedVideoUrl);

  const projectStore = useProjectStore();
  const subtitleTrack = projectStore.project?.tracks.find((t) => t.type === "subtitle");
  const subtitleItems = subtitleTrack?.items ?? [];
  const audioTrack = projectStore.project?.tracks.find((t) => t.type === "audio");
  const narrationUrl = projectStore.project?.narration_audio_path || audioTrack?.items?.find((item) => item.asset_url)?.asset_url;

  const activeSubtitles = propsSubtitleItems ?? subtitleItems;

  const videoAspect = useVideoStore((s) => s.video_aspect) ?? "9:16";

  useEffect(() => {
    if (renderedVideoUrl) {
      setUseRenderedMode(true);
    }
  }, [renderedVideoUrl]);

  useEffect(() => {
    setPlayingId(selectedId ?? items[0]?.id ?? null);
    setClipTime(0);
  }, [selectedId, items]);

  const currentIndex = items.findIndex((item) => item.id === playingId);
  const currentItem = currentIndex >= 0 ? items[currentIndex] : null;
  const src = currentItem?.asset_url ?? undefined;

  const maxDuration = (currentItem && currentItem.duration_sec > 0)
    ? currentItem.duration_sec
    : (clipDuration || 0);

  const globalTime = currentItem ? currentItem.start_sec + clipTime : 0;
  const targetAudioTime = (selectedPart === "all" ? 0 : partOffsetSec) + globalTime;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    if (playing) {
      void videoRef.current?.play().catch(() => {});
      if (audioRef.current && isFinite(targetAudioTime)) {
        try {
          audioRef.current.currentTime = targetAudioTime;
          void audioRef.current.play().catch(() => {});
        } catch (e) {
          console.warn(e);
        }
      }
    } else {
      if (audioRef.current && isFinite(targetAudioTime)) {
        try {
          audioRef.current.currentTime = targetAudioTime;
        } catch (e) {}
      }
    }
  }, [playingId]);

  const activeSubtitle = activeSubtitles.find(
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
  const subtitleBgStyle = useVideoStore((s) => s.subtitle_bg_style) ?? "solid";
  const subtitleAnimation = useVideoStore((s) => s.subtitle_animation) ?? "pop";

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

  const getTranslucentColor = (hex: string): string => {
    if (!hex || !hex.startsWith("#")) return hex;
    const clean = hex.substring(1);
    if (clean.length === 3) {
      const r = clean[0], g = clean[1], b = clean[2];
      return `rgba(${parseInt(r+r, 16)}, ${parseInt(g+g, 16)}, ${parseInt(b+b, 16)}, 0.5)`;
    }
    if (clean.length === 6) {
      const r = clean.substring(0, 2);
      const g = clean.substring(2, 4);
      const b = clean.substring(4, 6);
      return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0.5)`;
    }
    return hex;
  };

  let bgStyle: React.CSSProperties = {
    backgroundColor: "transparent",
  };
  if (textBackgroundColor !== false) {
    let baseColor = "#000000";
    if (typeof textBackgroundColor === "string" && textBackgroundColor.trim()) {
      baseColor = textBackgroundColor;
    }
    
    if (subtitleBgStyle === "translucent") {
      bgStyle.backgroundColor = getTranslucentColor(baseColor);
    } else if (subtitleBgStyle === "blur") {
      bgStyle.backgroundColor = "rgba(255, 255, 255, 0.25)";
    } else {
      bgStyle.backgroundColor = baseColor;
    }
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

  const handlePlay = () => {
    setPlaying(true);
    if (audioRef.current) {
      if (isFinite(targetAudioTime)) {
        try {
          audioRef.current.currentTime = targetAudioTime;
        } catch (e) {}
      }
      void audioRef.current.play();
    }
  };

  const handlePause = () => {
    setPlaying(false);
    audioRef.current?.pause();
  };

  const handleSeeking = () => {
    if (audioRef.current) {
      const vTime = videoRef.current?.currentTime ?? 0;
      if (currentItem) {
        const gTime = currentItem.start_sec + vTime;
        const targetTime = (selectedPart === "all" ? 0 : partOffsetSec) + gTime;
        if (isFinite(targetTime)) {
          try {
            audioRef.current.currentTime = targetTime;
          } catch (e) {}
        }
      }
    }
  };

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }
  };

  const handleEnded = () => {
    const nextItem = items[currentIndex + 1];
    if (nextItem) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
      setClipTime(0);
      setPlayingId(nextItem.id);
    } else {
      setPlaying(false);
      audioRef.current?.pause();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentItem) return;
    const t = videoRef.current.currentTime;

    // Check if we've reached or exceeded the segment duration in the timeline
    if (t >= maxDuration) {
      videoRef.current.pause();
      const nextItem = items[currentIndex + 1];
      if (nextItem) {
        videoRef.current.currentTime = 0;
        setClipTime(0);
        setPlayingId(nextItem.id);
      } else {
        setPlaying(false);
        audioRef.current?.pause();
        setClipTime(maxDuration);
      }
      return;
    }

    setClipTime(t);
    const gTime = currentItem.start_sec + t;
    onTimeUpdate?.(gTime);

    if (audioRef.current && !videoRef.current.paused) {
      const diff = Math.abs(audioRef.current.currentTime - gTime);
      if (diff > 0.25 && isFinite(gTime)) {
        try {
          audioRef.current.currentTime = gTime;
        } catch (e) {}
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setClipTime(t);
    if (currentItem) {
      const gTime = currentItem.start_sec + t;
      if (audioRef.current && isFinite(gTime)) {
        try {
          audioRef.current.currentTime = gTime;
        } catch (e) {}
      }
    }
  };

  let containerClass = "w-full max-w-2xl mx-auto aspect-video";
  if (videoAspect === "9:16") {
    containerClass = "h-full max-h-[540px] w-auto max-w-[310px] sm:max-w-[325px] mx-auto aspect-[9/16]";
  } else if (videoAspect === "1:1") {
    containerClass = "h-full max-h-[450px] w-auto max-w-[450px] mx-auto aspect-square";
  }

  const animType = subtitleAnimation ?? "pop";
  let motionProps = {};
  if (animType === "pop") {
    motionProps = {
      initial: { scale: 0.8 },
      animate: { scale: [0.8, 1.12, 1.0] },
      transition: { duration: 0.18, times: [0, 0.5, 1], ease: "easeOut" },
    };
  } else if (animType === "fade") {
    motionProps = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.15, ease: "easeOut" },
    };
  } else if (animType === "rotate") {
    motionProps = {
      initial: { scale: 0.8, rotate: -3.5 },
      animate: { scale: [0.8, 1.12, 1.0], rotate: [-3.5, 2, 0] },
      transition: { duration: 0.2, times: [0, 0.5, 1], ease: "easeOut" },
    };
  }

  // If rendered video URL is provided and user is in rendered mode
  if (renderedVideoUrl && useRenderedMode) {
    return (
      <div className={`flex flex-col bg-black rounded-2xl overflow-hidden shadow-2xl border border-border/80 ${containerClass}`}>
        <div className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            key={renderedVideoUrl}
            src={renderedVideoUrl.includes("?") ? renderedVideoUrl : `${renderedVideoUrl}?v=${Date.now()}`}
            controls
            preload="auto"
            playsInline
            {...{ referrerPolicy: "no-referrer" }}
            className="w-full h-full object-contain mx-auto block rounded-xl"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-black rounded-2xl overflow-hidden shadow-2xl border border-border/80 ${containerClass}`}>
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
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeking={handleSeeking}
            onLoadedMetadata={() => setClipDuration(videoRef.current?.duration ?? 0)}
          />
          {narrationUrl && (
            <audio
              ref={audioRef}
              src={narrationUrl}
              preload="auto"
              style={{ display: "none" }}
            />
          )}
          {subtitleEnabled && activeSubtitle && activeSubtitle.text && (
            <div style={positionStyle}>
              <motion.div
                key={`${activeSubtitle.id || activeSubtitle.text}-${animType}-${textColor}-${fontName}-${fontSize}-${strokeColor}-${strokeWidth}-${roundedBackground}-${subtitleBgStyle}`}
                className={`inline-block max-w-full px-3 py-1.5 leading-tight transition-all ${borderStyleClass} ${
                  subtitleBgStyle === "blur" && textBackgroundColor !== false ? "backdrop-blur-md border border-white/20" : ""
                }`}
                style={bgStyle}
                {...motionProps}
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
              </motion.div>
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
            max={maxDuration}
            step={0.05}
            value={clipTime}
            onChange={handleSeek}
            data-testid="video-seek"
            className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
          />
          <span className="text-[10px] tabular-nums text-muted w-9 text-right">
            {formatTime(maxDuration)}
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
