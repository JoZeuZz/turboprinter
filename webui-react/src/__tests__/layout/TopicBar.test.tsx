import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { TopicBar } from "../../components/layout/TopicBar";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import type { TaskStatus } from "../../api/types";

function renderAtNew() {
  return render(
    <MemoryRouter initialEntries={["/project/new"]}>
      <TopicBar />
    </MemoryRouter>
  );
}

function renderAtProject(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/project/${id}`]}>
      <Routes>
        <Route path="/project/:id" element={<TopicBar />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TopicBar origin", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useProjectWorkspaceStore.getState().reset();
    useProjectStore.getState().reset();
  });

  it("shows draft on /project/new with a clean store", () => {
    renderAtNew();
    expect(screen.getByTestId("origin-badge")).toHaveAttribute("data-origin", "draft");
  });

  it("shows generating while a generation is in progress", () => {
    useProjectWorkspaceStore.setState({ panel: "generating" });
    renderAtNew();
    expect(screen.getByTestId("origin-badge")).toHaveAttribute("data-origin", "generating");
  });

  it("shows finished for a video generated this session", () => {
    useProjectWorkspaceStore.setState({
      taskId: "t1",
      taskStatus: { state: 1 } as TaskStatus,
      panel: "done",
      videoUrls: ["/v.mp4"],
    });
    renderAtNew();
    expect(screen.getByTestId("origin-badge")).toHaveAttribute("data-origin", "finished");
  });

  it("shows history for a project opened by id with no session task", () => {
    useProjectWorkspaceStore.setState({ taskId: null, taskStatus: null, panel: "review" });
    renderAtProject("p1");
    expect(screen.getByTestId("origin-badge")).toHaveAttribute("data-origin", "history");
  });

  it("renders the Spanish origin label for draft", () => {
    renderAtNew();
    expect(screen.getByTestId("origin-badge")).toHaveTextContent("Sin guardar");
  });
});
