// webui-react/src/components/panels/ScriptPanel.tsx
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button, Input, Select, Textarea, Collapsible } from "../ui";
import { useVideoStore } from "../../store/useVideoStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { llmApi } from "../../api/llm";

export function ScriptPanel() {
  const store = useVideoStore();
  const workspaceStore = useProjectWorkspaceStore();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    store.set("video_subject", e.target.value);
    workspaceStore.setTopic(e.target.value);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate script");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 px-6 py-5 max-w-2xl mx-auto w-full">
      <h2 className="text-base font-semibold text-foreground">Script</h2>

      <Input
        label="Topic"
        placeholder="e.g. Benefits of morning exercise"
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
        placeholder="Generated script will appear here, or paste your own..."
        value={store.video_script ?? ""}
        onChange={(e) => store.set("video_script", e.target.value)}
        rows={8}
      />

      <Textarea
        label="Keywords"
        placeholder="keyword1, keyword2, keyword3"
        value={typeof store.video_terms === "string" ? store.video_terms : (store.video_terms ?? []).join(", ")}
        onChange={(e) => store.set("video_terms", e.target.value)}
        rows={2}
      />

      <Collapsible title="Advanced Prompt">
        <Textarea
          label="Script Prompt"
          placeholder="Additional instructions for script generation..."
          value={store.video_script_prompt ?? ""}
          onChange={(e) => store.set("video_script_prompt", e.target.value)}
          rows={3}
        />
        <Textarea
          label="System Prompt"
          placeholder="Custom system prompt override..."
          value={store.custom_system_prompt ?? ""}
          onChange={(e) => store.set("custom_system_prompt", e.target.value)}
          rows={3}
        />
      </Collapsible>

      <div className="pt-4 border-t border-border flex justify-end">
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
