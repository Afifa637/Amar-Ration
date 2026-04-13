import { BrowserRouter, Routes, Route } from "react-router-dom";
import DistributorLayout from "./layouts/DistributorLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import EntrancePage from "./pages/EntrancePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";
import DistributorDashboard from "./pages/distributor/DistributorDashboard";
import BeneficiariesPage from "./pages/distributor/BeneficiariesPage";
import CardsTokensPage from "./pages/distributor/CardsTokensPage";
import StockDistributionPage from "./pages/distributor/StockDistributionPage";
import LiveQueuePage from "./pages/distributor/LiveQueuePage";
import AuditLogPage from "./pages/distributor/AuditLogPage";
import ReportsPage from "./pages/distributor/ReportsPage";
import MonitoringPage from "./pages/distributor/MonitoringPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import ComplaintSubmitPage from "./pages/ComplaintSubmitPage";
import AppealSubmitPage from "./pages/AppealSubmitPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDistributorsPage from "./pages/admin/AdminDistributorsPage";
import AdminConsumersPage from "./pages/admin/AdminConsumersPage";
import AdminCardsPage from "./pages/admin/AdminCardsPage";
import AdminDistributionPage from "./pages/admin/AdminDistributionPage";
import AdminAuditPage from "./pages/admin/AdminAuditPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminQRRotationPage from "./pages/admin/AdminQRRotationPage";
import AdminComplaintsPage from "./pages/admin/AdminComplaintsPage";
import AdminAppealsPage from "./pages/admin/AdminAppealsPage";
import AdminFraudDashboard from "./pages/admin/AdminFraudDashboard";
import AdminSessionHealthPage from "./pages/admin/AdminSessionHealthPage";
import AdminEligibilityPage from "./pages/admin/AdminEligibilityPage";
import AdminStockSuggestionPage from "./pages/admin/AdminStockSuggestionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntrancePage />} />
        <Route path="/login/:role" element={<LoginPage />} />
        <Route path="/signup/:role" element={<SignupPage />} />
        <Route path="/pending-approval" element={<PendingApprovalPage />} />
        <Route path="/public/complaint" element={<ComplaintSubmitPage />} />
        <Route path="/public/appeal" element={<AppealSubmitPage />} />
        <Route
          path="/force-password-change"
          element={
            <ProtectedRoute
              allowedRoles={[
                "central-admin",
                "distributor",
                "field-distributor",
              ]}
            >
              <ForcePasswordChangePage />
            </ProtectedRoute>
          }
        />

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
          <Route path="/admin/cards" element={<AdminCardsPage />} />
          <Route
            path="/admin/distribution"
            element={<AdminDistributionPage />}
          />
          <Route path="/admin/audit" element={<AdminAuditPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/qr-rotation" element={<AdminQRRotationPage />} />
          <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
          <Route path="/admin/appeals" element={<AdminAppealsPage />} />
          <Route path="/admin/fraud" element={<AdminFraudDashboard />} />
          <Route
            path="/admin/session-health"
            element={<AdminSessionHealthPage />}
          />
          <Route path="/admin/eligibility" element={<AdminEligibilityPage />} />
          <Route
            path="/admin/stock-suggestion"
            element={<AdminStockSuggestionPage />}
          />
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
          <Route path="/queue" element={<LiveQueuePage />} />
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
