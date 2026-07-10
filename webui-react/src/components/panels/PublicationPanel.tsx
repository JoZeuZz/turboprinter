import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select, Textarea } from "../ui";
import { useProjectStore } from "../../store/useProjectStore";
import { usePublicationsStore } from "../../store/usePublicationsStore";

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function PublicationPanel() {
  const { t } = useTranslation();
  const projectId = useProjectStore((s) => s.projectId);
  const { publications, current, loading, error, refresh, createDraft, publishDryRun } = usePublicationsStore();
  const currentForProject = current?.project_id === projectId
    ? current
    : publications.find((publication) => publication.project_id === projectId) ?? null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [privacy, setPrivacy] = useState("private");

  useEffect(() => {
    if (projectId) {
      void refresh({ project_id: projectId });
    }
  }, [projectId, refresh]);

  const create = async () => {
    if (!projectId) {
      return;
    }

    await createDraft(projectId, {
      title: title || null,
      description: description || null,
      tags: splitTags(tags),
      privacy_status: privacy,
      dry_run: true,
    });
  };

  const publish = async () => {
    if (currentForProject?.id) {
      await publishDryRun(currentForProject.id);
    }
  };

  return (
    <div className="flex h-full w-full max-w-5xl mx-auto flex-col px-6 py-5">
      <div className="max-w-2xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("publication.panelTitle")}
          </h2>
          <p className="text-xs text-muted">{t("publication.dryRunHint")}</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <Input
          label={t("publication.title")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          label={t("publication.description")}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Input
          label={t("publication.tags")}
          hint={t("publication.tagsHint")}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
        <Select
          label={t("publication.privacy")}
          value={privacy}
          onChange={(event) => setPrivacy(event.target.value)}
          options={[
            { value: "private", label: "private" },
            { value: "unlisted", label: "unlisted" },
            { value: "public", label: "public" },
          ]}
        />

        <div className="flex gap-2">
          <Button onClick={() => void create()} isLoading={loading}>
            {t("publication.createDraft")}
          </Button>
          <Button onClick={() => void publish()} disabled={!currentForProject} isLoading={loading}>
            {t("publication.dryRunPublish")}
          </Button>
        </div>

        {currentForProject && (
          <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
            <div className="font-medium text-foreground">{currentForProject.title}</div>
            <div>{currentForProject.status}</div>
            {currentForProject.external_video_id && <div>{currentForProject.external_video_id}</div>}
            {currentForProject.error && <div className="text-red-400">{currentForProject.error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
