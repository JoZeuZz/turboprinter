import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash } from "lucide-react";
import { configApi } from "../api/config";
import type { EditableConfig } from "../api/types";
import { Button, Checkbox, Collapsible, Input, Select, Textarea } from "../components/ui";
import { LanguageSelector } from "../components/settings/LanguageSelector";
import { useConfigStore } from "../store/useConfigStore";
import { videoApi } from "../api/video";

type SectionName = keyof EditableConfig;

const listToText = (value?: string[]) => (value ?? []).join("\n");

const textToList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const optionList = (values: string[] = []) => values.map((value) => ({ value, label: value }));

const valuesEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const changedSettings = (original: EditableConfig, draft: EditableConfig): Partial<EditableConfig> => {
  const changes: Record<string, Record<string, unknown>> = {};
  (Object.keys(draft) as SectionName[]).forEach((section) => {
    const sectionChanges: Record<string, unknown> = {};
    Object.keys(draft[section]).forEach((key) => {
      const typedKey = key as keyof EditableConfig[typeof section];
      if (!valuesEqual(original[section][typedKey], draft[section][typedKey])) {
        sectionChanges[key] = draft[section][typedKey];
      }
    });
    if (Object.keys(sectionChanges).length > 0) {
      changes[section] = sectionChanges;
    }
  });
  return changes as Partial<EditableConfig>;
};

