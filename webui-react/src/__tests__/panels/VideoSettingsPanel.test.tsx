// webui-react/src/__tests__/panels/VideoSettingsPanel.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import { VideoSettingsPanel } from "../../components/panels/VideoSettingsPanel";
import { useVideoStore } from "../../store/useVideoStore";

beforeEach(() => {
  act(() => useVideoStore.getState().reset());
});

describe("VideoSettingsPanel", () => {
  it("renders aspect ratio select with default 9:16", () => {
    render(<VideoSettingsPanel />);
    const select = screen.getByLabelText("Aspect Ratio") as HTMLSelectElement;
    expect(select.value).toBe("9:16");
  });

  it("renders source select with default pexels", () => {
    render(<VideoSettingsPanel />);
    const select = screen.getByLabelText("Source") as HTMLSelectElement;
    expect(select.value).toBe("pexels");
  });
});
