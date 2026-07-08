import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { promptTemplatesApi } from "../../api/promptTemplates";
import { usePromptTemplatesStore } from "../../store/usePromptTemplatesStore";
import type { PromptTemplate, PromptVersion } from "../../api/types";

vi.mock("../../api/promptTemplates", () => ({
  promptTemplatesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addVersion: vi.fn(),
    listVersions: vi.fn(),
    activateVersion: vi.fn(),
  },
}));

const tmpl1: PromptTemplate = {
  id: "tmpl-1", name: "Curiosidades ES", content_type: "curiosidades", language: "es",
  system_prompt: "s", user_prompt_template: "u", active_version_id: "ver-1",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", metadata: {},
};

const ver1: PromptVersion = {
  id: "ver-1", template_id: "tmpl-1", version: 1, system_prompt: "s",
  user_prompt_template: "u", created_at: "2026-01-01T00:00:00Z", active: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  usePromptTemplatesStore.setState({ templates: [], loading: false, error: null });
});

describe("usePromptTemplatesStore", () => {
  it("fetchAll populates templates", async () => {
    vi.mocked(promptTemplatesApi.list).mockResolvedValue({ templates: [tmpl1] });
    await act(async () => {
      await usePromptTemplatesStore.getState().fetchAll();
    });
    expect(usePromptTemplatesStore.getState().templates).toEqual([tmpl1]);
    expect(usePromptTemplatesStore.getState().loading).toBe(false);
  });

  it("create adds the new template to state", async () => {
    vi.mocked(promptTemplatesApi.create).mockResolvedValue({ template: tmpl1 });
    await act(async () => {
      await usePromptTemplatesStore.getState().create({
        name: "Curiosidades ES", content_type: "curiosidades",
        system_prompt: "s", user_prompt_template: "u",
      });
    });
    expect(usePromptTemplatesStore.getState().templates).toEqual([tmpl1]);
  });

  it("update replaces the template in state", async () => {
    usePromptTemplatesStore.setState({ templates: [tmpl1] });
    const updated = { ...tmpl1, name: "Renamed" };
    vi.mocked(promptTemplatesApi.update).mockResolvedValue({ template: updated });
    await act(async () => {
      await usePromptTemplatesStore.getState().update("tmpl-1", {
        name: "Renamed", content_type: "curiosidades",
      });
    });
    expect(usePromptTemplatesStore.getState().templates[0].name).toBe("Renamed");
  });

  it("addVersion returns the new version without mutating templates", async () => {
    usePromptTemplatesStore.setState({ templates: [tmpl1] });
    const ver2: PromptVersion = { ...ver1, id: "ver-2", version: 2, active: false };
    vi.mocked(promptTemplatesApi.addVersion).mockResolvedValue({ version: ver2 });
    let result: PromptVersion | undefined;
    await act(async () => {
      result = await usePromptTemplatesStore.getState().addVersion("tmpl-1", {
        system_prompt: "s2", user_prompt_template: "u2",
      });
    });
    expect(result).toEqual(ver2);
    expect(usePromptTemplatesStore.getState().templates).toEqual([tmpl1]);
  });

  it("listVersions returns the versions list", async () => {
    vi.mocked(promptTemplatesApi.listVersions).mockResolvedValue({ versions: [ver1] });
    let result: PromptVersion[] = [];
    await act(async () => {
      result = await usePromptTemplatesStore.getState().listVersions("tmpl-1");
    });
    expect(result).toEqual([ver1]);
  });

  it("activateVersion replaces the template in state", async () => {
    usePromptTemplatesStore.setState({ templates: [tmpl1] });
    const activated = { ...tmpl1, active_version_id: "ver-2" };
    vi.mocked(promptTemplatesApi.activateVersion).mockResolvedValue({ template: activated });
    await act(async () => {
      await usePromptTemplatesStore.getState().activateVersion("tmpl-1", "ver-2");
    });
    expect(usePromptTemplatesStore.getState().templates[0].active_version_id).toBe("ver-2");
  });

  it("fetchAll sets error on failure", async () => {
    vi.mocked(promptTemplatesApi.list).mockRejectedValue(new Error("boom"));
    await act(async () => {
      await usePromptTemplatesStore.getState().fetchAll();
    });
    expect(usePromptTemplatesStore.getState().error).toBe("boom");
    expect(usePromptTemplatesStore.getState().loading).toBe(false);
  });
});
