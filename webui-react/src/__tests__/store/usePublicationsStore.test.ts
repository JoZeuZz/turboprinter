import { beforeEach, describe, expect, it, vi } from "vitest";
import { publicationsApi } from "../../api/publications";
import type { Publication } from "../../api/types";
import { usePublicationsStore } from "../../store/usePublicationsStore";

vi.mock("../../api/publications", () => ({
  publicationsApi: {
    list: vi.fn(),
    get: vi.fn(),
    createDraft: vi.fn(),
    publish: vi.fn(),
  },
}));

const publication: Publication = {
  id: "pub-1",
  video_output_id: "vo-1",
  project_id: "project-1",
  workspace_id: null,
  platform: "youtube",
  channel_id: null,
  external_video_id: null,
  title: "Title",
  description: "Desc",
  tags: [],
  thumbnail_path: null,
  privacy_status: "private",
  scheduled_at: null,
  published_at: null,
  status: "draft",
  error: null,
  dry_run: true,
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  usePublicationsStore.setState({ publications: [], current: null, loading: false, error: null });
});

describe("usePublicationsStore", () => {
  it("refresh loads publications", async () => {
    vi.mocked(publicationsApi.list).mockResolvedValue({ publications: [publication] });
    await usePublicationsStore.getState().refresh({ project_id: "project-1" });
    expect(usePublicationsStore.getState().publications).toEqual([publication]);
  });

  it("createDraft stores current publication", async () => {
    vi.mocked(publicationsApi.createDraft).mockResolvedValue({ publication });
    await usePublicationsStore.getState().createDraft("project-1", { title: "Title" });
    expect(usePublicationsStore.getState().current).toEqual(publication);
  });

  it("createDraft records error state when API fails", async () => {
    vi.mocked(publicationsApi.createDraft).mockRejectedValue(new Error("draft failed"));

    await expect(
      usePublicationsStore.getState().createDraft("project-1", { title: "Title" })
    ).rejects.toThrow("draft failed");

    expect(usePublicationsStore.getState().loading).toBe(false);
    expect(usePublicationsStore.getState().error).toBe("draft failed");
  });

  it("publishDryRun forces dry_run true", async () => {
    vi.mocked(publicationsApi.publish).mockResolvedValue({ publication: { ...publication, status: "published" } });
    await usePublicationsStore.getState().publishDryRun("pub-1");
    expect(publicationsApi.publish).toHaveBeenCalledWith("pub-1", { dry_run: true });
    expect(usePublicationsStore.getState().current?.status).toBe("published");
  });

  it("publishDryRun records error state when API fails", async () => {
    vi.mocked(publicationsApi.publish).mockRejectedValue(new Error("publish failed"));

    await expect(usePublicationsStore.getState().publishDryRun("pub-1")).rejects.toThrow(
      "publish failed"
    );

    expect(usePublicationsStore.getState().loading).toBe(false);
    expect(usePublicationsStore.getState().error).toBe("publish failed");
  });
});
