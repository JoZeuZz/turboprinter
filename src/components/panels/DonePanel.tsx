// webui-react/src/components/panels/DonePanel.tsx
import { useState } from "react";
import { Download, RotateCcw, CheckCircle2, Youtube, Loader2, SlidersHorizontal, Scissors, Sparkles, Music as Tiktok } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Input, Textarea, Select, TabBar } from "../ui";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";
import { useYouTubePublish, useTikTokPublish } from "../../hooks/usePublish";
import { deriveDownloadFilename, deriveShortTitle } from "../../lib/videoNaming";

function updateDescriptionHashtags(existingText: string, newHashtags: string): string {
  if (!existingText.trim()) return newHashtags;
  const firstHashIndex = existingText.indexOf("#");
  if (firstHashIndex !== -1) {
    const introText = existingText.substring(0, firstHashIndex).trim();
    return introText ? `${introText}\n\n${newHashtags}` : newHashtags;
  }
  return `${existingText.trim()}\n\n${newHashtags}`;
}

export function DonePanel() {
  const { t } = useTranslation();
  const { videoUrls, reset, setPanel, setActivePartIndex } = useProjectWorkspaceStore();

  const youtube = useYouTubePublish();
  const tiktok = useTikTokPublish();

  const videoStore = useVideoStore();
  const videoSubject = videoStore.video_subject || "";
  const isMultiPart = Boolean((videoStore.is_multi_part && (videoStore.multi_part_count ?? 1) > 1) || videoUrls.length > 1);
  const multiPartCount = isMultiPart ? (videoStore.multi_part_count || videoUrls.length || 2) : 1;

  const [selectedPart, setSelectedPart] = useState<number | "all">(1);
  const [targetVideoUrl, setTargetVideoUrl] = useState<string | null>(null);
  const [targetPartNum, setTargetPartNum] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTiktokModalOpen, setIsTiktokModalOpen] = useState(false);

  // Automatically update youtube/tiktok default title when active part changes
  const currentPartNum = typeof selectedPart === "number" ? selectedPart : 1;

  const activeYtState = youtube.getPartState(currentPartNum);
  const activeTtState = tiktok.getPartState(currentPartNum);

  const handleOpenYoutubeModal = (partIndex?: number) => {
    const partToUse = partIndex !== undefined ? partIndex : currentPartNum;
    setTargetPartNum(partToUse);
    const urlToUse = videoUrls[partToUse - 1] || videoUrls[0];
    setTargetVideoUrl(urlToUse);
    const baseTitle = videoStore.selected_title || deriveShortTitle(videoSubject, "Mi Short");
    if (isMultiPart) {
      youtube.setTitle(`${baseTitle} (Parte ${partToUse}/${multiPartCount})`);
      const isFinalPart = partToUse >= multiPartCount;
      const ctaText = isFinalPart
        ? "Suscríbete para no perderte más historias."
        : "Suscríbete para no perderte las siguientes partes.";
      youtube.setDescription(
        `📌 Parte ${partToUse} de ${multiPartCount}. ${ctaText}\n\n#HistoriasDeReddit #CasosReales #Suspenso #Shorts #Viral`
      );
    } else {
      youtube.setTitle(baseTitle);
      youtube.setDescription(
        `Suscríbete para más historias impactantes.\n\n#HistoriasDeReddit #CasosReales #Suspenso #Shorts #Viral`
      );
    }
    setIsModalOpen(true);
  };

  const handleOpenTiktokModal = (partIndex?: number) => {
    const partToUse = partIndex !== undefined ? partIndex : currentPartNum;
    setTargetPartNum(partToUse);
    const urlToUse = videoUrls[partToUse - 1] || videoUrls[0];
    setTargetVideoUrl(urlToUse);
    const baseTitle = videoStore.selected_title || deriveShortTitle(videoSubject, "Mi Video");
    if (isMultiPart) {
      tiktok.setTitle(
        `${baseTitle} (Parte ${partToUse}/${multiPartCount}) #HistoriasDeReddit #CasosReales #Suspenso #Shorts #Viral`
      );
    } else {
      tiktok.setTitle(`${baseTitle} #HistoriasDeReddit #CasosReales #Suspenso #Shorts #Viral`);
    }
    setIsTiktokModalOpen(true);
  };

  const handleBack = () => setPanel("config");
  const handleEditClips = () => setPanel("editor");
  const handleMakeAnother = () => {
    reset();
    setPanel("script");
  };

  const handleGenerateHashtags = async () => {
    const tags = await youtube.generateHashtags();
    if (!tags) return;

    if (isTiktokModalOpen) {
      const currentTitle = tiktok.title || "";
      const updated = updateDescriptionHashtags(currentTitle, tags);
      tiktok.setTitle(updated);
    } else {
      const currentDesc = youtube.description || "";
      const updated = updateDescriptionHashtags(currentDesc, tags);
      youtube.setDescription(updated);
    }
  };

  const downloadFilename = deriveDownloadFilename(videoSubject);

  return (
    <div className="flex min-h-full h-full w-full max-w-4xl mx-auto flex-col items-center justify-start gap-4 px-4 py-6 text-center overflow-y-auto min-h-0">
      {isMultiPart && multiPartCount > 1 && videoUrls.length > 0 && (
        <div className="flex items-center justify-center gap-2 bg-surface/80 p-1.5 rounded-xl border border-border shrink-0">
          <span className="text-xs font-semibold text-muted-foreground px-2">Seleccionar Parte:</span>
          {Array.from({ length: multiPartCount }).map((_, idx) => {
            const partNum = idx + 1;
            const isActive = selectedPart === partNum;
            return (
              <button
                key={partNum}
                type="button"
                onClick={() => {
                  setSelectedPart(partNum);
                  setActivePartIndex(partNum);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? "bg-accent text-white shadow-xs"
                    : "bg-transparent text-muted hover:text-foreground"
                }`}
              >
                Parte {partNum}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedPart("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedPart === "all"
                ? "bg-accent text-white shadow-xs"
                : "bg-transparent text-muted hover:text-foreground"
            }`}
          >
            Ver Todas las Partes
          </button>
        </div>
      )}

      {videoUrls.length === 0 ? (
        <div className="flex min-h-[300px] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-sm text-muted-foreground gap-3 shrink-0">
          <Loader2 className="h-10 w-10 text-muted/40 animate-pulse" />
          <span>{t("panels.done.none")}</span>
        </div>
      ) : (
        (() => {
          const videoAspect = useVideoStore.getState().video_aspect ?? "9:16";
          let aspectClass = "aspect-[9/16]";
          let maxWidthClass = "max-w-[300px] sm:max-w-[320px]";
          if (videoAspect === "16:9") {
            aspectClass = "aspect-video";
            maxWidthClass = "max-w-xl sm:max-w-2xl";
          } else if (videoAspect === "1:1") {
            aspectClass = "aspect-square";
            maxWidthClass = "max-w-sm sm:max-w-md";
          }

          const visibleVideoIndices = selectedPart === "all"
            ? videoUrls.map((_, i) => i)
            : [Math.min(Math.max((selectedPart as number) - 1, 0), videoUrls.length - 1)];

          return visibleVideoIndices.map((index) => {
            const rawUrl = videoUrls[index] || videoUrls[0];
            const partNum = index + 1;
            const filename = downloadFilename.includes(".")
              ? downloadFilename.replace(/(\.[\w]+)$/, `_parte${partNum}$1`)
              : `${downloadFilename}_parte${partNum}.mp4`;
            const videoSrc = rawUrl ? (rawUrl.includes("?") ? rawUrl : `${rawUrl}?v=${Date.now()}`) : "";

            return (
              <div
                key={`${rawUrl}-${index}`}
                className={`w-full ${maxWidthClass} shrink-0 mx-auto rounded-2xl overflow-hidden border border-border bg-neutral-900/60 shadow-2xl p-2.5 transition-all duration-300 hover:shadow-accent/5 hover:border-accent/20`}
              >

                <div className={`relative w-full shrink-0 rounded-xl overflow-hidden bg-black flex items-center justify-center ${aspectClass}`}>
                  <video
                    key={videoSrc}
                    src={videoSrc}
                    controls
                    preload="auto"
                    playsInline
                    {...{ referrerPolicy: "no-referrer" }}
                    className="w-full h-full object-contain mx-auto block rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-3 border-t border-border/50 mt-2 bg-surface/30 rounded-lg">
                  <span className="text-xs font-medium text-foreground truncate max-w-[180px]">
                    {filename}
                  </span>
                  <a
                    href={rawUrl}
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
        <div className="w-full max-w-3xl space-y-4">
          {/* YouTube Upload Status Card */}
          {(activeYtState.status !== "idle" || activeYtState.error) && (
            <div className={`rounded-xl border p-4 text-left transition-all duration-300 max-w-md mx-auto ${
              activeYtState.status === "uploading"
                ? "bg-accent/5 border-accent/20 animate-pulse"
                : activeYtState.status === "error"
                ? "bg-red-500/5 border-red-500/20"
                : "bg-green-500/5 border-green-500/20"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">
                  {activeYtState.status === "uploading"
                    ? `Subiendo Parte ${currentPartNum} a YouTube (${activeYtState.progress}%)`
                    : activeYtState.status === "error"
                    ? `Error en subida de Parte ${currentPartNum} a YouTube`
                    : `Parte ${currentPartNum} subida a YouTube con éxito`
                  }
                </span>
                {activeYtState.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : activeYtState.status === "error" ? (
                  <span className="text-red-500 text-xs">❌</span>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              {activeYtState.status === "uploading" && (
                <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-accent h-full transition-all duration-300 ease-out"
                    style={{ width: `${activeYtState.progress}%` }}
                  />
                </div>
              )}
              {activeYtState.status === "success" && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("panels.review.uploadChannelInfo", { channel: youtube.channelName })}
                  </p>
                  {activeYtState.uploadedUrl && (
                    <a
                      href={activeYtState.uploadedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-semibold text-accent hover:underline mt-1 bg-accent/10 px-2 py-1 rounded"
                    >
                      🔗 Ver Short en YouTube
                    </a>
                  )}
                </div>
              )}
              {activeYtState.status === "error" && (
                <p className="text-xs text-red-400 font-medium">
                  {activeYtState.error}
                </p>
              )}
            </div>
          )}

          {/* TikTok Upload Status Card */}
          {(activeTtState.status !== "idle" || activeTtState.error) && (
            <div className={`rounded-xl border p-4 text-left transition-all duration-300 max-w-md mx-auto ${
              activeTtState.status === "uploading"
                ? "bg-cyan-500/5 border-cyan-500/20 animate-pulse"
                : activeTtState.status === "error"
                ? "bg-red-500/5 border-red-500/20"
                : "bg-green-500/5 border-green-500/20"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">
                  {activeTtState.status === "uploading"
                    ? `Subiendo Parte ${currentPartNum} a TikTok (${activeTtState.progress}%)`
                    : activeTtState.status === "error"
                    ? `Error en subida de Parte ${currentPartNum} a TikTok`
                    : `Parte ${currentPartNum} publicada en TikTok con éxito`
                  }
                </span>
                {activeTtState.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                ) : activeTtState.status === "error" ? (
                  <span className="text-red-500 text-xs">❌</span>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              {activeTtState.status === "uploading" && (
                <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-300 ease-out"
                    style={{ width: `${activeTtState.progress}%` }}
                  />
                </div>
              )}
              {activeTtState.status === "success" && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Subido a la cuenta de TikTok: <strong>{tiktok.channelName}</strong>
                  </p>
                  {activeTtState.uploadedUrl && (
                    <a
                      href={activeTtState.uploadedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-semibold text-cyan-400 hover:underline mt-1 bg-cyan-950/40 border border-cyan-800/40 px-2 py-1 rounded"
                    >
                      🔗 Ver Video en TikTok
                    </a>
                  )}
                </div>
              )}
              {activeTtState.status === "error" && (
                <p className="text-xs text-red-400 font-medium">
                  {activeTtState.error}
                </p>
              )}
            </div>
          )}

          {/* Unified Horizontal 5-Button Row */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 w-full pt-2">
            {/* 1. YouTube Upload */}
            <Button
              onClick={() => handleOpenYoutubeModal()}
              disabled={!youtube.linked || activeYtState.status === "uploading" || activeYtState.status === "success"}
              className={`flex items-center justify-center gap-1.5 font-medium py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs transition-all truncate whitespace-nowrap ${
                youtube.linked
                  ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
                  : "bg-muted/50 text-muted-foreground cursor-not-allowed hover:bg-muted/50 border border-border"
              }`}
              title={!youtube.linked ? t("panels.review.notLinkedYoutube") : undefined}
            >
              <Youtube className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {activeYtState.status === "success"
                  ? `Subido Parte ${currentPartNum} YouTube`
                  : activeYtState.status === "uploading"
                  ? "Subiendo..."
                  : isMultiPart
                  ? `Subir Parte ${currentPartNum} YouTube`
                  : "Subir YouTube"
                }
              </span>
            </Button>

            {/* 2. TikTok Upload */}
            <Button
              onClick={() => handleOpenTiktokModal()}
              disabled={!tiktok.linked || activeTtState.status === "uploading" || activeTtState.status === "success"}
              className={`flex items-center justify-center gap-1.5 font-medium py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs transition-all truncate whitespace-nowrap ${
                tiktok.linked
                  ? "bg-zinc-950 hover:bg-zinc-900 border border-neutral-800 text-cyan-400 focus:ring-cyan-500"
                  : "bg-muted/50 text-muted-foreground cursor-not-allowed hover:bg-muted/50 border border-border"
              }`}
              title={!tiktok.linked ? "TikTok no vinculado" : undefined}
            >
              <Tiktok className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {activeTtState.status === "success"
                  ? `Subido Parte ${currentPartNum} TikTok`
                  : activeTtState.status === "uploading"
                  ? "Subiendo..."
                  : isMultiPart
                  ? `Subir Parte ${currentPartNum} TikTok`
                  : "Subir TikTok"
                }
              </span>
            </Button>

            {/* 3. Volver a Revisión */}
            <Button
              variant="ghost"
              onClick={handleEditClips}
              className="flex items-center justify-center gap-1.5 border border-accent/20 text-accent hover:bg-accent/10 hover:text-accent-hover py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs truncate whitespace-nowrap"
            >
              <Scissors className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("panels.done.editClips") || "Volver a Revisión"}</span>
            </Button>

            {/* 4. Editar Configuración */}
            <Button
              variant="ghost"
              onClick={handleBack}
              className="flex items-center justify-center gap-1.5 border border-border hover:bg-muted py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs truncate whitespace-nowrap"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("panels.review.editSettings") || "Editar Configuración"}</span>
            </Button>

            {/* 5. Crear Otro */}
            <Button
              onClick={handleMakeAnother}
              className="flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-foreground py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-semibold transition-all truncate whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("panels.done.makeAnother") || "Crear Otro"}</span>
            </Button>
          </div>
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

            {/* TabBar to choose publishing mode */}
            <TabBar
              tabs={[
                { key: "now", label: "Publicar Ahora" },
                { key: "schedule", label: "Programar Publicación" },
              ]}
              active={youtube.mode}
              onChange={(key) => youtube.setMode(key as any)}
            />

            {youtube.channels.length > 1 && (
              <Select
                label="Subir al Canal de YouTube"
                value={youtube.activeChannelId || ""}
                onChange={(e) => youtube.selectChannel(e.target.value)}
                options={youtube.channels.map((ch) => ({ value: ch.channelId, label: ch.channelName }))}
                className="text-xs font-medium"
              />
            )}

            {youtube.channels.length === 1 && (
              <div className="text-[11px] bg-neutral-950/40 border border-neutral-800/80 px-3 py-2 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">Canal destino:</span>
                <span className="text-zinc-200 font-bold">{youtube.channels[0].channelName}</span>
              </div>
            )}

            <Input
              label="Título del Short (Máx 100 caracteres)"
              value={youtube.title}
              onChange={(e) => youtube.setTitle(e.target.value.substring(0, 100))}
              placeholder="Introduce un título llamativo"
              className="text-xs"
            />

            <div className="flex flex-col gap-1.5">
              <Textarea
                label="Descripción del Short (Solo Hashtags)"
                value={youtube.description}
                onChange={(e) => youtube.setDescription(e.target.value)}
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
                  onClick={handleGenerateHashtags}
                  disabled={youtube.hashtagsGenerating || youtube.hashtagsAutoLoading}
                >
                  {youtube.hashtagsGenerating || youtube.hashtagsAutoLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Generar Hashtags con IA (Palabras Clave)
                </Button>
                {youtube.hashtagsAutoLoading && (
                  <span className="text-[10px] text-muted-foreground animate-pulse">
                    Autogenerando hashtags...
                  </span>
                )}
              </div>
              {youtube.hashtagsError && (
                <p className="text-[10px] text-red-400">{youtube.hashtagsError}</p>
              )}
            </div>

            {youtube.mode === "now" ? (
              <Select
                label="Visibilidad en YouTube"
                value={youtube.privacy}
                onChange={(e) => youtube.setPrivacy(e.target.value as any)}
                options={[
                  { value: "private", label: "Privado (Solo tú)" },
                  { value: "unlisted", label: "Oculto (Cualquiera con el enlace)" },
                  { value: "public", label: "Público (Todo el mundo)" },
                ]}
                className="text-xs"
              />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="Fecha de Publicación"
                    value={youtube.publishDate}
                    onChange={(e) => youtube.setPublishDate(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    type="time"
                    label="Hora de Publicación"
                    value={youtube.publishTime}
                    onChange={(e) => youtube.setPublishTime(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="text-[11px] text-zinc-400 bg-neutral-950/40 border border-neutral-800/80 p-3 rounded-xl flex flex-col gap-1 leading-relaxed">
                  <span className="text-zinc-300 font-semibold flex items-center gap-1">
                    ⏰ Programación:
                  </span>
                  <span>
                    El video se subirá inicialmente en estado <strong>Privado</strong> y se publicará como <strong>Público</strong> de forma automática en el momento indicado (con respecto a tu hora local).
                  </span>
                </div>
              </div>
            )}

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
                  youtube.upload(targetVideoUrl || undefined, targetPartNum);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 h-9"
              >
                {youtube.mode === "now" ? "Confirmar y Subir" : "Confirmar y Programar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TikTok Detail Form Pop-up Modal */}
      {isTiktokModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-left space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Tiktok className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Detalles del Video de TikTok
                </h3>
              </div>
              <button
                onClick={() => setIsTiktokModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2 py-1 rounded hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            {tiktok.channels.length > 1 && (
              <Select
                label="Subir a la Cuenta de TikTok"
                value={tiktok.activeChannelId || ""}
                onChange={(e) => tiktok.selectChannel(e.target.value)}
                options={tiktok.channels.map((ch) => ({ value: ch.channelId, label: ch.channelName }))}
                className="text-xs font-medium"
              />
            )}

            {tiktok.channels.length === 1 && (
              <div className="text-[11px] bg-neutral-950/40 border border-neutral-800/80 px-3 py-2 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">Cuenta de destino:</span>
                <span className="text-zinc-200 font-bold">{tiktok.channels[0].channelName}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Textarea
                label="Texto de Publicación / Descripción del Video"
                value={tiktok.title}
                onChange={(e) => tiktok.setTitle(e.target.value)}
                placeholder="Añade descripción y hashtags para TikTok"
                rows={4}
                className="text-xs"
              />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-7 text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-2 bg-cyan-950/20 hover:bg-cyan-900/30 border border-cyan-800/20 rounded-md"
                  onClick={handleGenerateHashtags}
                  disabled={youtube.hashtagsGenerating || youtube.hashtagsAutoLoading}
                >
                  {youtube.hashtagsGenerating || youtube.hashtagsAutoLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Generar Hashtags con IA
                </Button>
                {youtube.hashtagsAutoLoading && (
                  <span className="text-[10px] text-muted-foreground animate-pulse">
                    Autogenerando hashtags...
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 bg-neutral-950/40 border border-neutral-800/80 p-3 rounded-xl flex flex-col gap-1 leading-relaxed">
              <span className="text-zinc-300 font-semibold flex items-center gap-1">
                📌 Nota de TikTok API:
              </span>
              <span>
                El video se subirá a tu bandeja de borradores en tu app de TikTok, donde podrás publicarlo inmediatamente de forma segura y directa.
              </span>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-neutral-800">
              <Button
                variant="ghost"
                onClick={() => setIsTiktokModalOpen(false)}
                className="text-xs py-1.5 h-9"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setIsTiktokModalOpen(false);
                  tiktok.upload(targetVideoUrl || undefined, targetPartNum);
                }}
                className="bg-cyan-500 hover:bg-cyan-600 text-zinc-950 text-xs py-1.5 h-9 font-bold"
              >
                Confirmar y Subir a TikTok
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
