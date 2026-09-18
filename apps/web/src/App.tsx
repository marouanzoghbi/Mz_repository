import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AutomationEditorPage } from "./pages/AutomationEditorPage.js";
import { AutomationsPage } from "./pages/AutomationsPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { DevicesPage } from "./pages/DevicesPage.js";
import { IntegrationsPage } from "./pages/IntegrationsPage.js";
import { LoginPage } from "./pages/LoginPage.js";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/automations" element={<AutomationsPage />} />
        <Route path="/automations/new" element={<AutomationEditorPage />} />
        <Route path="/automations/:id/edit" element={<AutomationEditorPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
