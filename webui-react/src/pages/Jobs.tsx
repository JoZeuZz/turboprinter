// webui-react/src/pages/Jobs.tsx
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui";
import { useJobsStore } from "../store/useJobsStore";
import type { Job, JobStatus } from "../api/types";

const COLUMNS: { status: JobStatus; labelKey: string }[] = [
  { status: "pending", labelKey: "jobs.pending" },
  { status: "running", labelKey: "jobs.running" },
  { status: "completed", labelKey: "jobs.completed" },
  { status: "failed", labelKey: "jobs.failed" },
];

const REFRESH_INTERVAL_MS = 3000;

function JobCard({ job, onCancel }: { job: Job; onCancel: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <li className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{job.id}</span>
        {job.status === "pending" && (
          <Button variant="ghost" size="sm" onClick={() => onCancel(job.id)}>
            {t("jobs.cancel")}
          </Button>
        )}
      </div>
      <div className="text-muted">{job.type}</div>
      <div className="text-muted">
        {job.attempts}/{job.max_attempts}
      </div>
      {job.last_error && <div className="text-red-400">{job.last_error}</div>}
    </li>
  );
}

export function Jobs() {
  const { t } = useTranslation();
  const { jobs, refresh, cancel } = useJobsStore();

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col min-h-full p-8">
      <h1 className="mb-6 text-lg font-semibold text-foreground">{t("jobs.title")}</h1>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted">{t("jobs.empty")}</p>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(({ status, labelKey }) => (
            <div key={status}>
              <h2 className="mb-2 text-xs font-semibold uppercase text-muted">
                {t(labelKey)}
              </h2>
              <ul className="space-y-2">
                {jobs
                  .filter((job) => job.status === status)
                  .map((job) => (
                    <JobCard key={job.id} job={job} onCancel={(id) => void cancel(id)} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
