import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspacesApi } from "../../api/workspaces";
import { useWorkspacesStore } from "../../store/useWorkspacesStore";
import type { Workspace } from "../../api/types";

vi.mock("../../api/workspaces", () => ({
  workspacesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const ws1: Workspace = {
  id: "ws-1", name: "Canal Curiosidades", language: "es", voice_rate: 1.0,
  enabled: true, safety_rules: {}, metadata: {},
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  useWorkspacesStore.setState({ workspaces: [], loading: false, error: null });
});

describe("useWorkspacesStore", () => {
  it("fetchAll populates workspaces", async () => {
    vi.mocked(workspacesApi.list).mockResolvedValue({ workspaces: [ws1] });
    await act(async () => {
      await useWorkspacesStore.getState().fetchAll();
    });
    expect(useWorkspacesStore.getState().workspaces).toEqual([ws1]);
    expect(useWorkspacesStore.getState().loading).toBe(false);
  });

  it("create adds the new workspace to state", async () => {
    vi.mocked(workspacesApi.create).mockResolvedValue({ workspace: ws1 });
    await act(async () => {
      await useWorkspacesStore.getState().create({ name: "Canal Curiosidades" });
    });
    expect(useWorkspacesStore.getState().workspaces).toEqual([ws1]);
  });

  it("update replaces the workspace in state", async () => {
    useWorkspacesStore.setState({ workspaces: [ws1] });
    const updated = { ...ws1, name: "Renamed" };
    vi.mocked(workspacesApi.update).mockResolvedValue({ workspace: updated });
    await act(async () => {
      await useWorkspacesStore.getState().update("ws-1", { name: "Renamed" });
    });
    expect(useWorkspacesStore.getState().workspaces[0].name).toBe("Renamed");
  });

  it("remove drops the workspace from state", async () => {
    useWorkspacesStore.setState({ workspaces: [ws1] });
    vi.mocked(workspacesApi.remove).mockResolvedValue({ workspace_id: "ws-1", deleted: true });
    await act(async () => {
      await useWorkspacesStore.getState().remove("ws-1");
    });
    expect(useWorkspacesStore.getState().workspaces).toEqual([]);
  });

  it("fetchAll sets error on failure", async () => {
    vi.mocked(workspacesApi.list).mockRejectedValue(new Error("boom"));
    await act(async () => {
      await useWorkspacesStore.getState().fetchAll();
    });
    expect(useWorkspacesStore.getState().error).toBe("boom");
    expect(useWorkspacesStore.getState().loading).toBe(false);
  });
});
