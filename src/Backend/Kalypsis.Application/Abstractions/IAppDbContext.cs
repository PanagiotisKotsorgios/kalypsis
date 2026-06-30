using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Customer> Customers { get; }
    DbSet<CustomerRelationship> CustomerRelationships { get; }
    DbSet<CustomerInsuranceNeed> CustomerInsuranceNeeds { get; }
    DbSet<Producer> Producers { get; }
    DbSet<InsuranceCompany> InsuranceCompanies { get; }
    DbSet<CompanyParameterItem> CompanyParameterItems { get; }
    DbSet<Policy> Policies { get; }
    DbSet<PolicyDocument> PolicyDocuments { get; }
    DbSet<PolicyObject> PolicyObjects { get; }
    DbSet<PolicyCover> PolicyCovers { get; }
    DbSet<PolicyInstallment> PolicyInstallments { get; }
    DbSet<Claim> Claims { get; }
    DbSet<CommissionRule> CommissionRules { get; }
    DbSet<CommissionTransaction> CommissionTransactions { get; }
    DbSet<AgencyTask> AgencyTasks { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<NewsletterSubscriber> NewsletterSubscribers { get; }
    DbSet<NewsletterCampaign> NewsletterCampaigns { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }
    DbSet<PlatformSetting> PlatformSettings { get; }
    DbSet<ServiceRequest> ServiceRequests { get; }
    DbSet<ServiceRequestAttachment> ServiceRequestAttachments { get; }

    DbSet<Appointment> Appointments { get; }
    DbSet<Tariff> Tariffs { get; }
    DbSet<CoverNote> CoverNotes { get; }
    DbSet<Branch> Branches { get; }
    DbSet<OverCommissionRule> OverCommissionRules { get; }
    DbSet<ProductionGoal> ProductionGoals { get; }
    DbSet<Receipt> Receipts { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Security> Securities { get; }
    DbSet<FinancialMovement> FinancialMovements { get; }
    DbSet<BankConnection> BankConnections { get; }
    DbSet<MarketingCampaign> MarketingCampaigns { get; }
    DbSet<DeliveryRecord> DeliveryRecords { get; }
    DbSet<DocumentFolder> DocumentFolders { get; }
    DbSet<PartnerPortalAccess> PartnerPortalAccesses { get; }
    DbSet<ThirdPartyApiKey> ThirdPartyApiKeys { get; }
    DbSet<DiasCode> DiasCodes { get; }
    DbSet<AccountingExport> AccountingExports { get; }
    DbSet<KepyoReport> KepyoReports { get; }
    DbSet<MagneticImport> MagneticImports { get; }
    DbSet<CommissionRun> CommissionRuns { get; }
    DbSet<CommissionRunLine> CommissionRunLines { get; }
    DbSet<CompanyBridge> CompanyBridges { get; }
    DbSet<PlatformPartner> PlatformPartners { get; }
    DbSet<ConsentRecord> ConsentRecords { get; }
    DbSet<CommunicationLog> CommunicationLogs { get; }
    DbSet<CustomerContact> CustomerContacts { get; }
    DbSet<EmailTemplate> EmailTemplates { get; }
    DbSet<TwoFactorRecoveryCode> TwoFactorRecoveryCodes { get; }

    // Phase 3 — carrier + quote + issuance
    DbSet<CarrierConnection> CarrierConnections { get; }
    DbSet<CarrierOperationLog> CarrierOperationLogs { get; }
    DbSet<Quote> Quotes { get; }
    DbSet<QuoteOffer> QuoteOffers { get; }
    DbSet<PolicyApplication> PolicyApplications { get; }

    // Phase 3 — billing + reconciliation + myDATA
    DbSet<Installment> Installments { get; }
    DbSet<InstallmentPayment> InstallmentPayments { get; }
    DbSet<BankStatementImport> BankStatementImports { get; }
    DbSet<BankStatementLine> BankStatementLines { get; }
    DbSet<MyDataInvoice> MyDataInvoices { get; }
    DbSet<MyDataInvoiceLine> MyDataInvoiceLines { get; }

    // Phase 3 — commissions / OCR / scanning
    DbSet<CommissionSplit> CommissionSplits { get; }
    DbSet<DocumentExtraction> DocumentExtractions { get; }
    DbSet<FileScanResult> FileScanResults { get; }

    // Phase 3 — workflows
    DbSet<WorkflowRule> WorkflowRules { get; }
    DbSet<WorkflowRuleAction> WorkflowRuleActions { get; }
    DbSet<WorkflowExecution> WorkflowExecutions { get; }

    // Phase 3 — mailbox / telephony / transcripts / AI
    DbSet<MailboxConnection> MailboxConnections { get; }
    DbSet<InboundMail> InboundMails { get; }
    DbSet<TelephonyConnection> TelephonyConnections { get; }
    DbSet<CallRecord> CallRecords { get; }
    DbSet<Transcript> Transcripts { get; }
    DbSet<AiInvocation> AiInvocations { get; }
    DbSet<ChurnScore> ChurnScores { get; }

    // Phase 3 — hierarchy / subscription / report builder
    DbSet<ProducerHierarchyLink> ProducerHierarchyLinks { get; }
    DbSet<TenantSubscription> TenantSubscriptions { get; }
    DbSet<SubscriptionUsage> SubscriptionUsage { get; }
    DbSet<ReportDefinition> ReportDefinitions { get; }

    // Phase 4 — Datawise parity
    DbSet<RiskProfile> RiskProfiles { get; }
    DbSet<CoverageOption> CoverageOptions { get; }
    DbSet<PendingItem> PendingItems { get; }
    DbSet<PaymentNotice> PaymentNotices { get; }
    DbSet<PaymentNoticeLine> PaymentNoticeLines { get; }
    DbSet<ProducerPlafond> ProducerPlafonds { get; }
    DbSet<KoumparasLine> KoumparasLines { get; }
    DbSet<CarrierOrder> CarrierOrders { get; }
    DbSet<OnlinePaymentSession> OnlinePaymentSessions { get; }
    DbSet<BackofficeBridgeConnection> BackofficeBridgeConnections { get; }
    DbSet<SmsLog> SmsLogs { get; }
    DbSet<ViberLog> ViberLogs { get; }

    // Phase 5 — Modular packaging
    DbSet<TenantPackageGrant> TenantPackageGrants { get; }

    // Producer reconciliation — self-reported expected commission per policy
    DbSet<ProducerCommissionDeclaration> ProducerCommissionDeclarations { get; }

    // Phase 6 — Multi-office agencies
    DbSet<AgencyOffice> AgencyOffices { get; }
    DbSet<UserAgencyOffice> UserAgencyOffices { get; }

    // Phase 7 — Tenant contracts
    DbSet<TenantContract> TenantContracts { get; }

    // Phase 8.5 — Platform-level email templates
    DbSet<PlatformEmailTemplate> PlatformEmailTemplates { get; }

    // Phase 9 — Policy lifecycle ops + reference catalogs
    DbSet<PolicyEndorsement> PolicyEndorsements { get; }

    // Phase 10.2 — Carrier parametric files
    DbSet<CarrierParametricFile> CarrierParametricFiles { get; }
    DbSet<CancellationReason> CancellationReasons { get; }
    DbSet<PolicyCancellation> PolicyCancellations { get; }
    DbSet<CreditNote> CreditNotes { get; }
    DbSet<Bank> Banks { get; }
    DbSet<TaxOffice> TaxOffices { get; }
    DbSet<CustomerCategory> CustomerCategories { get; }
    DbSet<ProducerCategory> ProducerCategories { get; }
    DbSet<Nationality> Nationalities { get; }
    DbSet<Occupation> Occupations { get; }
    DbSet<City> Cities { get; }
    DbSet<LegalForm> LegalForms { get; }

    // Phase 11 — Remaining ALIS gap features
    DbSet<GroupPolicy> GroupPolicies { get; }
    DbSet<GroupPolicyMember> GroupPolicyMembers { get; }
    DbSet<ClaimProvision> ClaimProvisions { get; }
    DbSet<ClaimIndemnity> ClaimIndemnities { get; }
    DbSet<Garage> Garages { get; }
    DbSet<GlAccount> GlAccounts { get; }
    DbSet<GlEntry> GlEntries { get; }
    DbSet<CashAccount> CashAccounts { get; }
    DbSet<CashMovement> CashMovements { get; }
    DbSet<NameDay> NameDays { get; }
    DbSet<MyDataSubmission> MyDataSubmissions { get; }
    DbSet<DocumentTemplate> DocumentTemplates { get; }
    DbSet<DocumentNumberingRule> DocumentNumberingRules { get; }

    // Phase 12 — BluByte parity
    DbSet<FriendlySettlement> FriendlySettlements { get; }
    DbSet<ClaimVictim> ClaimVictims { get; }
    DbSet<SettlementPayment> SettlementPayments { get; }
    DbSet<CallerIdLog> CallerIdLogs { get; }
    DbSet<UsaeSubmission> UsaeSubmissions { get; }
    DbSet<VehicleModel> VehicleModels { get; }

    // Phase 13 — full BluByte parity
    DbSet<IntegrationSetting> IntegrationSettings { get; }
    DbSet<CustomFieldDefinition> CustomFieldDefinitions { get; }
    DbSet<CustomFieldValue> CustomFieldValues { get; }
    DbSet<MovementType> MovementTypes { get; }
    DbSet<BonusMalusRule> BonusMalusRules { get; }
    DbSet<RenewalRule> RenewalRules { get; }
    DbSet<RegisterTemplate> RegisterTemplates { get; }
    DbSet<AdvancePayment> AdvancePayments { get; }
    DbSet<ReconciliationLink> ReconciliationLinks { get; }
    DbSet<TachyPaymentBatch> TachyPaymentBatches { get; }
    DbSet<TachyPaymentLine> TachyPaymentLines { get; }
    DbSet<ContactExportLog> ContactExportLogs { get; }
    DbSet<EditableDocument> EditableDocuments { get; }
    DbSet<InfoCenterExport> InfoCenterExports { get; }
    DbSet<SapBridgeMapping> SapBridgeMappings { get; }
    DbSet<PeriodLock> PeriodLocks { get; }

    // Phase 14 — default-value rules + carrier bridge import runs
    DbSet<DefaultValueRule> DefaultValueRules { get; }
    DbSet<CompanyBridgeRun> CompanyBridgeRuns { get; }

    // Public signup queue — reviewed by the platform superadmin
    DbSet<RegistrationRequest> RegistrationRequests { get; }

    // Phase 15 — Per-tenant invoicing (lines derived from TenantPackageGrants)
    DbSet<TenantInvoice> TenantInvoices { get; }
    DbSet<TenantInvoiceLine> TenantInvoiceLines { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
