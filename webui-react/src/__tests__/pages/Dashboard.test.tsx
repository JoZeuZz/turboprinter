// webui-react/src/__tests__/pages/Dashboard.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("../../api/projects", () => ({
  projectsApi: {
    listProjects: vi.fn().mockResolvedValue({ projects: [] }),
  },
}));

import { Dashboard } from "../../pages/Dashboard";

describe("Dashboard", () => {
  it("renders New Project button", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText(/New Project/i)).toBeInTheDocument();
  });

  it("shows empty state when no projects", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    // Wait for async load
    await screen.findByText(/no projects yet/i);
  });
});
