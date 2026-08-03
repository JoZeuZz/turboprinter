// webui-react/src/components/editor/VideoPreview.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { formatTime } from "../../lib/time";
import type { TimelineItem } from "../../api/types";
import { useVideoStore } from "../../store/useVideoStore";
import { useProjectStore } from "../../store/useProjectStore";
import { getSubtitleFontFamily, getSubtitleFontWeight } from "../subtitles/SubtitleFontGallery";
import { splitTextIntoTikTokSubtitles } from "../../lib/subtitleLayout";

interface VideoPreviewProps {
  items: TimelineItem[];
  subtitleItems?: TimelineItem[];
  audioItems?: TimelineItem[];
  selectedPart?: number | "all";
  partOffsetSec?: number;
  selectedId: string | null;
  onTimeUpdate?: (globalTimeSec: number) => void;
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
}: VideoPreviewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });

  const projectStore = useProjectStore();
  const subtitleTrack = projectStore.project?.tracks.find((t) => t.type === "subtitle");
  const storeSubtitleItems = subtitleTrack?.items ?? [];
  const audioTrack = projectStore.project?.tracks.find((t) => t.type === "audio");
  const narrationUrl = projectStore.project?.narration_audio_path || audioTrack?.items?.find((item) => item.asset_url)?.asset_url;

  // Process and normalize subtitle cues
  const formattedSubtitles = useMemo(() => {
    const raw = propsSubtitleItems ?? storeSubtitleItems;
    if (!raw || raw.length === 0) return [];

    const splitList: TimelineItem[] = [];
    raw.forEach((item, idx) => {
      const text = (item.text || "").trim();
      if (!text) return;

      const duration = item.duration_sec && item.duration_sec > 0
        ? item.duration_sec
        : (item.end_sec && item.end_sec > item.start_sec ? item.end_sec - item.start_sec : 5);

      const words = text.split(/\s+/).length;
      if (words > 4) {
        const cues = splitTextIntoTikTokSubtitles(
          text,
          item.start_sec ?? 0,
          duration,
          item.segment_id || `seg_${idx}`,
          item.id || `sub_${idx}`
        ).map((c) => ({ ...c, part_index: item.part_index }));
        splitList.push(...(cues as TimelineItem[]));
      } else {
        splitList.push({
          ...item,
          duration_sec: duration,
        });
      }
    });

    splitList.sort((a, b) => (a.start_sec ?? 0) - (b.start_sec ?? 0));
    return splitList;
  }, [propsSubtitleItems, storeSubtitleItems]);

  // Calculate overall timeline duration
  const totalDuration = useMemo(() => {
    let maxTime = 0;
    formattedSubtitles.forEach((s) => {
      const start = s.start_sec ?? 0;
      const dur = s.duration_sec ?? 5;
      if (start + dur > maxTime) maxTime = start + dur;
    });
    items.forEach((v) => {
      const start = v.start_sec ?? 0;
      const dur = v.duration_sec ?? 5;
      if (start + dur > maxTime) maxTime = start + dur;
    });
    return Math.max(maxTime, 1);
  }, [formattedSubtitles, items]);

  // Current active subtitle based on currentTime
  const activeSubtitle = useMemo(() => {
    if (!formattedSubtitles || formattedSubtitles.length === 0) return null;

    for (let i = 0; i < formattedSubtitles.length; i++) {
      const item = formattedSubtitles[i];
      const start = item.start_sec ?? 0;
      const dur = item.duration_sec && item.duration_sec > 0
        ? item.duration_sec
        : (item.end_sec && item.end_sec > start ? item.end_sec - start : 5);
      const itemEnd = start + dur;

      const nextItem = formattedSubtitles[i + 1];
      const nextStart = nextItem ? (nextItem.start_sec ?? 0) : Infinity;

      const effectiveEnd = (nextStart > start && nextStart <= itemEnd + 0.2)
        ? nextStart
        : itemEnd + 0.1;

      if (currentTime >= start && currentTime < effectiveEnd) {
        return item;
      }
    }
    return null;
  }, [formattedSubtitles, currentTime]);

  // Current video clip and local clip position based on currentTime
  const videoTrackDuration = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.duration_sec || 5), 0) || 1;
  }, [items]);

  const { activeVideoClip, clipLocalTime } = useMemo(() => {
    if (!items || items.length === 0) {
      return { activeVideoClip: null, clipLocalTime: 0 };
    }

    const cyclicTime = videoTrackDuration > 0 ? currentTime % videoTrackDuration : currentTime;
    let acc = 0;
    for (const item of items) {
      const dur = item.duration_sec && item.duration_sec > 0 ? item.duration_sec : 5;
      if (cyclicTime >= acc && cyclicTime < acc + dur) {
        return { activeVideoClip: item, clipLocalTime: cyclicTime - acc };
      }
      acc += dur;
    }
    return { activeVideoClip: items[items.length - 1], clipLocalTime: 0 };
  }, [items, currentTime, videoTrackDuration]);

  const [audioDuration, setAudioDuration] = useState(0);

  // Notify parent of current global time
  useEffect(() => {
    const globalTime = (selectedPart === "all" ? 0 : partOffsetSec) + currentTime;
    onTimeUpdate?.(globalTime);
  }, [currentTime, selectedPart, partOffsetSec, onTimeUpdate]);

  // Handle selectedId selection change from external editor
  const allTimelineItems = useMemo(() => {
    return [...items, ...(propsSubtitleItems || storeSubtitleItems || []), ...(_propsAudioItems || [])];
  }, [items, propsSubtitleItems, storeSubtitleItems, _propsAudioItems]);

  useEffect(() => {
    if (selectedId && allTimelineItems.length > 0) {
      const target = allTimelineItems.find((item) => item.id === selectedId);
      if (target && target.start_sec !== undefined) {
        const newTime = target.start_sec;
        setCurrentTime(newTime);
        if (audioRef.current) {
          try {
            const maxSeekable = audioDuration > 0 ? Math.min(newTime, audioDuration - 0.05) : newTime;
            audioRef.current.currentTime = Math.max(0, maxSeekable);
          } catch (e) {}
        }
      }
    }
  }, [selectedId, allTimelineItems, audioDuration]);

  // Sync video element when active video clip or seeking changes
  const activeClipUrl = activeVideoClip?.asset_url;
  useEffect(() => {
    if (!videoRef.current || !activeClipUrl) return;

    videoRef.current.muted = true;

    if (videoRef.current.src !== activeClipUrl) {
      videoRef.current.src = activeClipUrl;
      videoRef.current.load();
    }

    if (Math.abs(videoRef.current.currentTime - clipLocalTime) > 0.3) {
      try {
        videoRef.current.currentTime = clipLocalTime;
      } catch (e) {}
    }

    if (playing) {
      void videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [activeClipUrl, clipLocalTime, playing]);

  // Audio playback master clock sync & RAF timer fallback past audio duration
  const isAudioActive = Boolean(narrationUrl && audioDuration > 0 && currentTime < audioDuration - 0.1);

  useEffect(() => {
    if (!audioRef.current || !narrationUrl) return;

    if (playing && isAudioActive) {
      if (Math.abs(audioRef.current.currentTime - currentTime) > 0.3) {
        try {
          audioRef.current.currentTime = Math.max(0, currentTime);
        } catch (e) {}
      }
      void audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [playing, currentTime, narrationUrl, isAudioActive]);

  // Fallback animation frame loop if audio is not active or finished
  useEffect(() => {
    if (!playing || isAudioActive) return;

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= totalDuration) {
          setPlaying(false);
          return totalDuration;
        }
        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [playing, isAudioActive, totalDuration]);

  // Handle Audio element time update
  const handleAudioTimeUpdate = () => {
    if (!narrationUrl || !audioRef.current || isSeeking || !playing || !isAudioActive) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration || 0);
    }
  };

  const handleAudioEnded = () => {
    if (currentTime < totalDuration - 0.2) {
      // Continue playback via RAF timer if total duration extends beyond audio (e.g. Outro)
      return;
    }
    setPlaying(false);
    setCurrentTime(totalDuration);
  };

  // User Play / Pause / Seek controls
  const handleTogglePlay = useCallback(() => {
    setPlaying((prev) => {
      const next = !prev;
      if (next && currentTime >= totalDuration) {
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
      }
      return next;
    });
  }, [currentTime, totalDuration]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = newTime;
      } catch (err) {}
    }
  };

  const handleSeekStart = () => setIsSeeking(true);
  const handleSeekEnd = () => setIsSeeking(false);

  // Keyboard shortcut for spacebar play/pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      handleTogglePlay();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleTogglePlay]);

  // Video resize observer to scale subtitle font size
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
  }, [activeClipUrl]);

  // Style parameters from store
  const videoAspect = useVideoStore((s) => s.video_aspect) ?? "9:16";
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
    positionStyle.top = "8%";
  } else if (subtitlePosition === "center" || subtitlePosition === "middle") {
    positionStyle.top = "50%";
    positionStyle.transform = "translate(-50%, -50%)";
  } else if (subtitlePosition === "custom") {
    positionStyle.top = `${customPosition}%`;
  } else {
    positionStyle.bottom = "8%";
  }

  const getTranslucentColor = (hex: string): string => {
    if (!hex || !hex.startsWith("#")) return hex;
    const clean = hex.substring(1);
    if (clean.length === 3) {
      const r = clean[0], g = clean[1], b = clean[2];
      return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, 0.5)`;
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

  let aspectWrapperClass = "w-full max-h-full aspect-video";
  if (videoAspect === "9:16") {
    aspectWrapperClass = "h-full max-w-full aspect-[9/16]";
  } else if (videoAspect === "1:1") {
    aspectWrapperClass = "h-full max-w-full aspect-square";
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

  return (
    <div className="w-full h-full max-w-5xl max-h-[620px] mx-auto flex flex-col bg-black rounded-2xl overflow-hidden shadow-2xl border border-border/80">
      {activeClipUrl || narrationUrl ? (
        <div className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden p-2">
          <div className={`relative flex items-center justify-center bg-black overflow-hidden rounded-xl ${aspectWrapperClass}`}>
            <video
              ref={videoRef}
              data-testid="video-preview"
              muted
              playsInline
              {...{ referrerPolicy: "no-referrer" }}
              className="w-full h-full object-contain"
            />
            {narrationUrl && (
              <audio
                ref={audioRef}
                src={narrationUrl}
                preload="auto"
                onLoadedMetadata={handleAudioLoadedMetadata}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
                style={{ display: "none" }}
              />
            )}
            {subtitleEnabled && activeSubtitle && activeSubtitle.text && (
              <div style={positionStyle}>
                <motion.div
                  key={`${activeSubtitle.id || 'sub'}_${activeSubtitle.start_sec}_${activeSubtitle.text}-${animType}-${textColor}-${fontName}-${fontSize}-${strokeColor}-${strokeWidth}-${roundedBackground}-${subtitleBgStyle}`}
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
        </div>
      ) : (
        <div className="w-full flex-1 flex items-center justify-center bg-surface text-muted text-sm min-h-[200px]">
          {t("editor.previewEmpty")}
        </div>
      )}

      {(activeClipUrl || narrationUrl) && (
        <div className="flex items-center gap-2 px-3 pt-2 bg-surface">
          <span className="text-[10px] tabular-nums text-muted w-9">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.05}
            value={currentTime}
            onChange={handleSeekChange}
            onMouseDown={handleSeekStart}
            onMouseUp={handleSeekEnd}
            onTouchStart={handleSeekStart}
            onTouchEnd={handleSeekEnd}
            data-testid="video-seek"
            className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
          />
          <span className="text-[10px] tabular-nums text-muted w-9 text-right">
            {formatTime(totalDuration)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 py-2 bg-surface">
        <button
          onClick={() => {
            setCurrentTime(0);
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          className="text-muted hover:text-foreground transition-colors"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={handleTogglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => {
            const nextTime = Math.min(currentTime + 5, totalDuration);
            setCurrentTime(nextTime);
            if (audioRef.current) audioRef.current.currentTime = nextTime;
          }}
          className="text-muted hover:text-foreground transition-colors"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
