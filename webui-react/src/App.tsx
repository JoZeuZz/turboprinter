// webui-react/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { Dashboard } from "./pages/Dashboard";
import { Workspace } from "./pages/Workspace";
import { Settings } from "./pages/Settings";
// Keep old pages during migration period
import { AutoFlow } from "./pages/AutoFlow";
import { Editor } from "./pages/Editor";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* New workspace routes */}
        <Route element={<WorkspaceLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="project/new" element={<Workspace />} />
          <Route path="project/:id" element={<Workspace />} />
        </Route>
        {/* Legacy routes — kept during migration */}
        <Route element={<Layout />}>
          <Route path="auto" element={<AutoFlow />} />
          <Route path="editor" element={<Editor />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
