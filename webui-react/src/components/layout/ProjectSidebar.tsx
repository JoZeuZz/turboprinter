import { PlusCircle, Settings } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

export function ProjectSidebar() {
  const navigate = useNavigate();
  const { reset } = useProjectWorkspaceStore();

  const handleNew = () => {
    reset();
    navigate("/project/new");
  };

  return (
    <nav className="flex h-screen w-48 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent text-xs font-bold text-white">
          TP
        </div>
        <span className="text-sm font-semibold text-foreground truncate">TurboPrinter</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={handleNew}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
        >
          <PlusCircle className="h-4 w-4 text-accent shrink-0" />
          New Project
        </button>

        <div className="mt-2 space-y-0.5" id="recent-projects">
          {/* Recent projects rendered by Dashboard data; empty here until Task 5 wires it */}
        </div>
      </div>

      <div className="border-t border-border p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground hover:bg-surface-2"
            }`
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
