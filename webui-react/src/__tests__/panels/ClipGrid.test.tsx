// webui-react/src/__tests__/panels/ClipGrid.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipGrid } from "../../components/panels/ClipGrid";
import type { TimelineItem } from "../../api/types";
import { vi } from "vitest";

const CLIPS: TimelineItem[] = [
  { id: "clip-1", start_sec: 0, duration_sec: 5.2 },
  { id: "clip-2", start_sec: 5.2, duration_sec: 4.8 },
  { id: "clip-3", start_sec: 10, duration_sec: 6.1 },
];

describe("ClipGrid", () => {
  it("renders clip count", () => {
    render(<ClipGrid clips={CLIPS} onExclude={vi.fn()} excluded={[]} />);
    expect(screen.getAllByText(/#[0-9]/i).length).toBeGreaterThan(0);
  });

  it("calls onExclude when exclude button clicked", async () => {
    const onExclude = vi.fn();
    render(<ClipGrid clips={CLIPS} onExclude={onExclude} excluded={[]} />);
    const excludeButtons = screen.getAllByTitle(/exclude/i);
    await userEvent.click(excludeButtons[0]);
    expect(onExclude).toHaveBeenCalledWith("clip-1");
  });

  it("dims excluded clips", () => {
    const { container } = render(
      <ClipGrid clips={CLIPS} onExclude={vi.fn()} excluded={["clip-2"]} />
    );
    const dimmed = container.querySelector('[data-excluded="true"]');
    expect(dimmed).toBeTruthy();
  });
});
