// webui-react/src/components/layout/NavBar.tsx
import { NavLink } from "react-router-dom";
import { Home, Settings, Film } from "lucide-react";
import { useProjectStore } from "../../store/useProjectStore";

export function NavBar() {
  const { projectId } = useProjectStore();
  const workspaceHref = projectId ? `/project/${projectId}` : "/";

  return (
    <nav className="flex h-screen w-14 flex-col items-center border-r border-border bg-surface py-4 gap-1">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md bg-accent">
        <span className="text-xs font-bold text-white">MP</span>
      </div>
      <NavLink
        to="/"
        end
        title="Home"
        className={({ isActive }) =>
          `flex h-10 w-10 flex-col items-center justify-center rounded-md text-[10px] gap-0.5 transition-colors ${
            isActive
              ? "bg-accent text-white"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`
        }
      >
        <Home className="h-4 w-4" />
        Home
      </NavLink>
      <NavLink
        to={workspaceHref}
        end={false}
        title="Workspace"
        className={({ isActive }) =>
          `flex h-10 w-10 flex-col items-center justify-center rounded-md text-[10px] gap-0.5 transition-colors ${
            isActive && workspaceHref !== "/"
              ? "bg-accent text-white"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`
        }
      >
        <Film className="h-4 w-4" />
        Work
      </NavLink>
      <NavLink
        to="/settings"
        end={false}
        title="Config"
        className={({ isActive }) =>
          `flex h-10 w-10 flex-col items-center justify-center rounded-md text-[10px] gap-0.5 transition-colors ${
            isActive
              ? "bg-accent text-white"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`
        }
      >
        <Settings className="h-4 w-4" />
        Config
      </NavLink>
    </nav>
  );
}
