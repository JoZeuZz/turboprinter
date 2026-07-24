// Backend-only repository for YouTube channel credentials.
// Owns the storage/youtube-credentials.json format, including the migration
// of pre-multichannel files ({tokens, channelName}) to a synthetic "legacy"
// channel — callers never see the legacy shape.

import fs from "fs";
import path from "path";

export interface YoutubeChannel {
  channelId: string;
  channelName: string;
  tokens: Record<string, unknown>;
}

export interface YoutubeCredentials {
  activeChannelId: string | null;
  channels: YoutubeChannel[];
}

const DEFAULT_LEGACY_NAME = "Mi Canal de YouTube";

export const youtubeCredsPath = (rootDir: string): string =>
  path.join(rootDir, "storage", "youtube-credentials.json");

export const loadChannels = (rootDir: string = process.cwd()): YoutubeCredentials => {
  const credsPath = youtubeCredsPath(rootDir);
  if (!fs.existsSync(credsPath)) {
    return { activeChannelId: null, channels: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    let channels: YoutubeChannel[] = data.channels || [];
    let activeChannelId: string | null = data.activeChannelId || null;

    if (channels.length === 0 && data.tokens) {
      channels = [
        {
          channelId: "legacy",
          channelName: data.channelName || DEFAULT_LEGACY_NAME,
          tokens: data.tokens,
        },
      ];
      activeChannelId = "legacy";
    }

    return { activeChannelId, channels };
  } catch {
    return { activeChannelId: null, channels: [] };
  }
};

export const saveChannels = (rootDir: string, creds: YoutubeCredentials): void => {
  const credsPath = youtubeCredsPath(rootDir);
  if (creds.channels.length === 0) {
    if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);
    return;
  }
  fs.mkdirSync(path.dirname(credsPath), { recursive: true });
  fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
};

export const getActiveChannel = (creds: YoutubeCredentials): YoutubeChannel | null =>
  creds.channels.find((c) => c.channelId === creds.activeChannelId) || creds.channels[0] || null;

export const upsertChannel = (
  creds: YoutubeCredentials,
  channel: YoutubeChannel
): YoutubeCredentials => {
  const channels = [...creds.channels];
  const existingIndex = channels.findIndex((c) => c.channelId === channel.channelId);
  if (existingIndex > -1) {
    channels[existingIndex] = { ...channels[existingIndex], ...channel };
  } else {
    channels.push(channel);
  }

  let activeChannelId = creds.activeChannelId;
  if (!activeChannelId || activeChannelId === "unknown" || channels.length === 1) {
    activeChannelId = channel.channelId;
  }

  return { activeChannelId, channels };
};

export const selectChannel = (
  creds: YoutubeCredentials,
  channelId: string
): YoutubeCredentials | null => {
  if (!creds.channels.some((c) => c.channelId === channelId)) return null;
  return { ...creds, activeChannelId: channelId };
};

export const removeChannel = (
  creds: YoutubeCredentials,
  channelId: string
): YoutubeCredentials => {
  const channels = creds.channels.filter((c) => c.channelId !== channelId);
  let activeChannelId = creds.activeChannelId;
  if (activeChannelId === channelId) {
    activeChannelId = channels.length > 0 ? channels[0].channelId : null;
  }
  return { activeChannelId, channels };
};
