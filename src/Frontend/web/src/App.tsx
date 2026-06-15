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
import { RegisterChoicePage } from "./pages/RegisterChoicePage";
import { RegisterAgencyPage } from "./pages/RegisterAgencyPage";
import { RegisterAgentPage } from "./pages/RegisterAgentPage";
import { ContactPage } from "./pages/ContactPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { CookiesPage } from "./pages/CookiesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { TenantsPage } from "./pages/TenantsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";

const navByRole: Record<Role, NavItem[]> = {
  Customer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon /> },
    { to: "/producers", labelKey: "nav.producers", icon: <HandshakeIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> },
    { to: "/users", labelKey: "nav.users", icon: <GroupIcon /> },
    { to: "/reports", labelKey: "nav.reports", icon: <DashboardIcon /> }
  ],
  AgencyUser: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> }
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
    { to: "/settings", labelKey: "nav.settings", icon: <SettingsIcon /> }
  ],
  PlatformEmployee: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> }
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
        <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterChoicePage />} />
        <Route
          path="/register/agency"
          element={user ? <Navigate to="/app" replace /> : <RegisterAgencyPage />}
        />
        <Route
          path="/register/agent"
          element={user ? <Navigate to="/app" replace /> : <RegisterAgentPage />}
        />
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
                  <Route path="policies" element={<PlaceholderPage titleKey="nav.policies" />} />
                  <Route path="documents" element={<PlaceholderPage titleKey="nav.documents" />} />
                  <Route
                    path="notifications"
                    element={<PlaceholderPage titleKey="nav.notifications" />}
                  />
                  <Route path="users" element={<EmployeesPage />} />
                  <Route path="tenants" element={<TenantsPage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                  <Route path="tasks" element={<PlaceholderPage titleKey="nav.tasks" />} />
                  <Route path="producers" element={<PlaceholderPage titleKey="nav.producers" />} />
                  <Route path="claims" element={<PlaceholderPage titleKey="nav.claims" />} />
                  <Route path="reports" element={<PlaceholderPage titleKey="nav.reports" />} />
                  <Route path="profile" element={<PlaceholderPage titleKey="nav.profile" />} />
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
