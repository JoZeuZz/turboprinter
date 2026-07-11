import { render, screen, fireEvent } from "@testing-library/react";
import { ClipInspector } from "../../components/editor/ClipInspector";
import type { TimelineItem } from "../../api/types";

const CLIP: TimelineItem = {
  id: "clip-1",
  start_sec: 0,
  duration_sec: 5,
  trim_start_sec: 0,
  trim_end_sec: 5,
  text: "Scene 1",
  provider: "pexels",
  keywords: ["ocean", "sunset"],
};

describe("ClipInspector", () => {
  it("shows a placeholder when no clip is selected", () => {
    render(<ClipInspector clip={null} onTrimChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByText(/selecciona un clip/i)).toBeInTheDocument();
  });

  it("shows clip metadata: text, duration, source, keywords", () => {
    render(<ClipInspector clip={CLIP} onTrimChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("Scene 1")).toBeInTheDocument();
    expect(screen.getByText("5.00s")).toBeInTheDocument();
    expect(screen.getByText("pexels")).toBeInTheDocument();
    expect(screen.getByText("ocean")).toBeInTheDocument();
  });

  it("does not render a Replace clip control", () => {
    render(<ClipInspector clip={CLIP} onTrimChange={() => {}} onRemove={() => {}} />);
    expect(screen.queryByText(/reemplazar/i)).not.toBeInTheDocument();
  });

  it("commits a trim change only after the slider is released", () => {
    const onTrimChange = vi.fn();
    render(<ClipInspector clip={CLIP} onTrimChange={onTrimChange} onRemove={() => {}} />);
    const [startSlider] = screen.getAllByRole("slider");
    fireEvent.change(startSlider, { target: { value: "1.5" } });
    expect(onTrimChange).not.toHaveBeenCalled();
    fireEvent.mouseUp(startSlider);
    expect(onTrimChange).toHaveBeenCalledWith("clip-1", 1.5, 5);
  });

  it("calls onRemove when the delete button is clicked", () => {
    const onRemove = vi.fn();
    render(<ClipInspector clip={CLIP} onTrimChange={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getByText(/eliminar|delete/i));
    expect(onRemove).toHaveBeenCalledWith("clip-1");
  });
});
