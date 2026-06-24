// webui-react/src/__tests__/panels/ProgressArea.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import { ProgressArea } from "../../components/panels/ProgressArea";
import { useTaskStore } from "../../store/useTaskStore";
import { TASK_STATE_PROCESSING, TASK_STATE_COMPLETE } from "../../api/types";

beforeEach(() => {
  act(() => useTaskStore.getState().reset());
});

describe("ProgressArea", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<ProgressArea />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows progress bar when running", () => {
    act(() => {
      useTaskStore.getState().setRunning(true);
      useTaskStore.getState().updateStatus({
        state: TASK_STATE_PROCESSING,
        progress: 45,
        videos: [],
        combined_videos: [],
      });
    });
    render(<ProgressArea />);
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
  });

  it("shows done message on COMPLETE", () => {
    act(() => {
      useTaskStore.getState().updateStatus({
        state: TASK_STATE_COMPLETE,
        progress: 100,
        videos: ["/tasks/abc/final-1.mp4"],
        combined_videos: [],
      });
    });
    render(<ProgressArea />);
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });
});
