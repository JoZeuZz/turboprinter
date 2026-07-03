// webui-react/src/__tests__/panels/ScriptPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ScriptPanel } from "../../components/panels/ScriptPanel";
import { useVideoStore } from "../../store/useVideoStore";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { useProjectStore } from "../../store/useProjectStore";

vi.mock("../../api/llm", () => ({
  llmApi: {
    generateScript: vi.fn().mockResolvedValue({ video_script: "Test script content" }),
    generateTerms: vi.fn().mockResolvedValue({ video_terms: ["cats", "animals"] }),
  },
}));

vi.mock("../../api/projects", () => ({
  projectsApi: {
    createFromScript: vi.fn(),
  },
}));

beforeEach(() => {
  act(() => useVideoStore.getState().reset());
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <ScriptPanel />
    </MemoryRouter>
  );
}

describe("ScriptPanel", () => {
  it("renders topic input", () => {
    renderPanel();
    expect(screen.getByPlaceholderText(/ejercicio matutino/i)).toBeInTheDocument();
  });

  it("generate button is disabled when topic is empty", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /generar guion/i })).toBeDisabled();
  });

  it("generate button enables when topic is filled", async () => {
    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/ejercicio matutino/i), "cats");
    expect(screen.getByRole("button", { name: /generar guion/i })).not.toBeDisabled();
  });

  it("updates store on script textarea change", async () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText(/guion generado/i);
    await userEvent.type(textarea, "Hello world");
    expect(useVideoStore.getState().video_script).toContain("Hello world");
  });

  it("marks project mode as disabled when createFromScript 404s", async () => {
    vi.mocked(projectsApi.createFromScript).mockRejectedValue(
      new ApiError(404, "project mode disabled")
    );
    act(() => useProjectStore.getState().reset());

    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/ejercicio matutino/i), "cats");
    await userEvent.click(screen.getByRole("button", { name: /generar guion/i }));

    await waitFor(() => {
      expect(useProjectStore.getState().mode).toBe("disabled");
    });
  });
});
