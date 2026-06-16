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
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import EventIcon from "@mui/icons-material/Event";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import HubIcon from "@mui/icons-material/Hub";
import LinkIcon from "@mui/icons-material/Link";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import RestoreIcon from "@mui/icons-material/Restore";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import CalculateIcon from "@mui/icons-material/Calculate";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";

import { useAuth, type Role } from "./auth/AuthContext";
import { useImpersonation } from "./impersonation/ImpersonationContext";
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
import { CustomerContractDetailsPage } from "./pages/CustomerContractDetailsPage";
import { NewContractWizardPage } from "./pages/NewContractWizardPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { TariffsPage } from "./pages/TariffsPage";
import { CoverNotesPage } from "./pages/CoverNotesPage";
import { BranchesPage } from "./pages/BranchesPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { SecuritiesPage } from "./pages/SecuritiesPage";
import { FinancialMovementsPage } from "./pages/FinancialMovementsPage";
import { BankConnectionsPage } from "./pages/BankConnectionsPage";
import { MarketingCampaignsPage } from "./pages/MarketingCampaignsPage";
import { DeliveryTrackingPage } from "./pages/DeliveryTrackingPage";
import { DocumentManagerPage } from "./pages/DocumentManagerPage";
import { PartnerPortalsPage } from "./pages/PartnerPortalsPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { DiasCodesPage } from "./pages/DiasCodesPage";
import { AccountingExportsPage } from "./pages/AccountingExportsPage";
import { KepyoReportsPage } from "./pages/KepyoReportsPage";
import { MagneticImportsPage } from "./pages/MagneticImportsPage";
import { OverCommissionsPage } from "./pages/OverCommissionsPage";
import { ProductionGoalsPage } from "./pages/ProductionGoalsPage";
import { ProductionStatsPage } from "./pages/ProductionStatsPage";
import { TenantDetailPage } from "./pages/TenantDetailPage";

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

    // Operations & insurance lifecycle
    { to: "/tariffs", labelKey: "nav.tariffs", icon: <PriceChangeIcon /> },
    { to: "/cover-notes", labelKey: "nav.coverNotes", icon: <DescriptionOutlinedIcon /> },
    { to: "/branches", labelKey: "nav.branchDesigner", icon: <AccountTreeIcon /> },
    { to: "/delivery-tracking", labelKey: "nav.deliveryTracking", icon: <LocalShippingIcon /> },

    // Commercial CRM
    { to: "/appointments", labelKey: "nav.appointments", icon: <EventIcon /> },
    { to: "/document-manager", labelKey: "nav.documentManager", icon: <FolderSpecialIcon /> },
    { to: "/marketing", labelKey: "nav.marketing", icon: <MailOutlineIcon /> },
    { to: "/partner-portals", labelKey: "nav.b2bPortal", icon: <HubIcon /> },

    // Commissions & production
    { to: "/over-commissions", labelKey: "nav.overCommissions", icon: <StackedLineChartIcon /> },
    { to: "/production-stats", labelKey: "nav.productionStats", icon: <LeaderboardIcon /> },
    { to: "/goals", labelKey: "nav.goals", icon: <EmojiEventsIcon /> },

    // Financial circuits
    { to: "/financial-movements", labelKey: "nav.financials", icon: <AttachMoneyIcon /> },
    { to: "/receipts", labelKey: "nav.receipts", icon: <ReceiptLongIcon /> },
    { to: "/payments", labelKey: "nav.payments", icon: <RequestQuoteIcon /> },
    { to: "/securities", labelKey: "nav.securities", icon: <RestoreIcon /> },

    // Banking & integrations
    { to: "/dias", labelKey: "nav.dias", icon: <AccountBalanceIcon /> },
    { to: "/bank-connections", labelKey: "nav.bankConnections", icon: <LinkIcon /> },
    { to: "/api-keys", labelKey: "nav.thirdParty", icon: <ExtensionIcon /> },

    // Accounting & reporting
    { to: "/accounting", labelKey: "nav.accounting", icon: <CalculateIcon /> },
    { to: "/kepyo", labelKey: "nav.kepyo", icon: <GavelIcon /> },
    { to: "/magnetic-import", labelKey: "nav.magneticImport", icon: <ImportExportIcon /> },

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
  const { tenantId: impersonatedTenantId } = useImpersonation();

  if (loading) return null;

  // While a PlatformAdmin / PlatformEmployee is "viewing as" a tenant we render
  // the AgencyAdmin sidebar so they see (and can use) everything an agency
  // admin would inside that tenant.
  const effectiveRole: Role | undefined = user
    ? (impersonatedTenantId && (user.role === "PlatformAdmin" || user.role === "PlatformEmployee")
        ? "AgencyAdmin"
        : user.role)
    : undefined;

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
              <AppLayout navItems={effectiveRole ? navByRole[effectiveRole] : []}>
                <Routes>
                  <Route index element={<DashboardPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="contracts/new" element={<NewContractWizardPage />} />
                  <Route path="contracts/:id" element={<CustomerContractDetailsPage />} />
                  <Route path="policies" element={<PoliciesPage />} />
                  <Route path="all-users" element={<AllUsersPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="users" element={<EmployeesPage />} />
                  <Route path="tenants" element={<TenantsPage />} />
                  <Route path="tenants/:id" element={<TenantDetailPage />} />
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
                  <Route path="agency/*" element={<ComingSoonPage />} />

                  <Route path="appointments" element={<AppointmentsPage />} />
                  <Route path="tariffs" element={<TariffsPage />} />
                  <Route path="cover-notes" element={<CoverNotesPage />} />
                  <Route path="branches" element={<BranchesPage />} />
                  <Route path="receipts" element={<ReceiptsPage />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="securities" element={<SecuritiesPage />} />
                  <Route path="financial-movements" element={<FinancialMovementsPage />} />
                  <Route path="bank-connections" element={<BankConnectionsPage />} />
                  <Route path="marketing" element={<MarketingCampaignsPage />} />
                  <Route path="delivery-tracking" element={<DeliveryTrackingPage />} />
                  <Route path="document-manager" element={<DocumentManagerPage />} />
                  <Route path="partner-portals" element={<PartnerPortalsPage />} />
                  <Route path="api-keys" element={<ApiKeysPage />} />
                  <Route path="dias" element={<DiasCodesPage />} />
                  <Route path="accounting" element={<AccountingExportsPage />} />
                  <Route path="kepyo" element={<KepyoReportsPage />} />
                  <Route path="magnetic-import" element={<MagneticImportsPage />} />
                  <Route path="over-commissions" element={<OverCommissionsPage />} />
                  <Route path="goals" element={<ProductionGoalsPage />} />
                  <Route path="production-stats" element={<ProductionStatsPage />} />
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
