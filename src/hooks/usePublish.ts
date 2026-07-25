// Publishing hooks: each platform's full flow (linked status, channels,
// form state, upload lifecycle) behind one interface, so panels only render.
import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectWorkspaceStore } from "../store/useProjectWorkspaceStore";
import { useVideoStore } from "../store/useVideoStore";
import { videoApi } from "../api/video";
import { deriveShortTitle } from "../lib/videoNaming";

export type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface PublishChannel {
  channelId: string;
  channelName: string;
  username?: string;
  avatarUrl?: string;
}

interface ChannelStatusApi {
  fetchStatus: () => Promise<{
    is_linked: boolean;
    channel_name: string | null;
    active_channel_id?: string | null;
    channels?: PublishChannel[];
  }>;
  selectChannel: (channelId: string) => Promise<unknown>;
}

function useChannelStatus({ fetchStatus, selectChannel }: ChannelStatusApi) {
  const [linked, setLinked] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channels, setChannels] = useState<PublishChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchStatus();
      setLinked(Boolean(res.is_linked));
      setChannelName(res.channel_name || "");
      setChannels(res.channels || []);
      setActiveChannelId(res.active_channel_id || null);
    } catch (err) {
      console.error("Error fetching publish channel status:", err);
    }
    // fetchStatus is a stable api reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = useCallback(
    async (channelId: string) => {
      try {
        await selectChannel(channelId);
        await refresh();
      } catch (err) {
        console.error("Error switching publish channel:", err);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [refresh]
  );

  return { linked, channelName, channels, activeChannelId, refresh, select };
}

function useUploadLifecycle() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const run = useCallback(async (doUpload: () => Promise<string | null>) => {
    setStatus("uploading");
    setProgress(15);
    setError(null);
    setUploadedUrl(null);
    try {
      setProgress(45);
      const url = await doUpload();
      setProgress(100);
      setStatus("success");
      setUploadedUrl(url);
    } catch (err: any) {
      setError(err?.message || "Error al subir el video");
      setStatus("error");
    }
  }, []);

  return { status, progress, error, uploadedUrl, run };
}

export function useHashtagGenerator() {
  const videoTerms = useVideoStore((s) => s.video_terms) || "";
  const videoSubject = useVideoStore((s) => s.video_subject) || "";
  const videoScript = useVideoStore((s) => s.video_script) || "";

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKeywords = (() => {
    const termsStr = Array.isArray(videoTerms) ? videoTerms.join(", ") : videoTerms;
    return Boolean(termsStr && termsStr.trim().length > 0);
  })();

  const generate = useCallback(async (): Promise<string | null> => {
    if (!hasKeywords) {
      setError("No hay palabras clave disponibles para generar hashtags.");
      return null;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await videoApi.generateHashtags({
        video_terms: videoTerms,
        video_subject: videoSubject,
        video_script: videoScript,
      });
      return res.hashtags || null;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error al generar hashtags");
      return null;
    } finally {
      setGenerating(false);
    }
  }, [hasKeywords, videoTerms, videoSubject, videoScript]);

  return { generating, error, hasKeywords, generate };
}

export function useYouTubePublish() {
  const videoUrls = useProjectWorkspaceStore((s) => s.videoUrls);
  const videoSubject = useVideoStore((s) => s.video_subject) || "";

  const channelStatus = useChannelStatus({
    fetchStatus: () => videoApi.getYouTubeStatus(),
    selectChannel: (id) => videoApi.selectYouTubeChannel(id),
  });

  const [title, setTitle] = useState(() => deriveShortTitle(videoSubject, "Mi YouTube Short"));
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">("public");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [publishDate, setPublishDate] = useState(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom.toISOString().split("T")[0]; // YYYY-MM-DD
  });
  const [publishTime, setPublishTime] = useState("12:00");

  const lifecycle = useUploadLifecycle();

  const hashtags = useHashtagGenerator();
  const [autoLoading, setAutoLoading] = useState(false);
  const autoDone = useRef(false);

  // Auto-populate the description with generated hashtags once per session.
  useEffect(() => {
    if (!channelStatus.linked || !hashtags.hasKeywords || autoDone.current) return;
    autoDone.current = true;
    setAutoLoading(true);
    void hashtags
      .generate()
      .then((tags) => {
        if (tags) setDescription(tags);
      })
      .finally(() => setAutoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelStatus.linked, hashtags.hasKeywords]);

  const upload = useCallback(async () => {
    if (!channelStatus.linked || videoUrls.length === 0) return;
    await lifecycle.run(async () => {
      let publishAt: string | undefined = undefined;
      if (mode === "schedule") {
        const [year, month, day] = publishDate.split("-").map(Number);
        const [hour, minute] = publishTime.split(":").map(Number);
        publishAt = new Date(year, month - 1, day, hour, minute).toISOString();
      }
      const res = await videoApi.uploadToYouTube({
        videoUrl: videoUrls[0],
        title: title || "YouTube Short",
        description: description || "",
        privacyStatus: mode === "now" ? privacy : "private",
        publishAt,
      });
      return res.url;
    });
  }, [channelStatus.linked, videoUrls, lifecycle, mode, publishDate, publishTime, title, description, privacy]);

  return {
    linked: channelStatus.linked,
    channelName: channelStatus.channelName,
    channels: channelStatus.channels,
    activeChannelId: channelStatus.activeChannelId,
    selectChannel: channelStatus.select,
    refreshStatus: channelStatus.refresh,
    title,
    setTitle,
    description,
    setDescription,
    privacy,
    setPrivacy,
    mode,
    setMode,
    publishDate,
    setPublishDate,
    publishTime,
    setPublishTime,
    status: lifecycle.status,
    progress: lifecycle.progress,
    error: lifecycle.error,
    uploadedUrl: lifecycle.uploadedUrl,
    upload,
    hashtagsGenerating: hashtags.generating,
    hashtagsAutoLoading: autoLoading,
    hashtagsError: hashtags.error,
    generateHashtags: hashtags.generate,
  };
}

export function useTikTokPublish() {
  const videoUrls = useProjectWorkspaceStore((s) => s.videoUrls);
  const videoSubject = useVideoStore((s) => s.video_subject) || "";

  const channelStatus = useChannelStatus({
    fetchStatus: () => videoApi.getTikTokStatus(),
    selectChannel: (id) => videoApi.selectTikTokChannel(id),
  });

  const [title, setTitle] = useState(() => deriveShortTitle(videoSubject, "Mi TikTok Video"));
  const lifecycle = useUploadLifecycle();

  const upload = useCallback(async () => {
    if (!channelStatus.linked || videoUrls.length === 0) return;
    await lifecycle.run(async () => {
      const res = await videoApi.uploadToTikTok({
        videoUrl: videoUrls[0],
        title: title || "TikTok Video",
      });
      return res.url || null;
    });
  }, [channelStatus.linked, videoUrls, lifecycle, title]);

  return {
    linked: channelStatus.linked,
    channelName: channelStatus.channelName,
    channels: channelStatus.channels,
    activeChannelId: channelStatus.activeChannelId,
    selectChannel: channelStatus.select,
    refreshStatus: channelStatus.refresh,
    title,
    setTitle,
    status: lifecycle.status,
    progress: lifecycle.progress,
    error: lifecycle.error,
    uploadedUrl: lifecycle.uploadedUrl,
    upload,
  };
}
