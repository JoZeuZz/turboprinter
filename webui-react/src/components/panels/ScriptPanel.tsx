// webui-react/src/components/panels/ScriptPanel.tsx
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { Button, Input, Select, Textarea, Collapsible } from "../ui";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useVideoStore } from "../../store/useVideoStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { llmApi } from "../../api/llm";

export function ScriptPanel() {
  const { t } = useTranslation();
  const store = useVideoStore();
  const workspaceStore = useProjectWorkspaceStore();
  const projectStore = useProjectStore();
  const updateCurrentDraft = useProjectHistoryStore((s) => s.updateCurrentDraft);
  const removeDraft = useProjectHistoryStore((s) => s.removeDraft);
  const currentDraftId = useProjectHistoryStore((s) => s.currentDraftId);
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    store.set("video_subject", e.target.value);
    workspaceStore.setTopic(e.target.value);
    updateCurrentDraft(e.target.value);
  };

  const handleGenerateScript = async () => {
    if (!store.video_subject.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { video_script } = await llmApi.generateScript({
        video_subject: store.video_subject,
        video_language: store.video_language,
        paragraph_number: store.paragraph_number,
        video_script_prompt: store.video_script_prompt,
        custom_system_prompt: store.custom_system_prompt,
      });
      store.set("video_script", video_script);

      const { video_terms } = await llmApi.generateTerms({
        video_subject: store.video_subject,
        video_script: video_script,
        amount: 5,
      });
      store.set("video_terms", video_terms.join(", "));

      try {
        const { project_id } = await projectsApi.createFromScript({
          script: video_script,
          language: store.video_language,
          topic: store.video_subject,
        });
        await projectStore.open(project_id);
        removeDraft(currentDraftId);
        navigate(`/project/${project_id}`, { replace: true });
      } catch (projectError) {
        if (!(projectError instanceof ApiError && projectError.status === 404)) {
          throw projectError;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate script");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="flex h-full w-full max-w-5xl mx-auto flex-col px-6 py-5">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-base font-semibold text-foreground">{t("panels.script.title")}</h2>

      <Input
        label="Topic"
        placeholder={t("panels.script.subjectPlaceholder")}
        value={store.video_subject}
        onChange={handleTopicChange}
      />

      <Select
        label="Language"
        value={store.video_language ?? ""}
        options={[
          { value: "", label: "Auto detect" },
          { value: "en", label: "English" },
          { value: "es", label: "Español" },
          { value: "zh", label: "中文" },
          { value: "fr", label: "Français" },
          { value: "de", label: "Deutsch" },
          { value: "ja", label: "日本語" },
          { value: "ko", label: "한국어" },
          { value: "pt", label: "Português" },
        ]}
        onChange={(e) => store.set("video_language", e.target.value)}
      />

      <Input
        label="Paragraphs"
        type="number"
        min={1}
        max={10}
        value={store.paragraph_number ?? 1}
        onChange={(e) =>
          store.set("paragraph_number", parseInt(e.target.value, 10))
        }
      />

      <Button
        onClick={handleGenerateScript}
        isLoading={generating}
        disabled={!store.video_subject.trim()}
        className="w-full"
      >
        <Wand2 className="mr-2 h-4 w-4" />
        Generate Script
      </Button>

      {error && (
        <p className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <Textarea
        label="Script"
        placeholder={t("panels.script.scriptPlaceholder")}
        value={store.video_script ?? ""}
        onChange={(e) => store.set("video_script", e.target.value)}
        rows={8}
      />

      <Textarea
        label="Keywords"
        placeholder={t("panels.script.keywordsPlaceholder")}
        value={typeof store.video_terms === "string" ? store.video_terms : (store.video_terms ?? []).join(", ")}
        onChange={(e) => store.set("video_terms", e.target.value)}
        rows={2}
      />

      <Collapsible title={t("panels.script.advancedPrompt")}>
        <Textarea
          label="Script Prompt"
          placeholder={t("panels.script.extraInstructionsPlaceholder")}
          value={store.video_script_prompt ?? ""}
          onChange={(e) => store.set("video_script_prompt", e.target.value)}
          rows={3}
        />
        <Textarea
          label="System Prompt"
          placeholder={t("panels.script.systemPromptPlaceholder")}
          value={store.custom_system_prompt ?? ""}
          onChange={(e) => store.set("custom_system_prompt", e.target.value)}
          rows={3}
        />
      </Collapsible>

        </div>
      </div>

      <div className="w-full max-w-2xl pt-4 border-t border-border flex justify-end">
        <Button
          disabled={!store.video_subject.trim()}
          onClick={() => workspaceStore.setPanel("config")}
        >
          Continue to Settings →
        </Button>
      </div>
    </section>
  );
}
