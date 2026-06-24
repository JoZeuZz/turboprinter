// webui-react/src/components/editor/VideoPreview.tsx
import { useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface VideoPreviewProps {
  src?: string;
}

export function VideoPreview({ src }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex flex-col bg-black rounded-lg overflow-hidden">
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full max-h-64 object-contain"
          onEnded={() => setPlaying(false)}
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center bg-surface text-muted text-sm">
          Select a clip to preview
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
