import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  loadChannels,
  saveChannels,
  getActiveChannel,
  upsertChannel,
  selectChannel,
  removeChannel,
  youtubeCredsPath,
} from "../../server/youtubeChannels";

let rootDir: string;

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-creds-"));
});

afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true });
});

const writeCreds = (data: unknown) => {
  fs.mkdirSync(path.join(rootDir, "storage"), { recursive: true });
  fs.writeFileSync(youtubeCredsPath(rootDir), JSON.stringify(data), "utf8");
};

describe("loadChannels", () => {
  it("returns empty credentials when the file does not exist", () => {
    expect(loadChannels(rootDir)).toEqual({ activeChannelId: null, channels: [] });
  });

  it("returns empty credentials when the file is corrupt", () => {
    fs.mkdirSync(path.join(rootDir, "storage"), { recursive: true });
    fs.writeFileSync(youtubeCredsPath(rootDir), "{not json", "utf8");
    expect(loadChannels(rootDir)).toEqual({ activeChannelId: null, channels: [] });
  });

  it("loads a multi-channel file as-is", () => {
    writeCreds({
      activeChannelId: "b",
      channels: [
        { channelId: "a", channelName: "Canal A", tokens: { t: 1 } },
        { channelId: "b", channelName: "Canal B", tokens: { t: 2 } },
      ],
    });
    const creds = loadChannels(rootDir);
    expect(creds.activeChannelId).toBe("b");
    expect(creds.channels).toHaveLength(2);
  });

  it("migrates a legacy single-token file to a synthetic legacy channel", () => {
    writeCreds({ channelName: "Viejo Canal", tokens: { access_token: "x" } });
    const creds = loadChannels(rootDir);
    expect(creds.activeChannelId).toBe("legacy");
    expect(creds.channels).toEqual([
      { channelId: "legacy", channelName: "Viejo Canal", tokens: { access_token: "x" } },
    ]);
  });

  it("uses the default name when a legacy file has no channelName", () => {
    writeCreds({ tokens: { access_token: "x" } });
    expect(loadChannels(rootDir).channels[0].channelName).toBe("Mi Canal de YouTube");
  });
});

describe("saveChannels", () => {
  it("persists credentials that round-trip through loadChannels", () => {
    saveChannels(rootDir, {
      activeChannelId: "a",
      channels: [{ channelId: "a", channelName: "Canal A", tokens: {} }],
    });
    expect(loadChannels(rootDir).activeChannelId).toBe("a");
  });

  it("deletes the file when saving empty channels", () => {
    saveChannels(rootDir, {
      activeChannelId: "a",
      channels: [{ channelId: "a", channelName: "Canal A", tokens: {} }],
    });
    saveChannels(rootDir, { activeChannelId: null, channels: [] });
    expect(fs.existsSync(youtubeCredsPath(rootDir))).toBe(false);
  });
});

describe("getActiveChannel", () => {
  const creds = {
    activeChannelId: "b",
    channels: [
      { channelId: "a", channelName: "Canal A", tokens: {} },
      { channelId: "b", channelName: "Canal B", tokens: {} },
    ],
  };

  it("returns the channel matching activeChannelId", () => {
    expect(getActiveChannel(creds)?.channelId).toBe("b");
  });

  it("falls back to the first channel when the id does not match", () => {
    expect(getActiveChannel({ ...creds, activeChannelId: "zz" })?.channelId).toBe("a");
  });

  it("returns null when there are no channels", () => {
    expect(getActiveChannel({ activeChannelId: null, channels: [] })).toBeNull();
  });
});

describe("upsertChannel", () => {
  it("adds a new channel and makes the only channel active", () => {
    const creds = upsertChannel(
      { activeChannelId: null, channels: [] },
      { channelId: "a", channelName: "Canal A", tokens: { t: 1 } }
    );
    expect(creds.channels).toHaveLength(1);
    expect(creds.activeChannelId).toBe("a");
  });

  it("updates tokens and name of an existing channel without duplicating", () => {
    const initial = {
      activeChannelId: "a",
      channels: [
        { channelId: "a", channelName: "Canal A", tokens: { t: 1 } },
        { channelId: "b", channelName: "Canal B", tokens: { t: 2 } },
      ],
    };
    const creds = upsertChannel(initial, {
      channelId: "b",
      channelName: "Canal B Renombrado",
      tokens: { t: 9 },
    });
    expect(creds.channels).toHaveLength(2);
    expect(creds.channels[1]).toEqual({
      channelId: "b",
      channelName: "Canal B Renombrado",
      tokens: { t: 9 },
    });
    expect(creds.activeChannelId).toBe("a");
  });

  it("repairs an unknown activeChannelId by activating the upserted channel", () => {
    const creds = upsertChannel(
      {
        activeChannelId: "unknown",
        channels: [{ channelId: "a", channelName: "Canal A", tokens: {} }],
      },
      { channelId: "b", channelName: "Canal B", tokens: {} }
    );
    expect(creds.activeChannelId).toBe("b");
  });
});

describe("selectChannel", () => {
  const creds = {
    activeChannelId: "a",
    channels: [
      { channelId: "a", channelName: "Canal A", tokens: {} },
      { channelId: "b", channelName: "Canal B", tokens: {} },
    ],
  };

  it("activates an existing channel", () => {
    expect(selectChannel(creds, "b")?.activeChannelId).toBe("b");
  });

  it("returns null for an unknown channel", () => {
    expect(selectChannel(creds, "zz")).toBeNull();
  });
});

describe("removeChannel", () => {
  const creds = {
    activeChannelId: "a",
    channels: [
      { channelId: "a", channelName: "Canal A", tokens: {} },
      { channelId: "b", channelName: "Canal B", tokens: {} },
    ],
  };

  it("removes a channel and reassigns active to the first remaining", () => {
    const next = removeChannel(creds, "a");
    expect(next.channels).toHaveLength(1);
    expect(next.activeChannelId).toBe("b");
  });

  it("keeps the current active when removing another channel", () => {
    const next = removeChannel(creds, "b");
    expect(next.activeChannelId).toBe("a");
  });

  it("leaves null active when the last channel is removed", () => {
    const next = removeChannel(
      { activeChannelId: "a", channels: [{ channelId: "a", channelName: "A", tokens: {} }] },
      "a"
    );
    expect(next).toEqual({ activeChannelId: null, channels: [] });
  });
});
