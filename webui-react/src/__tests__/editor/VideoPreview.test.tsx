import { render, screen, fireEvent } from "@testing-library/react";
import { VideoPreview } from "../../components/editor/VideoPreview";
import type { TimelineItem } from "../../api/types";

const ITEMS: TimelineItem[] = [
  { id: "c1", start_sec: 0, duration_sec: 5, asset_url: "https://example.com/c1.mp4" },
  { id: "c2", start_sec: 5, duration_sec: 4, asset_url: "https://example.com/c2.mp4" },
];

describe("VideoPreview", () => {
  it("shows a placeholder when there are no items", () => {
    render(<VideoPreview items={[]} selectedId={null} />);
    expect(screen.getByText(/selecciona un clip/i)).toBeInTheDocument();
  });

  it("plays the first item by default when nothing is selected", () => {
    render(<VideoPreview items={ITEMS} selectedId={null} />);
    const video = screen.getByTestId("video-preview") as HTMLVideoElement;
    expect(video.src).toContain("c1.mp4");
  });

  it("jumps to the selected item", () => {
    render(<VideoPreview items={ITEMS} selectedId="c2" />);
    const video = screen.getByTestId("video-preview") as HTMLVideoElement;
    expect(video.src).toContain("c2.mp4");
  });

  it("advances to the next item when the current one ends", () => {
    render(<VideoPreview items={ITEMS} selectedId="c1" />);
    const video = screen.getByTestId("video-preview") as HTMLVideoElement;
    fireEvent.ended(video);
    expect(video.src).toContain("c2.mp4");
  });

  it("stays on the last item when it ends and there is no next item", () => {
    render(<VideoPreview items={ITEMS} selectedId="c2" />);
    const video = screen.getByTestId("video-preview") as HTMLVideoElement;
    fireEvent.ended(video);
    expect(video.src).toContain("c2.mp4");
  });

  it("falls back to items[0] when selectedId transitions from a value to null", () => {
    const { rerender } = render(<VideoPreview items={ITEMS} selectedId="c2" />);
    const video = screen.getByTestId("video-preview") as HTMLVideoElement;
    expect(video.src).toContain("c2.mp4");

    rerender(<VideoPreview items={ITEMS} selectedId={null} />);
    expect(video.src).toContain("c1.mp4");
  });
});
