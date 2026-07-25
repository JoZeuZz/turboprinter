// Backend-only repository for TikTok account credentials, symmetric to
// youtubeChannels.ts. Owns the storage/tiktok-credentials.json format,
// including the domain-verification metadata that must survive account
// linking/unlinking, and legacy files that only carried a root channelName.

import fs from "fs";
import path from "path";

export interface TiktokChannel {
  channelId: string;
  channelName: string;
  username?: string;
  avatarUrl?: string;
  tokens: Record<string, any>;
}

export interface TiktokCredentials {
  activeChannelId: string | null;
  channels: TiktokChannel[];
  verification_filename?: string;
  verification_content?: string;
  legacyAccountName?: string;
}

export const tiktokCredsPath = (rootDir: string): string =>
  path.join(rootDir, "storage", "tiktok-credentials.json");

export const loadTiktokChannels = (rootDir: string = process.cwd()): TiktokCredentials => {
  const credsPath = tiktokCredsPath(rootDir);
  if (!fs.existsSync(credsPath)) {
    return { activeChannelId: null, channels: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    const creds: TiktokCredentials = {
      activeChannelId: data.activeChannelId || null,
      channels: data.channels || [],
    };
    if (data.verification_filename) creds.verification_filename = data.verification_filename;
    if (data.verification_content) creds.verification_content = data.verification_content;
    if (creds.channels.length === 0 && data.channelName) {
      creds.legacyAccountName = data.channelName;
    }
    return creds;
  } catch {
    return { activeChannelId: null, channels: [] };
  }
};

export const saveTiktokChannels = (rootDir: string, creds: TiktokCredentials): void => {
  const credsPath = tiktokCredsPath(rootDir);
  const hasVerification = Boolean(creds.verification_filename || creds.verification_content);
  if (creds.channels.length === 0 && !hasVerification) {
    if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);
    return;
  }
  const data: Record<string, unknown> = {
    activeChannelId: creds.activeChannelId,
    channels: creds.channels,
  };
  if (creds.verification_filename) data.verification_filename = creds.verification_filename;
  if (creds.verification_content) data.verification_content = creds.verification_content;
  fs.mkdirSync(path.dirname(credsPath), { recursive: true });
  fs.writeFileSync(credsPath, JSON.stringify(data, null, 2));
};

export const getActiveTiktokChannel = (creds: TiktokCredentials): TiktokChannel | null =>
  creds.channels.find((c) => c.channelId === creds.activeChannelId) || creds.channels[0] || null;

export const upsertTiktokChannel = (
  creds: TiktokCredentials,
  channel: TiktokChannel
): TiktokCredentials => {
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

  return { ...creds, activeChannelId, channels };
};

export const selectTiktokChannel = (
  creds: TiktokCredentials,
  channelId: string
): TiktokCredentials | null => {
  if (!creds.channels.some((c) => c.channelId === channelId)) return null;
  return { ...creds, activeChannelId: channelId };
};

export const removeTiktokChannel = (
  creds: TiktokCredentials,
  channelId: string
): TiktokCredentials => {
  const channels = creds.channels.filter((c) => c.channelId !== channelId);
  let activeChannelId = creds.activeChannelId;
  if (activeChannelId === channelId) {
    activeChannelId = channels.length > 0 ? channels[0].channelId : null;
  }
  return { ...creds, activeChannelId, channels };
};

export const setTiktokVerification = (
  creds: TiktokCredentials,
  update: { filename?: string; content?: string }
): TiktokCredentials => {
  const next = { ...creds };
  if (update.filename !== undefined) next.verification_filename = update.filename;
  if (update.content !== undefined) next.verification_content = update.content;
  return next;
};

export const clearTiktokCredentials = (rootDir: string): void => {
  const credsPath = tiktokCredsPath(rootDir);
  if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);
};

// Writes the domain-verification file where the static servers can serve it
// (public/ in dev, dist/ in production builds). No-op without full metadata.
export const writeTiktokVerificationFiles = (
  rootDir: string,
  creds: TiktokCredentials
): void => {
  const filename = creds.verification_filename;
  const content = creds.verification_content;
  if (!filename || !content) return;

  for (const dir of ["public", "dist"]) {
    try {
      const filePath = path.join(rootDir, dir, filename);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf8");
    } catch (err) {
      console.error(`[TikTok] Failed to write verification file to ${dir}/`, err);
    }
  }
};
