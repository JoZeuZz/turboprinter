// webui-react/src/__tests__/panels/VideoConfigPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VideoConfigPanel } from "../../components/panels/VideoConfigPanel";

vi.mock("../../api/video", () => ({
  videoApi: {
    getBgmList: vi.fn().mockResolvedValue({ files: [] }),
    createTask: vi.fn().mockResolvedValue({ task_id: "test-task-id" }),
  },
}));

vi.mock("../../store/useConfigStore", () => ({
  useConfigStore: () => ({ config: null }),
}));

describe("VideoConfigPanel", () => {
  it("renders Video, Audio, and Subtitles tabs", () => {
    render(<VideoConfigPanel />);
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Audio")).toBeInTheDocument();
    expect(screen.getByText("Subtitles")).toBeInTheDocument();
  });

  it("switches tab on click", async () => {
    render(<VideoConfigPanel />);
    await userEvent.click(screen.getByText("Audio"));
    expect(screen.getByText("Voice")).toBeInTheDocument();
  });

  it("shows Generate Video button", () => {
    render(<VideoConfigPanel />);
    expect(screen.getByText(/Generate Video/i)).toBeInTheDocument();
  });
});
