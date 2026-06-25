import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { ReviewPanel } from "../../components/panels/ReviewPanel";
import { useProjectStore } from "../../store/useProjectStore";
import type { TimelineProject } from "../../api/types";

vi.mock("../../store/useProjectWorkspaceStore", () => ({
  useProjectWorkspaceStore: () => ({ setPanel: vi.fn() }),
}));

vi.mock("../../store/useProjectStore", () => ({
  useProjectStore: vi.fn(),
}));

const PROJECT: TimelineProject = {
  project_id: "proj-1",
  tracks: [
    {
      id: "track-video",
      type: "video",
      name: "Video",
      items: [
        { id: "clip-1", start_sec: 0, duration_sec: 5 },
        { id: "clip-2", start_sec: 5, duration_sec: 3 },
        { id: "clip-3", start_sec: 8, duration_sec: 4 },
      ],
    },
  ],
};

function makeStore(overrides = {}) {
  return {
    project: PROJECT,
    mode: "ready",
    applyTimelineCommands: vi.fn().mockResolvedValue(undefined),
    render: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useProjectStore).mockReturnValue(makeStore() as never);
});

describe("ReviewPanel", () => {
  it("renders all clips", () => {
    render(<ReviewPanel />);
    // 3 duration badges: "5.0s", "3.0s", "4.0s"
    expect(screen.getByText("5.0s")).toBeInTheDocument();
    expect(screen.getByText("3.0s")).toBeInTheDocument();
    expect(screen.getByText("4.0s")).toBeInTheDocument();
  });

  it("shows total duration", () => {
    render(<ReviewPanel />);
    expect(screen.getByText(/12s/i)).toBeInTheDocument();
  });

  it("renders 'disabled' message when mode is disabled", () => {
    vi.mocked(useProjectStore).mockReturnValue(
      makeStore({ mode: "disabled" }) as never
    );
    render(<ReviewPanel />);
    expect(screen.getByText(/review not available/i)).toBeInTheDocument();
  });

  it("on Render, calls applyTimelineCommands with move commands for all non-excluded clips", async () => {
    const store = makeStore();
    vi.mocked(useProjectStore).mockReturnValue(store as never);
    render(<ReviewPanel />);
    await act(async () => {
      fireEvent.click(screen.getByText(/render video/i));
    });
    expect(store.applyTimelineCommands).toHaveBeenCalledWith({
      commands: [
        { type: "move", track_id: "track-video", item_id: "clip-1", new_start_sec: 0 },
        { type: "move", track_id: "track-video", item_id: "clip-2", new_start_sec: 5 },
        { type: "move", track_id: "track-video", item_id: "clip-3", new_start_sec: 8 },
      ],
    });
    expect(store.render).toHaveBeenCalled();
  });

  it("excluded clips get set_timing duration_sec 0", async () => {
    const store = makeStore();
    vi.mocked(useProjectStore).mockReturnValue(store as never);
    render(<ReviewPanel />);

    // Exclude clip-2 (second ✕ button)
    const excludeButtons = screen.getAllByTitle(/excluir|exclude/i);
    fireEvent.click(excludeButtons[1]);

    await act(async () => {
      fireEvent.click(screen.getByText(/render video/i));
    });

    const { commands } = (store.applyTimelineCommands as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const excluded = commands.find(
      (c: { item_id: string }) => c.item_id === "clip-2"
    );
    expect(excluded).toMatchObject({ type: "set_timing", duration_sec: 0 });

    // Remaining clips keep correct cumulative start times
    const clip3Cmd = commands.find(
      (c: { item_id: string }) => c.item_id === "clip-3"
    );
    expect(clip3Cmd).toMatchObject({ type: "move", new_start_sec: 5 });
  });
});
