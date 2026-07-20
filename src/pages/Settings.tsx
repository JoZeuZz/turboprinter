import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
        // Also sync store config
        configApi.get().then((cfg) => {
          setConfig(cfg);
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setConfig]);

  const handleYoutubeConnect = async () => {
    if (draft?.youtube?.is_linked) {
      // Disconnect
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
        configApi.get().then((cfg) => {
          setConfig(cfg);
        });
      } catch (err) {
        console.error("Error disconnect:", err);
      }
    } else {
      // Connect (popup)
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
          />
          <div className="flex flex-col justify-end space-y-1">
            <span className="text-xs font-medium text-muted">{t("settings.fields.youtubeStatus")}</span>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                draft.youtube?.is_linked 
                  ? "bg-green-500/10 text-green-400 ring-green-500/20" 
                  : "bg-red-500/10 text-red-400 ring-red-500/20"
              }`}>
                {draft.youtube?.is_linked ? t("settings.fields.youtubeLinked") : t("settings.fields.youtubeNotLinked")}
              </span>
               <Button
                type="button"
                variant={draft.youtube?.is_linked ? "ghost" : "primary"}
                size="sm"
                onClick={handleYoutubeConnect}
                disabled={linkingYoutube}
              >
                {linkingYoutube 
                  ? "Conectando..." 
                  : draft.youtube?.is_linked 
                    ? t("settings.fields.youtubeUnlinkBtn") 
                    : t("settings.fields.youtubeLinkBtn")
                }
              </Button>
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
