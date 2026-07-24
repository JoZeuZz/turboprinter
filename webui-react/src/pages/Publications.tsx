import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select } from "../components/ui";
import { usePublicationsStore } from "../store/usePublicationsStore";
import { useMetricsStore } from "../store/useMetricsStore";

const AGE_WINDOW_OPTIONS = ["2h", "6h", "24h", "48h", "7d", "28d"].map((value) => ({
  value,
  label: value,
}));

function toNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export function Publications() {
  const { t } = useTranslation();
  const { publications, refresh } = usePublicationsStore();
  const { byPublication, loadPublication, saveManual } = useMetricsStore();
  const [openMetricsId, setOpenMetricsId] = useState<string | null>(null);
  const [metricsForm, setMetricsForm] = useState({
    age_window: "24h",
    views: "",
    impressions: "",
    ctr: "",
    average_view_percentage: "",
    likes: "",
    comments: "",
    subscribers_gained: "",
    estimated_revenue: "",
    rpm: "",
  });

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
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border px-2 py-1 text-xs text-muted">
                    {publication.status}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = openMetricsId === publication.id ? null : publication.id;
                      setOpenMetricsId(next);
                      if (next) void loadPublication(publication.id);
                    }}
                  >
                    {t("metrics.open")}
                  </Button>
                </div>
              </div>
              {publication.external_video_id && (
                <div className="mt-2 text-xs text-muted">
                  {publication.external_video_id}
                </div>
              )}
              {publication.error && (
                <div className="mt-2 text-xs text-red-400">{publication.error}</div>
              )}
              {openMetricsId === publication.id && (
                <div className="mt-4 space-y-3 rounded-md border border-border bg-background/40 p-3">
                  <Select
                    label={t("metrics.ageWindow")}
                    options={AGE_WINDOW_OPTIONS}
                    value={metricsForm.age_window}
                    onChange={(e) =>
                      setMetricsForm({ ...metricsForm, age_window: e.target.value })
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label={t("metrics.views")}
                      value={metricsForm.views}
                      onChange={(e) => setMetricsForm({ ...metricsForm, views: e.target.value })}
                    />
                    <Input
                      label={t("metrics.impressions")}
                      value={metricsForm.impressions}
                      onChange={(e) =>
                        setMetricsForm({ ...metricsForm, impressions: e.target.value })
                      }
                    />
                    <Input
                      label={t("metrics.ctr")}
                      value={metricsForm.ctr}
                      onChange={(e) => setMetricsForm({ ...metricsForm, ctr: e.target.value })}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      void saveManual(publication.id, {
                        age_window: metricsForm.age_window,
                        views: toNumber(metricsForm.views),
                        impressions: toNumber(metricsForm.impressions),
                        ctr: toNumber(metricsForm.ctr),
                        average_view_percentage: toNumber(metricsForm.average_view_percentage),
                        likes: toNumber(metricsForm.likes),
                        comments: toNumber(metricsForm.comments),
                        subscribers_gained: toNumber(metricsForm.subscribers_gained),
                        estimated_revenue: toNumber(metricsForm.estimated_revenue),
                        rpm: toNumber(metricsForm.rpm),
                      })
                    }
                  >
                    {t("metrics.save")}
                  </Button>
                  <div className="space-y-1 text-xs text-muted">
                    {(byPublication[publication.id] ?? []).length === 0 ? (
                      <p>{t("metrics.empty")}</p>
                    ) : (
                      (byPublication[publication.id] ?? []).map((snapshot) => (
                        <div key={snapshot.id} className="rounded border border-border px-2 py-1">
                          {snapshot.age_window}: {snapshot.views ?? 0} {t("metrics.viewsShort")}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
