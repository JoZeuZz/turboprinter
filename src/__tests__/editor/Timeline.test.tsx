import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timeline } from "../../components/editor/Timeline";
import type { TimelineTrack } from "../../api/types";

const VIDEO_TRACK: TimelineTrack = {
  id: "video_1",
  type: "video",
  name: "Video",
  items: [
    { id: "c1", start_sec: 0, duration_sec: 5, text: "One" },
    { id: "c2", start_sec: 5, duration_sec: 4, text: "Two" },
    { id: "c3", start_sec: 9, duration_sec: 6, text: "Three" },
  ],
};

const AUDIO_TRACK: TimelineTrack = {
  id: "audio_1",
  type: "audio",
  name: "Audio",
  items: [{ id: "a1", start_sec: 0, duration_sec: 15 }],
};

const SUBTITLE_TRACK: TimelineTrack = {
  id: "subtitle_1",
  type: "subtitle",
  name: "Subtitle",
  items: [{ id: "s1", start_sec: 0, duration_sec: 15 }],
};

function renderTimeline(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
  return render(
    <Timeline
      videoTrack={VIDEO_TRACK}
      audioTrack={undefined}
      subtitleTrack={undefined}
      selectedId={null}
      onSelect={() => {}}
      onReorder={() => {}}
      {...overrides}
    />
  );
}

describe("Timeline", () => {
  it("renders all video clip cards", () => {
    renderTimeline();
    expect(screen.getByTestId("clip-c1")).toBeInTheDocument();
    expect(screen.getByTestId("clip-c2")).toBeInTheDocument();
    expect(screen.getByTestId("clip-c3")).toBeInTheDocument();
  });

  it("marks the selected clip", () => {
    renderTimeline({ selectedId: "c2" });
    expect(screen.getByTestId("clip-c2").className).toMatch(/accent/);
  });

  it("calls onSelect when a clip card is clicked", async () => {
    const onSelect = vi.fn();
    renderTimeline({ onSelect });
    await userEvent.click(screen.getByTestId("clip-c1"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("renders audio track items read-only", () => {
    renderTimeline({ audioTrack: AUDIO_TRACK });
    expect(screen.getByTestId("audio-a1")).toBeInTheDocument();
  });

  it("renders subtitle track items read-only", () => {
    renderTimeline({ subtitleTrack: SUBTITLE_TRACK });
    expect(screen.getByTestId("subtitle-s1")).toBeInTheDocument();
  });

  it("renders nothing in the video row when there is no video track", () => {
    renderTimeline({ videoTrack: undefined });
    expect(screen.queryByTestId("clip-c1")).not.toBeInTheDocument();
  });

  it("sizes clip cards proportionally to their duration", () => {
    renderTimeline();
    const c1Width = parseFloat(screen.getByTestId("clip-c1").style.width);
    const c3Width = parseFloat(screen.getByTestId("clip-c3").style.width);
    // c1 is 5s, c3 is 6s: c3 must render wider.
    expect(c3Width).toBeGreaterThan(c1Width);
  });

  it("positions the playhead according to currentTime", () => {
    const atZero = renderTimeline({ currentTime: 0 });
    const leftAt0 = parseFloat(
      (atZero.container.querySelector('[data-testid="timeline-playhead"]') as HTMLElement).style
        .left
    );
    atZero.unmount();

    const atFive = renderTimeline({ currentTime: 5 });
    const leftAt5 = parseFloat(
      (atFive.container.querySelector('[data-testid="timeline-playhead"]') as HTMLElement).style
        .left
    );

    expect(leftAt5).toBeGreaterThan(leftAt0);
  });

  it("selects the clip covering the clicked ruler position", async () => {
    const onSelect = vi.fn();
    renderTimeline({ onSelect });
    const ruler = screen.getByTestId("timeline-ruler");
    ruler.getBoundingClientRect = () =>
      ({ left: 0, right: 500, top: 0, bottom: 0, width: 500, height: 20 }) as DOMRect;
    fireEvent.click(ruler, { clientX: 10 }); // well within c1's span at default zoom
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("zoom-in increases clip card width", () => {
    renderTimeline();
    const before = parseFloat(screen.getByTestId("clip-c1").style.width);
    fireEvent.click(screen.getByTestId("timeline-zoom-in"));
    const after = parseFloat(screen.getByTestId("clip-c1").style.width);
    expect(after).toBeGreaterThan(before);
  });
});
