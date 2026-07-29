import { describe, expect, it } from "vitest";
import {
  isSafeMediaFilename,
  resolveWithinDir,
  isSafeProjectFolderName,
} from "../../server/pathSafety";

describe("isSafeMediaFilename", () => {
  it("accepts a plain filename with a known video extension", () => {
    expect(isSafeMediaFilename("nature_cinematic.mp4")).toBe(true);
  });
  it("accepts an uppercase extension case-insensitively", () => {
    expect(isSafeMediaFilename("CLIP.MOV")).toBe(true);
  });
  it("rejects a traversal attempt", () => {
    expect(isSafeMediaFilename("../../etc/passwd")).toBe(false);
  });
  it("rejects a filename containing a subdirectory", () => {
    expect(isSafeMediaFilename("sub/dir/clip.mp4")).toBe(false);
  });
  it("rejects a filename containing a NUL byte", () => {
    expect(isSafeMediaFilename("clip.mp4\0.txt")).toBe(false);
  });
  it("rejects a filename with a non-video extension", () => {
    expect(isSafeMediaFilename("notes.txt")).toBe(false);
  });
  it("rejects an empty string", () => {
    expect(isSafeMediaFilename("")).toBe(false);
  });
  it("rejects non-string values", () => {
    expect(isSafeMediaFilename(undefined)).toBe(false);
    expect(isSafeMediaFilename(null)).toBe(false);
    expect(isSafeMediaFilename(42)).toBe(false);
    expect(isSafeMediaFilename({})).toBe(false);
  });
  it("rejects a filename containing a double quote", () => {
    expect(isSafeMediaFilename('a";id;".mp4')).toBe(false);
  });
  it("rejects command substitution", () => {
    expect(isSafeMediaFilename("a$(id).mp4")).toBe(false);
  });
  it("rejects backtick substitution", () => {
    expect(isSafeMediaFilename("a`id`.mp4")).toBe(false);
  });
  it("rejects a backslash", () => {
    expect(isSafeMediaFilename("a\\x.mp4")).toBe(false);
  });
  it("rejects a newline", () => {
    expect(isSafeMediaFilename("a\nid.mp4")).toBe(false);
  });
  it("still accepts an accented filename with parentheses", () => {
    expect(isSafeMediaFilename("vídeo (1).mp4")).toBe(true);
  });
  it("still accepts a filename with a space and a hyphen", () => {
    expect(isSafeMediaFilename("my clip-02.webm")).toBe(true);
  });
  it("still accepts a filename with an apostrophe", () => {
    expect(isSafeMediaFilename("o'brien.mp4")).toBe(true);
  });
  it("still accepts a filename with a semicolon, since it is not shell-special inside double quotes", () => {
    expect(isSafeMediaFilename("a;b.mp4")).toBe(true);
  });
});

describe("resolveWithinDir", () => {
  it("resolves a relative candidate within the base directory", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", "tema/proyecto/final.mp4")).toBe(
      "/srv/app/storage/renders/tema/proyecto/final.mp4"
    );
  });
  it("rejects a traversal candidate", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", "../../config.toml")).toBeNull();
  });
  it("rejects an absolute outsider", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", "/etc/passwd")).toBeNull();
  });
  it("accepts an absolute path that is actually inside the base", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", "/srv/app/storage/renders/tema/x.mp4")).toBe(
      "/srv/app/storage/renders/tema/x.mp4"
    );
  });
  it("rejects the sibling-prefix trap", () => {
    expect(
      resolveWithinDir("/srv/app/storage/renders", "/srv/app/storage/renders-evil/x.mp4")
    ).toBeNull();
  });
  it("returns the base itself when the candidate is '.'", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", ".")).toBe("/srv/app/storage/renders");
  });
  it("rejects an empty string", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", "")).toBeNull();
  });
  it("rejects undefined", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", undefined)).toBeNull();
  });
  it("rejects a candidate containing a NUL byte", () => {
    expect(resolveWithinDir("/srv/app/storage/renders", "tema/\0evil")).toBeNull();
  });
});

describe("isSafeProjectFolderName", () => {
  it("accepts the shape the server generates", () => {
    expect(isSafeProjectFolderName("gatos/gatos_20260727_120000")).toBe(true);
  });
  it("rejects a traversal attempt", () => {
    expect(isSafeProjectFolderName("../escape/x")).toBe(false);
  });
  it("rejects a single segment", () => {
    expect(isSafeProjectFolderName("one_segment")).toBe(false);
  });
  it("rejects three segments", () => {
    expect(isSafeProjectFolderName("a/b/c")).toBe(false);
  });
  it("rejects uppercase characters", () => {
    expect(isSafeProjectFolderName("Tema/Proyecto")).toBe(false);
  });
  it("rejects a trailing empty segment", () => {
    expect(isSafeProjectFolderName("tema/")).toBe(false);
  });
  it("rejects a leading empty segment", () => {
    expect(isSafeProjectFolderName("/tema/x")).toBe(false);
  });
  it("rejects a segment longer than 100 characters", () => {
    const longSegment = "a".repeat(101);
    expect(isSafeProjectFolderName(`tema/${longSegment}`)).toBe(false);
  });
  it("rejects non-string values", () => {
    expect(isSafeProjectFolderName(undefined)).toBe(false);
    expect(isSafeProjectFolderName(null)).toBe(false);
    expect(isSafeProjectFolderName(42)).toBe(false);
  });
});
