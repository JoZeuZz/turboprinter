// Pexels video search adapter plus the clip-uniqueness helper used when
// assigning one clip per shot-plan segment (no repeated clips in a timeline).

export interface PexelsClip {
  id: string;
  provider: "pexels";
  source_url: string | undefined;
  download_url: string | undefined;
  thumbnail_url: string;
  width: number;
  height: number;
  duration_sec: number;
  query: string;
  title: string;
}

export const searchPexelsVideos = async (
  query: string,
  apiKey: string,
  orientation: string = "portrait"
): Promise<PexelsClip[]> => {
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}`;
    const res = await fetch(url, {
      headers: {
        "Authorization": apiKey
      }
    });
    if (!res.ok) {
      throw new Error(`Pexels API response error: ${res.status}`);
    }
    const data: any = await res.json();
    return (data.videos || []).map((video: any) => {
      const file = video.video_files?.find((f: any) => f.quality === "hd" || f.quality === "sd") || video.video_files?.[0];
      return {
        id: `pexels_${video.id}`,
        provider: "pexels",
        source_url: file?.link || video.video_files?.[0]?.link,
        download_url: file?.link || video.video_files?.[0]?.link,
        thumbnail_url: video.image || `https://images.pexels.com/videos/${video.id}/pictures/medium-1.jpg`,
        width: video.width,
        height: video.height,
        duration_sec: video.duration,
        query: query,
        title: video.user?.name ? `Video by ${video.user.name}` : "Pexels Video"
      };
    });
  } catch (err) {
    console.error(`Failed to search Pexels for query "${query}":`, err);
    return [];
  }
};

export const clipIdOf = (clip: { id?: unknown; source_url?: unknown; download_url?: unknown }): string | null => {
  const id = clip.id || clip.source_url || clip.download_url;
  return id ? String(id) : null;
};

// Picks the first candidate whose id has not been used, falling back to the
// first candidate when all are used, and records the chosen id in usedIds.
export function pickUniqueClip<T extends { id?: unknown; source_url?: unknown; download_url?: unknown }>(
  candidates: T[],
  usedIds: Set<string>
): T | undefined {
  if (candidates.length === 0) return undefined;
  let chosen = candidates[0];
  for (const candidate of candidates) {
    const id = clipIdOf(candidate);
    if (id && !usedIds.has(id)) {
      chosen = candidate;
      break;
    }
  }
  const chosenId = clipIdOf(chosen);
  if (chosenId) {
    usedIds.add(chosenId);
  }
  return chosen;
}
