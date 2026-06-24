// webui-react/src/components/layout/NavBar.tsx
import { NavLink } from "react-router-dom";
import { Home, Settings } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/settings", label: "Config", icon: Settings, end: false },
];

export function NavBar() {
  return (
    <nav className="flex h-screen w-14 flex-col items-center border-r border-border bg-surface py-4 gap-1">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md bg-accent">
        <span className="text-xs font-bold text-white">MP</span>
      </div>
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) =>
            `flex h-10 w-10 flex-col items-center justify-center rounded-md text-[10px] gap-0.5 transition-colors ${
              isActive
                ? "bg-accent text-white"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
