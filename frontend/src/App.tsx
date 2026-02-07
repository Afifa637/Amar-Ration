import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DistributorLayout from "./layouts/DistributorLayout";
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntrancePage />} />
        <Route path="/login/:role" element={<LoginPage />} />
        <Route path="/signup/:role" element={<SignupPage />} />
        
        <Route element={
          <ProtectedRoute allowedRoles={['central-admin', 'distributor', 'field-distributor']}>
            <DistributorLayout />
          </ProtectedRoute>
        }>
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
