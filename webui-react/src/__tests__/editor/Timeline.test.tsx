// webui-react/src/__tests__/editor/Timeline.test.tsx
import { render, screen } from "@testing-library/react";
import { Timeline } from "../../components/editor/Timeline";
import type { TimelineItem } from "../../api/types";

const ITEMS: TimelineItem[] = [
  { id: "c1", start_sec: 0, duration_sec: 5 },
  { id: "c2", start_sec: 5, duration_sec: 4 },
  { id: "c3", start_sec: 9, duration_sec: 6 },
];

describe("Timeline", () => {
  it("renders all clip ids", () => {
    render(<Timeline items={ITEMS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("clip-c1")).toBeInTheDocument();
    expect(screen.getByTestId("clip-c2")).toBeInTheDocument();
    expect(screen.getByTestId("clip-c3")).toBeInTheDocument();
  });

  it("marks selected clip", () => {
    render(<Timeline items={ITEMS} selectedId="c2" onSelect={() => {}} />);
    const clip = screen.getByTestId("clip-c2");
    expect(clip.className).toMatch(/accent/);
  });
});
