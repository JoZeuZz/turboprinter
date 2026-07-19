import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  Plus, 
  Copy, 
  Trash2, 
  Star, 
  Save, 
  Edit2, 
  Check, 
  X,
  Sliders
} from "lucide-react";
import { usePresetStore, type VideoPreset } from "../../store/usePresetStore";
import { useVideoStore } from "../../store/useVideoStore";
import { Button, Input, Checkbox } from "../ui";

// Helper to check if current video settings match the preset settings
function settingsMatchPreset(store: any, preset: VideoPreset): boolean {
  const keys: (keyof Omit<VideoPreset, "id" | "name" | "isSystem">)[] = [
    "video_aspect",
    "video_concat_mode",
    "video_transition_mode",
    "video_clip_duration",
    "match_materials_to_script",
    "video_source",
    "tts_provider",
    "voice_name",
    "voice_volume",
    "voice_rate",
    "bgm_type",
    "bgm_file",
    "bgm_volume",
    "subtitle_enabled",
    "subtitle_position",
    "custom_position",
    "font_name",
    "font_size",
    "text_fore_color",
    "stroke_color",
    "stroke_width",
    "text_background_color",
    "rounded_subtitle_background",
  ];

  for (const k of keys) {
    let storeVal = store[k];
    let presetVal = preset[k];
    
    // Normalize comparison for background color (string or boolean)
    if (k === "text_background_color") {
      const storeBg = storeVal === false ? false : (typeof storeVal === "string" ? storeVal : "#000000");
      const presetBg = presetVal === false ? false : (typeof presetVal === "string" ? presetVal : "#000000");
      if (storeBg !== presetBg) return false;
      continue;
    }

    // Normalize comparison for local video files array
    if (k === "local_video_files" as any) {
      const storeFiles = store.local_video_files ?? [];
      const presetFiles = preset.local_video_files ?? [];
      if (storeFiles.length !== presetFiles.length) return false;
      if (JSON.stringify([...storeFiles].sort()) !== JSON.stringify([...presetFiles].sort())) return false;
      continue;
    }

    if (storeVal !== presetVal) {
      return false;
    }
  }
  return true;
}

// Apply preset values to useVideoStore
export function applyPresetToStore(preset: VideoPreset, store: any) {
  const keys: (keyof Omit<VideoPreset, "id" | "name" | "isSystem">)[] = [
    "video_aspect",
    "video_concat_mode",
    "video_transition_mode",
    "video_clip_duration",
    "match_materials_to_script",
    "video_source",
    "local_video_files",
    "tts_provider",
    "voice_name",
    "voice_volume",
    "voice_rate",
    "bgm_type",
    "bgm_file",
    "bgm_volume",
    "subtitle_enabled",
    "subtitle_position",
    "custom_position",
    "font_name",
    "font_size",
    "text_fore_color",
    "stroke_color",
    "stroke_width",
    "text_background_color",
    "rounded_subtitle_background",
  ];

  keys.forEach((k) => {
    if (preset[k] !== undefined) {
      store.set(k, preset[k]);
    }
  });
}

