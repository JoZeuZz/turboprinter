import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  tiktokCredsPath,
  loadTiktokChannels,
  saveTiktokChannels,
  getActiveTiktokChannel,
  upsertTiktokChannel,
  selectTiktokChannel,
  removeTiktokChannel,
  setTiktokVerification,
  clearTiktokCredentials,
  writeTiktokVerificationFiles,
} from "../../server/tiktokCredentials";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tiktok-creds-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const channel = (id: string, extra: Record<string, unknown> = {}) => ({
  channelId: id,
  channelName: `Cuenta ${id}`,
  username: `user_${id}`,
  avatarUrl: `https://a/${id}.jpg`,
  tokens: { access_token: `tok_${id}`, refresh_token: `ref_${id}` },
  ...extra,
});

describe("loadTiktokChannels", () => {
  it("returns empty credentials when no file exists", () => {
    expect(loadTiktokChannels(tmpDir)).toEqual({ activeChannelId: null, channels: [] });
  });

  it("round-trips channels and verification metadata through save/load", () => {
    const creds = {
      activeChannelId: "c1",
      channels: [channel("c1")],
      verification_filename: "tiktok-verify.txt",
      verification_content: "tiktok-site-verification=abc",
    };
    saveTiktokChannels(tmpDir, creds);

    expect(loadTiktokChannels(tmpDir)).toEqual(creds);
  });

  it("tolerates a corrupt file by returning empty credentials", () => {
    fs.mkdirSync(path.dirname(tiktokCredsPath(tmpDir)), { recursive: true });
    fs.writeFileSync(tiktokCredsPath(tmpDir), "{broken", "utf8");
    expect(loadTiktokChannels(tmpDir)).toEqual({ activeChannelId: null, channels: [] });
  });

  it("surfaces a legacy root channelName as legacyAccountName", () => {
    fs.mkdirSync(path.dirname(tiktokCredsPath(tmpDir)), { recursive: true });
    fs.writeFileSync(tiktokCredsPath(tmpDir), JSON.stringify({ channelName: "Vieja Cuenta" }), "utf8");
    const creds = loadTiktokChannels(tmpDir);
    expect(creds.channels).toEqual([]);
    expect(creds.legacyAccountName).toBe("Vieja Cuenta");
  });
});

describe("saveTiktokChannels", () => {
  it("keeps the file when there are no channels but verification metadata exists", () => {
    saveTiktokChannels(tmpDir, {
      activeChannelId: null,
      channels: [],
      verification_filename: "v.txt",
      verification_content: "x",
    });
    expect(fs.existsSync(tiktokCredsPath(tmpDir))).toBe(true);
  });

  it("deletes the file when there is nothing left to store", () => {
    saveTiktokChannels(tmpDir, { activeChannelId: "c1", channels: [channel("c1")] });
    saveTiktokChannels(tmpDir, { activeChannelId: null, channels: [] });
    expect(fs.existsSync(tiktokCredsPath(tmpDir))).toBe(false);
  });
});

describe("upsertTiktokChannel", () => {
  it("inserts a new channel and makes the first one active", () => {
    const creds = upsertTiktokChannel({ activeChannelId: null, channels: [] }, channel("c1"));
    expect(creds.activeChannelId).toBe("c1");
    expect(creds.channels).toHaveLength(1);
  });

  it("updates an existing channel in place and preserves verification metadata", () => {
    let creds: import("../../server/tiktokCredentials").TiktokCredentials = {
      activeChannelId: "c1",
      channels: [channel("c1")],
      verification_filename: "v.txt",
      verification_content: "x",
    };
    creds = upsertTiktokChannel(creds, channel("c1", { channelName: "Renombrada" }));
    expect(creds.channels).toHaveLength(1);
    expect(creds.channels[0].channelName).toBe("Renombrada");
    expect(creds.verification_filename).toBe("v.txt");
  });
});

describe("selectTiktokChannel / removeTiktokChannel / getActiveTiktokChannel", () => {
  const base = { activeChannelId: "c1", channels: [channel("c1"), channel("c2")] };

  it("selects an existing channel and rejects unknown ids", () => {
    expect(selectTiktokChannel(base, "c2")?.activeChannelId).toBe("c2");
    expect(selectTiktokChannel(base, "nope")).toBeNull();
  });

  it("removing the active channel promotes the next one", () => {
    const creds = removeTiktokChannel(base, "c1");
    expect(creds.channels.map((c) => c.channelId)).toEqual(["c2"]);
    expect(creds.activeChannelId).toBe("c2");
  });

  it("getActive falls back to the first channel when active id is stale", () => {
    expect(getActiveTiktokChannel({ ...base, activeChannelId: "gone" })?.channelId).toBe("c1");
    expect(getActiveTiktokChannel({ activeChannelId: null, channels: [] })).toBeNull();
  });
});

describe("setTiktokVerification", () => {
  it("merges partial updates without touching channels", () => {
    let creds = setTiktokVerification(
      { activeChannelId: "c1", channels: [channel("c1")] },
      { filename: "v.txt" }
    );
    creds = setTiktokVerification(creds, { content: "abc" });
    expect(creds.verification_filename).toBe("v.txt");
    expect(creds.verification_content).toBe("abc");
    expect(creds.channels).toHaveLength(1);
  });
});

describe("writeTiktokVerificationFiles", () => {
  it("writes the verification file into public/ and dist/", () => {
    writeTiktokVerificationFiles(tmpDir, {
      activeChannelId: null,
      channels: [],
      verification_filename: "tiktok-verify.txt",
      verification_content: "tiktok-site-verification=abc",
    });
    expect(fs.readFileSync(path.join(tmpDir, "public", "tiktok-verify.txt"), "utf8")).toBe(
      "tiktok-site-verification=abc"
    );
    expect(fs.readFileSync(path.join(tmpDir, "dist", "tiktok-verify.txt"), "utf8")).toBe(
      "tiktok-site-verification=abc"
    );
  });

  it("does nothing when metadata is incomplete", () => {
    writeTiktokVerificationFiles(tmpDir, { activeChannelId: null, channels: [] });
    expect(fs.existsSync(path.join(tmpDir, "public"))).toBe(false);
  });
});

describe("clearTiktokCredentials", () => {
  it("removes the credentials file", () => {
    saveTiktokChannels(tmpDir, { activeChannelId: "c1", channels: [channel("c1")] });
    clearTiktokCredentials(tmpDir);
    expect(fs.existsSync(tiktokCredsPath(tmpDir))).toBe(false);
  });
});
