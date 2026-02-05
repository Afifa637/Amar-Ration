import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DistributorLayout from "./layouts/DistributorLayout";

import EntrancePage from "./pages/EntrancePage";
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
        
        <Route element={<DistributorLayout />}>
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
