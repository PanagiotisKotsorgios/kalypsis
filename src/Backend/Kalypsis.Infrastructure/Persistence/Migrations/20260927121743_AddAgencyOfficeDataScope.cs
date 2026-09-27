using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAgencyOfficeDataScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "workflow_rules",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "workflow_rule_actions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "workflow_executions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ViberLogs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "VehicleModels",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "users",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "UserAgencyOffices",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "UsaeSubmissions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "transcripts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "third_party_api_keys",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "TenantContracts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "tenant_subscriptions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "tenant_carrier_optins",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "telephony_connections",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "TaxOffices",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "tariffs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "TachyPaymentLines",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "TachyPaymentBatches",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "subscription_usage",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "SmsLogs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "SettlementPayments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "service_requests",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "service_request_attachments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "securities",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "SapBridgeMappings",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "RiskProfiles",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "report_definitions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "RenewalRules",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "RegisterTemplates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ReconciliationLinks",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "receipts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "quotes",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "quote_offers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "production_goals",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "producers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ProducerPlafonds",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ProducerCategories",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "producer_hierarchy_links",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "producer_commission_declarations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "PolicyEndorsements",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "PolicyCancellations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "policy_documents",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "policy_applications",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "policies",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "PeriodLocks",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "PendingItems",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "payments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "PaymentNotices",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "PaymentNoticeLines",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "partner_portal_accesses",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "over_commission_rules",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "OnlinePaymentSessions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "Occupations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "notifications",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "Nationalities",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "NameDays",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "MyDataSubmissions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "mydata_invoices",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "mydata_invoice_lines",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "MovementTypes",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "marketing_campaigns",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "mailbox_connections",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "magnetic_imports",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "LegalForms",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "KoumparasLines",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "kepyo_reports",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "IntegrationSettings",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "installments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "installment_payments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "InfoCenterExports",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "inbound_mails",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "GroupPolicyMembers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "GroupPolicies",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "GlEntries",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "GlAccounts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "Garages",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "FriendlySettlements",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "financial_movements",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "file_scan_results",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "email_templates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "EditableDocuments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "DocumentTemplates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "DocumentNumberingRules",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "document_folders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "document_extractions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "dias_codes",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "delivery_records",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "DefaultValueRules",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CustomFieldValues",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CustomFieldDefinitions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "customers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CustomerCategories",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "customer_relationships",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "customer_insurance_needs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "customer_contacts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CreditNotes",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CoverageOptions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "cover_notes",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ContactExportLogs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "consent_records",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CompanyBridgeRuns",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "company_bridges",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "communication_logs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "commission_transactions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "commission_splits",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "commission_runs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "commission_run_lines",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "commission_rules",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ClaimVictims",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "claims",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ClaimProvisions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ClaimIndemnities",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "Cities",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "churn_scores",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CashMovements",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CashAccounts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CarrierOrders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "carrier_operation_logs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "carrier_connections",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CancellationReasons",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "CallerIdLogs",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "call_records",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "branches",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "BonusMalusRules",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "Banks",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "bank_statement_lines",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "bank_statement_imports",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "bank_connections",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "BackofficeBridgeConnections",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "appointments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "ai_invocations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "AgencyOffices",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "agency_tasks",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "AdvancePayments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

migrationBuilder.AddColumn<Guid>(
                name: "AgencyOfficeScopeId",
                table: "accounting_exports",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "workflow_rules");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "workflow_rule_actions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "workflow_executions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ViberLogs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "VehicleModels");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "users");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "UserAgencyOffices");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "UsaeSubmissions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "transcripts");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "third_party_api_keys");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "TenantContracts");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "tenant_subscriptions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "tenant_carrier_optins");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "telephony_connections");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "TaxOffices");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "tariffs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "TachyPaymentLines");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "TachyPaymentBatches");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "subscription_usage");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "SmsLogs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "SettlementPayments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "service_requests");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "service_request_attachments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "securities");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "SapBridgeMappings");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "RiskProfiles");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "report_definitions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "RenewalRules");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "RegisterTemplates");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ReconciliationLinks");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "receipts");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "quotes");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "quote_offers");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "production_goals");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "producers");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ProducerPlafonds");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ProducerCategories");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "producer_hierarchy_links");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "producer_commission_declarations");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "PolicyEndorsements");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "PolicyCancellations");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "policy_documents");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "policy_applications");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "policies");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "PeriodLocks");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "PendingItems");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "payments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "PaymentNotices");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "PaymentNoticeLines");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "partner_portal_accesses");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "over_commission_rules");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "OnlinePaymentSessions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "Occupations");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "notifications");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "Nationalities");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "NameDays");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "MyDataSubmissions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "mydata_invoices");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "mydata_invoice_lines");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "MovementTypes");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "marketing_campaigns");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "mailbox_connections");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "magnetic_imports");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "LegalForms");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "KoumparasLines");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "kepyo_reports");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "IntegrationSettings");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "installments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "installment_payments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "InfoCenterExports");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "inbound_mails");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "GroupPolicyMembers");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "GroupPolicies");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "GlEntries");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "GlAccounts");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "Garages");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "FriendlySettlements");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "financial_movements");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "file_scan_results");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "email_templates");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "EditableDocuments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "DocumentTemplates");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "DocumentNumberingRules");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "document_folders");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "document_extractions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "dias_codes");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "delivery_records");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "DefaultValueRules");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CustomFieldValues");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CustomFieldDefinitions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "customers");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CustomerCategories");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "customer_relationships");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "customer_insurance_needs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "customer_contacts");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CreditNotes");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CoverageOptions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "cover_notes");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ContactExportLogs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "consent_records");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CompanyBridgeRuns");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "company_bridges");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "communication_logs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "commission_transactions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "commission_splits");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "commission_runs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "commission_run_lines");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "commission_rules");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ClaimVictims");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "claims");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ClaimProvisions");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ClaimIndemnities");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "Cities");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "churn_scores");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CashMovements");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CashAccounts");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CarrierOrders");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "carrier_operation_logs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "carrier_connections");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CancellationReasons");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "CallerIdLogs");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "call_records");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "branches");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "BonusMalusRules");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "Banks");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "bank_statement_lines");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "bank_statement_imports");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "bank_connections");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "BackofficeBridgeConnections");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "appointments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "ai_invocations");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "AgencyOffices");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "agency_tasks");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "AdvancePayments");

migrationBuilder.DropColumn(
                name: "AgencyOfficeScopeId",
                table: "accounting_exports");
        }
    }
}
