// webui-react/src/__tests__/pages/AutoFlow.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { act } from "@testing-library/react";
import { AutoFlow } from "../../pages/AutoFlow";
import { useVideoStore } from "../../store/useVideoStore";
import { useTaskStore } from "../../store/useTaskStore";

vi.mock("../../api/llm", () => ({
  llmApi: {
    generateScript: vi.fn().mockResolvedValue({ video_script: "" }),
    generateTerms: vi.fn().mockResolvedValue({ video_terms: [] }),
  },
}));

vi.mock("../../api/video", () => ({
  videoApi: {
    createTask: vi.fn().mockResolvedValue({ task_id: "test-id" }),
    getBgmList: vi.fn().mockResolvedValue({ files: [] }),
  },
}));

vi.mock("../../api/config", () => ({
  configApi: {
    get: vi.fn().mockResolvedValue({
      video_sources: ["pexels", "pixabay", "local"],
      subtitle_position_default: "bottom",
      custom_position_default: 70.0,
    }),
  },
}));

vi.mock("../../api/polling", () => ({
  pollTask: vi.fn().mockResolvedValue({ state: 1, progress: 100, videos: [], combined_videos: [] }),
}));

beforeEach(() => {
  act(() => {
    useVideoStore.getState().reset();
    useTaskStore.getState().reset();
  });
});

describe("AutoFlow", () => {
  it("renders all three panels", () => {
    render(
      <MemoryRouter>
        <AutoFlow />
      </MemoryRouter>
    );
    // ScriptPanel heading ("Script" also appears as a textarea label, so use getAllByText)
    expect(screen.getAllByText("Script")[0]).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /audio/i })).toBeInTheDocument();
  });

  it("Generate button is disabled when topic is empty", () => {
    render(
      <MemoryRouter>
        <AutoFlow />
      </MemoryRouter>
    );
    expect(screen.getAllByRole("button", { name: /generate/i })[0]).toBeDisabled();
  });
});
