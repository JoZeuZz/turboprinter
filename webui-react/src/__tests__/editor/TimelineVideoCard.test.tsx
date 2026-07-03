import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { TimelineVideoCard } from "../../components/editor/TimelineVideoCard";
import type { TimelineItem } from "../../api/types";

const ITEM: TimelineItem = {
  id: "clip-1",
  start_sec: 0,
  duration_sec: 5,
  thumbnail_url: "https://example.com/thumb.jpg",
  text: "Scene 1",
};

function TestDndWrapper({ children, itemId }: { children: React.ReactNode; itemId: string }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  return (
    <DndContext sensors={sensors}>
      <SortableContext items={[itemId]} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

function renderCard(overrides: Partial<{ item: TimelineItem; isSelected: boolean; onSelect: (id: string) => void }> = {}) {
  const props = { item: ITEM, isSelected: false, onSelect: () => {}, ...overrides };
  return render(
    <TestDndWrapper itemId={props.item.id}>
      <TimelineVideoCard {...props} />
    </TestDndWrapper>
  );
}

describe("TimelineVideoCard", () => {
  it("renders with testid keyed by item id", () => {
    renderCard();
    expect(screen.getByTestId("clip-clip-1")).toBeInTheDocument();
  });

  it("shows the thumbnail image when available", () => {
    renderCard();
    expect(screen.getByAltText("Scene 1")).toBeInTheDocument();
  });

  it("falls back to text label when there is no thumbnail", () => {
    renderCard({ item: { ...ITEM, thumbnail_url: undefined } });
    expect(screen.getByText("Scene 1")).toBeInTheDocument();
  });

  it("shows the duration badge", () => {
    renderCard();
    expect(screen.getByText("5.0s")).toBeInTheDocument();
  });

  it("calls onSelect with the item id on click", async () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });
    await userEvent.click(screen.getByTestId("clip-clip-1"));
    expect(onSelect).toHaveBeenCalledWith("clip-1");
  });

  it("applies selected styling when isSelected is true", () => {
    renderCard({ isSelected: true });
    expect(screen.getByTestId("clip-clip-1").className).toMatch(/accent/);
  });
});
