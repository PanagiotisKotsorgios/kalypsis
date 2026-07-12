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
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import TranslateIcon from "@mui/icons-material/Translate";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EventIcon from "@mui/icons-material/Event";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import LinkIcon from "@mui/icons-material/Link";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import EngineeringIcon from "@mui/icons-material/Engineering";

import { useAuth, type Role } from "./auth/AuthContext";
import { useImpersonation } from "./impersonation/ImpersonationContext";
import { type NavItem } from "./components/AppLayout";
import { AppShell } from "./components/AppShell";
import { GlobalKeyboardShortcuts } from "./components/GlobalKeyboardShortcuts";
import { CommandPalette } from "./components/CommandPalette";
import { GlobalStickyHeaders } from "./components/GlobalStickyHeaders";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CookieBanner } from "./components/CookieBanner";
import { CookiePreferencesButton } from "./components/CookiePreferencesButton";
import { UserImpersonationBanner } from "./components/UserImpersonationBanner";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { PageLoader } from "./components/PageLoader";
import { ScrollToTop } from "./components/ScrollToTop";
import { PreloginResponsiveStyles } from "./components/PreloginResponsiveStyles";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { PricingPage } from "./pages/PricingPage";
import { FaqPage } from "./pages/FaqPage";
import { ContactPage } from "./pages/ContactPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { CookiesPage } from "./pages/CookiesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UnderMaintenancePage } from "./pages/UnderMaintenancePage";
import { SiteMaintenancePage } from "./pages/SiteMaintenancePage";
import { useMaintenance } from "./auth/MaintenanceContext";
import { TenantsPage } from "./pages/TenantsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
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
import { PackageGate } from "./pages/PackageLockedPage";
import { CustomerContractDetailsPage } from "./pages/CustomerContractDetailsPage";
import { NewContractWizardPage } from "./pages/NewContractWizardPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { TariffsPage } from "./pages/TariffsPage";
import { CoverNotesPage } from "./pages/CoverNotesPage";
import { BranchesPage } from "./pages/BranchesPage";
import { SecuritiesPage } from "./pages/SecuritiesPage";
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
import { PlatformRegistrationsPage } from "./pages/PlatformRegistrationsPage";
import { PlatformBillingConfigPage } from "./pages/PlatformBillingConfigPage";
import { PlatformInvoicesPage } from "./pages/PlatformInvoicesPage";
import { CommissionRunsPage } from "./pages/CommissionRunsPage";
import { CompanyBridgesPage } from "./pages/CompanyBridgesPage";
import { QuoteBuilderPage } from "./pages/QuoteBuilderPage";
import { WorkflowRulesPage } from "./pages/WorkflowRulesPage";
import { ChurnDashboardPage } from "./pages/ChurnDashboardPage";
import { ReportBuilderPage } from "./pages/ReportBuilderPage";
import { PrintPayBasketPage } from "./pages/PrintPayBasketPage";
import { PlafondPage } from "./pages/PlafondPage";
import { RiskProfilesPage } from "./pages/RiskProfilesPage";
import { AgencyOfficesPage } from "./pages/AgencyOfficesPage";
import { PlatformEconomicsPage } from "./pages/PlatformEconomicsPage";
import { WorkspaceHubPage } from "./pages/WorkspaceHubPage";
import { PlatformEmailTemplatesPage } from "./pages/PlatformEmailTemplatesPage";
import { PlatformMaintenancePage } from "./pages/PlatformMaintenancePage";
import { InsuranceCompaniesPage } from "./pages/InsuranceCompaniesPage";
import { EndorsementsPage } from "./pages/EndorsementsPage";
import { PolicyCancellationsPage } from "./pages/PolicyCancellationsPage";
import { CreditNotesPage } from "./pages/CreditNotesPage";
import { CommissionRulesPage } from "./pages/CommissionRulesPage";
import { ReferenceCatalogsPage } from "./pages/ReferenceCatalogsPage";
import { ParametricFilesPage } from "./pages/ParametricFilesPage";
import { PlatformParametricFilesPage } from "./pages/PlatformParametricFilesPage";
import { PlatformCompanyParametersPage } from "./pages/PlatformCompanyParametersPage";
import { AgencyCompanyParametricsPage } from "./pages/AgencyCompanyParametricsPage";
import { GaragesPage } from "./pages/GaragesPage";
import { ClaimProvisionsPage } from "./pages/ClaimProvisionsPage";
import { ClaimIndemnitiesPage } from "./pages/ClaimIndemnitiesPage";
import { NameDaysPage } from "./pages/NameDaysPage";
import { MyDataSubmissionsPage } from "./pages/MyDataSubmissionsPage";
import { DocumentDesignerPage } from "./pages/DocumentDesignerPage";
import { FriendlySettlementsPage } from "./pages/FriendlySettlementsPage";
import { CustomerMergePage } from "./pages/CustomerMergePage";
import { PersistencyPage } from "./pages/PersistencyPage";
import { UsaeSubmissionsPage } from "./pages/UsaeSubmissionsPage";
import { IntegrationSettingsPage } from "./pages/IntegrationSettingsPage";
import { NamedReportsPage } from "./pages/NamedReportsPage";
import { AgencyInstructionsPage } from "./pages/AgencyInstructionsPage";
import { BackupsPage } from "./pages/BackupsPage";
import { ConfigHubPage } from "./pages/ConfigHubPage";
import { RecycleBinPage } from "./pages/RecycleBinPage";
import { ProducerReconciliationPage } from "./pages/ProducerReconciliationPage";
import { MyExpectedRatesPage } from "./pages/MyExpectedRatesPage";
import { MyReconciliationPage } from "./pages/MyReconciliationPage";
import { ReconciliationDashboardPage } from "./pages/ReconciliationDashboardPage";
import { PremiumGate } from "./components/PremiumGate";
import { UpgradePlanDialogHost } from "./components/UpgradePlanDialog";
import VerifiedIcon from "@mui/icons-material/Verified";
import { AdvancePaymentsPage, ReconciliationPage, TachyPaymentsPage, InfoCenterPage, VehicleModelsPage } from "./pages/Phase13Pages";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import AppsIcon from "@mui/icons-material/Apps";
// PriceChangeIcon (used for tariffs) is no longer referenced — tariffs removed from sidebar.
import EditNoteIcon from "@mui/icons-material/EditNote";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import BackupIcon from "@mui/icons-material/Backup";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
// ΖΗΜΙΕΣ ΚΑΙ ΔΙΑΚΑΝΟΝΙΣΜΟΙ group icons (Build/Savings/PaymentsOutlined/HandshakeOutlined)
// were removed from the sidebar; their imports are no longer needed.
import RuleIcon from "@mui/icons-material/Rule";
import RestoreIcon from "@mui/icons-material/Restore";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CakeIcon from "@mui/icons-material/Cake";
import MergeIcon from "@mui/icons-material/Merge";
// DirectionsCarIcon was the vehicle-models entry — removed from sidebar.
import InventoryIcon from "@mui/icons-material/Inventory";
import HubIcon from "@mui/icons-material/Hub";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { AllToolsPage } from "./pages/AllToolsPage";
import { CarrierBridgesPage } from "./pages/CarrierBridgesPage";
import { BridgeCodeMappingsPage } from "./pages/BridgeCodeMappingsPage";
import { ProductionListsPage } from "./pages/ProductionListsPage";
import { RenewalsPage } from "./pages/RenewalsPage";
import { FinancialsPage } from "./pages/FinancialsPage";
import {
  SubscriptionPlansPage, TenantChargeablesPage, BroadcastPage, PlatformTranslationsPage,
  PlatformApiKeysPage, PlatformIntegrationsPage, PlatformBackupsPage,
  PlatformStoragePage, PlatformJobsPage, PlatformStatusPage, PlatformCompliancePage, PlatformSupportPage
} from "./pages/PlatformAdminPages";
import { PlatformCarriersPage } from "./pages/PlatformCarriersPage";

