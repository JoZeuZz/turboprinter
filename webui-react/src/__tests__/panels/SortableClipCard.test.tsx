import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { SortableClipCard } from "../../components/panels/SortableClipCard";
import type { TimelineItem } from "../../api/types";

const CLIP: TimelineItem = {
  id: "clip-1",
  start_sec: 0,
  duration_sec: 5.3,
  thumbnail_url: "http://example.com/thumb.jpg",
  text: "Scene 1",
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <DndContext>{children}</DndContext>
);

describe("SortableClipCard", () => {
  it("renders clip duration badge", () => {
    render(
      <Wrapper>
        <SortableClipCard
          clip={CLIP}
          excluded={false}
          onExclude={vi.fn()}
          onPreview={vi.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText(/5\.3s/i)).toBeInTheDocument();
  });

  it("renders thumbnail image when thumbnail_url present", () => {
    render(
      <Wrapper>
        <SortableClipCard
          clip={CLIP}
          excluded={false}
          onExclude={vi.fn()}
          onPreview={vi.fn()}
        />
      </Wrapper>
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("thumb.jpg");
  });

  it("applies reduced opacity when excluded", () => {
    const { container } = render(
      <Wrapper>
        <SortableClipCard
          clip={CLIP}
          excluded={true}
          onExclude={vi.fn()}
          onPreview={vi.fn()}
        />
      </Wrapper>
    );
    const card = container.querySelector('[data-excluded="true"]');
    expect(card).toBeTruthy();
  });

  it("calls onExclude when exclude button clicked", () => {
    const onExclude = vi.fn();
    render(
      <Wrapper>
        <SortableClipCard
          clip={CLIP}
          excluded={false}
          onExclude={onExclude}
          onPreview={vi.fn()}
        />
      </Wrapper>
    );
    fireEvent.click(screen.getByTitle(/excluir|exclude/i));
    expect(onExclude).toHaveBeenCalledWith("clip-1");
  });

  it("calls onPreview when play button clicked", () => {
    const onPreview = vi.fn();
    render(
      <Wrapper>
        <SortableClipCard
          clip={CLIP}
          excluded={false}
          onExclude={vi.fn()}
          onPreview={onPreview}
        />
      </Wrapper>
    );
    fireEvent.click(screen.getByTitle(/preview|previsualizar/i));
    expect(onPreview).toHaveBeenCalledWith(CLIP);
  });
});
