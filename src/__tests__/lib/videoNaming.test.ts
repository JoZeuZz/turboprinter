import { describe, expect, it } from "vitest";
import { deriveShortTitle, deriveDownloadFilename } from "../../lib/videoNaming";

describe("deriveShortTitle", () => {
  it("cuts the subject at the first colon or comma", () => {
    expect(deriveShortTitle("Gatos ninja: la verdad oculta", "f")).toBe("Gatos ninja");
    expect(deriveShortTitle("Gatos ninja, parte 2", "f")).toBe("Gatos ninja");
    expect(deriveShortTitle("Gatos: si, ninja", "f")).toBe("Gatos");
  });

  it("caps the title at 100 characters", () => {
    expect(deriveShortTitle("x".repeat(150), "f")).toHaveLength(100);
  });

  it("falls back when the subject is empty", () => {
    expect(deriveShortTitle("", "Mi YouTube Short")).toBe("Mi YouTube Short");
    expect(deriveShortTitle("   ", "Mi TikTok Video")).toBe("Mi TikTok Video");
  });
});

describe("deriveDownloadFilename", () => {
  it("builds an mp4 filename from the trimmed subject snippet", () => {
    expect(deriveDownloadFilename("Gatos ninja: la verdad")).toBe("Gatos ninja.mp4");
  });

  it("strips characters not allowed in filenames", () => {
    expect(deriveDownloadFilename('Duro <de> "matar"?')).toBe("Duro de matar.mp4");
  });

  it("falls back to video.mp4 for empty or fully sanitized subjects", () => {
    expect(deriveDownloadFilename("")).toBe("video.mp4");
    expect(deriveDownloadFilename('\\/:*?"<>|')).toBe("video.mp4");
  });
});
