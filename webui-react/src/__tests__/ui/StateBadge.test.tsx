import { render, screen } from "@testing-library/react";
import { StateBadge } from "../../components/ui/StateBadge";

describe("StateBadge", () => {
  it("renders label for draft", () => {
    render(<StateBadge panel="script" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders label for generating", () => {
    render(<StateBadge panel="generating" />);
    expect(screen.getByText("Generating…")).toBeInTheDocument();
  });

  it("renders label for done", () => {
    render(<StateBadge panel="done" />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders label for review", () => {
    render(<StateBadge panel="review" />);
    expect(screen.getByText("Review")).toBeInTheDocument();
  });
});
