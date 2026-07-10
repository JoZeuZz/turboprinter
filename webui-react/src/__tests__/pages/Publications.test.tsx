import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Publication } from "../../api/types";
import { Publications } from "../../pages/Publications";
import { usePublicationsStore } from "../../store/usePublicationsStore";

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
});

describe("Publications page", () => {
  it("renders persisted publications", () => {
    render(<Publications />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("published")).toBeInTheDocument();
    expect(screen.getByText("dry-run:pub-1")).toBeInTheDocument();
  });
});
