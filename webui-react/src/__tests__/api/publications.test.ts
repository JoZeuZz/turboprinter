import { beforeEach, describe, expect, it, vi } from "vitest";
import { publicationsApi } from "../../api/publications";

const okResponse = (data: unknown) =>
  ({ ok: true, json: async () => ({ status: 200, message: "success", data }) }) as Response;

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = vi.fn().mockResolvedValue(okResponse({ publication: { id: "pub-1" } }));
});

describe("publicationsApi", () => {
  it("creates a draft under a project", async () => {
    await publicationsApi.createDraft("project-1", { title: "Title", tags: ["a"] });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/publication/draft",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Title", tags: ["a"] }) })
    );
  });

  it("publishes dry-run", async () => {
    await publicationsApi.publish("pub-1", { dry_run: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/publications/pub-1/publish",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ dry_run: true }) })
    );
  });

  it("lists with query filters", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse({ publications: [] }));
    await publicationsApi.list({ project_id: "project-1", status: "draft" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/publications?project_id=project-1&status=draft",
      expect.objectContaining({})
    );
  });
});
