import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MetricsSnapshot, Publication } from "../../api/types";
import { Publications } from "../../pages/Publications";
import { usePublicationsStore } from "../../store/usePublicationsStore";
import { useMetricsStore } from "../../store/useMetricsStore";

const publication: Publication = {
  id: "pub-1",
  video_output_id: "vo-1",
  project_id: "project-1",
  workspace_id: null,
  platform: "youtube",
  channel_id: null,
  external_video_id: "dry-run:pub-1",
  title: "Title",
  description: "Desc",
  tags: ["a"],
  thumbnail_path: null,
  privacy_status: "private",
  scheduled_at: null,
  published_at: "2026-01-01T00:00:00Z",
  status: "published",
  error: null,
  dry_run: true,
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  usePublicationsStore.setState({
    publications: [publication],
    current: null,
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    createDraft: vi.fn(),
    publishDryRun: vi.fn(),
  });

  useMetricsStore.setState({
    byPublication: {},
    workspaceSummaries: {},
    loading: false,
    error: null,
    loadPublication: vi.fn().mockResolvedValue(undefined),
    saveManual: vi.fn(async (publicationId: string, params) => {
      const snapshot: MetricsSnapshot = {
        id: "snap-1",
        publication_id: publicationId,
        external_video_id: null,
        platform: "youtube",
        collected_at: "2026-01-01T00:00:00Z",
        age_window: params.age_window,
        views: params.views ?? null,
        impressions: params.impressions ?? null,
        ctr: params.ctr ?? null,
        average_view_duration: null,
        average_view_percentage: params.average_view_percentage ?? null,
        likes: params.likes ?? null,
        comments: params.comments ?? null,
        subscribers_gained: params.subscribers_gained ?? null,
        estimated_revenue: params.estimated_revenue ?? null,
        rpm: params.rpm ?? null,
        metadata: {},
      };
      useMetricsStore.setState({
        byPublication: { ...useMetricsStore.getState().byPublication, [publicationId]: [snapshot] },
      });
      return snapshot;
    }),
    loadWorkspaceSummary: vi.fn().mockResolvedValue(undefined),
  });
});

describe("Publications page", () => {
  it("renders persisted publications", () => {
    render(<Publications />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("published")).toBeInTheDocument();
    expect(screen.getByText("dry-run:pub-1")).toBeInTheDocument();
  });

  it("submits manual metrics for a publication", async () => {
    const user = userEvent.setup();
    usePublicationsStore.setState({
      publications: [publication],
      current: null,
      loading: false,
      error: null,
    });
    render(<Publications />);

    await user.click(screen.getByRole("button", { name: /métricas/i }));
    await user.clear(screen.getByLabelText(/vistas/i));
    await user.type(screen.getByLabelText(/vistas/i), "123");
    await user.click(screen.getByRole("button", { name: /guardar métricas/i }));

    expect(await screen.findByText(/123 vistas/i)).toBeInTheDocument();
  });
});
