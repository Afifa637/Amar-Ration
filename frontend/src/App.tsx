import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import DistributorLayout from "./layouts/DistributorLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

const EntrancePage = lazy(() => import("./pages/EntrancePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const PendingApprovalPage = lazy(() => import("./pages/PendingApprovalPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ForcePasswordChangePage = lazy(
  () => import("./pages/ForcePasswordChangePage"),
);
const ComplaintSubmitPage = lazy(() => import("./pages/ComplaintSubmitPage"));
const AppealSubmitPage = lazy(() => import("./pages/AppealSubmitPage"));

const DistributorDashboard = lazy(
  () => import("./pages/distributor/DistributorDashboard"),
);
const BeneficiariesPage = lazy(
  () => import("./pages/distributor/BeneficiariesPage"),
);
const CardsTokensPage = lazy(
  () => import("./pages/distributor/CardsTokensPage"),
);
const StockDistributionPage = lazy(
  () => import("./pages/distributor/StockDistributionPage"),
);
const LiveQueuePage = lazy(() => import("./pages/distributor/LiveQueuePage"));
const AuditLogPage = lazy(() => import("./pages/distributor/AuditLogPage"));
const ReportsPage = lazy(() => import("./pages/distributor/ReportsPage"));
const MonitoringPage = lazy(() => import("./pages/distributor/MonitoringPage"));
const FieldApplicationsPage = lazy(
  () => import("./pages/distributor/FieldApplicationsPage"),
);
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminDistributorsPage = lazy(
  () => import("./pages/admin/AdminDistributorsPage"),
);
const AdminConsumersPage = lazy(
  () => import("./pages/admin/AdminConsumersPage"),
);
const AdminCardsPage = lazy(() => import("./pages/admin/AdminCardsPage"));
const AdminDistributionPage = lazy(
  () => import("./pages/admin/AdminDistributionPage"),
);
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminComplaintsPage = lazy(
  () => import("./pages/admin/AdminComplaintsPage"),
);
const AdminAppealsPage = lazy(() => import("./pages/admin/AdminAppealsPage"));
const AdminFraudDashboard = lazy(
  () => import("./pages/admin/AdminFraudDashboard"),
);
const AdminEligibilityPage = lazy(
  () => import("./pages/admin/AdminEligibilityPage"),
);
const AdminStockSuggestionPage = lazy(
  () => import("./pages/admin/AdminStockSuggestionPage"),
);
const AdminSessionHealthPage = lazy(
  () => import("./pages/admin/AdminSessionHealthPage"),
);
const AdminBulkRegisterPage = lazy(
  () => import("./pages/admin/AdminBulkRegisterPage"),
);
const AdminQRRotationPage = lazy(
  () => import("./pages/admin/AdminQRRotationPage"),
);
const AdminIoTPage = lazy(() => import("./pages/admin/AdminIoTPage"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-gray-600">
            Loading...
          </div>
        }
      >
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
              <ProtectedRoute allowedRoles={["central-admin", "distributor"]}>
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
            <Route
              path="/admin/bulk-register"
              element={<AdminBulkRegisterPage />}
            />
            <Route
              path="/admin/qr-rotation"
              element={<AdminQRRotationPage />}
            />
            <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
            <Route path="/admin/appeals" element={<AdminAppealsPage />} />
            <Route path="/admin/fraud" element={<AdminFraudDashboard />} />
            <Route
              path="/admin/session-health"
              element={<AdminSessionHealthPage />}
            />
            <Route
              path="/admin/eligibility"
              element={<AdminEligibilityPage />}
            />
            <Route
              path="/admin/stock-suggestion"
              element={<AdminStockSuggestionPage />}
            />
            <Route path="/admin/iot" element={<AdminIoTPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={["distributor"]}>
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
            <Route path="/field-applications" element={<FieldApplicationsPage />} />
            <Route path="/appeals" element={<AppealSubmitPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<HelpPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
