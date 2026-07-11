// webui-react/src/components/layout/Layout.tsx
import { Outlet } from "react-router-dom";
import { NavBar } from "./NavBar";

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <NavBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