const navByRole: Record<Role, NavItem[]> = {
  Customer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyAdmin: [
    // ===== Top home link, every workspace =====
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm","Intelligence","Integrations"] },

    // ===== BackOffice — Standalone "Γέφυρες Εταιριών" (carrier xlsx/csv import) =====
    { to: "/carrier-bridges", labelKey: "nav.carrierBridges", icon: <CloudUploadIcon />, package: "BackOffice" },
    { to: "/bridge-code-mappings", labelKey: "nav.bridgeCodeMappings", icon: <CloudUploadIcon />, package: "BackOffice" },

    // ===== BackOffice — ΠΑΡΑΓΩΓΗ (core production records: customers, policies, claims) =====
    { to: "/production-lists", labelKey: "nav.productionLists", icon: <LeaderboardIcon />, package: "BackOffice", group: "production" },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon />, package: "BackOffice", group: "production" },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon />, package: "BackOffice", group: "production" },
    { to: "/renewals", labelKey: "nav.renewals", icon: <EventRepeatIcon />, package: "BackOffice", group: "production" },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon />, package: "BackOffice", group: "production" },
    { to: "/producers", labelKey: "nav.producers", icon: <HandshakeIcon />, package: "BackOffice", group: "production" },
    { to: "/endorsements", labelKey: "nav.endorsements", icon: <EditNoteIcon />, package: "BackOffice", group: "production" },
    { to: "/cancellations", labelKey: "nav.cancellations", icon: <CancelPresentationIcon />, package: "BackOffice", group: "production" },

    // BackOffice → ΟΙΚΟΝΟΜΙΚΑ (unified — five sub-workspaces as tabs)
    { to: "/financials", labelKey: "nav.financials", icon: <AttachMoneyIcon />, package: "BackOffice", group: "financials" },
    { to: "/securities", labelKey: "nav.securities", icon: <RestoreIcon />, package: "BackOffice", group: "financials" },
    { to: "/credit-notes", labelKey: "nav.creditNotes", icon: <ReceiptLongOutlinedIcon />, package: "BackOffice", group: "financials" },

    // BackOffice → ΠΡΟΜΗΘΕΙΕΣ — the commission settlement entry point is in
    // Production Lists, keeping production reporting and monthly settlement together.
    { to: "/over-commissions", labelKey: "nav.overCommissions", icon: <StackedLineChartIcon />,  package: "BackOffice", group: "production" },

    // Accounting and cash-control routes remain available from the Financial hub.

    // BackOffice → ΖΗΜΙΕΣ ΚΑΙ ΔΙΑΚΑΝΟΝΙΣΜΟΙ — temporarily disabled (per user request).
    // Routes below still resolve so we don't crash existing deep-links, but the
    // sidebar entries are gone. Restore these lines to re-enable the group.

    // BackOffice → ΠΑΡΑΜΕΤΡΟΠΟΙΗΣΗ — fewer sidebar entries:
    // Εταιρείες → Κλάδοι/Πακέτα/Καλύψεις → ενιαία παραμετροποίηση προμηθειών/προεπιλογών.
    { to: "/insurance-companies", labelKey: "nav.insuranceCompanies", icon: <BusinessIcon />,           package: "BackOffice", group: "params" },
    { to: "/company-parametrics", labelKey: "nav.companyParametrics", icon: <TuneOutlinedIcon />,       package: "BackOffice", group: "params" },
    { to: "/lookups",             labelKey: "nav.lookups",            icon: <MenuBookIcon />,           package: "BackOffice", group: "params" },
    { to: "/commission-rules",    labelKey: "nav.commissionRules",    icon: <StackedLineChartIcon />,   package: "BackOffice", group: "params" },
    // — secondary configuration tools below the four primary items —
    { to: "/parametric-files",    labelKey: "nav.parametricFiles",    icon: <InventoryIcon />,      package: "BackOffice", group: "params" },
    { to: "/document-designer",   labelKey: "nav.docDesigner",        icon: <DesignServicesIcon />, package: "BackOffice", group: "params" },
    { to: "/config-hub",          labelKey: "nav.configHub",          icon: <TuneOutlinedIcon />,   package: "BackOffice", group: "params" },

    // BackOffice → ΔΙΟΙΚΗΣΗ
    { to: "/users", labelKey: "nav.users", icon: <GroupIcon />, package: "BackOffice", group: "admin" },
    { to: "/audit", labelKey: "nav.audit", icon: <GavelIcon />, package: "BackOffice", group: "admin" },
    { to: "/recycle-bin", labelKey: "nav.recycleBin", icon: <RestoreFromTrashIcon />, package: "BackOffice", group: "admin", premium: "recycle-bin" },
    { to: "/producer-reconciliation", labelKey: "nav.producerReconciliation", icon: <VerifiedIcon />, package: "BackOffice", group: "admin" },
    { to: "/reconciliation-dashboard", labelKey: "nav.reconciliationDashboard", icon: <AnalyticsIcon />, package: "BackOffice", group: "admin" },
    { to: "/customer-merge", labelKey: "nav.merge", icon: <MergeIcon />, package: "BackOffice", group: "admin" },
    { to: "/all-tools", labelKey: "nav.allTools", icon: <AppsIcon />, package: "BackOffice", group: "admin" },

    // Standalone top-level — agency-wide backup & document archive
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon />, package: "BackOffice" },

    // Per-tenant handbook — visible to every staff member of the γραφείο,
    // editable only by AgencyAdmin. No package gate (kept always visible).
    { to: "/instructions", labelKey: "nav.instructions", icon: <MenuBookIcon /> },

    // Per-tenant backups + GDPR — always visible.
    { to: "/backups", labelKey: "nav.backups", icon: <BackupIcon /> },

    // ===== CRM — top-level (3) + grouped (5) =====
    // Every CRM item carries a `permission` code so an AgencyAdmin can hide
    // it from individual employees without touching the tenant's package.
    // Employees who don't hold the code see nothing in the sidebar AND get
    // the locked screen if they hit the URL directly.
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon />, package: "Crm" },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon />, package: "Crm" },
    { to: "/appointments", labelKey: "nav.appointments", icon: <EventIcon />, package: "Crm", permission: "appointments.read" },
    { to: "/marketing", labelKey: "nav.marketing", icon: <MailOutlineIcon />, package: "Crm", group: "crm", permission: "marketing.read" },
    { to: "/name-days", labelKey: "nav.nameDays", icon: <CakeIcon />, package: "Crm", group: "crm", permission: "customers.read" },
    { to: "/document-manager", labelKey: "nav.documentManager", icon: <FolderSpecialIcon />, package: "Crm", group: "crm", permission: "documents.read" },
    { to: "/delivery-tracking", labelKey: "nav.deliveryTracking", icon: <LocalShippingIcon />, package: "Crm", group: "crm", permission: "delivery.read" },
    { to: "/all-tools", labelKey: "nav.allTools", icon: <AppsIcon />, package: "Crm" },

    // ===== FrontOffice =====
    // quote-builder is still routable but hidden from the sidebar until the
    // carrier-aware quote engine ships. cover-notes stays — it's wired.
    { to: "/cover-notes", labelKey: "nav.coverNotes", icon: <DescriptionOutlinedIcon />, package: "FrontOffice" },
    { to: "/all-tools", labelKey: "nav.allTools", icon: <AppsIcon />, package: "FrontOffice" },

    // ===== Intelligence =====
    // persistency hidden — analytics shell exists but not wired to data yet.
    { to: "/reports", labelKey: "nav.reports", icon: <AnalyticsIcon />, package: "Intelligence" },
    { to: "/named-reports", labelKey: "nav.namedReports", icon: <AssessmentOutlinedIcon />, package: "Intelligence" },
    { to: "/production-stats", labelKey: "nav.productionStats", icon: <LeaderboardIcon />, package: "Intelligence" },
    { to: "/all-tools", labelKey: "nav.allTools", icon: <AppsIcon />, package: "Intelligence" },

    // ===== Integrations =====
    { to: "/integration-settings", labelKey: "nav.integrationSettings", icon: <VpnKeyIcon />, package: "Integrations" },
    { to: "/mydata", labelKey: "nav.mydata", icon: <GavelOutlinedIcon />, package: "Integrations" },
    { to: "/usae", labelKey: "nav.usae", icon: <RuleIcon />, package: "Integrations", group: "integrationsGrp" },
    { to: "/dias", labelKey: "nav.dias", icon: <AccountBalanceIcon />, package: "Integrations", group: "integrationsGrp" },
    { to: "/bank-connections", labelKey: "nav.bankConnections", icon: <LinkIcon />, package: "Integrations", group: "integrationsGrp" },
    // company-bridges + bridge-import are duplicates of /carrier-bridges
    // (BackOffice top-level). Routes redirect — sidebar entries removed.
    { to: "/info-center", labelKey: "nav.infoCenter", icon: <CloudUploadOutlinedIcon />, package: "Integrations", group: "integrationsGrp" },
    { to: "/partner-portals", labelKey: "nav.b2bPortal", icon: <HubIcon />, package: "Integrations", group: "integrationsGrp" },
    { to: "/api-keys", labelKey: "nav.thirdParty", icon: <ExtensionIcon />, package: "Integrations", group: "integrationsGrp" },
    { to: "/branches", labelKey: "nav.branchDesigner", icon: <AccountTreeIcon />, package: "Integrations", group: "setup" },
    { to: "/agency-offices", labelKey: "nav.agencyOffices", icon: <HomeWorkIcon />, package: "Integrations", group: "setup" },
    { to: "/all-tools", labelKey: "nav.allTools", icon: <AppsIcon />, package: "Integrations" },

    // Always-visible footer
    { to: "/agency-settings", labelKey: "nav.agencySettings", icon: <SettingsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyUser: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm","Intelligence","Integrations"] },
    // BackOffice
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon />, package: "BackOffice" },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon />, package: "BackOffice" },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon />, package: "BackOffice" },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon />, package: "BackOffice" },
    // CRM
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon />, package: "Crm" },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon />, package: "Crm" },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  Producer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    // «Λίστες Παραγωγής» — the producer's own book. Backend already
    // filters /policies to their own ProducerId when Role=Producer.
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    // Producer's own «παραμετροποίηση προμηθειών» — what THEY expect per
    // company × package. Feeds the comparison view below.
    { to: "/my-expected-rates", labelKey: "nav.myExpectedRates", icon: <TuneOutlinedIcon /> },
    // Live compare of my rates vs the office's rules, per company/package.
    { to: "/my-reconciliation", labelKey: "nav.myReconciliation", icon: <VerifiedIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  PlatformAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/all-users", labelKey: "nav.allUsers", icon: <GroupIcon /> },
    { to: "/platform/registrations", labelKey: "nav.registrations", icon: <AssignmentIcon /> },
    { to: "/audit", labelKey: "nav.audit", icon: <GavelIcon /> },
    { to: "/settings", labelKey: "nav.settings", icon: <SettingsIcon /> },
    // Platform-wide operations (carriers, plans, comms, ops)
    { to: "/platform/carriers", labelKey: "nav.platformCarriers", icon: <SecurityIcon /> },
    { to: "/platform/maintenance", labelKey: "nav.maintenance", icon: <EngineeringIcon /> },
    { to: "/platform/parametric-files", labelKey: "nav.broadcastParametric", icon: <InventoryIcon /> },
    { to: "/platform/company-parameters", labelKey: "nav.companyParameters", icon: <TuneOutlinedIcon /> },
    { to: "/platform/plans", labelKey: "nav.subscriptionPlans", icon: <CreditCardIcon /> },
    { to: "/platform/chargeables", labelKey: "nav.chargeables", icon: <PaymentsIcon /> },
    { to: "/platform/billing", labelKey: "nav.billing", icon: <PaymentsIcon /> },
    { to: "/platform/invoices", labelKey: "nav.invoices", icon: <ReceiptLongIcon /> },
    { to: "/platform/email-templates", labelKey: "nav.emailTemplates", icon: <EmailIcon /> },
    { to: "/platform/broadcast", labelKey: "nav.broadcast", icon: <CampaignIcon /> },
    { to: "/platform/i18n", labelKey: "nav.translations", icon: <TranslateIcon /> },
    { to: "/platform/api-keys", labelKey: "nav.apiKeys", icon: <KeyIcon /> },
    { to: "/platform/integrations", labelKey: "nav.integrations", icon: <ExtensionIcon /> },
    { to: "/platform/backups", labelKey: "nav.backups", icon: <CloudUploadIcon /> },
    { to: "/platform/storage", labelKey: "nav.storage", icon: <StorageIcon /> },
    { to: "/platform/jobs", labelKey: "nav.jobs", icon: <ScheduleIcon /> },
    { to: "/platform/status", labelKey: "nav.status", icon: <MonitorHeartIcon /> },
    { to: "/platform/compliance", labelKey: "nav.compliance", icon: <RuleFolderIcon /> },
    { to: "/platform/support", labelKey: "nav.support", icon: <SupportAgentIcon /> },
    { to: "/platform/economics", labelKey: "nav.platformEconomics", icon: <AnalyticsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  PlatformEmployee: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/all-users", labelKey: "nav.allUsers", icon: <GroupIcon /> },
    { to: "/audit", labelKey: "nav.audit", icon: <GavelIcon /> },
    { to: "/platform/support", labelKey: "nav.support", icon: <SupportAgentIcon /> },
    { to: "/platform/status", labelKey: "nav.status", icon: <MonitorHeartIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ]
};

export default function App() {
  const { user, loading } = useAuth();
  const { tenantId: impersonatedTenantId } = useImpersonation();

  if (loading) return <PageLoader minHeight="100vh" />;

  // While a PlatformAdmin / PlatformEmployee is "viewing as" a tenant we render
  // the AgencyAdmin sidebar so they see (and can use) everything an agency
  // admin would inside that tenant.
  const effectiveRole: Role | undefined = user
    ? (impersonatedTenantId && (user.role === "PlatformAdmin" || user.role === "PlatformEmployee")
        ? "AgencyAdmin"
        : user.role)
    : undefined;

  // ---------------- LAUNCH GATE + SITE MAINTENANCE ----------------
  // Both flags live in PlatformSetting (editable from the superadmin
  // Maintenance page) and are read by <MaintenanceProvider>.
  //   launchGateEnabled:    agency-side roles see the under-construction page.
  //   maintenanceModeEnabled: EVERYONE (including customers + visitors) sees the full-site maintenance page.
  // PlatformAdmin / PlatformEmployee bypass both β€” they need to manage the system.
  // An explicit `?staff=1` override flag is also preserved for emergency access.
  const maintenance = useMaintenance();
  const overrideKey = "kalypsis.launchOverride";
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.get("staff") === "1") {
      window.localStorage.setItem(overrideKey, "1");
    } else if (url.searchParams.get("staff") === "0") {
      window.localStorage.removeItem(overrideKey);
    }
  }
  const staffOverride =
    typeof window !== "undefined" && window.localStorage.getItem(overrideKey) === "1";

  // Site-wide maintenance hides everything except platform staff
  const isPlatformStaff = user?.role === "PlatformAdmin" || user?.role === "PlatformEmployee";
  if (maintenance.maintenanceModeEnabled && !isPlatformStaff && !staffOverride) {
    return (
      <SiteMaintenancePage
        title={maintenance.maintenanceTitle}
        message={maintenance.maintenanceMessage}
      />
    );
  }

  const gatedRoles: Role[] = ["AgencyAdmin", "AgencyUser", "Producer"];
  const isGated =
    maintenance.launchGateEnabled &&
    !!user &&
    !staffOverride &&
    !impersonatedTenantId && // platform users impersonating a tenant still see the agency UI
    gatedRoles.includes(user.role);

  return (
    <>
      <ScrollToTop />
      <PreloginResponsiveStyles />
      <UserImpersonationBanner />
      <UpgradePlanDialogHost />
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
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              {isGated ? <UnderMaintenancePage title={maintenance.launchGateTitle} message={maintenance.launchGateMessage} /> : (
              <AppShell navItems={effectiveRole ? navByRole[effectiveRole] : []} role={effectiveRole}>
                <GlobalKeyboardShortcuts />
                <CommandPalette />
                <GlobalStickyHeaders />
                <Routes>
                  {/* Agency users land on the Workspace Hub; other roles keep their dashboard. */}
                  <Route index element={
                    (effectiveRole === "AgencyAdmin" || effectiveRole === "AgencyUser")
                      ? <WorkspaceHubPage />
                      : <DashboardPage />
                  } />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="customers/:id" element={<CustomerDetailPage />} />
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
                  <Route path="recycle-bin" element={<PremiumGate code="recycle-bin"><RecycleBinPage /></PremiumGate>} />
                  <Route path="producer-reconciliation" element={<ProducerReconciliationPage />} />
                  {/* Producer portal — «Παραμετροποίηση μου» + «Σύγκριση με γραφείο». Both routes
                      are backend-guarded by Role=Producer, so no client-side gating needed. */}
                  <Route path="my-expected-rates" element={<MyExpectedRatesPage />} />
                  <Route path="my-reconciliation" element={<MyReconciliationPage />} />
                  <Route path="reconciliation-dashboard" element={<ReconciliationDashboardPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="producers" element={<ProducersPage />} />
                  <Route path="claims" element={<ClaimsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="agency-settings" element={<AgencySettingsPage />} />
                  <Route path="coming-soon" element={<ComingSoonPage />} />
                  <Route path="platform/registrations" element={<PlatformRegistrationsPage />} />
                  <Route path="platform/economics" element={<PlatformEconomicsPage />} />
                  <Route path="platform/email-templates" element={<PlatformEmailTemplatesPage />} />
                  <Route path="platform/maintenance" element={<PlatformMaintenancePage />} />
                  <Route path="platform/*" element={<ComingSoonPage />} />
                  <Route path="agency/*" element={<ComingSoonPage />} />

                  <Route path="appointments" element={<PackageGate package="Crm"><AppointmentsPage /></PackageGate>} />
                  <Route path="tariffs" element={<TariffsPage />} />
                  <Route path="cover-notes" element={<CoverNotesPage />} />
                  <Route path="branches" element={<BranchesPage />} />
                  <Route path="securities" element={<SecuritiesPage />} />
                  <Route path="bank-connections" element={<BankConnectionsPage />} />
                  <Route path="marketing" element={<PackageGate package="Crm"><MarketingCampaignsPage /></PackageGate>} />
                  <Route path="delivery-tracking" element={<PackageGate package="Crm"><DeliveryTrackingPage /></PackageGate>} />
                  <Route path="document-manager" element={<PackageGate package="Crm"><DocumentManagerPage /></PackageGate>} />
                  <Route path="partner-portals" element={<PartnerPortalsPage />} />
                  <Route path="api-keys" element={<ApiKeysPage />} />
                  <Route path="dias" element={<DiasCodesPage />} />
                  <Route path="accounting" element={<AccountingExportsPage />} />
                  <Route path="kepyo" element={<KepyoReportsPage />} />
                  <Route path="magnetic-import" element={<MagneticImportsPage />} />
                  <Route path="over-commissions" element={<OverCommissionsPage />} />
                  <Route path="goals" element={<ProductionGoalsPage />} />
                  <Route path="production-stats" element={<ProductionStatsPage />} />
                  <Route path="commission-runs" element={<CommissionRunsPage />} />
                  <Route path="company-bridges" element={<CompanyBridgesPage />} />
                  <Route path="insurance-companies" element={<InsuranceCompaniesPage />} />
                  <Route path="endorsements" element={<EndorsementsPage />} />
                  <Route path="cancellations" element={<PolicyCancellationsPage />} />
                  <Route path="credit-notes" element={<CreditNotesPage />} />
                  <Route path="bulk-commissions" element={<Navigate to="/app/commission-rules" replace />} />
                  <Route path="commission-rules" element={<CommissionRulesPage />} />
                  <Route path="lookups" element={<ReferenceCatalogsPage />} />
                  <Route path="parametric-files" element={<ParametricFilesPage />} />
                  <Route path="platform/parametric-files" element={<PlatformParametricFilesPage />} />
                  <Route path="platform/company-parameters" element={<PlatformCompanyParametersPage />} />
                  <Route path="company-parametrics" element={<AgencyCompanyParametricsPage />} />
                  <Route path="quote-builder" element={<QuoteBuilderPage />} />
                  <Route path="workflows" element={<WorkflowRulesPage />} />
                  <Route path="churn" element={<ChurnDashboardPage />} />
                  <Route path="report-builder" element={<ReportBuilderPage />} />
                  <Route path="print-pay" element={<PrintPayBasketPage />} />
                  <Route path="plafond" element={<PlafondPage />} />
                  <Route path="risk-profiles" element={<RiskProfilesPage />} />
                  <Route path="agency-offices" element={<AgencyOfficesPage />} />
                  <Route path="group-policies" element={<Navigate to="/app/policies?view=group" replace />} />
                  <Route path="garages" element={<GaragesPage />} />
                  <Route path="claim-provisions" element={<ClaimProvisionsPage />} />
                  <Route path="indemnities" element={<ClaimIndemnitiesPage />} />
                  <Route path="name-days" element={<PackageGate package="Crm"><NameDaysPage /></PackageGate>} />
                  <Route path="instructions" element={<AgencyInstructionsPage />} />
                  <Route path="backups" element={<BackupsPage />} />
                  <Route path="mydata" element={<MyDataSubmissionsPage />} />
                  <Route path="document-designer" element={<DocumentDesignerPage />} />
                  <Route path="friendly-settlements" element={<FriendlySettlementsPage />} />
                  <Route path="customer-merge" element={<CustomerMergePage />} />
                  <Route path="persistency" element={<PersistencyPage />} />
                  <Route path="policy-delivery" element={<Navigate to="/app/policies?view=delivery" replace />} />
                  <Route path="caller-id" element={<Navigate to="/app" replace />} />
                  <Route path="usae" element={<UsaeSubmissionsPage />} />
                  <Route path="all-tools" element={<AllToolsPage />} />
                  <Route path="default-value-rules" element={<Navigate to="/app/commission-rules" replace />} />
                  <Route path="carrier-bridges" element={<CarrierBridgesPage />} />
                  <Route path="bridge-code-mappings" element={<BridgeCodeMappingsPage />} />
                  <Route path="production-lists" element={<ProductionListsPage />} />
                  <Route path="renewals" element={<RenewalsPage />} />
                  <Route path="financials" element={<FinancialsPage />} />
                  <Route path="receipts" element={<Navigate to="/app/financials?tab=receipts" replace />} />
                  <Route path="payments" element={<Navigate to="/app/financials?tab=payments" replace />} />
                  <Route path="financial-movements" element={<Navigate to="/app/financials?tab=movements" replace />} />
                  <Route path="cash" element={<Navigate to="/app/financials?tab=cash" replace />} />
                  <Route path="gl" element={<Navigate to="/app/financials?tab=gl" replace />} />
                  <Route path="company-bridges" element={<Navigate to="/app/carrier-bridges" replace />} />
                  <Route path="bridge-import" element={<Navigate to="/app/carrier-bridges" replace />} />
                  <Route path="platform/carriers" element={<PlatformCarriersPage />} />
                  <Route path="platform/plans" element={<SubscriptionPlansPage />} />
                  <Route path="platform/chargeables" element={<TenantChargeablesPage />} />
                  <Route path="platform/billing" element={<PlatformBillingConfigPage />} />
                  <Route path="platform/invoices" element={<PlatformInvoicesPage />} />
                  <Route path="platform/broadcast" element={<BroadcastPage />} />
                  <Route path="platform/i18n" element={<PlatformTranslationsPage />} />
                  <Route path="platform/api-keys" element={<PlatformApiKeysPage />} />
                  <Route path="platform/integrations" element={<PlatformIntegrationsPage />} />
                  <Route path="platform/backups" element={<PlatformBackupsPage />} />
                  <Route path="platform/storage" element={<PlatformStoragePage />} />
                  <Route path="platform/jobs" element={<PlatformJobsPage />} />
                  <Route path="platform/status" element={<PlatformStatusPage />} />
                  <Route path="platform/compliance" element={<PlatformCompliancePage />} />
                  <Route path="platform/support" element={<PlatformSupportPage />} />
                  <Route path="integration-settings" element={<IntegrationSettingsPage />} />
                  <Route path="named-reports" element={<NamedReportsPage />} />
                  <Route path="config-hub" element={<ConfigHubPage />} />
                  <Route path="advance-payments" element={<AdvancePaymentsPage />} />
                  <Route path="reconciliation" element={<ReconciliationPage />} />
                  <Route path="tachypayments" element={<TachyPaymentsPage />} />
                  <Route path="info-center" element={<InfoCenterPage />} />
                  <Route path="vehicle-models" element={<VehicleModelsPage />} />
                  <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>
              </AppShell>
              )}
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieBanner />
      <CookiePreferencesButton />
      {user?.role === "AgencyAdmin" && !impersonatedTenantId && <OnboardingWizard />}
    </>
  );
}
