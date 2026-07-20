// webui-react/src/components/panels/DonePanel.tsx
import { useState, useEffect } from "react";
import { Download, RotateCcw, CheckCircle2, Youtube, Loader2, SlidersHorizontal, Scissors, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Input, Textarea, Select } from "../ui";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useConfigStore } from "../../store/useConfigStore";
import { useVideoStore } from "../../store/useVideoStore";
import { videoApi } from "../../api/video";

export function DonePanel() {
  const { t } = useTranslation();
  const { videoUrls, reset, setPanel } = useProjectWorkspaceStore();
  const { config } = useConfigStore();

  const isYoutubeLinked = !!config?.settings?.youtube?.is_linked;
  const youtubeChannel = config?.settings?.youtube?.channel_name || "";

  const videoSubject = useVideoStore((s) => s.video_subject) || "";
  const videoScript = useVideoStore((s) => s.video_script) || "";
  const videoTerms = useVideoStore((s) => s.video_terms) || "";

  const getInitialTitle = (subject: string) => {
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

    return name.trim().substring(0, 100);
  };

  const [ytTitle, setYtTitle] = useState(() => {
    const cleaned = getInitialTitle(videoSubject);
    return cleaned || "Mi YouTube Short";
  });
  const [ytDescription, setYtDescription] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState<"private" | "unlisted" | "public">("public");

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const [loadingAutoHashtags, setLoadingAutoHashtags] = useState(false);
  const [generatingHashtags, setGeneratingHashtags] = useState(false);
  const [hashtagsError, setHashtagsError] = useState<string | null>(null);

  // Auto-generate hashtags on mount (Option 1)
  useEffect(() => {
    if (!isYoutubeLinked) return;
    const termsStr = Array.isArray(videoTerms) ? videoTerms.join(", ") : videoTerms;
    if (!termsStr || termsStr.trim().length === 0) return;

    const fetchAutoHashtags = async () => {
      setLoadingAutoHashtags(true);
      try {
        const res = await videoApi.generateHashtags({
          video_terms: videoTerms,
          video_subject: videoSubject,
          video_script: videoScript,
        });
        if (res.hashtags) {
          setYtDescription(res.hashtags);
        }
      } catch (err) {
        console.error("Error auto-generating hashtags on mount:", err);
      } finally {
        setLoadingAutoHashtags(false);
      }
    };
    fetchAutoHashtags();
  }, [isYoutubeLinked, videoTerms, videoSubject, videoScript]);

  const handleGenerateHashtagsManual = async () => {
    const termsStr = Array.isArray(videoTerms) ? videoTerms.join(", ") : videoTerms;
    if (!termsStr || termsStr.trim().length === 0) {
      setHashtagsError("No hay palabras clave disponibles para generar hashtags.");
      return;
    }
    setGeneratingHashtags(true);
    setHashtagsError(null);
    try {
      const res = await videoApi.generateHashtags({
        video_terms: videoTerms,
        video_subject: videoSubject,
        video_script: videoScript,
      });
      if (res.hashtags) {
        setYtDescription(res.hashtags);
      }
    } catch (err: any) {
      console.error(err);
      setHashtagsError(err.message || "Error al generar hashtags");
    } finally {
      setGeneratingHashtags(false);
    }
  };

  const handleYoutubeUpload = async () => {
    if (!isYoutubeLinked || videoUrls.length === 0) return;
    setUploadStatus("uploading");
    setUploadProgress(15);
    setUploadError(null);
    setUploadedUrl(null);

    try {
      const videoUrl = videoUrls[0];
      setUploadProgress(45);
      const res = await videoApi.uploadToYouTube({
        videoUrl,
        title: ytTitle || "YouTube Short",
        description: ytDescription || "",
        privacyStatus,
      });
      setUploadProgress(100);
      setUploadStatus("success");
      setUploadedUrl(res.url);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Error al subir video a YouTube");
      setUploadStatus("error");
    }
  };

  const handleBack = () => {
    setPanel("config");
  };

  const handleEditClips = () => {
    setPanel("editor");
  };

  const handleMakeAnother = () => {
    reset();
    setPanel("script");
  };

  const getDownloadFilename = () => {
    let name = videoSubject;
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

    name = name.trim();
    if (!name) {
      return "video.mp4";
    }

    // Sanitize characters not allowed in file names
    const sanitized = name.replace(/[\\/:*?"<>|]/g, "").trim();
    return sanitized ? `${sanitized}.mp4` : "video.mp4";
  };

  const downloadFilename = getDownloadFilename();

  return (
    <div className="flex h-full w-full max-w-4xl mx-auto flex-col items-center justify-center gap-6 px-6 py-8 text-center">
      <div className="space-y-2 max-w-xl">
        <div className="flex items-center justify-center gap-2 text-green-400">
          <CheckCircle2 className="h-6 w-6" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t("panels.done.ready")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("panels.review.taskReviewDescription")}</p>
      </div>

      {videoUrls.length === 0 ? (
        <div className="flex min-h-[300px] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-sm text-muted-foreground gap-3">
          <Loader2 className="h-10 w-10 text-muted/40 animate-pulse" />
          <span>{t("panels.done.none")}</span>
        </div>
      ) : (
        (() => {
          const videoAspect = useVideoStore.getState().video_aspect ?? "9:16";
          let aspectClass = "aspect-[9/16] max-h-[500px]";
          let maxWidthClass = "max-w-sm sm:max-w-md";
          if (videoAspect === "16:9") {
            aspectClass = "aspect-video max-h-[420px]";
            maxWidthClass = "max-w-xl sm:max-w-2xl";
          } else if (videoAspect === "1:1") {
            aspectClass = "aspect-square max-h-[450px]";
            maxWidthClass = "max-w-sm sm:max-w-md";
          }

          return videoUrls.map((url, index) => {
            const filename = videoUrls.length > 1 
              ? downloadFilename.replace(".mp4", `_${index + 1}.mp4`) 
              : downloadFilename;

            return (
              <div
                key={url}
                className={`w-full ${maxWidthClass} mx-auto rounded-2xl overflow-hidden border border-border bg-neutral-900/60 shadow-2xl p-2 transition-all duration-300 hover:shadow-accent/5 hover:border-accent/20`}
              >
                <div className={`relative rounded-xl overflow-hidden bg-black flex items-center justify-center ${aspectClass}`} style={{ display: "contents" }}>
                  <video
                    src={url}
                    controls
                    {...{ referrerPolicy: "no-referrer" }}
                    className="w-full h-full object-contain mx-auto block"
                  />
                </div>
                <div className="flex items-center justify-center gap-2 px-3 py-3 border-t border-border/50 mt-2 bg-surface/30 rounded-lg">
                  <a
                    href={url}
                    download={filename}
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-medium bg-accent/10 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t("common.download")}
                  </a>
                </div>
              </div>
            );
          });
        })()
      )}

      {videoUrls.length > 0 && (
        <div className="w-full max-w-md space-y-4">
          {/* YouTube Upload Status Card */}
          {(uploadStatus !== "idle" || uploadError) && (
            <div className={`rounded-xl border p-4 text-left transition-all duration-300 ${
              uploadStatus === "uploading" 
                ? "bg-accent/5 border-accent/20 animate-pulse" 
                : uploadStatus === "error"
                ? "bg-red-500/5 border-red-500/20"
                : "bg-green-500/5 border-green-500/20"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">
                  {uploadStatus === "uploading" 
                    ? `Subiendo a YouTube (${uploadProgress}%)`
                    : uploadStatus === "error"
                    ? "Error en la subida"
                    : t("panels.review.uploadSuccess")
                  }
                </span>
                {uploadStatus === "uploading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : uploadStatus === "error" ? (
                  <span className="text-red-500 text-xs">❌</span>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              {uploadStatus === "uploading" && (
                <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-accent h-full transition-all duration-300 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              {uploadStatus === "success" && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("panels.review.uploadChannelInfo", { channel: youtubeChannel })}
                  </p>
                  {uploadedUrl && (
                    <a
                      href={uploadedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-semibold text-accent hover:underline mt-1 bg-accent/10 px-2 py-1 rounded"
                    >
                      🔗 Ver Short en YouTube
                    </a>
                  )}
                </div>
              )}
              {uploadStatus === "error" && (
                <p className="text-xs text-red-400 font-medium">
                  {uploadError}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Button 
              variant="ghost" 
              onClick={handleEditClips}
              className="flex items-center justify-center gap-2 border-accent/20 text-accent hover:bg-accent/10 hover:text-accent-hover"
            >
              <Scissors className="h-4 w-4" />
              {t("panels.done.editClips") || "Volver a Revisión"}
            </Button>

            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="flex items-center justify-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("panels.review.editSettings")}
            </Button>

            <Button
              onClick={() => setIsModalOpen(true)}
              disabled={!isYoutubeLinked || uploadStatus === "uploading" || uploadStatus === "success"}
              className={`flex-1 flex items-center justify-center gap-2 font-medium ${
                isYoutubeLinked 
                  ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500" 
                  : "bg-muted/50 text-muted-foreground cursor-not-allowed hover:bg-muted/50 border border-border"
              }`}
              title={!isYoutubeLinked ? t("panels.review.notLinkedYoutube") : undefined}
            >
              <Youtube className="h-4 w-4" />
              {uploadStatus === "success" 
                ? t("panels.review.uploadSuccess") 
                : uploadStatus === "uploading"
                ? `Subiendo...`
                : t("panels.review.uploadToYoutube")
              }
            </Button>

            <Button 
              onClick={handleMakeAnother} 
              className="flex items-center justify-center gap-2"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {t("panels.done.makeAnother")}
            </Button>
          </div>

          {!isYoutubeLinked && (
            <p className="text-xs text-muted-foreground text-center bg-muted/30 py-2 px-4 rounded-lg border border-border/50 max-w-sm mx-auto">
              ℹ️ {t("panels.review.notLinkedYoutube")}
            </p>
          )}
        </div>
      )}

      {/* YouTube Detail Form Pop-up Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-left space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Detalles de YouTube Short
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2 py-1 rounded hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            <Input
              label="Título del Short (Máx 100 caracteres)"
              value={ytTitle}
              onChange={(e) => setYtTitle(e.target.value.substring(0, 100))}
              placeholder="Introduce un título llamativo"
              className="text-xs"
            />

            <div className="flex flex-col gap-1.5">
              <Textarea
                label="Descripción del Short (Solo Hashtags)"
                value={ytDescription}
                onChange={(e) => setYtDescription(e.target.value)}
                placeholder="Añade descripción y hashtags"
                rows={4}
                className="text-xs"
              />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-7 text-accent/80 hover:text-accent flex items-center gap-1.5 px-2 bg-accent/5 hover:bg-accent/10 border border-accent/10 rounded-md"
                  onClick={handleGenerateHashtagsManual}
                  disabled={generatingHashtags || loadingAutoHashtags}
                >
                  {generatingHashtags || loadingAutoHashtags ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Generar Hashtags con IA (Palabras Clave)
                </Button>
                {loadingAutoHashtags && (
                  <span className="text-[10px] text-muted-foreground animate-pulse">
                    Autogenerando hashtags...
                  </span>
                )}
              </div>
              {hashtagsError && (
                <p className="text-[10px] text-red-400">{hashtagsError}</p>
              )}
            </div>

            <Select
              label="Visibilidad en YouTube"
              value={privacyStatus}
              onChange={(e) => setPrivacyStatus(e.target.value as any)}
              options={[
                { value: "private", label: "Privado (Solo tú)" },
                { value: "unlisted", label: "Oculto (Cualquiera con el enlace)" },
                { value: "public", label: "Público (Todo el mundo)" },
              ]}
              className="text-xs"
            />

            <div className="flex gap-3 justify-end pt-3 border-t border-neutral-800">
              <Button 
                variant="ghost" 
                onClick={() => setIsModalOpen(false)}
                className="text-xs py-1.5 h-9"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  setIsModalOpen(false);
                  handleYoutubeUpload();
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 h-9"
              >
                Confirmar y Subir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
