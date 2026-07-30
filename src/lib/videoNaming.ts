// Derives display/file names from the video subject: the snippet before the
// first colon or comma is the human title of the piece.

const subjectSnippet = (subject: string): string => {
  let name = subject;
  const colonIndex = name.indexOf(":");
  const commaIndex = name.indexOf(",");

  let splitIndex = -1;
  if (colonIndex !== -1 && commaIndex !== -1) {
    splitIndex = Math.min(colonIndex, commaIndex);
  } else if (colonIndex !== -1) {
    splitIndex = colonIndex;
  } else if (commaIndex !== -1) {
    splitIndex = commaIndex;
  }

  if (splitIndex !== -1) {
    name = name.substring(0, splitIndex);
  }
  return name.trim();
};

export const deriveShortTitle = (subject: string, fallback: string): string => {
  const snippet = subjectSnippet(subject).substring(0, 100);
  return snippet || fallback;
};

export const deriveDownloadFilename = (subject: string): string => {
  const snippet = subjectSnippet(subject);
  if (!snippet) {
    return "video.mp4";
  }
  const sanitized = snippet.replace(/[\\/:*?"<>|]/g, "").trim();
  return sanitized ? `${sanitized}.mp4` : "video.mp4";
};
