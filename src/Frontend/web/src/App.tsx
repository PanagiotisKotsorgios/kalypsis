import { Navigate, Route, Routes } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import NotificationsIcon from "@mui/icons-material/Notifications";
import GroupIcon from "@mui/icons-material/Group";
import BusinessIcon from "@mui/icons-material/Business";
import AssignmentIcon from "@mui/icons-material/Assignment";
import HandshakeIcon from "@mui/icons-material/Handshake";
import ReportIcon from "@mui/icons-material/Report";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SettingsIcon from "@mui/icons-material/Settings";

import { useAuth, type Role } from "./auth/AuthContext";
import { AppLayout, type NavItem } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CookieBanner } from "./components/CookieBanner";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { PricingPage } from "./pages/PricingPage";
import { ContactPage } from "./pages/ContactPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { CookiesPage } from "./pages/CookiesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TenantsPage } from "./pages/TenantsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { RequestsPage } from "./pages/RequestsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { AllUsersPage } from "./pages/AllUsersPage";
import { ClaimsPage } from "./pages/ClaimsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TasksPage } from "./pages/TasksPage";
import { ProducersPage } from "./pages/ProducersPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AgencySettingsPage } from "./pages/AgencySettingsPage";

const navByRole: Record<Role, NavItem[]> = {
  Customer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon /> },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon /> },
    { to: "/producers", labelKey: "nav.producers", icon: <HandshakeIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> },
    { to: "/users", labelKey: "nav.users", icon: <GroupIcon /> },
    { to: "/reports", labelKey: "nav.reports", icon: <DashboardIcon /> },
    { to: "/agency-settings", labelKey: "nav.agencySettings", icon: <SettingsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyUser: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon /> },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> },
    { to: "/reports", labelKey: "nav.reports", icon: <DashboardIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  Producer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  PlatformAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/all-users", labelKey: "nav.allUsers", icon: <GroupIcon /> },
    { to: "/audit", labelKey: "nav.audit", icon: <ReportIcon /> },
    { to: "/settings", labelKey: "nav.settings", icon: <SettingsIcon /> }
  ],
  PlatformEmployee: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/all-users", labelKey: "nav.allUsers", icon: <GroupIcon /> },
    { to: "/audit", labelKey: "nav.audit", icon: <ReportIcon /> }
  ]
};

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
        <Route
          path="/forgot-password"
          element={user ? <Navigate to="/app" replace /> : <ForgotPasswordPage />}
        />
        <Route
          path="/reset-password"
          element={user ? <Navigate to="/app" replace /> : <ResetPasswordPage />}
        />
        <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage />} />
        <Route path="/register/agency" element={<Navigate to="/register" replace />} />
        <Route path="/register/agent" element={<Navigate to="/register" replace />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <AppLayout navItems={user ? navByRole[user.role] : []}>
                <Routes>
                  <Route index element={<DashboardPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="policies" element={<PoliciesPage />} />
                  <Route path="all-users" element={<AllUsersPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="users" element={<EmployeesPage />} />
                  <Route path="tenants" element={<TenantsPage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                  <Route path="requests" element={<RequestsPage />} />
                  <Route path="audit" element={<AuditLogsPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="producers" element={<ProducersPage />} />
                  <Route path="claims" element={<ClaimsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="agency-settings" element={<AgencySettingsPage />} />
                  <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieBanner />
    </>
  );
}
