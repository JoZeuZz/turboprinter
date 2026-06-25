import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClipPreviewModal } from "../../components/ui/ClipPreviewModal";
import type { TimelineItem } from "../../api/types";

const CLIP: TimelineItem = {
  id: "clip-1",
  start_sec: 0,
  duration_sec: 5,
  source_url: "http://example.com/video.mp4",
  text: "Scene 1",
};

describe("ClipPreviewModal", () => {
  it("renders nothing when clip is null", () => {
    const { container } = render(
      <ClipPreviewModal clip={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders video element with source_url", () => {
    render(<ClipPreviewModal clip={CLIP} onClose={vi.fn()} />);
    const video = screen.getByTestId("preview-video") as HTMLVideoElement;
    expect(video.src).toContain("video.mp4");
  });

  it("shows 'Preview no disponible' when no source_url or local_path", () => {
    const noSource: TimelineItem = { id: "x", start_sec: 0, duration_sec: 3 };
    render(<ClipPreviewModal clip={noSource} onClose={vi.fn()} />);
    expect(screen.getByText(/preview no disponible/i)).toBeInTheDocument();
  });

  it("calls onClose on overlay click", () => {
    const onClose = vi.fn();
    render(<ClipPreviewModal clip={CLIP} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("modal-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ClipPreviewModal clip={CLIP} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows clip text as title", () => {
    render(<ClipPreviewModal clip={CLIP} onClose={vi.fn()} />);
    expect(screen.getByText("Scene 1")).toBeInTheDocument();
  });
});
