// webui-react/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { Dashboard } from "./pages/Dashboard";
import { Workspace } from "./pages/Workspace";
import { Workspaces } from "./pages/Workspaces";
import { Settings } from "./pages/Settings";
import { Jobs } from "./pages/Jobs";

export default function App() {
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
          <Route path="workspaces" element={<Workspaces />} />
          <Route path="jobs" element={<Jobs />} />
        </Route>
        {/* Legacy redirects */}
        <Route path="auto" element={<Navigate to="/" replace />} />
        <Route path="editor" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