export function PresetManager() {
  const { t } = useTranslation();
  const videoStore = useVideoStore();
  const presetStore = usePresetStore();
  
  const { presets, activePresetId, defaultPresetId } = presetStore;

  const [newPresetName, setNewPresetName] = useState("");
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "error">("success");

  // Show a message that fades away
  const showToast = (msg: string, type: "success" | "info" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  };

  const selectedPreset = presets.find((p) => p.id === activePresetId) || null;
  const hasModified = selectedPreset ? !settingsMatchPreset(videoStore, selectedPreset) : false;

  const handleToggleEditPreset = () => {
    const nextState = !presetStore.isEditingPreset;
    if (nextState) {
      // Entering edit mode
      // Capture backup of current store values
      const keys = [
        "video_aspect",
        "video_concat_mode",
        "video_transition_mode",
        "video_clip_duration",
        "match_materials_to_script",
        "video_source",
        "local_video_files",
        "tts_provider",
        "voice_name",
        "voice_volume",
        "voice_rate",
        "bgm_type",
        "bgm_file",
        "bgm_volume",
        "subtitle_enabled",
        "subtitle_position",
        "custom_position",
        "font_name",
        "font_size",
        "text_fore_color",
        "stroke_color",
        "stroke_width",
        "text_background_color",
        "rounded_subtitle_background",
        "subtitle_bg_style",
        "subtitle_animation",
      ];
      const videoStoreAny = videoStore as any;
      const backup: any = {};
      keys.forEach((k) => {
        if (videoStoreAny[k] !== undefined) {
          backup[k] = videoStoreAny[k];
        }
      });
      presetStore.setEditingPresetBackup(backup);
      presetStore.setIsEditingPreset(true);
      showToast(t("presets.editingModeOn") || "Modo edición de preset activado. Ajusta los parámetros en las pestañas superiores.");
    } else {
      // Exiting edit mode (Cancelling)
      const backup = presetStore.editingPresetBackup;
      if (backup) {
        Object.keys(backup).forEach((k) => {
          videoStore.set(k as any, backup[k]);
        });
      }
      presetStore.setEditingPresetBackup(null);
      presetStore.setIsEditingPreset(false);
      showToast(t("presets.editingModeOff") || "Edición de preset cancelada.");
    }
  };

  // Load default preset on mount if no active preset and settings are clean defaults
  useEffect(() => {
    if (!activePresetId && defaultPresetId) {
      const defaultPreset = presets.find((p) => p.id === defaultPresetId);
      if (defaultPreset) {
        applyPresetToStore(defaultPreset, videoStore);
        presetStore.setActivePresetId(defaultPresetId);
        showToast(`${t("presets.title")}: ${t("presets.defaultSet")}`, "info");
      }
    }
  }, []);

  const handleSelectPreset = (id: string) => {
    presetStore.setIsEditingPreset(false);
    presetStore.setEditingPresetBackup(null);
    if (!id) {
      presetStore.setActivePresetId(null);
      return;
    }
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      applyPresetToStore(preset, videoStore);
      presetStore.setActivePresetId(id);
    }
  };

  const handleSaveNew = () => {
    if (!newPresetName.trim()) return;
    
    // Gather values from videoStore
    const values: Omit<VideoPreset, "id" | "name" | "isSystem"> = {
      video_aspect: videoStore.video_aspect ?? "9:16",
      video_concat_mode: videoStore.video_concat_mode ?? "random",
      video_transition_mode: videoStore.video_transition_mode ?? null,
      video_clip_duration: videoStore.video_clip_duration ?? 5,
      match_materials_to_script: videoStore.match_materials_to_script ?? false,
      video_source: videoStore.video_source ?? "pexels",
      local_video_files: videoStore.local_video_files ?? [],
      tts_provider: videoStore.tts_provider ?? "azure-tts-v1",
      voice_name: videoStore.voice_name ?? "",
      voice_volume: videoStore.voice_volume ?? 1.0,
      voice_rate: videoStore.voice_rate ?? 1.0,
      bgm_type: videoStore.bgm_type ?? "random",
      bgm_file: videoStore.bgm_file ?? "",
      bgm_volume: videoStore.bgm_volume ?? 0.2,
      subtitle_enabled: videoStore.subtitle_enabled ?? true,
      subtitle_position: videoStore.subtitle_position ?? "bottom",
      custom_position: videoStore.custom_position ?? 70.0,
      font_name: videoStore.font_name ?? "STHeitiMedium.ttc",
      font_size: videoStore.font_size ?? 60,
      text_fore_color: videoStore.text_fore_color ?? "#FFFFFF",
      stroke_color: videoStore.stroke_color ?? "#000000",
      stroke_width: videoStore.stroke_width ?? 1.5,
      text_background_color: videoStore.text_background_color ?? true,
      rounded_subtitle_background: videoStore.rounded_subtitle_background ?? false,
    };

    presetStore.savePreset(newPresetName.trim(), values);
    setNewPresetName("");
    setIsSavingNew(false);
    showToast(t("presets.saved"));
  };

  const handleOverwrite = () => {
    if (!selectedPreset) return;
    if (selectedPreset.isSystem) {
      showToast("No se pueden modificar presets del sistema. Duplícalo para editarlo.", "error");
      return;
    }

    const values = {
      video_aspect: videoStore.video_aspect ?? "9:16",
      video_concat_mode: videoStore.video_concat_mode ?? "random",
      video_transition_mode: videoStore.video_transition_mode ?? null,
      video_clip_duration: videoStore.video_clip_duration ?? 5,
      match_materials_to_script: videoStore.match_materials_to_script ?? false,
      video_source: videoStore.video_source ?? "pexels",
      local_video_files: videoStore.local_video_files ?? [],
      tts_provider: videoStore.tts_provider ?? "azure-tts-v1",
      voice_name: videoStore.voice_name ?? "",
      voice_volume: videoStore.voice_volume ?? 1.0,
      voice_rate: videoStore.voice_rate ?? 1.0,
      bgm_type: videoStore.bgm_type ?? "random",
      bgm_file: videoStore.bgm_file ?? "",
      bgm_volume: videoStore.bgm_volume ?? 0.2,
      subtitle_enabled: videoStore.subtitle_enabled ?? true,
      subtitle_position: videoStore.subtitle_position ?? "bottom",
      custom_position: videoStore.custom_position ?? 70.0,
      font_name: videoStore.font_name ?? "STHeitiMedium.ttc",
      font_size: videoStore.font_size ?? 60,
      text_fore_color: videoStore.text_fore_color ?? "#FFFFFF",
      stroke_color: videoStore.stroke_color ?? "#000000",
      stroke_width: videoStore.stroke_width ?? 1.5,
      text_background_color: videoStore.text_background_color ?? true,
      rounded_subtitle_background: videoStore.rounded_subtitle_background ?? false,
    };

    presetStore.updatePreset(selectedPreset.id, values);
    showToast(t("presets.updated"));
  };

  const handleRename = () => {
    if (!selectedPreset || !renameValue.trim()) return;
    if (selectedPreset.isSystem) return;

    presetStore.updatePreset(selectedPreset.id, { name: renameValue.trim() });
    setIsRenaming(false);
    showToast(t("presets.updated"));
  };

  const handleDuplicate = () => {
    if (!selectedPreset) return;
    const copyLabel = t("presets.duplicateSuffix");
    const newId = presetStore.duplicatePreset(selectedPreset.id, copyLabel);
    if (newId) {
      showToast(t("presets.updated"));
    }
  };

  const handleDelete = () => {
    if (!selectedPreset) return;
    if (selectedPreset.isSystem) return;

    if (confirm(t("presets.confirmDelete"))) {
      const name = selectedPreset.name;
      presetStore.deletePreset(selectedPreset.id);
      showToast(`${t("presets.deleted")}: ${name}`, "info");
    }
  };

  const handleToggleDefault = () => {
    if (!selectedPreset) return;
    if (defaultPresetId === selectedPreset.id) {
      presetStore.setDefaultPresetId(null);
      showToast(t("presets.defaultCleared"), "info");
    } else {
      presetStore.setDefaultPresetId(selectedPreset.id);
      showToast(t("presets.defaultSet"));
    }
  };

  const systemPresets = presets.filter((p) => p.isSystem);
  const customPresets = presets.filter((p) => !p.isSystem);

  const getPresetDisplayName = (p: VideoPreset) => {
    if (p.isSystem) {
      return t(`presets.${p.name}`, p.name);
    }
    return p.name || t("presets.unnamed");
  };

  return (
    <div id="preset-manager-container" className="rounded-xl border border-border bg-surface p-5.5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 pt-2.5 pl-2.5">
          <span>{t("presets.title")}</span>
          {hasModified && (
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Configuración modificada" />
          )}
        </h3>
        
        {toastMessage && (
          <div className={`text-[11px] font-medium px-2.5 py-0.5 rounded transition-all animate-fadeIn ${
            toastType === "success" 
              ? "bg-green-500/10 text-green-400 border border-green-500/20" 
              : toastType === "error"
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          }`}>
            {toastMessage}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] px-2.5">
        {/* Dropdown Selector */}
        <div className="relative">
          <select
            id="preset-select-dropdown"
            value={activePresetId || ""}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="w-full rounded-lg border border-border bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-100 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="" className="bg-neutral-950 text-neutral-100">{t("presets.select")}</option>
            {systemPresets.length > 0 && (
              <optgroup label={t("presets.systemPresets")} className="bg-neutral-950 text-neutral-400 font-bold">
                {systemPresets.map((p) => (
                  <option key={p.id} value={p.id} className="bg-neutral-900 text-neutral-100 font-medium">
                    {getPresetDisplayName(p)} {defaultPresetId === p.id ? ` ★` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {customPresets.length > 0 && (
              <optgroup label={t("presets.customPresets")} className="bg-neutral-950 text-neutral-400 font-bold">
                {customPresets.map((p) => (
                  <option key={p.id} value={p.id} className="bg-neutral-900 text-neutral-100 font-medium">
                    {getPresetDisplayName(p)} {defaultPresetId === p.id ? ` ★` : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Preset Actions Quick Bar */}
        <div className="flex gap-2 items-center justify-end">
          {/* Save/New Button */}
          {!isSavingNew && !isRenaming && (
            <button
              id="btn-add-preset"
              type="button"
              onClick={() => {
                setIsSavingNew(true);
                setNewPresetName("");
              }}
              title={t("presets.saveCurrent")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          {/* Actions for Selected Preset */}
          {selectedPreset && !isSavingNew && !isRenaming && (
            <>
              {/* Edit preset parameters button */}
              <button
                id="btn-edit-preset-params"
                type="button"
                onClick={handleToggleEditPreset}
                title={presetStore.isEditingPreset ? "Cancelar edición de preset" : "Editar parámetros del preset"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                  presetStore.isEditingPreset
                    ? "border-accent/40 bg-accent/15 text-accent hover:bg-accent/25"
                    : "border-border bg-background text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <Sliders className="h-4 w-4" />
              </button>

              {/* Overwrite / Update button for Custom presets when modified */}
              {hasModified && !selectedPreset.isSystem && (
                <button
                  id="btn-update-preset"
                  type="button"
                  onClick={handleOverwrite}
                  title={t("presets.overwrite")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
                >
                  <Save className="h-4 w-4" />
                </button>
              )}

              {/* Duplicate Button */}
              <button
                id="btn-duplicate-preset"
                type="button"
                onClick={handleDuplicate}
                title={t("presets.duplicate")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <Copy className="h-4 w-4" />
              </button>

              {/* Set Default Button */}
              <button
                id="btn-default-preset"
                type="button"
                onClick={handleToggleDefault}
                title={defaultPresetId === selectedPreset.id ? t("presets.clearDefault") : t("presets.setDefault")}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                  defaultPresetId === selectedPreset.id
                    ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                    : "border-border bg-background text-muted hover:text-yellow-500 hover:bg-surface-hover"
                }`}
              >
                <Star className={`h-4 w-4 ${defaultPresetId === selectedPreset.id ? "fill-yellow-500" : ""}`} />
              </button>

              {/* Rename Button (Custom only) */}
              {!selectedPreset.isSystem && (
                <button
                  id="btn-rename-preset"
                  type="button"
                  onClick={() => {
                    setIsRenaming(true);
                    setRenameValue(selectedPreset.name);
                  }}
                  title={t("presets.edit")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}

              {/* Delete Button (Custom only) */}
              {!selectedPreset.isSystem && (
                <button
                  id="btn-delete-preset"
                  type="button"
                  onClick={handleDelete}
                  title={t("presets.delete")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-background text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Parameters Editor Mode is active notification bar */}
      {presetStore.isEditingPreset && selectedPreset && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-accent animate-pulse" />
            <div className="text-xs">
              <span className="font-semibold text-accent">{t("presets.editingTitle") || "Editando Preset"}: </span>
              <span className="text-foreground">{selectedPreset.isSystem ? t(`presets.${selectedPreset.name}`) : selectedPreset.name}</span>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground italic hidden sm:inline">
            {t("presets.editHint") || "Usa las pestañas superiores para cambiar valores y luego haz clic en Guardar arriba."}
          </span>
        </div>
      )}

      {/* Save New Preset Dialog Inline */}
      {isSavingNew && (
        <div id="save-preset-dialog" className="rounded-lg border border-border bg-background p-4 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-accent" />
              {t("presets.saveCurrent")}
            </span>
            <button 
              type="button" 
              onClick={() => setIsSavingNew(false)} 
              className="text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            <Input
              id="input-new-preset-name"
              placeholder={t("presets.placeholder")}
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="text-xs py-1.5 h-auto bg-surface border-border focus:border-accent"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <Button
                id="btn-cancel-save-preset"
                variant="ghost"
                size="sm"
                onClick={() => setIsSavingNew(false)}
                className="text-[11px] py-1 h-auto"
              >
                {t("common.cancel")}
              </Button>
              <Button
                id="btn-confirm-save-preset"
                size="sm"
                disabled={!newPresetName.trim()}
                onClick={handleSaveNew}
                className="text-[11px] py-1 h-auto px-3"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Preset Dialog Inline */}
      {isRenaming && selectedPreset && (
        <div id="rename-preset-dialog" className="rounded-lg border border-border bg-background p-4 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <Edit2 className="h-3.5 w-3.5 text-accent" />
              {t("presets.edit")}
            </span>
            <button 
              type="button" 
              onClick={() => setIsRenaming(false)} 
              className="text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            <Input
              id="input-rename-preset"
              placeholder={t("presets.placeholder")}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="text-xs py-1.5 h-auto bg-surface border-border focus:border-accent"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <Button
                id="btn-cancel-rename"
                variant="ghost"
                size="sm"
                onClick={() => setIsRenaming(false)}
                className="text-[11px] py-1 h-auto"
              >
                {t("common.cancel")}
              </Button>
              <Button
                id="btn-confirm-rename"
                size="sm"
                disabled={!renameValue.trim() || renameValue.trim() === selectedPreset.name}
                onClick={handleRename}
                className="text-[11px] py-1 h-auto px-3"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}



      {/* Custom Presets List for direct management */}
      {customPresets.length > 0 && (
        <div className="pt-3.5 border-t border-border/60 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            {t("presets.customPresets")}
          </span>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {customPresets.map((p) => {
              const isDefault = defaultPresetId === p.id;
              const isActive = activePresetId === p.id;
              return (
                <div 
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                    isActive 
                      ? "bg-accent/10 border border-accent/20 text-foreground" 
                      : "bg-background/40 hover:bg-background/80 border border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {/* Clickable name to select it */}
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className="flex-1 text-left font-medium truncate pr-2 hover:underline"
                    title={`Cargar ${p.name}`}
                  >
                    {p.name}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Select/Active Indicator */}
                    {isActive && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 mr-1 text-center scale-90">
                        Activo
                      </span>
                    )}

                    {/* Default/Star Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isDefault) {
                          presetStore.setDefaultPresetId(null);
                          showToast(t("presets.defaultCleared"), "info");
                        } else {
                          presetStore.setDefaultPresetId(p.id);
                          showToast(t("presets.defaultSet"));
                        }
                      }}
                      title={isDefault ? t("presets.clearDefault") : t("presets.setDefault")}
                      className={`p-1 rounded hover:bg-surface-hover transition-colors ${
                        isDefault ? "text-yellow-500" : "text-muted hover:text-yellow-500"
                      }`}
                    >
                      <Star className={`h-3.5 w-3.5 ${isDefault ? "fill-yellow-500" : ""}`} />
                    </button>

                    {/* Rename Button */}
                    <button
                      type="button"
                      onClick={() => {
                        presetStore.setActivePresetId(p.id);
                        setIsRenaming(true);
                        setRenameValue(p.name);
                      }}
                      title={t("presets.edit")}
                      className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t("presets.confirmDelete"))) {
                          presetStore.deletePreset(p.id);
                          showToast(`${t("presets.deleted")}: ${p.name}`, "info");
                        }
                      }}
                      title={t("presets.delete")}
                      className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto-save configuration checkbox */}
      <div id="auto-save-config-checkbox-container" className="p-2.5 border-t border-border/50 flex flex-col gap-1">
        <Checkbox
          checked={presetStore.autoSaveConfigAfterGeneration}
          onChange={(checked) => presetStore.setAutoSaveConfigAfterGeneration(checked)}
          label={t("presets.autoSaveConfig")}
        />
        <span className="text-[10px] text-muted-foreground ml-6 leading-normal">
          {t("presets.autoSaveConfigHint")}
        </span>
      </div>
    </div>
  );
}
