import { useEffect, useState } from "react";
import { useConfigStore } from "../store/useConfigStore";
import { configApi } from "../api/config";
import { ApiKeyInput, Collapsible } from "../components/ui";

export function Settings() {
  const { config, setConfig } = useConfigStore();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
    deepseek: "",
  });

  useEffect(() => {
    configApi.get().then(setConfig).catch(() => {});
  }, []);

  const handleSaveKey = async (keyName: string, value: string) => {
    setApiKeys((prev) => ({ ...prev, [keyName]: value }));
  };

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-base font-semibold text-foreground">Settings</h1>

      <Collapsible title="LLM API Keys" defaultOpen>
        <div className="space-y-3">
          <ApiKeyInput
            label="OpenAI API Key"
            value={apiKeys.openai}
            placeholder="sk-..."
            onSave={(v) => handleSaveKey("openai", v)}
          />
          <ApiKeyInput
            label="Anthropic API Key"
            value={apiKeys.anthropic}
            placeholder="sk-ant-..."
            onSave={(v) => handleSaveKey("anthropic", v)}
          />
          <ApiKeyInput
            label="DeepSeek API Key"
            value={apiKeys.deepseek}
            placeholder="sk-..."
            onSave={(v) => handleSaveKey("deepseek", v)}
          />
        </div>
      </Collapsible>

      <Collapsible title="Server Config">
        {!config ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Video sources</dt>
              <dd className="text-foreground">{config.video_sources.join(", ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Default subtitle position</dt>
              <dd className="text-foreground">{config.subtitle_position_default}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Custom position default</dt>
              <dd className="text-foreground">{config.custom_position_default}%</dd>
            </div>
          </dl>
        )}
      </Collapsible>

      <p className="text-xs text-muted">
        For full config, edit <code className="font-mono">config.toml</code> and restart the server.
      </p>
    </div>
  );
}
