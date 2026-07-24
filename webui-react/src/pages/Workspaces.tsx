// webui-react/src/pages/Workspaces.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { Button, Input, Select } from "../components/ui";
import { useWorkspacesStore } from "../store/useWorkspacesStore";
import { useJobsStore } from "../store/useJobsStore";
import { useMetricsStore } from "../store/useMetricsStore";
import type { Workspace, WorkspaceUpsertRequest } from "../api/types";

const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

const FORMAT_OPTIONS = [
  { value: "shorts", label: "Shorts" },
  { value: "reels", label: "Reels" },
  { value: "landscape", label: "Landscape" },
];

interface FormState {
  name: string;
  language: string;
  target_format: string;
  default_voice: string;
}

function toFormState(workspace?: Workspace): FormState {
  return {
    name: workspace?.name ?? "",
    language: workspace?.language ?? "es",
    target_format: workspace?.target_format ?? "",
    default_voice: workspace?.default_voice ?? "",
  };
}

export function Workspaces() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaces, fetchAll, create, update, remove } = useWorkspacesStore();
  const { workspaceSummaries, loadWorkspaceSummary } = useMetricsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(toFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [pipelineTopics, setPipelineTopics] = useState<Record<string, string>>({});
  const [openSummaryId, setOpenSummaryId] = useState<string | null>(null);

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(toFormState());
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (workspace: Workspace) => {
    setEditingId(workspace.id);
    setForm(toFormState(workspace));
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError(t("channels.nameRequired"));
      return;
    }
    const payload: WorkspaceUpsertRequest = {
      name: form.name,
      language: form.language,
      target_format: form.target_format || null,
      default_voice: form.default_voice || null,
    };
    if (editingId) {
      await update(editingId, payload);
    } else {
      await create(payload);
    }
    setShowForm(false);
  };

  const handleRunPipeline = async (workspace: Workspace) => {
    const topic = pipelineTopics[workspace.id]?.trim();
    if (!topic) return;
    await useJobsStore.getState().runFullPipeline(workspace.id, {
      topic,
      language: workspace.language,
    });
    navigate("/jobs");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">{t("channels.title")}</h1>
          <Button onClick={openCreateForm} size="sm">
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            {t("channels.createNew")}
          </Button>
        </div>

        {workspaces.length === 0 && !showForm && (
          <p className="text-sm text-muted">{t("channels.empty")}</p>
        )}

        {workspaces.length > 0 && (
          <ul className="space-y-1">
            {workspaces.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-3"
              >
                <span className="text-sm text-foreground">{w.name}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={t("channels.runPipeline")}
                    placeholder={t("channels.runPipelineTopicPlaceholder")}
                    value={pipelineTopics[w.id] ?? ""}
                    onChange={(e) =>
                      setPipelineTopics({ ...pipelineTopics, [w.id]: e.target.value })
                    }
                  />
                  <Button variant="ghost" size="sm" onClick={() => void handleRunPipeline(w)}>
                    {t("channels.runPipeline")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpenSummaryId(openSummaryId === w.id ? null : w.id);
                      void loadWorkspaceSummary(w.id);
                    }}
                  >
                    {t("metrics.loadSummary")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditForm(w)}>
                    {t("channels.edit")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(w.id)}>
                    {t("channels.delete")}
                  </Button>
                </div>
                {openSummaryId === w.id && (
                  <div className="basis-full rounded-md border border-border bg-background/40 p-3 text-xs text-muted">
                    <div className="font-medium text-foreground">{t("metrics.workspaceSummary")}</div>
                    {workspaceSummaries[w.id] ? (
                      <div className="mt-2 overflow-x-auto">
                        <div className="mb-2">{workspaceSummaries[w.id].totals.views} {t("metrics.viewsShort")}</div>
                        <table className="w-full text-left">
                          <thead><tr><th>Group</th><th>Key</th><th>Views</th><th>CTR</th></tr></thead>
                          <tbody>
                            {Object.entries(workspaceSummaries[w.id].groups).flatMap(([group, rows]) =>
                              rows.map((row) => (
                                <tr key={`${group}:${row.key}`}>
                                  <td>{group}</td><td>{row.key}</td><td>{row.views}</td><td>{row.ctr ?? "-"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-2">{t("metrics.empty")}</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {showForm && (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <Input
              label={t("channels.name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              label={t("channels.language")}
              options={LANGUAGE_OPTIONS}
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            />
            <Select
              label={t("channels.targetFormat")}
              options={FORMAT_OPTIONS}
              value={form.target_format}
              onChange={(e) => setForm({ ...form, target_format: e.target.value })}
            />
            <Input
              label={t("channels.defaultVoice")}
              value={form.default_voice}
              onChange={(e) => setForm({ ...form, default_voice: e.target.value })}
            />
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void handleSave()}>
                {t("channels.save")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                {t("channels.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
