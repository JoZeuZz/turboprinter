export type VideoOrigin = "draft" | "history" | "generating" | "finished";

export interface VideoOriginInput {
  routeId: string | undefined;
  panel: string;
  videoUrls: string[];
}

export function deriveVideoOrigin(input: VideoOriginInput): VideoOrigin {
  const { routeId, panel, videoUrls } = input;
  if (panel === "generating" || panel === "rendering") return "generating";
  if (panel === "done" && videoUrls.length > 0) return "finished";
  if (!routeId) return "draft";
  return "history";
}
