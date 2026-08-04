export function getClipsForPart<T extends { part_index?: number }>(
  items: T[],
  partIndex: number | "all",
  multiPartCount: number = 2
): T[] {
  if (partIndex === "all" || !items || items.length === 0) {
    return items;
  }

  const numericPart = typeof partIndex === "number" ? partIndex : 1;
  const hasPartIndex = items.some((item) => item.part_index !== undefined && item.part_index !== null);

  if (hasPartIndex) {
    return items.filter((item) => {
      const isOutro = (item as any)?.id === "clip_outro" || (item as any)?.keywords?.includes("outro") || (item as any)?.asset_url?.includes("outro");
      if (isOutro) {
        return true;
      }
      return (item.part_index ?? 1) === numericPart;
    });
  }

  // Fallback: chunk items evenly across multiPartCount
  const total = items.length;
  const chunkSize = Math.max(1, Math.ceil(total / multiPartCount));
  const startIdx = (numericPart - 1) * chunkSize;
  const endIdx = Math.min(startIdx + chunkSize, total);
  return items.slice(startIdx, endIdx);
}

export function getNormalizedItemsForPart<T extends { start_sec: number; end_sec?: number | null; duration_sec?: number; part_index?: number }>(
  items: T[],
  partIndex: number | "all",
  multiPartCount: number = 2,
  commonOffsetSec?: number
): T[] {
  if (!items || items.length === 0) return [];
  const selected = getClipsForPart(items, partIndex, multiPartCount);
  if (partIndex === "all" || selected.length === 0) return selected;

  const nonOutroSelected = selected.filter(
    (item) => !((item as any)?.id === "clip_outro" || (item as any)?.keywords?.includes("outro") || (item as any)?.asset_url?.includes("outro"))
  );

  const minStartSec = commonOffsetSec !== undefined
    ? commonOffsetSec
    : (nonOutroSelected.length > 0 ? Math.min(...nonOutroSelected.map((item) => item.start_sec ?? 0)) : Math.min(...selected.map((item) => item.start_sec ?? 0)));

  let nonOutroDuration = 0;
  nonOutroSelected.forEach((item) => {
    const normStart = Math.max(0, (item.start_sec ?? 0) - minStartSec);
    const dur = item.duration_sec ?? 5;
    if (normStart + dur > nonOutroDuration) {
      nonOutroDuration = normStart + dur;
    }
  });

  return selected.map((item) => {
    const isOutro = (item as any)?.id === "clip_outro" || (item as any)?.keywords?.includes("outro") || (item as any)?.asset_url?.includes("outro");
    if (isOutro) {
      return {
        ...item,
        start_sec: nonOutroDuration,
        ...(item.end_sec !== undefined && item.end_sec !== null
          ? { end_sec: nonOutroDuration + (item.duration_sec ?? 4) }
          : {}),
      };
    }

    const normStart = Math.max(0, (item.start_sec ?? 0) - minStartSec);
    return {
      ...item,
      start_sec: normStart,
      ...(item.end_sec !== undefined && item.end_sec !== null
        ? { end_sec: Math.max(0, item.end_sec - minStartSec) }
        : {}),
    };
  });
}

