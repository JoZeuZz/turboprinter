import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorPanel } from "../../components/panels/EditorPanel";
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
      id: "video_1", type: "video", name: "Video",
      items: [
        { id: "c1", start_sec: 0, duration_sec: 5, text: "One", asset_url: "https://example.com/c1.mp4" },
        { id: "c2", start_sec: 5, duration_sec: 3, text: "Two" },
      ],
    },
    {
      id: "audio_1", type: "audio", name: "Audio",
      items: [{ id: "a1", start_sec: 0, duration_sec: 8 }],
    },
  ],
};

function makeStore(overrides = {}) {
  return {
    mode: "ready",
    project: PROJECT,
    applyTimelineCommands: vi.fn().mockResolvedValue(undefined),
    render: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useProjectStore).mockReturnValue(makeStore() as never);
});

describe("EditorPanel", () => {
  it("renders video clips from the project's video track", () => {
    render(<EditorPanel />);
    expect(screen.getByTestId("clip-c1")).toBeInTheDocument();
    expect(screen.getByTestId("clip-c2")).toBeInTheDocument();
  });

  it("renders audio track items", () => {
    render(<EditorPanel />);
    expect(screen.getByTestId("audio-a1")).toBeInTheDocument();
  });

  it("shows the not-available message when project mode is disabled", () => {
    vi.mocked(useProjectStore).mockReturnValue(makeStore({ mode: "disabled" }) as never);
    render(<EditorPanel />);
    expect(screen.getByText(/editor no disponible/i)).toBeInTheDocument();
  });

  it("passes the video track items and selection to VideoPreview", () => {
    render(<EditorPanel />);
    // No clip selected yet: VideoPreview defaults to the first item, which
    // now carries an asset_url in this fixture, so the video element renders it.
    const video = screen.getByTestId("video-preview") as HTMLVideoElement;
    expect(video.src).toContain("c1.mp4");
  });

  it("removes the selected clip when Delete is pressed", async () => {
    const store = makeStore();
    vi.mocked(useProjectStore).mockReturnValue(store as never);
    render(<EditorPanel />);
    await userEvent.click(screen.getByTestId("clip-c1"));
    fireEvent.keyDown(window, { key: "Delete" });
    expect(store.applyTimelineCommands).toHaveBeenCalledWith({
      commands: [{ type: "move", track_id: "video_1", item_id: "c1", new_start_sec: -1 }],
    });
  });

  it("ignores Delete while typing in an input", async () => {
    const store = makeStore();
    vi.mocked(useProjectStore).mockReturnValue(store as never);
    render(<EditorPanel />);
    await userEvent.click(screen.getByTestId("clip-c1"));
    (store.applyTimelineCommands as ReturnType<typeof vi.fn>).mockClear();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: "Delete" });
    expect(store.applyTimelineCommands).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
