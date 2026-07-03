// webui-react/src/lib/mediaOrientation.ts
import type { VideoAspect } from "../api/types";

const ASPECT_TO_ORIENTATION: Record<VideoAspect, "landscape" | "portrait" | "square"> = {
  "16:9": "landscape",
  "9:16": "portrait",
  "1:1": "square",
};

export function orientationForAspect(
  aspect: VideoAspect | undefined
): "landscape" | "portrait" | "square" {
  return ASPECT_TO_ORIENTATION[aspect ?? "9:16"];
}
