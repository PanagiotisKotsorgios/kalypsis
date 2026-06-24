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
import BoltIcon from "@mui/icons-material/Bolt";
import PsychologyAltIcon from "@mui/icons-material/PsychologyAlt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PrintIcon from "@mui/icons-material/Print";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import DriveEtaIcon from "@mui/icons-material/DriveEta";
import ImageIcon from "@mui/icons-material/Image";
import EngineeringIcon from "@mui/icons-material/Engineering";
import HomeWorkIcon from "@mui/icons-material/HomeWork";

import { useAuth, type Role } from "./auth/AuthContext";
import { useImpersonation } from "./impersonation/ImpersonationContext";
import { type NavItem } from "./components/AppLayout";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CookieBanner } from "./components/CookieBanner";
import { UserImpersonationBanner } from "./components/UserImpersonationBanner";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { PageLoader } from "./components/PageLoader";
import { ScrollToTop } from "./components/ScrollToTop";
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
import { PlatformPartnersPage } from "./pages/PlatformPartnersPage";
import { CommissionRunsPage } from "./pages/CommissionRunsPage";
import { CompanyBridgesPage } from "./pages/CompanyBridgesPage";
import { QuoteBuilderPage } from "./pages/QuoteBuilderPage";
import { WorkflowRulesPage } from "./pages/WorkflowRulesPage";
import { ChurnDashboardPage } from "./pages/ChurnDashboardPage";
import { ReportBuilderPage } from "./pages/ReportBuilderPage";
import { PrintPayBasketPage } from "./pages/PrintPayBasketPage";
import { PlafondPage } from "./pages/PlafondPage";
import { RiskProfilesPage } from "./pages/RiskProfilesPage";
import { ShowcaseImagesPage } from "./pages/ShowcaseImagesPage";
import { AgencyOfficesPage } from "./pages/AgencyOfficesPage";
import { PlatformEconomicsPage } from "./pages/PlatformEconomicsPage";
import { WorkspaceHubPage } from "./pages/WorkspaceHubPage";
import { PlatformEmailTemplatesPage } from "./pages/PlatformEmailTemplatesPage";
import { PlatformMaintenancePage } from "./pages/PlatformMaintenancePage";
import { InsuranceCompaniesPage } from "./pages/InsuranceCompaniesPage";
import { EndorsementsPage } from "./pages/EndorsementsPage";
import { PolicyCancellationsPage } from "./pages/PolicyCancellationsPage";
import { CreditNotesPage } from "./pages/CreditNotesPage";
import { BulkCommissionsPage } from "./pages/BulkCommissionsPage";
import { ReferenceCatalogsPage } from "./pages/ReferenceCatalogsPage";
import { ParametricFilesPage } from "./pages/ParametricFilesPage";
import { PlatformParametricFilesPage } from "./pages/PlatformParametricFilesPage";
import { GroupPoliciesPage } from "./pages/GroupPoliciesPage";
import { GaragesPage } from "./pages/GaragesPage";
import { ClaimProvisionsPage } from "./pages/ClaimProvisionsPage";
import { ClaimIndemnitiesPage } from "./pages/ClaimIndemnitiesPage";
import { GeneralLedgerPage } from "./pages/GeneralLedgerPage";
import { CashPositionPage } from "./pages/CashPositionPage";
import { NameDaysPage } from "./pages/NameDaysPage";
import { MyDataSubmissionsPage } from "./pages/MyDataSubmissionsPage";
import { DocumentDesignerPage } from "./pages/DocumentDesignerPage";
import { FriendlySettlementsPage } from "./pages/FriendlySettlementsPage";
import { CustomerMergePage } from "./pages/CustomerMergePage";
import { PersistencyPage } from "./pages/PersistencyPage";
import { PolicyDeliveryPage } from "./pages/PolicyDeliveryPage";
import { CallerIdPage } from "./pages/CallerIdPage";
import { UsaeSubmissionsPage } from "./pages/UsaeSubmissionsPage";
import { IntegrationSettingsPage } from "./pages/IntegrationSettingsPage";
import { NamedReportsPage } from "./pages/NamedReportsPage";
import { ConfigHubPage } from "./pages/ConfigHubPage";
import { AdvancePaymentsPage, ReconciliationPage, TachyPaymentsPage, InfoCenterPage, VehicleModelsPage } from "./pages/Phase13Pages";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import LocalPostOfficeIcon from "@mui/icons-material/LocalPostOffice";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import MergeIcon from "@mui/icons-material/Merge";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import MovingIcon from "@mui/icons-material/Moving";
import PhoneCallbackIcon from "@mui/icons-material/PhoneCallback";
import RuleIcon from "@mui/icons-material/Rule";
import InventoryIcon from "@mui/icons-material/Inventory";
import EditNoteIcon from "@mui/icons-material/EditNote";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import GroupsIcon from "@mui/icons-material/Groups";
import BuildIcon from "@mui/icons-material/Build";
import SavingsIcon from "@mui/icons-material/Savings";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import LocalAtmIcon from "@mui/icons-material/LocalAtm";
import CakeIcon from "@mui/icons-material/Cake";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import DesignServicesIcon from "@mui/icons-material/DesignServices";

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
    // Dashboard appears in every workspace
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm","Intelligence","Integrations"] },

    // Foundational catalogs — visible in the workspaces that actually use them
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm","Intelligence"] },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon />,
      workspaces: ["BackOffice","FrontOffice","Intelligence"] },
    { to: "/producers", labelKey: "nav.producers", icon: <HandshakeIcon />,
      workspaces: ["BackOffice","FrontOffice","Intelligence"] },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm"] },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon />,
      workspaces: ["BackOffice","Crm","Intelligence"] },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon />,
      workspaces: ["BackOffice","Crm"] },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon />,
      workspaces: ["Crm"] },
    { to: "/users", labelKey: "nav.users", icon: <GroupIcon />,
      workspaces: ["BackOffice","Integrations"] },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> /* always visible */ },
    { to: "/reports", labelKey: "nav.reports", icon: <AnalyticsIcon />, package: "Intelligence" },

    // Phase 3 — integrations & intelligence
    { to: "/quote-builder", labelKey: "nav.quoteBuilder", icon: <RequestQuoteIcon />, package: "FrontOffice" },
    { to: "/risk-profiles", labelKey: "nav.riskProfiles", icon: <DriveEtaIcon />, package: "FrontOffice" },
    { to: "/workflows", labelKey: "nav.workflows", icon: <BoltIcon />, package: "Intelligence" },
    { to: "/churn", labelKey: "nav.churn", icon: <PsychologyAltIcon />, package: "Intelligence" },
    { to: "/report-builder", labelKey: "nav.reportBuilder", icon: <AssessmentIcon />, package: "Intelligence" },

    // Phase 4 — Datawise parity
    { to: "/print-pay", labelKey: "nav.printPay", icon: <PrintIcon />, package: "FrontOffice" },
    { to: "/plafond", labelKey: "nav.plafond", icon: <AccountBalanceWalletIcon />, package: "FrontOffice" },

    // Operations & insurance lifecycle
    { to: "/insurance-companies", labelKey: "nav.insuranceCompanies", icon: <BusinessIcon />, package: "BackOffice" },
    { to: "/tariffs", labelKey: "nav.tariffs", icon: <PriceChangeIcon />, package: "BackOffice" },
    { to: "/endorsements", labelKey: "nav.endorsements", icon: <EditNoteIcon />, package: "BackOffice" },
    { to: "/cancellations", labelKey: "nav.cancellations", icon: <CancelPresentationIcon />, package: "BackOffice" },
    { to: "/credit-notes", labelKey: "nav.creditNotes", icon: <ReceiptLongOutlinedIcon />, package: "BackOffice" },
    { to: "/bulk-commissions", labelKey: "nav.bulkCommissions", icon: <TuneIcon />, package: "BackOffice" },
    { to: "/lookups", labelKey: "nav.lookups", icon: <MenuBookIcon />, package: "BackOffice" },
    { to: "/parametric-files", labelKey: "nav.parametricFiles", icon: <InventoryIcon />, package: "BackOffice" },
    { to: "/group-policies", labelKey: "nav.groupPolicies", icon: <GroupsIcon />, package: "BackOffice" },
    { to: "/garages", labelKey: "nav.garages", icon: <BuildIcon />, package: "BackOffice" },
    { to: "/claim-provisions", labelKey: "nav.provisions", icon: <SavingsIcon />, package: "BackOffice" },
    { to: "/indemnities", labelKey: "nav.indemnities", icon: <PaymentsOutlinedIcon />, package: "BackOffice" },
    { to: "/gl", labelKey: "nav.gl", icon: <AccountBalanceOutlinedIcon />, package: "BackOffice" },
    { to: "/cash", labelKey: "nav.cash", icon: <LocalAtmIcon />, package: "BackOffice" },
    { to: "/name-days", labelKey: "nav.nameDays", icon: <CakeIcon />, package: "Crm" },
    { to: "/mydata", labelKey: "nav.mydata", icon: <GavelOutlinedIcon />, package: "Integrations" },
    { to: "/document-designer", labelKey: "nav.docDesigner", icon: <DesignServicesIcon />, package: "BackOffice" },
    { to: "/friendly-settlements", labelKey: "nav.friendly", icon: <HandshakeOutlinedIcon />, package: "BackOffice" },
    { to: "/customer-merge", labelKey: "nav.merge", icon: <MergeIcon />, package: "BackOffice" },
    { to: "/persistency", labelKey: "nav.persistency", icon: <TrendingUpIcon />, package: "Intelligence" },
    { to: "/policy-delivery", labelKey: "nav.policyDelivery", icon: <MovingIcon />, package: "BackOffice" },
    { to: "/caller-id", labelKey: "nav.callerId", icon: <PhoneCallbackIcon />, package: "Crm" },
    { to: "/usae", labelKey: "nav.usae", icon: <RuleIcon />, package: "Integrations" },
    { to: "/integration-settings", labelKey: "nav.integrationSettings", icon: <VpnKeyIcon />, package: "Integrations" },
    { to: "/named-reports", labelKey: "nav.namedReports", icon: <AssessmentOutlinedIcon />, package: "Intelligence" },
    { to: "/config-hub", labelKey: "nav.configHub", icon: <TuneOutlinedIcon />, package: "BackOffice" },
    { to: "/advance-payments", labelKey: "nav.advance", icon: <SavingsOutlinedIcon />, package: "BackOffice" },
    { to: "/reconciliation", labelKey: "nav.reconciliation", icon: <CompareArrowsIcon />, package: "BackOffice" },
    { to: "/tachypayments", labelKey: "nav.tachy", icon: <LocalPostOfficeIcon />, package: "BackOffice" },
    { to: "/info-center", labelKey: "nav.infoCenter", icon: <CloudUploadOutlinedIcon />, package: "Integrations" },
    { to: "/vehicle-models", labelKey: "nav.vehicleModels", icon: <DirectionsCarIcon />, package: "BackOffice" },
    { to: "/cover-notes", labelKey: "nav.coverNotes", icon: <DescriptionOutlinedIcon />, package: "FrontOffice" },
    { to: "/branches", labelKey: "nav.branchDesigner", icon: <AccountTreeIcon />, package: "Integrations" },
    { to: "/agency-offices", labelKey: "nav.agencyOffices", icon: <HomeWorkIcon />, package: "Integrations" },
    { to: "/delivery-tracking", labelKey: "nav.deliveryTracking", icon: <LocalShippingIcon />, package: "Crm" },

    // Commercial CRM
    { to: "/appointments", labelKey: "nav.appointments", icon: <EventIcon />, package: "Crm" },
    { to: "/document-manager", labelKey: "nav.documentManager", icon: <FolderSpecialIcon />, package: "Crm" },
    { to: "/marketing", labelKey: "nav.marketing", icon: <MailOutlineIcon />, package: "Crm" },
    { to: "/partner-portals", labelKey: "nav.b2bPortal", icon: <HubIcon />, package: "Integrations" },

    // Commissions & production
    { to: "/commission-runs", labelKey: "nav.commissionRuns", icon: <CalculateIcon />, package: "BackOffice" },
    { to: "/over-commissions", labelKey: "nav.overCommissions", icon: <StackedLineChartIcon />, package: "BackOffice" },
    { to: "/production-stats", labelKey: "nav.productionStats", icon: <LeaderboardIcon />, package: "Intelligence" },
    { to: "/goals", labelKey: "nav.goals", icon: <EmojiEventsIcon />, package: "Intelligence" },

    // Financial circuits
    { to: "/financial-movements", labelKey: "nav.financials", icon: <AttachMoneyIcon />, package: "BackOffice" },
    { to: "/receipts", labelKey: "nav.receipts", icon: <ReceiptLongIcon />, package: "BackOffice" },
    { to: "/payments", labelKey: "nav.payments", icon: <RequestQuoteIcon />, package: "BackOffice" },
    { to: "/securities", labelKey: "nav.securities", icon: <RestoreIcon />, package: "BackOffice" },

    // Banking & integrations
    { to: "/dias", labelKey: "nav.dias", icon: <AccountBalanceIcon />, package: "Integrations" },
    { to: "/bank-connections", labelKey: "nav.bankConnections", icon: <LinkIcon />, package: "Integrations" },
    { to: "/company-bridges", labelKey: "nav.companyBridges", icon: <HubIcon />, package: "Integrations",
      workspaces: ["BackOffice","Integrations"] },
    { to: "/api-keys", labelKey: "nav.thirdParty", icon: <ExtensionIcon />, package: "Integrations" },

    // Accounting & reporting
    { to: "/accounting", labelKey: "nav.accounting", icon: <CalculateIcon />, package: "BackOffice" },
    { to: "/kepyo", labelKey: "nav.kepyo", icon: <GavelIcon />, package: "BackOffice" },
    { to: "/magnetic-import", labelKey: "nav.magneticImport", icon: <ImportExportIcon />, package: "BackOffice" },

    { to: "/agency-settings", labelKey: "nav.agencySettings", icon: <SettingsIcon />, comingSoon: true /* always visible */ },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> /* always visible */ }
  ],
  AgencyUser: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm","Intelligence","Integrations"] },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm"] },
    { to: "/policies", labelKey: "nav.contracts", icon: <DescriptionIcon />,
      workspaces: ["BackOffice","FrontOffice"] },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon />,
      workspaces: ["BackOffice","FrontOffice","Crm"] },
    { to: "/requests", labelKey: "nav.requests", icon: <AssignmentIcon />, workspaces: ["Crm"] },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon />,
      workspaces: ["BackOffice","Crm"] },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon />,
      workspaces: ["BackOffice","Crm"] },
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
    { to: "/platform/partners", labelKey: "nav.partners", icon: <SecurityIcon /> },
    { to: "/platform/showcase-images", labelKey: "nav.showcaseImages", icon: <ImageIcon /> },
    { to: "/platform/maintenance", labelKey: "nav.maintenance", icon: <EngineeringIcon /> },
    { to: "/platform/parametric-files", labelKey: "nav.broadcastParametric", icon: <InventoryIcon /> },
    { to: "/platform/plans", labelKey: "nav.subscriptionPlans", icon: <CreditCardIcon />, comingSoon: true },
    { to: "/platform/billing", labelKey: "nav.billing", icon: <PaymentsIcon />, comingSoon: true },
    { to: "/platform/email-templates", labelKey: "nav.emailTemplates", icon: <EmailIcon /> },
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
    { to: "/platform/economics", labelKey: "nav.platformEconomics", icon: <AnalyticsIcon /> },
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
  // PlatformAdmin / PlatformEmployee bypass both — they need to manage the system.
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
      <UserImpersonationBanner />
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
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="producers" element={<ProducersPage />} />
                  <Route path="claims" element={<ClaimsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="agency-settings" element={<AgencySettingsPage />} />
                  <Route path="coming-soon" element={<ComingSoonPage />} />
                  <Route path="platform/partners" element={<PlatformPartnersPage />} />
                  <Route path="platform/showcase-images" element={<ShowcaseImagesPage />} />
                  <Route path="platform/economics" element={<PlatformEconomicsPage />} />
                  <Route path="platform/email-templates" element={<PlatformEmailTemplatesPage />} />
                  <Route path="platform/maintenance" element={<PlatformMaintenancePage />} />
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
                  <Route path="commission-runs" element={<CommissionRunsPage />} />
                  <Route path="company-bridges" element={<CompanyBridgesPage />} />
                  <Route path="insurance-companies" element={<InsuranceCompaniesPage />} />
                  <Route path="endorsements" element={<EndorsementsPage />} />
                  <Route path="cancellations" element={<PolicyCancellationsPage />} />
                  <Route path="credit-notes" element={<CreditNotesPage />} />
                  <Route path="bulk-commissions" element={<BulkCommissionsPage />} />
                  <Route path="lookups" element={<ReferenceCatalogsPage />} />
                  <Route path="parametric-files" element={<ParametricFilesPage />} />
                  <Route path="platform/parametric-files" element={<PlatformParametricFilesPage />} />
                  <Route path="quote-builder" element={<QuoteBuilderPage />} />
                  <Route path="workflows" element={<WorkflowRulesPage />} />
                  <Route path="churn" element={<ChurnDashboardPage />} />
                  <Route path="report-builder" element={<ReportBuilderPage />} />
                  <Route path="print-pay" element={<PrintPayBasketPage />} />
                  <Route path="plafond" element={<PlafondPage />} />
                  <Route path="risk-profiles" element={<RiskProfilesPage />} />
                  <Route path="agency-offices" element={<AgencyOfficesPage />} />
                  <Route path="group-policies" element={<GroupPoliciesPage />} />
                  <Route path="garages" element={<GaragesPage />} />
                  <Route path="claim-provisions" element={<ClaimProvisionsPage />} />
                  <Route path="indemnities" element={<ClaimIndemnitiesPage />} />
                  <Route path="gl" element={<GeneralLedgerPage />} />
                  <Route path="cash" element={<CashPositionPage />} />
                  <Route path="name-days" element={<NameDaysPage />} />
                  <Route path="mydata" element={<MyDataSubmissionsPage />} />
                  <Route path="document-designer" element={<DocumentDesignerPage />} />
                  <Route path="friendly-settlements" element={<FriendlySettlementsPage />} />
                  <Route path="customer-merge" element={<CustomerMergePage />} />
                  <Route path="persistency" element={<PersistencyPage />} />
                  <Route path="policy-delivery" element={<PolicyDeliveryPage />} />
                  <Route path="caller-id" element={<CallerIdPage />} />
                  <Route path="usae" element={<UsaeSubmissionsPage />} />
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
      {user?.role === "AgencyAdmin" && !impersonatedTenantId && <OnboardingWizard />}
    </>
  );
}
