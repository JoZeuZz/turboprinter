// webui-react/src/components/layout/NavBar.tsx
import { NavLink } from "react-router-dom";
import { Home, Settings, Film } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../store/useProjectStore";

export function NavBar() {
  const { t } = useTranslation();
  const { projectId } = useProjectStore();
  const workspaceHref = projectId ? `/project/${projectId}` : "/";

  return (
    <nav className="flex h-screen w-[72px] flex-col items-center border-r border-border bg-surface py-4 gap-1.5">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-accent">
        <span className="text-xs font-bold text-white">MP</span>
      </div>
      <NavLink
        to="/"
        end
        title={t("nav.home")}
        className={({ isActive }) =>
          `flex h-12 w-[56px] flex-col items-center justify-center rounded-md text-[11px] gap-0.5 transition-colors ${
            isActive
              ? "bg-accent text-white"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`
        }
      >
        <Home className="h-[18px] w-[18px]" />
        {t("nav.home")}
      </NavLink>
      <NavLink
        to={workspaceHref}
        end={false}
        title={t("nav.workspace")}
        className={({ isActive }) =>
          `flex h-12 w-[56px] flex-col items-center justify-center rounded-md text-[11px] gap-0.5 transition-colors ${
            isActive && workspaceHref !== "/"
              ? "bg-accent text-white"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`
        }
      >
        <Film className="h-[18px] w-[18px]" />
        {t("nav.workspace")}
      </NavLink>
      <NavLink
        to="/settings"
        end={false}
        title={t("nav.config")}
        className={({ isActive }) =>
          `flex h-12 w-[56px] flex-col items-center justify-center rounded-md text-[11px] gap-0.5 transition-colors ${
            isActive
              ? "bg-accent text-white"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`
        }
      >
        <Settings className="h-[18px] w-[18px]" />
        {t("nav.config")}
      </NavLink>
    </nav>
  );
}
