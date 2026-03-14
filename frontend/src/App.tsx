import { BrowserRouter, Routes, Route } from "react-router-dom";
import DistributorLayout from "./layouts/DistributorLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import EntrancePage from "./pages/EntrancePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DistributorDashboard from "./pages/DistributorDashboard";
import BeneficiariesPage from "./pages/BeneficiariesPage";
import CardsTokensPage from "./pages/CardsTokensPage";
import StockDistributionPage from "./pages/StockDistributionPage";
import AuditLogPage from "./pages/AuditLogPage";
import ReportsPage from "./pages/ReportsPage";
import MonitoringPage from "./pages/MonitoringPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDistributorsPage from "./pages/admin/AdminDistributorsPage";
import AdminConsumersPage from "./pages/admin/AdminConsumersPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntrancePage />} />
        <Route path="/login/:role" element={<LoginPage />} />
        <Route path="/signup/:role" element={<SignupPage />} />

        <Route
          element={
            <ProtectedRoute allowedRoles={["central-admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route
            path="/admin/distributors"
            element={<AdminDistributorsPage />}
          />
          <Route path="/admin/consumers" element={<AdminConsumersPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={["distributor", "field-distributor"]}>
              <DistributorLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DistributorDashboard />} />
          <Route path="/beneficiaries" element={<BeneficiariesPage />} />
          <Route path="/cards" element={<CardsTokensPage />} />
          <Route path="/stock" element={<StockDistributionPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
