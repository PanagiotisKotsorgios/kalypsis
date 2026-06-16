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
import EmailIcon from "@mui/icons-material/Email";
import SecurityIcon from "@mui/icons-material/Security";
import PaymentsIcon from "@mui/icons-material/Payments";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import KeyIcon from "@mui/icons-material/Key";
import ExtensionIcon from "@mui/icons-material/Extension";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StorageIcon from "@mui/icons-material/Storage";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import CampaignIcon from "@mui/icons-material/Campaign";
import GavelIcon from "@mui/icons-material/Gavel";
import PaletteIcon from "@mui/icons-material/Palette";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import TranslateIcon from "@mui/icons-material/Translate";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";

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
import { ComingSoonPage } from "./pages/ComingSoonPage";

const navByRole: Record<Role, NavItem[]> = {
  Customer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon />, comingSoon: true },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon /> },
    { to: "/users", labelKey: "nav.users", icon: <GroupIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon />, comingSoon: true },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon />, comingSoon: true },
    { to: "/producers", labelKey: "nav.producers", icon: <HandshakeIcon />, comingSoon: true },
    { to: "/reports", labelKey: "nav.reports", icon: <AnalyticsIcon />, comingSoon: true },
    { to: "/agency-settings", labelKey: "nav.agencySettings", icon: <SettingsIcon />, comingSoon: true },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyUser: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon />, comingSoon: true },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon />, comingSoon: true },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  Producer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  PlatformAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/all-users", labelKey: "nav.allUsers", icon: <GroupIcon /> },
    { to: "/audit", labelKey: "nav.audit", icon: <GavelIcon /> },
    { to: "/settings", labelKey: "nav.settings", icon: <SettingsIcon /> },
    // Coming-soon platform-wide operations
    { to: "/platform/carriers", labelKey: "nav.carriers", icon: <SecurityIcon />, comingSoon: true },
    { to: "/platform/plans", labelKey: "nav.subscriptionPlans", icon: <CreditCardIcon />, comingSoon: true },
    { to: "/platform/billing", labelKey: "nav.billing", icon: <PaymentsIcon />, comingSoon: true },
    { to: "/platform/email-templates", labelKey: "nav.emailTemplates", icon: <EmailIcon />, comingSoon: true },
    { to: "/platform/broadcast", labelKey: "nav.broadcast", icon: <CampaignIcon />, comingSoon: true },
    { to: "/platform/i18n", labelKey: "nav.translations", icon: <TranslateIcon />, comingSoon: true },
    { to: "/platform/branding", labelKey: "nav.branding", icon: <PaletteIcon />, comingSoon: true },
    { to: "/platform/api-keys", labelKey: "nav.apiKeys", icon: <KeyIcon />, comingSoon: true },
    { to: "/platform/integrations", labelKey: "nav.integrations", icon: <ExtensionIcon />, comingSoon: true },
    { to: "/platform/backups", labelKey: "nav.backups", icon: <CloudUploadIcon />, comingSoon: true },
    { to: "/platform/storage", labelKey: "nav.storage", icon: <StorageIcon />, comingSoon: true },
    { to: "/platform/jobs", labelKey: "nav.jobs", icon: <ScheduleIcon />, comingSoon: true },
    { to: "/platform/status", labelKey: "nav.status", icon: <MonitorHeartIcon />, comingSoon: true },
    { to: "/platform/compliance", labelKey: "nav.compliance", icon: <RuleFolderIcon />, comingSoon: true },
    { to: "/platform/support", labelKey: "nav.support", icon: <SupportAgentIcon />, comingSoon: true },
    { to: "/platform/analytics", labelKey: "nav.platformAnalytics", icon: <AnalyticsIcon />, comingSoon: true },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  PlatformEmployee: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/all-users", labelKey: "nav.allUsers", icon: <GroupIcon /> },
    { to: "/audit", labelKey: "nav.audit", icon: <GavelIcon /> },
    { to: "/platform/support", labelKey: "nav.support", icon: <SupportAgentIcon />, comingSoon: true },
    { to: "/platform/status", labelKey: "nav.status", icon: <MonitorHeartIcon />, comingSoon: true },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
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
                  <Route path="coming-soon" element={<ComingSoonPage />} />
                  <Route path="platform/*" element={<ComingSoonPage />} />
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