export function Settings() {
  const { t } = useTranslation();
  const { config, setConfig } = useConfigStore();
  const [draft, setDraft] = useState<EditableConfig | null>(null);
  const [originalDraft, setOriginalDraft] = useState<EditableConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [linkingYoutube, setLinkingYoutube] = useState(false);
  const [linkingTiktok, setLinkingTiktok] = useState(false);

  const [youtubeChannels, setYoutubeChannels] = useState<Array<{ channelId: string; channelName: string }>>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const [tiktokChannels, setTiktokChannels] = useState<Array<{ channelId: string; channelName: string; username?: string; avatarUrl?: string }>>([]);
  const [activeTiktokChannelId, setActiveTiktokChannelId] = useState<string | null>(null);

  const fetchYouTubeStatus = () => {
    videoApi.getYouTubeStatus().then((res) => {
      if (res.is_linked) {
        setYoutubeChannels(res.channels || []);
        setActiveChannelId(res.active_channel_id || null);
      } else {
        setYoutubeChannels([]);
        setActiveChannelId(null);
      }
    }).catch(console.error);
  };

  const fetchTikTokStatus = () => {
    videoApi.getTikTokStatus().then((res) => {
      if (res.is_linked) {
        setTiktokChannels(res.channels || []);
        setActiveTiktokChannelId(res.active_channel_id || null);
      } else {
        setTiktokChannels([]);
        setActiveTiktokChannelId(null);
      }
    }).catch(console.error);
  };

  // Listen for message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        const channelName = event.data?.channelName || "Canal de YouTube Vinculado";
        setDraft((curr) => {
          if (!curr) return null;
          return {
            ...curr,
            youtube: {
              ...curr.youtube,
              is_linked: true,
              channel_name: channelName,
            },
          };
        });
        fetchYouTubeStatus();
        configApi.get().then((cfg) => {
          setConfig(cfg);
        });
      } else if (event.data?.type === 'TIKTOK_AUTH_SUCCESS') {
        const channelName = event.data?.channelName || "Cuenta de TikTok Vinculada";
        setDraft((curr) => {
          if (!curr) return null;
          return {
            ...curr,
            tiktok: {
              ...(curr.tiktok || { client_id: "", client_secret: "" }),
              is_linked: true,
              channel_name: channelName,
            },
          };
        });
        fetchTikTokStatus();
        configApi.get().then((cfg) => {
          setConfig(cfg);
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setConfig]);

  const handleYoutubeConnect = async () => {
    setLinkingYoutube(true);
    try {
      const { url } = await videoApi.getYouTubeAuthUrl();
      const popup = window.open(url, "youtube_oauth", "width=600,height=700");
      if (!popup) {
        alert("Por favor habilita las ventanas emergentes (popups) para vincular tu canal de YouTube.");
      }
    } catch (err: any) {
      alert(err.message || "Error al obtener URL de autenticación. Verifica que tengas las credenciales en .env.");
    } finally {
      setLinkingYoutube(false);
    }
  };

  const handleTiktokConnect = async () => {
    setLinkingTiktok(true);
    try {
      const { url } = await videoApi.getTikTokAuthUrl();
      const popup = window.open(url, "tiktok_oauth", "width=600,height=700");
      if (!popup) {
        alert("Por favor habilita las ventanas emergentes (popups) para vincular tu cuenta de TikTok.");
      }
    } catch (err: any) {
      alert(err.message || "Error al obtener URL de autenticación de TikTok. Verifica que tengas las credenciales en .env.");
    } finally {
      setLinkingTiktok(false);
    }
  };

  const handleSelectChannel = async (channelId: string) => {
    try {
      await videoApi.selectYouTubeChannel(channelId);
      fetchYouTubeStatus();
      const cfg = await configApi.get();
      setConfig(cfg);
      setDraft(cfg.settings);
    } catch (e) {
      console.error("Error selecting channel:", e);
    }
  };

  const handleSelectTiktokChannel = async (channelId: string) => {
    try {
      await videoApi.selectTikTokChannel(channelId);
      fetchTikTokStatus();
      const cfg = await configApi.get();
      setConfig(cfg);
      setDraft(cfg.settings);
    } catch (e) {
      console.error("Error selecting TikTok channel:", e);
    }
  };

  const handleDisconnectChannel = async (channelId: string) => {
    try {
      await videoApi.disconnectYouTubeChannel(channelId);
      fetchYouTubeStatus();
      const cfg = await configApi.get();
      setConfig(cfg);
      setDraft(cfg.settings);
    } catch (e) {
      console.error("Error disconnecting channel:", e);
    }
  };

  const handleDisconnectTiktokChannel = async (channelId: string) => {
    try {
      await videoApi.disconnectTikTokChannel(channelId);
      fetchTikTokStatus();
      const cfg = await configApi.get();
      setConfig(cfg);
      setDraft(cfg.settings);
    } catch (e) {
      console.error("Error disconnecting TikTok channel:", e);
    }
  };

  const handleFullYoutubeDisconnect = async () => {
    try {
      await videoApi.disconnectYouTube();
      setDraft((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          youtube: {
            ...curr.youtube,
            is_linked: false,
            channel_name: "",
          },
        };
      });
      setYoutubeChannels([]);
      setActiveChannelId(null);
      const cfg = await configApi.get();
      setConfig(cfg);
    } catch (err) {
      console.error("Error full disconnect:", err);
    }
  };

  const handleFullTiktokDisconnect = async () => {
    try {
      await videoApi.disconnectTikTok();
      setDraft((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          tiktok: {
            ...(curr.tiktok || { client_id: "", client_secret: "" }),
            is_linked: false,
            channel_name: "",
          },
        };
      });
      setTiktokChannels([]);
      setActiveTiktokChannelId(null);
      const cfg = await configApi.get();
      setConfig(cfg);
    } catch (err) {
      console.error("Error full disconnect TikTok:", err);
    }
  };

  useEffect(() => {
    configApi
      .get()
      .then((cfg) => {
        setConfig(cfg);
        setDraft(cfg.settings);
        setOriginalDraft(cfg.settings);
        setError(null);
        fetchYouTubeStatus();
        fetchTikTokStatus();
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("settings.loadError")))
      .finally(() => setLoading(false));
  }, [setConfig]);

  const updateField = <S extends SectionName, K extends keyof EditableConfig[S]>(
    section: S,
    key: K,
    value: EditableConfig[S][K]
  ) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [section]: {
          ...(current[section] || {}),
          [key]: value,
        },
      };
    });
    setSaved(false);
  };

  const saveSettings = async () => {
    if (!draft || !originalDraft) return;
    setSaving(true);
    setError(null);
    try {
      const nextConfig = await configApi.update(changedSettings(originalDraft, draft));
      setConfig(nextConfig);
      setDraft(nextConfig.settings);
      setOriginalDraft(nextConfig.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted">{t("settings.loading")}</div>;
  }

  if (!draft || !config) {
    return (
      <div className="p-6 max-w-2xl space-y-3">
        <h1 className="text-base font-semibold text-foreground">{t("settings.title")}</h1>
        <p className="text-sm text-red-400">{error ?? t("settings.loadError")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t("settings.title")}</h1>
          <p className="text-xs text-muted">{t("settings.subtitle")}</p>
        </div>
        <div className="flex items-end gap-3">
          {saved && <span className="text-xs text-green-400 mb-2">{t("settings.saved")}</span>}
          <div className="w-40">
            <LanguageSelector />
          </div>
          <Button onClick={saveSettings} isLoading={saving} disabled={saving}>
            {t("settings.save")}
          </Button>
        </div>
      </div>

      {error && <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <Collapsible title={t("settings.sections.providers")} defaultOpen>
        <p className="mb-3 text-xs text-muted">
          {t("settings.sections.providersHint")}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label={t("settings.fields.videoSource")}
            value={draft.app.video_source ?? ""}
            options={optionList(config.options.video_sources)}
            onChange={(e) => updateField("app", "video_source", e.target.value)}
          />
          <Select
            label={t("settings.fields.llmProvider")}
            value={draft.app.llm_provider ?? ""}
            options={optionList(config.options.llm_providers)}
            onChange={(e) => updateField("app", "llm_provider", e.target.value)}
          />
          <SecretInput
            label={t("settings.fields.geminiApiKey")}
            value={draft.app.gemini_api_key}
            onChange={(value) => updateField("app", "gemini_api_key", value)}
          />
          <Input
            label={t("settings.fields.geminiModel")}
            value={draft.app.gemini_model_name ?? ""}
            onChange={(e) => updateField("app", "gemini_model_name", e.target.value)}
          />
          <ListInput
            label={t("settings.fields.pexelsApiKeys")}
            value={draft.app.pexels_api_keys}
            onChange={(value) => updateField("app", "pexels_api_keys", value)}
          />
          <ListInput
            label={t("settings.fields.pixabayApiKeys")}
            value={draft.app.pixabay_api_keys}
            onChange={(value) => updateField("app", "pixabay_api_keys", value)}
          />
          <ListInput
            label={t("settings.fields.coverrApiKeys")}
            value={draft.app.coverr_api_keys}
            onChange={(value) => updateField("app", "coverr_api_keys", value)}
          />
          <ListInput
            label={t("settings.fields.llmFallbackProviders")}
            value={draft.app.llm_fallback_providers}
            onChange={(value) => updateField("app", "llm_fallback_providers", value)}
          />
          <SecretInput
            label={t("settings.fields.azureSpeechKey")}
            value={draft.azure.speech_key}
            onChange={(value) => updateField("azure", "speech_key", value)}
          />
          <Input
            label={t("settings.fields.azureSpeechRegion")}
            value={draft.azure.speech_region ?? ""}
            onChange={(e) => updateField("azure", "speech_region", e.target.value)}
          />
          <SecretInput
            label={t("settings.fields.siliconflowApiKey")}
            value={draft.siliconflow.api_key}
            onChange={(value) => updateField("siliconflow", "api_key", value)}
          />
          <Input
            label={t("settings.fields.customEndpoint")}
            value={draft.app.endpoint ?? ""}
            onChange={(e) => updateField("app", "endpoint", e.target.value)}
          />
        </div>
      </Collapsible>

      <Collapsible title={t("settings.sections.rendering")} defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label={t("settings.fields.videoCodec")}
            value={draft.app.video_codec ?? ""}
            options={optionList(config.options.video_codecs)}
            onChange={(e) => updateField("app", "video_codec", e.target.value)}
          />
          <Input
            label={t("settings.fields.materialDirectory")}
            value={draft.app.material_directory ?? ""}
            onChange={(e) => updateField("app", "material_directory", e.target.value)}
          />
          <NumberInput
            label={t("settings.fields.threads")}
            value={draft.app.n_threads}
            onChange={(value) => updateField("app", "n_threads", value)}
          />
          <NumberInput
            label={t("settings.fields.llmRequestTimeout")}
            value={draft.app.llm_request_timeout_seconds}
            onChange={(value) => updateField("app", "llm_request_timeout_seconds", value)}
          />
          <NumberInput
            label={t("settings.fields.llmConnectTimeout")}
            value={draft.app.llm_connect_timeout_seconds}
            onChange={(value) => updateField("app", "llm_connect_timeout_seconds", value)}
          />
          <Input
            label={t("settings.fields.subtitleProvider")}
            value={draft.app.subtitle_provider ?? ""}
            onChange={(e) => updateField("app", "subtitle_provider", e.target.value)}
          />
          <Checkbox
            label={t("settings.fields.tlsVerify")}
            checked={!!draft.app.tls_verify}
            onChange={(value) => updateField("app", "tls_verify", value)}
          />
          <Checkbox
            label={t("settings.fields.matchMaterials")}
            checked={!!draft.app.match_materials_to_script}
            onChange={(value) => updateField("app", "match_materials_to_script", value)}
          />
        </div>
      </Collapsible>

      <Collapsible title={t("settings.sections.queue")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Checkbox
            label={t("settings.fields.enableRedis")}
            checked={!!draft.app.enable_redis}
            onChange={(value) => updateField("app", "enable_redis", value)}
          />
          <Input label={t("settings.fields.redisHost")} value={draft.app.redis_host ?? ""} onChange={(e) => updateField("app", "redis_host", e.target.value)} />
          <NumberInput label={t("settings.fields.redisPort")} value={draft.app.redis_port} onChange={(value) => updateField("app", "redis_port", value)} />
          <NumberInput label={t("settings.fields.redisDb")} value={draft.app.redis_db} onChange={(value) => updateField("app", "redis_db", value)} />
          <SecretInput label={t("settings.fields.redisPassword")} value={draft.app.redis_password} onChange={(value) => updateField("app", "redis_password", value)} />
          <NumberInput label={t("settings.fields.maxConcurrentTasks")} value={draft.app.max_concurrent_tasks} onChange={(value) => updateField("app", "max_concurrent_tasks", value)} />
          <NumberInput label={t("settings.fields.maxQueuedTasks")} value={draft.app.max_queued_tasks} onChange={(value) => updateField("app", "max_queued_tasks", value)} />
          <NumberInput label={t("settings.fields.maxUploadSize")} value={draft.app.max_upload_size_mb} onChange={(value) => updateField("app", "max_upload_size_mb", value)} />
        </div>
      </Collapsible>

      <Collapsible title={t("settings.sections.upload")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Checkbox label={t("settings.fields.uploadPostEnabled")} checked={!!draft.app.upload_post_enabled} onChange={(value) => updateField("app", "upload_post_enabled", value)} />
          <Checkbox label={t("settings.fields.uploadPostAutoUpload")} checked={!!draft.app.upload_post_auto_upload} onChange={(value) => updateField("app", "upload_post_auto_upload", value)} />
          <SecretInput label={t("settings.fields.uploadPostApiKey")} value={draft.app.upload_post_api_key} onChange={(value) => updateField("app", "upload_post_api_key", value)} />
          <Input label={t("settings.fields.uploadPostUsername")} value={draft.app.upload_post_username ?? ""} onChange={(e) => updateField("app", "upload_post_username", e.target.value)} />
          <ListInput label={t("settings.fields.uploadPostPlatforms")} value={draft.app.upload_post_platforms} onChange={(value) => updateField("app", "upload_post_platforms", value)} />
        </div>
      </Collapsible>

      <Collapsible title={t("settings.sections.youtube")}>
        <p className="mb-3 text-xs text-muted">
          {t("settings.sections.youtubeHint")}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={t("settings.fields.youtubeClientId")}
            value={draft.youtube?.client_id ?? ""}
            onChange={(e) => updateField("youtube", "client_id", e.target.value)}
            placeholder="e.g. 123456-abcdef.apps.googleusercontent.com"
          />
          <SecretInput
            label={t("settings.fields.youtubeApiKey")}
            value={draft.youtube?.api_key ?? ""}
            onChange={(value) => updateField("youtube", "api_key", value)}
          />
          <Input
            label={t("settings.fields.youtubeChannelName")}
            value={draft.youtube?.channel_name ?? ""}
            onChange={(e) => updateField("youtube", "channel_name", e.target.value)}
            placeholder="e.g. @MiCanalShorts"
            className="hidden" // No longer needed as we auto-fetch and display list of real channels, but keep it hidden to preserve config model
          />
          <div className="flex flex-col space-y-2 col-span-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Conexión con YouTube</span>
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                draft.youtube?.is_linked 
                  ? "bg-green-500/10 text-green-400 ring-green-500/20" 
                  : "bg-red-500/10 text-red-400 ring-red-500/20"
              }`}>
                {draft.youtube?.is_linked ? `${youtubeChannels.length} Canal(es) Vinculado(s)` : t("settings.fields.youtubeNotLinked")}
              </span>
            </div>

            {/* If linked, show the lists of channels */}
            {draft.youtube?.is_linked && youtubeChannels.length > 0 && (
              <div className="space-y-2 border border-neutral-800/80 bg-neutral-900/40 p-3 rounded-xl mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Cuentas / Canales Vinculados (Haz clic en uno para activarlo)
                </span>
                <div className="grid gap-2">
                  {youtubeChannels.map((ch) => {
                    const isActive = ch.channelId === activeChannelId;
                    return (
                      <div 
                        key={ch.channelId} 
                        onClick={() => !isActive && handleSelectChannel(ch.channelId)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-red-950/20 border-red-500/40 hover:bg-red-950/30' 
                            : 'bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-zinc-600'}`} />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-zinc-100">{ch.channelName}</span>
                            <span className="text-[10px] font-mono text-zinc-500">{ch.channelId}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isActive ? (
                            <span className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Activo
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded-md transition-colors"
                              onClick={() => handleSelectChannel(ch.channelId)}
                            >
                              Activar
                            </button>
                          )}
                          <button
                            type="button"
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent"
                            onClick={() => handleDisconnectChannel(ch.channelId)}
                            title="Desvincular este canal"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleYoutubeConnect}
                disabled={linkingYoutube}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-8"
              >
                {linkingYoutube ? "Conectando..." : draft.youtube?.is_linked ? "Vincular Otro Canal" : "Vincular Canal de YouTube"}
              </Button>

              {draft.youtube?.is_linked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFullYoutubeDisconnect}
                  className="border border-neutral-800 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-8"
                >
                  Desvincular Todos
                </Button>
              )}
            </div>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="TikTok Integración">
        <p className="mb-3 text-xs text-muted">
          Configura tus credenciales de la API de TikTok Developer para habilitar la vinculación de cuentas y publicación directa de videos.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="TikTok Client Key"
            value={draft.tiktok?.client_key ?? ""}
            onChange={(e) => updateField("tiktok", "client_key", e.target.value)}
            placeholder="e.g. aw9xxxxxxxxxxxxxx"
          />
          <SecretInput
            label="TikTok Client Secret"
            value={draft.tiktok?.client_secret ?? ""}
            onChange={(value) => updateField("tiktok", "client_secret", value)}
          />

          <div className="col-span-2 border-t border-neutral-800/85 my-1" />
          <div className="col-span-2 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Verificación de Dominio / URL de TikTok</h4>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Si TikTok muestra "This URL is not verified", selecciona el método de verificación <strong>"URL prefix (signature file)"</strong> en la consola de TikTok Developer. Copia el nombre del archivo y el código que te da TikTok y pégalos aquí abajo para que nuestro servidor los aloje automáticamente:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nombre del Archivo de Verificación"
                value={draft.tiktok?.verification_filename ?? ""}
                onChange={(e) => updateField("tiktok", "verification_filename", e.target.value)}
                placeholder="e.g. tiktok-developer-verification.txt o tiktok_xxxxxxxx.txt"
              />
              <Input
                label="Código / Contenido del Archivo"
                value={draft.tiktok?.verification_content ?? ""}
                onChange={(e) => updateField("tiktok", "verification_content", e.target.value)}
                placeholder="Pega aquí el código/texto de verificación largo"
              />
            </div>
          </div>

          <div className="col-span-2 border-t border-neutral-800/85 my-1" />
          <div className="flex flex-col space-y-2 col-span-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Conexión con TikTok</span>
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                draft.tiktok?.is_linked 
                  ? "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20" 
                  : "bg-red-500/10 text-red-400 ring-red-500/20"
              }`}>
                {draft.tiktok?.is_linked ? `${tiktokChannels.length} Cuenta(s) Vinculada(s)` : "No Vinculado"}
              </span>
            </div>

            {/* If linked, show the lists of channels */}
            {draft.tiktok?.is_linked && tiktokChannels.length > 0 && (
              <div className="space-y-2 border border-neutral-800/80 bg-neutral-900/40 p-3 rounded-xl mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Cuentas / Perfiles Vinculados (Haz clic en uno para activarlo)
                </span>
                <div className="grid gap-2">
                  {tiktokChannels.map((ch) => {
                    const isActive = ch.channelId === activeTiktokChannelId;
                    return (
                      <div 
                        key={ch.channelId} 
                        onClick={() => !isActive && handleSelectTiktokChannel(ch.channelId)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-cyan-950/20 border-cyan-500/40 hover:bg-cyan-950/30' 
                            : 'bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {ch.avatarUrl ? (
                            <img
                              src={ch.avatarUrl}
                              alt={ch.channelName}
                              referrerPolicy="no-referrer"
                              className="h-6 w-6 rounded-md object-cover border border-neutral-800 shadow-sm"
                            />
                          ) : (
                            <div className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-zinc-600'}`} />
                          )}
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-zinc-100">{ch.channelName}</span>
                            {ch.username && (
                              <span className="text-[10px] text-zinc-400">@{ch.username}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isActive ? (
                            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Activo
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded-md transition-colors"
                              onClick={() => handleSelectTiktokChannel(ch.channelId)}
                            >
                              Activar
                            </button>
                          )}
                          <button
                            type="button"
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent"
                            onClick={() => handleDisconnectTiktokChannel(ch.channelId)}
                            title="Desvincular esta cuenta"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleTiktokConnect}
                disabled={linkingTiktok}
                className="bg-zinc-950 hover:bg-zinc-900 border border-neutral-800 text-cyan-400 text-xs h-8"
              >
                {linkingTiktok ? "Conectando..." : draft.tiktok?.is_linked ? "Vincular Otra Cuenta" : "Vincular Cuenta de TikTok"}
              </Button>

              {draft.tiktok?.is_linked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFullTiktokDisconnect}
                  className="border border-neutral-800 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-8"
                >
                  Desvincular Todas
                </Button>
              )}
            </div>
          </div>
        </div>
      </Collapsible>

      <Collapsible title={t("settings.sections.whisper")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={t("settings.fields.whisperModelSize")} value={draft.whisper.model_size ?? ""} onChange={(e) => updateField("whisper", "model_size", e.target.value)} />
          <Select label={t("settings.fields.whisperDevice")} value={draft.whisper.device ?? ""} options={optionList(config.options.whisper_devices)} onChange={(e) => updateField("whisper", "device", e.target.value)} />
          <Input label={t("settings.fields.whisperComputeType")} value={draft.whisper.compute_type ?? ""} onChange={(e) => updateField("whisper", "compute_type", e.target.value)} />
          <Input label={t("settings.fields.uiLanguage")} value={draft.ui.language ?? ""} onChange={(e) => updateField("ui", "language", e.target.value)} />
          <Select label={t("settings.fields.subtitlePosition")} value={draft.ui.subtitle_position ?? ""} options={optionList(config.options.subtitle_positions)} onChange={(e) => updateField("ui", "subtitle_position", e.target.value)} />
          <NumberInput label={t("settings.fields.customPositionPercent")} value={draft.ui.custom_position} onChange={(value) => updateField("ui", "custom_position", value)} />
          <Select label={t("settings.fields.qualityProfile")} value={draft.quality.profile ?? ""} options={optionList(config.options.quality_profiles)} onChange={(e) => updateField("quality", "profile", e.target.value)} />
          <Input label={t("settings.fields.targetPlatform")} value={draft.quality.target_platform ?? ""} onChange={(e) => updateField("quality", "target_platform", e.target.value)} />
          <Checkbox label={t("settings.fields.qualityEnabled")} checked={!!draft.quality.enabled} onChange={(value) => updateField("quality", "enabled", value)} />
          <Checkbox label={t("settings.fields.preferLocalAssets")} checked={!!draft.quality.prefer_local_assets} onChange={(value) => updateField("quality", "prefer_local_assets", value)} />
          <Checkbox label={t("settings.fields.preferLicensedAssets")} checked={!!draft.quality.prefer_licensed_assets} onChange={(value) => updateField("quality", "prefer_licensed_assets", value)} />
          <Checkbox label={t("settings.fields.normalizeAudio")} checked={!!draft.quality.normalize_audio} onChange={(value) => updateField("quality", "normalize_audio", value)} />
          <Checkbox label={t("settings.fields.safeArea")} checked={!!draft.quality.safe_area_enabled} onChange={(value) => updateField("quality", "safe_area_enabled", value)} />
          <Checkbox label={t("settings.fields.twoPassRender")} checked={!!draft.quality.use_two_pass} onChange={(value) => updateField("quality", "use_two_pass", value)} />
        </div>
      </Collapsible>

      <Collapsible title={t("settings.sections.prompts")}>
        <Textarea
          label={t("settings.fields.customSystemPrompt")}
          rows={5}
          value={draft.app.custom_system_prompt ?? ""}
          onChange={(e) => updateField("app", "custom_system_prompt", e.target.value)}
        />
      </Collapsible>
    </div>
  );
}

function SecretInput({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <Input label={label} type="password" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

function NumberInput({ label, value, onChange }: { label: string; value?: number; onChange: (value: number) => void }) {
  return (
    <Input
      label={label}
      type="number"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function ListInput({ label, value, onChange }: { label: string; value?: string[]; onChange: (value: string[]) => void }) {
  const { t } = useTranslation();
  return (
    <Textarea
      label={label}
      rows={3}
      value={listToText(value)}
      hint={t("settings.listHint")}
      onChange={(e) => onChange(textToList(e.target.value))}
    />
  );
}
