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
  const selectedTitle = useVideoStore((s) => s.selected_title) || "";
  const genDescription = useVideoStore((s) => s.generated_description) || "";
  const genTags = useVideoStore((s) => s.generated_tags) || "";

  const channelStatus = useChannelStatus({
    fetchStatus: () => videoApi.getYouTubeStatus(),
    selectChannel: (id) => videoApi.selectYouTubeChannel(id),
  });

  const [title, setTitle] = useState(() => selectedTitle || deriveShortTitle(videoSubject, "Mi YouTube Short"));
  const [description, setDescription] = useState(() => genDescription);
  const [tags, setTags] = useState(() => genTags);

  useEffect(() => {
    if (selectedTitle) {
      setTitle(selectedTitle);
    }
  }, [selectedTitle]);

  useEffect(() => {
    if (genDescription) {
      setDescription(genDescription);
    }
  }, [genDescription]);

  useEffect(() => {
    if (genTags) {
      setTags(genTags);
    }
  }, [genTags]);
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">("public");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [publishDate, setPublishDate] = useState(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom.toISOString().split("T")[0]; // YYYY-MM-DD
  });
  const [publishTime, setPublishTime] = useState("12:00");

  const [partStates, setPartStates] = useState<
    Record<
      string,
      {
        status: UploadStatus;
        progress: number;
        error: string | null;
        uploadedUrl: string | null;
      }
    >
  >({});

  const getPartState = useCallback(
    (key?: string | number) => {
      const k = key !== undefined ? String(key) : "1";
      return partStates[k] || { status: "idle", progress: 0, error: null, uploadedUrl: null };
    },
    [partStates]
  );

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

  const upload = useCallback(
    async (customVideoUrl?: string, partKey?: string | number) => {
      if (!channelStatus.linked || videoUrls.length === 0) return;
      const targetUrl = customVideoUrl || videoUrls[0];
      const key = String(partKey !== undefined ? partKey : customVideoUrl || 1);

      setPartStates((prev) => ({
        ...prev,
        [key]: { status: "uploading", progress: 15, error: null, uploadedUrl: null },
      }));

      try {
        setPartStates((prev) => ({
          ...prev,
          [key]: { status: "uploading", progress: 45, error: null, uploadedUrl: null },
        }));

        let publishAt: string | undefined = undefined;
        if (mode === "schedule") {
          const [year, month, day] = publishDate.split("-").map(Number);
          const [hour, minute] = publishTime.split(":").map(Number);
          publishAt = new Date(year, month - 1, day, hour, minute).toISOString();
        }

        const res = await videoApi.uploadToYouTube({
          videoUrl: targetUrl,
          title: title || "YouTube Short",
          description: description || "",
          tags: tags || undefined,
          privacyStatus: mode === "now" ? privacy : "private",
          publishAt,
        });

        setPartStates((prev) => ({
          ...prev,
          [key]: { status: "success", progress: 100, error: null, uploadedUrl: res.url },
        }));
      } catch (err: any) {
        setPartStates((prev) => ({
          ...prev,
          [key]: {
            status: "error",
            progress: 0,
            error: err?.message || "Error al subir el video",
            uploadedUrl: null,
          },
        }));
      }
    },
    [channelStatus.linked, videoUrls, mode, publishDate, publishTime, title, description, tags, privacy]
  );

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
    tags,
    setTags,
    privacy,
    setPrivacy,
    mode,
    setMode,
    publishDate,
    setPublishDate,
    publishTime,
    setPublishTime,
    getPartState,
    status: getPartState(1).status,
    progress: getPartState(1).progress,
    error: getPartState(1).error,
    uploadedUrl: getPartState(1).uploadedUrl,
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

  const [partStates, setPartStates] = useState<
    Record<
      string,
      {
        status: UploadStatus;
        progress: number;
        error: string | null;
        uploadedUrl: string | null;
      }
    >
  >({});

  const getPartState = useCallback(
    (key?: string | number) => {
      const k = key !== undefined ? String(key) : "1";
      return partStates[k] || { status: "idle", progress: 0, error: null, uploadedUrl: null };
    },
    [partStates]
  );

  const upload = useCallback(
    async (customVideoUrl?: string, partKey?: string | number) => {
      if (!channelStatus.linked || videoUrls.length === 0) return;
      const targetUrl = customVideoUrl || videoUrls[0];
      const key = String(partKey !== undefined ? partKey : customVideoUrl || 1);

      setPartStates((prev) => ({
        ...prev,
        [key]: { status: "uploading", progress: 15, error: null, uploadedUrl: null },
      }));

      try {
        setPartStates((prev) => ({
          ...prev,
          [key]: { status: "uploading", progress: 45, error: null, uploadedUrl: null },
        }));

        const res = await videoApi.uploadToTikTok({
          videoUrl: targetUrl,
          title: title || "TikTok Video",
        });

        setPartStates((prev) => ({
          ...prev,
          [key]: { status: "success", progress: 100, error: null, uploadedUrl: res.url || null },
        }));
      } catch (err: any) {
        setPartStates((prev) => ({
          ...prev,
          [key]: {
            status: "error",
            progress: 0,
            error: err?.message || "Error al subir el video",
            uploadedUrl: null,
          },
        }));
      }
    },
    [channelStatus.linked, videoUrls, title]
  );

  return {
    linked: channelStatus.linked,
    channelName: channelStatus.channelName,
    channels: channelStatus.channels,
    activeChannelId: channelStatus.activeChannelId,
    selectChannel: channelStatus.select,
    refreshStatus: channelStatus.refresh,
    title,
    setTitle,
    getPartState,
    status: getPartState(1).status,
    progress: getPartState(1).progress,
    error: getPartState(1).error,
    uploadedUrl: getPartState(1).uploadedUrl,
    upload,
  };
}
