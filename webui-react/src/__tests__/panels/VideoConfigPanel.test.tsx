// webui-react/src/__tests__/panels/VideoConfigPanel.test.tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import { VideoConfigPanel } from "../../components/panels/VideoConfigPanel";
import { useVideoStore } from "../../store/useVideoStore";
import { voiceApi } from "../../api/voice";
import { videoApi } from "../../api/video";

vi.mock("../../api/voice", () => ({
  voiceApi: { getVoices: vi.fn(), previewVoice: vi.fn() },
}));

vi.mock("../../api/video", () => ({
  videoApi: {
    getBgmList: vi.fn(),
    createTask: vi.fn(),
  },
}));

vi.mock("../../store/useProjectWorkspaceStore", () => ({
  useProjectWorkspaceStore: () => ({
    generateVideo: vi.fn(),
    setPanel: vi.fn(),
  }),
}));

vi.mock("../../store/useConfigStore", () => ({
  useConfigStore: () => ({ config: null }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(videoApi.getBgmList).mockResolvedValue({ files: [] });
  vi.mocked(videoApi.createTask).mockResolvedValue({ task_id: "test-task-id" });
  vi.mocked(voiceApi.getVoices).mockResolvedValue([
    { value: "es-ES-AlvaroNeural-Male", label: "es-ES AlvaroNeural (Male)" },
    { value: "es-ES-ElviraNeural-Female", label: "es-ES ElviraNeural (Female)" },
  ]);
  act(() => useVideoStore.getState().reset());
});

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
    expect(screen.getByText("Buscar voz")).toBeInTheDocument();
  });

  it("shows Generate Video button", () => {
    render(<VideoConfigPanel />);
    expect(screen.getByText(/Generate Video/i)).toBeInTheDocument();
  });
});

describe("VideoConfigPanel TTS", () => {
  it("renders TTS Provider select in audio tab", async () => {
    render(<VideoConfigPanel />);
    await userEvent.click(screen.getByText("Audio"));
    expect(screen.getByLabelText("TTS Provider")).toBeInTheDocument();
  });

  it("fetches voices on mount and populates voice select", async () => {
    render(<VideoConfigPanel />);
    await userEvent.click(screen.getByText("Audio"));
    await waitFor(() =>
      expect(voiceApi.getVoices).toHaveBeenCalledWith("azure-tts-v1")
    );
    await waitFor(() =>
      expect(screen.getByText("Alvaro")).toBeInTheDocument()
    );
  });

  it("re-fetches voices when provider changes", async () => {
    vi.mocked(voiceApi.getVoices).mockResolvedValueOnce([
      { value: "siliconflow:x:alex-Male", label: "alex (Male)" },
    ]);
    render(<VideoConfigPanel />);
    await userEvent.click(screen.getByText("Audio"));
    await waitFor(() => expect(voiceApi.getVoices).toHaveBeenCalledTimes(1));

    const providerSelect = screen.getByLabelText("TTS Provider") as HTMLSelectElement;
    await userEvent.selectOptions(providerSelect, "siliconflow");

    await waitFor(() =>
      expect(voiceApi.getVoices).toHaveBeenCalledWith("siliconflow")
    );
  });

  it("hides voice controls when provider is no-voice", async () => {
    vi.mocked(voiceApi.getVoices).mockResolvedValue([]);
    render(<VideoConfigPanel />);
    await userEvent.click(screen.getByText("Audio"));
    const providerSelect = screen.getByLabelText("TTS Provider") as HTMLSelectElement;
    await userEvent.selectOptions(providerSelect, "no-voice");
    await waitFor(() =>
      expect(screen.queryByText("Buscar voz")).not.toBeInTheDocument()
    );
  });
});
