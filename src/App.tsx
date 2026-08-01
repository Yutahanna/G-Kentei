import { Route, Routes } from "react-router-dom";
import Layout from "./app/Layout";
import DashboardPage from "./features/dashboard/DashboardPage";
import ChapterListPage from "./features/materials-viewer/ChapterListPage";
import ChapterViewPage from "./features/materials-viewer/ChapterViewPage";
import DrillSetupPage from "./features/drill/DrillSetupPage";
import DrillPlayPage from "./features/drill/DrillPlayPage";
import DrillResultPage from "./features/drill/DrillResultPage";
import SettingsPage from "./features/settings/SettingsPage";
import NotFoundPage from "./app/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="materials" element={<ChapterListPage />} />
        <Route path="materials/:chapterId" element={<ChapterViewPage />} />
        <Route path="drill" element={<DrillSetupPage />} />
        <Route path="drill/:chapterId/play" element={<DrillPlayPage />} />
        <Route path="drill/:chapterId/result" element={<DrillResultPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
