import { useEffect } from "react";
import { useConfigStore } from "../store/useConfigStore";
import { configApi } from "../api/config";

export function Settings() {
  const { config, setConfig } = useConfigStore();

  useEffect(() => {
    configApi.get().then(setConfig).catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-base font-semibold text-foreground">Settings</h1>

      <section className="rounded-md border border-border bg-surface p-4 space-y-3">
        <h2 className="text-sm font-medium text-foreground">Server Config</h2>
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
      </section>

      <p className="text-xs text-muted">
        To change API keys or LLM providers, edit <code className="font-mono">config.toml</code> and restart the server.
      </p>
    </div>
  );
}
