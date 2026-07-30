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
    return items.filter((item) => (item.part_index ?? 1) === numericPart);
  }

  // Fallback: chunk items evenly across multiPartCount
  const total = items.length;
  const chunkSize = Math.max(1, Math.ceil(total / multiPartCount));
  const startIdx = (numericPart - 1) * chunkSize;
  const endIdx = Math.min(startIdx + chunkSize, total);
  return items.slice(startIdx, endIdx);
}
