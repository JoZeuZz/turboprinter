import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePublicationsStore } from "../store/usePublicationsStore";

export function Publications() {
  const { t } = useTranslation();
  const { publications, refresh } = usePublicationsStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex min-h-full flex-col p-8">
      <h1 className="mb-6 text-lg font-semibold text-foreground">
        {t("publication.titlePage")}
      </h1>
      {publications.length === 0 ? (
        <p className="text-sm text-muted">{t("publication.empty")}</p>
      ) : (
        <div className="space-y-3">
          {publications.map((publication) => (
            <div
              key={publication.id}
              className="rounded-lg border border-border bg-surface p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-foreground">{publication.title}</div>
                  <div className="text-xs text-muted">
                    {publication.project_id} · {publication.platform}
                  </div>
                </div>
                <span className="rounded-full border border-border px-2 py-1 text-xs text-muted">
                  {publication.status}
                </span>
              </div>
              {publication.external_video_id && (
                <div className="mt-2 text-xs text-muted">
                  {publication.external_video_id}
                </div>
              )}
              {publication.error && (
                <div className="mt-2 text-xs text-red-400">{publication.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
