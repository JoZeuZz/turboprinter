// webui-react/src/__tests__/panels/AudioSubtitlePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import { AudioSubtitlePanel } from "../../components/panels/AudioSubtitlePanel";
import { useVideoStore } from "../../store/useVideoStore";

vi.mock("../../api/video", () => ({
  videoApi: {
    getBgmList: vi.fn().mockResolvedValue({ files: [] }),
  },
}));

vi.mock("../../api/voice", () => ({
  voiceApi: {
    previewVoice: vi.fn(),
  },
}));

beforeEach(() => {
  act(() => useVideoStore.getState().reset());
});

describe("AudioSubtitlePanel", () => {
  it("renders voice gallery", () => {
    render(<AudioSubtitlePanel />);
    expect(screen.getByText("Buscar voz")).toBeInTheDocument();
  });

  it("renders subtitle checkbox checked by default", () => {
    render(<AudioSubtitlePanel />);
    const checkbox = screen.getByRole("checkbox", { name: /enable subtitles/i });
    expect(checkbox).toBeChecked();
  });
});
