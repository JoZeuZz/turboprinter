// webui-react/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { AutoFlow } from "./pages/AutoFlow";
import { Settings } from "./pages/Settings";
import { Editor } from "./pages/Editor";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<AutoFlow />} />
          <Route path="settings" element={<Settings />} />
          <Route path="editor" element={<Editor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
