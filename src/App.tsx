// webui-react/src/App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { Dashboard } from "./pages/Dashboard";
import { Workspace } from "./pages/Workspace";
import { Settings } from "./pages/Settings";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { configApi } from "./api/config";
import { useConfigStore } from "./store/useConfigStore";

export default function App() {
  const { setConfig } = useConfigStore();

  useEffect(() => {
    configApi
      .get()
      .then((cfg) => {
        setConfig(cfg);
      })
      .catch((err) => {
        console.error("Error loading initial config:", err);
      });
  }, [setConfig]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="project/new" element={<Workspace />} />
          <Route path="project/:id" element={<Workspace />} />
        </Route>
        <Route element={<Layout />}>
          <Route path="settings" element={<Settings />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
        </Route>
        {/* Legacy redirects */}
        <Route path="auto" element={<Navigate to="/" replace />} />
        <Route path="editor" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
