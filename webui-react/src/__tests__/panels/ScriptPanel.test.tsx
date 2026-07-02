// webui-react/src/__tests__/panels/ScriptPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ScriptPanel } from "../../components/panels/ScriptPanel";
import { useVideoStore } from "../../store/useVideoStore";

vi.mock("../../api/llm", () => ({
  llmApi: {
    generateScript: vi.fn().mockResolvedValue({ video_script: "Test script content" }),
    generateTerms: vi.fn().mockResolvedValue({ video_terms: ["cats", "animals"] }),
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
    expect(screen.getByPlaceholderText(/morning exercise/i)).toBeInTheDocument();
  });

  it("generate button is disabled when topic is empty", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /generate script/i })).toBeDisabled();
  });

  it("generate button enables when topic is filled", async () => {
    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/morning exercise/i), "cats");
    expect(screen.getByRole("button", { name: /generate script/i })).not.toBeDisabled();
  });

  it("updates store on script textarea change", async () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText(/generated script/i);
    await userEvent.type(textarea, "Hello world");
    expect(useVideoStore.getState().video_script).toContain("Hello world");
  });
});
