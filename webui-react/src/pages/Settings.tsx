import { useEffect, useState } from "react";
import { configApi } from "../api/config";
import type { EditableConfig } from "../api/types";
import { Button, Checkbox, Collapsible, Input, Select, Textarea } from "../components/ui";
import { useConfigStore } from "../store/useConfigStore";

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
  const { config, setConfig } = useConfigStore();
  const [draft, setDraft] = useState<EditableConfig | null>(null);
  const [originalDraft, setOriginalDraft] = useState<EditableConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    configApi
      .get()
      .then((cfg) => {
        setConfig(cfg);
        setDraft(cfg.settings);
        setOriginalDraft(cfg.settings);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la configuración"))
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
          ...current[section],
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
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted">Cargando configuración...</div>;
  }

  if (!draft || !config) {
    return (
      <div className="p-6 max-w-2xl space-y-3">
        <h1 className="text-base font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-red-400">{error ?? "No se pudo cargar la configuración."}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted">Edita las opciones globales guardadas en config.toml.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-400">Guardado</span>}
          <Button onClick={saveSettings} isLoading={saving} disabled={saving}>
            Guardar configuración
          </Button>
        </div>
      </div>

      {error && <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <Collapsible title="Proveedores y API keys" defaultOpen>
        <p className="mb-3 text-xs text-muted">
          Por seguridad las llaves existentes no se muestran. Deja el campo vacío para conservarlas o escribe un valor nuevo para reemplazarlas.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Fuente de video por defecto"
            value={draft.app.video_source ?? ""}
            options={optionList(config.options.video_sources)}
            onChange={(e) => updateField("app", "video_source", e.target.value)}
          />
          <Select
            label="Proveedor LLM"
            value={draft.app.llm_provider ?? ""}
            options={optionList(config.options.llm_providers)}
            onChange={(e) => updateField("app", "llm_provider", e.target.value)}
          />
          <SecretInput
            label="Gemini API key"
            value={draft.app.gemini_api_key}
            onChange={(value) => updateField("app", "gemini_api_key", value)}
          />
          <Input
            label="Modelo Gemini"
            value={draft.app.gemini_model_name ?? ""}
            onChange={(e) => updateField("app", "gemini_model_name", e.target.value)}
          />
          <ListInput
            label="Pexels API keys"
            value={draft.app.pexels_api_keys}
            onChange={(value) => updateField("app", "pexels_api_keys", value)}
          />
          <ListInput
            label="Pixabay API keys"
            value={draft.app.pixabay_api_keys}
            onChange={(value) => updateField("app", "pixabay_api_keys", value)}
          />
          <ListInput
            label="Coverr API keys"
            value={draft.app.coverr_api_keys}
            onChange={(value) => updateField("app", "coverr_api_keys", value)}
          />
          <ListInput
            label="Fallback LLM providers"
            value={draft.app.llm_fallback_providers}
            onChange={(value) => updateField("app", "llm_fallback_providers", value)}
          />
          <SecretInput
            label="Azure Speech key"
            value={draft.azure.speech_key}
            onChange={(value) => updateField("azure", "speech_key", value)}
          />
          <Input
            label="Azure Speech region"
            value={draft.azure.speech_region ?? ""}
            onChange={(e) => updateField("azure", "speech_region", e.target.value)}
          />
          <SecretInput
            label="SiliconFlow API key"
            value={draft.siliconflow.api_key}
            onChange={(value) => updateField("siliconflow", "api_key", value)}
          />
          <Input
            label="Endpoint personalizado"
            value={draft.app.endpoint ?? ""}
            onChange={(e) => updateField("app", "endpoint", e.target.value)}
          />
        </div>
      </Collapsible>

      <Collapsible title="Renderizado y materiales" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Codec de video"
            value={draft.app.video_codec ?? ""}
            options={optionList(config.options.video_codecs)}
            onChange={(e) => updateField("app", "video_codec", e.target.value)}
          />
          <Input
            label="Directorio de materiales"
            value={draft.app.material_directory ?? ""}
            onChange={(e) => updateField("app", "material_directory", e.target.value)}
          />
          <NumberInput
            label="Threads"
            value={draft.app.n_threads}
            onChange={(value) => updateField("app", "n_threads", value)}
          />
          <NumberInput
            label="Timeout LLM request (s)"
            value={draft.app.llm_request_timeout_seconds}
            onChange={(value) => updateField("app", "llm_request_timeout_seconds", value)}
          />
          <NumberInput
            label="Timeout LLM connect (s)"
            value={draft.app.llm_connect_timeout_seconds}
            onChange={(value) => updateField("app", "llm_connect_timeout_seconds", value)}
          />
          <Input
            label="Proveedor de subtítulos"
            value={draft.app.subtitle_provider ?? ""}
            onChange={(e) => updateField("app", "subtitle_provider", e.target.value)}
          />
          <Checkbox
            label="Verificar TLS"
            checked={!!draft.app.tls_verify}
            onChange={(value) => updateField("app", "tls_verify", value)}
          />
          <Checkbox
            label="Emparejar materiales con script"
            checked={!!draft.app.match_materials_to_script}
            onChange={(value) => updateField("app", "match_materials_to_script", value)}
          />
        </div>
      </Collapsible>

      <Collapsible title="Cola y Redis">
        <div className="grid gap-4 md:grid-cols-2">
          <Checkbox
            label="Habilitar Redis"
            checked={!!draft.app.enable_redis}
            onChange={(value) => updateField("app", "enable_redis", value)}
          />
          <Input label="Redis host" value={draft.app.redis_host ?? ""} onChange={(e) => updateField("app", "redis_host", e.target.value)} />
          <NumberInput label="Redis port" value={draft.app.redis_port} onChange={(value) => updateField("app", "redis_port", value)} />
          <NumberInput label="Redis DB" value={draft.app.redis_db} onChange={(value) => updateField("app", "redis_db", value)} />
          <SecretInput label="Redis password" value={draft.app.redis_password} onChange={(value) => updateField("app", "redis_password", value)} />
          <NumberInput label="Tareas concurrentes" value={draft.app.max_concurrent_tasks} onChange={(value) => updateField("app", "max_concurrent_tasks", value)} />
          <NumberInput label="Tareas en cola" value={draft.app.max_queued_tasks} onChange={(value) => updateField("app", "max_queued_tasks", value)} />
          <NumberInput label="Upload máximo (MB, 0 = sin límite)" value={draft.app.max_upload_size_mb} onChange={(value) => updateField("app", "max_upload_size_mb", value)} />
        </div>
      </Collapsible>

      <Collapsible title="Upload post">
        <div className="grid gap-4 md:grid-cols-2">
          <Checkbox label="Habilitar upload post" checked={!!draft.app.upload_post_enabled} onChange={(value) => updateField("app", "upload_post_enabled", value)} />
          <Checkbox label="Auto upload" checked={!!draft.app.upload_post_auto_upload} onChange={(value) => updateField("app", "upload_post_auto_upload", value)} />
          <SecretInput label="Upload post API key" value={draft.app.upload_post_api_key} onChange={(value) => updateField("app", "upload_post_api_key", value)} />
          <Input label="Username" value={draft.app.upload_post_username ?? ""} onChange={(e) => updateField("app", "upload_post_username", e.target.value)} />
          <ListInput label="Plataformas" value={draft.app.upload_post_platforms} onChange={(value) => updateField("app", "upload_post_platforms", value)} />
        </div>
      </Collapsible>

      <Collapsible title="Whisper, UI y calidad">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Whisper model size" value={draft.whisper.model_size ?? ""} onChange={(e) => updateField("whisper", "model_size", e.target.value)} />
          <Select label="Whisper device" value={draft.whisper.device ?? ""} options={optionList(config.options.whisper_devices)} onChange={(e) => updateField("whisper", "device", e.target.value)} />
          <Input label="Whisper compute type" value={draft.whisper.compute_type ?? ""} onChange={(e) => updateField("whisper", "compute_type", e.target.value)} />
          <Input label="Idioma UI" value={draft.ui.language ?? ""} onChange={(e) => updateField("ui", "language", e.target.value)} />
          <Select label="Posición subtítulos" value={draft.ui.subtitle_position ?? ""} options={optionList(config.options.subtitle_positions)} onChange={(e) => updateField("ui", "subtitle_position", e.target.value)} />
          <NumberInput label="Posición custom (%)" value={draft.ui.custom_position} onChange={(value) => updateField("ui", "custom_position", value)} />
          <Select label="Perfil de calidad" value={draft.quality.profile ?? ""} options={optionList(config.options.quality_profiles)} onChange={(e) => updateField("quality", "profile", e.target.value)} />
          <Input label="Plataforma objetivo" value={draft.quality.target_platform ?? ""} onChange={(e) => updateField("quality", "target_platform", e.target.value)} />
          <Checkbox label="Calidad avanzada" checked={!!draft.quality.enabled} onChange={(value) => updateField("quality", "enabled", value)} />
          <Checkbox label="Preferir assets locales" checked={!!draft.quality.prefer_local_assets} onChange={(value) => updateField("quality", "prefer_local_assets", value)} />
          <Checkbox label="Preferir assets licenciados" checked={!!draft.quality.prefer_licensed_assets} onChange={(value) => updateField("quality", "prefer_licensed_assets", value)} />
          <Checkbox label="Normalizar audio" checked={!!draft.quality.normalize_audio} onChange={(value) => updateField("quality", "normalize_audio", value)} />
          <Checkbox label="Safe area" checked={!!draft.quality.safe_area_enabled} onChange={(value) => updateField("quality", "safe_area_enabled", value)} />
          <Checkbox label="Two-pass render" checked={!!draft.quality.use_two_pass} onChange={(value) => updateField("quality", "use_two_pass", value)} />
        </div>
      </Collapsible>

      <Collapsible title="Prompts globales">
        <Textarea
          label="System prompt custom"
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
  return (
    <Textarea
      label={label}
      rows={3}
      value={listToText(value)}
      hint="Un valor por línea o separado por comas."
      onChange={(e) => onChange(textToList(e.target.value))}
    />
  );
}
