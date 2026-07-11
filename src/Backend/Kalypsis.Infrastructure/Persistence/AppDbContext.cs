using System.Linq.Expressions;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Common;
using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly ICurrentUser _currentUser;
    private readonly IDateTimeProvider _clock;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser, IDateTimeProvider clock)
        : base(options)
    {
        _currentUser = currentUser;
        _clock = clock;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerRelationship> CustomerRelationships => Set<CustomerRelationship>();
    public DbSet<CustomerInsuranceNeed> CustomerInsuranceNeeds => Set<CustomerInsuranceNeed>();
    public DbSet<Producer> Producers => Set<Producer>();
    public DbSet<InsuranceCompany> InsuranceCompanies => Set<InsuranceCompany>();
    public DbSet<CompanyParameterItem> CompanyParameterItems => Set<CompanyParameterItem>();
    public DbSet<Policy> Policies => Set<Policy>();
    public DbSet<PolicyObject> PolicyObjects => Set<PolicyObject>();
    public DbSet<PolicyCover> PolicyCovers => Set<PolicyCover>();
    public DbSet<PolicyInstallment> PolicyInstallments => Set<PolicyInstallment>();
    public DbSet<SavedReport> SavedReports => Set<SavedReport>();
    public DbSet<PolicyDocument> PolicyDocuments => Set<PolicyDocument>();
    public DbSet<Claim> Claims => Set<Claim>();
    public DbSet<ClaimInvolvedParty> ClaimInvolvedParties => Set<ClaimInvolvedParty>();
    public DbSet<CommissionRule> CommissionRules => Set<CommissionRule>();
    public DbSet<CommissionTransaction> CommissionTransactions => Set<CommissionTransaction>();
    public DbSet<PolicyCommissionSplit> PolicyCommissionSplits => Set<PolicyCommissionSplit>();
    public DbSet<AgencyTask> AgencyTasks => Set<AgencyTask>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NewsletterSubscriber> NewsletterSubscribers => Set<NewsletterSubscriber>();
    public DbSet<NewsletterCampaign> NewsletterCampaigns => Set<NewsletterCampaign>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<PlatformSetting> PlatformSettings => Set<PlatformSetting>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<ServiceRequestAttachment> ServiceRequestAttachments => Set<ServiceRequestAttachment>();

    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<Tariff> Tariffs => Set<Tariff>();
    public DbSet<CoverNote> CoverNotes => Set<CoverNote>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<OverCommissionRule> OverCommissionRules => Set<OverCommissionRule>();
    public DbSet<ProductionGoal> ProductionGoals => Set<ProductionGoal>();
    public DbSet<Receipt> Receipts => Set<Receipt>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Security> Securities => Set<Security>();
    public DbSet<FinancialMovement> FinancialMovements => Set<FinancialMovement>();
    public DbSet<BankConnection> BankConnections => Set<BankConnection>();
    public DbSet<MarketingCampaign> MarketingCampaigns => Set<MarketingCampaign>();
    public DbSet<DeliveryRecord> DeliveryRecords => Set<DeliveryRecord>();
    public DbSet<DocumentFolder> DocumentFolders => Set<DocumentFolder>();
    public DbSet<PartnerPortalAccess> PartnerPortalAccesses => Set<PartnerPortalAccess>();
    public DbSet<ThirdPartyApiKey> ThirdPartyApiKeys => Set<ThirdPartyApiKey>();
    public DbSet<DiasCode> DiasCodes => Set<DiasCode>();
    public DbSet<AccountingExport> AccountingExports => Set<AccountingExport>();
    public DbSet<KepyoReport> KepyoReports => Set<KepyoReport>();
    public DbSet<MagneticImport> MagneticImports => Set<MagneticImport>();
    public DbSet<CommissionRun> CommissionRuns => Set<CommissionRun>();
    public DbSet<CommissionRunLine> CommissionRunLines => Set<CommissionRunLine>();
    public DbSet<CompanyBridge> CompanyBridges => Set<CompanyBridge>();
    public DbSet<BridgeCodeMapping> BridgeCodeMappings => Set<BridgeCodeMapping>();
    public DbSet<PlatformPartner> PlatformPartners => Set<PlatformPartner>();
    public DbSet<ConsentRecord> ConsentRecords => Set<ConsentRecord>();
    public DbSet<CommunicationLog> CommunicationLogs => Set<CommunicationLog>();
    public DbSet<CustomerContact> CustomerContacts => Set<CustomerContact>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<TwoFactorRecoveryCode> TwoFactorRecoveryCodes => Set<TwoFactorRecoveryCode>();

    // Phase 3
    public DbSet<CarrierConnection> CarrierConnections => Set<CarrierConnection>();
    public DbSet<CarrierOperationLog> CarrierOperationLogs => Set<CarrierOperationLog>();
    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<QuoteOffer> QuoteOffers => Set<QuoteOffer>();
    public DbSet<PolicyApplication> PolicyApplications => Set<PolicyApplication>();
    public DbSet<Installment> Installments => Set<Installment>();
    public DbSet<InstallmentPayment> InstallmentPayments => Set<InstallmentPayment>();
    public DbSet<BankStatementImport> BankStatementImports => Set<BankStatementImport>();
    public DbSet<BankStatementLine> BankStatementLines => Set<BankStatementLine>();
    public DbSet<MyDataInvoice> MyDataInvoices => Set<MyDataInvoice>();
    public DbSet<MyDataInvoiceLine> MyDataInvoiceLines => Set<MyDataInvoiceLine>();
    public DbSet<CommissionSplit> CommissionSplits => Set<CommissionSplit>();
    public DbSet<DocumentExtraction> DocumentExtractions => Set<DocumentExtraction>();
    public DbSet<FileScanResult> FileScanResults => Set<FileScanResult>();
    public DbSet<WorkflowRule> WorkflowRules => Set<WorkflowRule>();
    public DbSet<WorkflowRuleAction> WorkflowRuleActions => Set<WorkflowRuleAction>();
    public DbSet<WorkflowExecution> WorkflowExecutions => Set<WorkflowExecution>();
    public DbSet<MailboxConnection> MailboxConnections => Set<MailboxConnection>();
    public DbSet<InboundMail> InboundMails => Set<InboundMail>();
    public DbSet<TelephonyConnection> TelephonyConnections => Set<TelephonyConnection>();
    public DbSet<CallRecord> CallRecords => Set<CallRecord>();
    public DbSet<Transcript> Transcripts => Set<Transcript>();
    public DbSet<AiInvocation> AiInvocations => Set<AiInvocation>();
    public DbSet<ChurnScore> ChurnScores => Set<ChurnScore>();
    public DbSet<ProducerHierarchyLink> ProducerHierarchyLinks => Set<ProducerHierarchyLink>();
    public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();
    public DbSet<SubscriptionUsage> SubscriptionUsage => Set<SubscriptionUsage>();
    public DbSet<ReportDefinition> ReportDefinitions => Set<ReportDefinition>();

    // Phase 4 — Datawise parity
    public DbSet<RiskProfile> RiskProfiles => Set<RiskProfile>();
    public DbSet<CoverageOption> CoverageOptions => Set<CoverageOption>();
    public DbSet<PendingItem> PendingItems => Set<PendingItem>();
    public DbSet<PaymentNotice> PaymentNotices => Set<PaymentNotice>();
    public DbSet<PaymentNoticeLine> PaymentNoticeLines => Set<PaymentNoticeLine>();
    public DbSet<ProducerPlafond> ProducerPlafonds => Set<ProducerPlafond>();
    public DbSet<KoumparasLine> KoumparasLines => Set<KoumparasLine>();
    public DbSet<CarrierOrder> CarrierOrders => Set<CarrierOrder>();
    public DbSet<OnlinePaymentSession> OnlinePaymentSessions => Set<OnlinePaymentSession>();
    public DbSet<BackofficeBridgeConnection> BackofficeBridgeConnections => Set<BackofficeBridgeConnection>();
    public DbSet<SmsLog> SmsLogs => Set<SmsLog>();
    public DbSet<ViberLog> ViberLogs => Set<ViberLog>();

    // Phase 5 — Modular packaging
    public DbSet<TenantPackageGrant> TenantPackageGrants => Set<TenantPackageGrant>();

    // Producer reconciliation — self-reported expected commission per policy
    public DbSet<ProducerCommissionDeclaration> ProducerCommissionDeclarations => Set<ProducerCommissionDeclaration>();
    public DbSet<ProducerExpectedRate> ProducerExpectedRates => Set<ProducerExpectedRate>();

    // Phase 6 — Multi-office agencies
    public DbSet<AgencyOffice> AgencyOffices => Set<AgencyOffice>();
    public DbSet<UserAgencyOffice> UserAgencyOffices => Set<UserAgencyOffice>();

    // Phase 7 — Tenant contracts
    public DbSet<TenantContract> TenantContracts => Set<TenantContract>();

    // Phase 8.5 — Platform-level email templates
    public DbSet<PlatformEmailTemplate> PlatformEmailTemplates => Set<PlatformEmailTemplate>();

    // Phase 9 — Policy lifecycle ops + reference catalogs
    public DbSet<PolicyEndorsement> PolicyEndorsements => Set<PolicyEndorsement>();

    // Phase 10.2 — Carrier parametric files
    public DbSet<CarrierParametricFile> CarrierParametricFiles => Set<CarrierParametricFile>();
    public DbSet<CancellationReason> CancellationReasons => Set<CancellationReason>();
    public DbSet<PolicyCancellation> PolicyCancellations => Set<PolicyCancellation>();
    public DbSet<CreditNote> CreditNotes => Set<CreditNote>();
    public DbSet<Bank> Banks => Set<Bank>();
    public DbSet<TaxOffice> TaxOffices => Set<TaxOffice>();
    public DbSet<CustomerCategory> CustomerCategories => Set<CustomerCategory>();
    public DbSet<ProducerCategory> ProducerCategories => Set<ProducerCategory>();
    public DbSet<Nationality> Nationalities => Set<Nationality>();
    public DbSet<Occupation> Occupations => Set<Occupation>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<LegalForm> LegalForms => Set<LegalForm>();

    // Phase 11 — Remaining ALIS gap features
    public DbSet<GroupPolicy> GroupPolicies => Set<GroupPolicy>();
    public DbSet<GroupPolicyMember> GroupPolicyMembers => Set<GroupPolicyMember>();
    public DbSet<ClaimProvision> ClaimProvisions => Set<ClaimProvision>();
    public DbSet<ClaimIndemnity> ClaimIndemnities => Set<ClaimIndemnity>();
    public DbSet<Garage> Garages => Set<Garage>();
    public DbSet<GlAccount> GlAccounts => Set<GlAccount>();
    public DbSet<GlEntry> GlEntries => Set<GlEntry>();
    public DbSet<CashAccount> CashAccounts => Set<CashAccount>();
    public DbSet<CashMovement> CashMovements => Set<CashMovement>();
    public DbSet<NameDay> NameDays => Set<NameDay>();
    public DbSet<MyDataSubmission> MyDataSubmissions => Set<MyDataSubmission>();
    public DbSet<DocumentTemplate> DocumentTemplates => Set<DocumentTemplate>();
    public DbSet<DocumentNumberingRule> DocumentNumberingRules => Set<DocumentNumberingRule>();

    // Phase 12 — BluByte parity
    public DbSet<FriendlySettlement> FriendlySettlements => Set<FriendlySettlement>();
    public DbSet<ClaimVictim> ClaimVictims => Set<ClaimVictim>();
    public DbSet<SettlementPayment> SettlementPayments => Set<SettlementPayment>();
    public DbSet<CallerIdLog> CallerIdLogs => Set<CallerIdLog>();
    public DbSet<UsaeSubmission> UsaeSubmissions => Set<UsaeSubmission>();
    public DbSet<VehicleModel> VehicleModels => Set<VehicleModel>();

    // Phase 13 — full BluByte parity
    public DbSet<IntegrationSetting> IntegrationSettings => Set<IntegrationSetting>();
    public DbSet<CustomFieldDefinition> CustomFieldDefinitions => Set<CustomFieldDefinition>();
    public DbSet<CustomFieldValue> CustomFieldValues => Set<CustomFieldValue>();
    public DbSet<MovementType> MovementTypes => Set<MovementType>();
    public DbSet<BonusMalusRule> BonusMalusRules => Set<BonusMalusRule>();
    public DbSet<RenewalRule> RenewalRules => Set<RenewalRule>();
    public DbSet<RegisterTemplate> RegisterTemplates => Set<RegisterTemplate>();
    public DbSet<AdvancePayment> AdvancePayments => Set<AdvancePayment>();
    public DbSet<ReconciliationLink> ReconciliationLinks => Set<ReconciliationLink>();
    public DbSet<TachyPaymentBatch> TachyPaymentBatches => Set<TachyPaymentBatch>();
    public DbSet<TachyPaymentLine> TachyPaymentLines => Set<TachyPaymentLine>();
    public DbSet<ContactExportLog> ContactExportLogs => Set<ContactExportLog>();
    public DbSet<EditableDocument> EditableDocuments => Set<EditableDocument>();
    public DbSet<InfoCenterExport> InfoCenterExports => Set<InfoCenterExport>();
    public DbSet<SapBridgeMapping> SapBridgeMappings => Set<SapBridgeMapping>();
    public DbSet<PeriodLock> PeriodLocks => Set<PeriodLock>();

    // Phase 14
    public DbSet<DefaultValueRule> DefaultValueRules => Set<DefaultValueRule>();
    public DbSet<CompanyBridgeRun> CompanyBridgeRuns => Set<CompanyBridgeRun>();

    // Public signup queue
    public DbSet<RegistrationRequest> RegistrationRequests => Set<RegistrationRequest>();

    // Phase 15 — invoicing
    public DbSet<TenantInvoice> TenantInvoices => Set<TenantInvoice>();
    public DbSet<TenantInvoiceLine> TenantInvoiceLines => Set<TenantInvoiceLine>();
    // Ad-hoc chargeable services per tenant (training, migration, custom dev).
    public DbSet<TenantChargeable> TenantChargeables => Set<TenantChargeable>();
    // Editable pricing catalog — singleton row.
    public DbSet<PlatformPricing> PlatformPricings => Set<PlatformPricing>();

    // Per-tenant opt-in to universal carriers.
    public DbSet<TenantCarrierOptIn> TenantCarrierOptIns => Set<TenantCarrierOptIn>();

    public DbSet<PolicyCoverAdjustment> PolicyCoverAdjustments => Set<PolicyCoverAdjustment>();

    public DbSet<AgencyInstruction> AgencyInstructions => Set<AgencyInstruction>();

    public DbSet<TenantBackup> TenantBackups => Set<TenantBackup>();
    public DbSet<TenantBackupPolicy> TenantBackupPolicies => Set<TenantBackupPolicy>();
    public DbSet<GdprErasureRequest> GdprErasureRequests => Set<GdprErasureRequest>();

    public Guid CurrentTenantId => _currentUser.TenantId ?? Guid.Empty;

    // PlatformAdmin / PlatformEmployee normally bypass the tenant filter, but
    // when they're impersonating a tenant (via X-Impersonate-Tenant) we scope
    // them to that tenant so every page behaves as if they were inside it.
    public bool BypassTenantFilter => _currentUser.IsPlatformLevel && !_currentUser.IsImpersonating;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;

            if (typeof(TenantEntity).IsAssignableFrom(clrType))
            {
                modelBuilder.Entity(clrType).HasQueryFilter(BuildTenantAndSoftDeleteFilter(clrType));
            }
            else if (typeof(BaseEntity).IsAssignableFrom(clrType))
            {
                modelBuilder.Entity(clrType).HasQueryFilter(BuildSoftDeleteFilter(clrType));
            }
        }

        base.OnModelCreating(modelBuilder);
    }

    /// See <see cref="Kalypsis.Application.Abstractions.IAppDbContext.ExecuteRawSqlAsync"/>.
    public Task<int> ExecuteRawSqlAsync(string sql, CancellationToken cancellationToken = default, params object[] parameters)
        => Database.ExecuteSqlRawAsync(sql, parameters, cancellationToken);

    /// See <see cref="Kalypsis.Application.Abstractions.IAppDbContext.ClearChangeTracker"/>.
    public void ClearChangeTracker() => ChangeTracker.Clear();

    public Task OpenConnectionAsync(CancellationToken cancellationToken = default)
        => Database.OpenConnectionAsync(cancellationToken);
    public Task CloseConnectionAsync(CancellationToken cancellationToken = default)
    {
        Database.CloseConnection();
        return Task.CompletedTask;
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditAndTenantStamps();
        var audits = BuildAuditEntries();
        var rows = await base.SaveChangesAsync(cancellationToken);
        if (audits.Count > 0)
        {
            AuditLogs.AddRange(audits);
            await base.SaveChangesAsync(cancellationToken);
        }
        return rows;
    }

    /// <summary>
    /// Snapshot ChangeTracker before SaveChanges so we can persist a paired
    /// AuditLog row for every meaningful entity mutation.
    /// </summary>
    private List<AuditLog> BuildAuditEntries()
    {
        var now = _clock.UtcNow;
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;
        var list = new List<AuditLog>();

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is AuditLog) continue;        // never audit the audit log
            if (entry.Entity is RefreshToken) continue;     // noisy, security-sensitive
            if (entry.Entity is PasswordResetToken) continue;
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;

            // Authentication handlers add explicit, correctly attributed login
            // events. Do not add a second anonymous User update just because
            // LastLoginAt, lockout state or the failed-attempt counter changed.
            if (entry.Entity is User && userId is null && entry.State == EntityState.Modified)
            {
                var changedNames = entry.Properties
                    .Where(p => p.IsModified)
                    .Select(p => p.Metadata.Name)
                    .ToHashSet(StringComparer.Ordinal);
                if (changedNames.Count > 0 && changedNames.All(name => name is nameof(User.LastLoginAt)
                    or nameof(User.FailedLoginAttempts) or nameof(User.LockedUntil) or nameof(BaseEntity.UpdatedAt)))
                    continue;
            }

            var clrType = entry.Entity.GetType();
            var idProp = clrType.GetProperty("Id");
            var idValue = idProp?.GetValue(entry.Entity)?.ToString() ?? string.Empty;
            string? entityTenantId = null;
            if (entry.Entity is TenantEntity te) entityTenantId = te.TenantId.ToString();

            var action = entry.State switch
            {
                EntityState.Added => "Create",
                EntityState.Modified => entry.Entity is BaseEntity be && be.DeletedAt is not null ? "Delete" : "Update",
                EntityState.Deleted => "Delete",
                _ => "Unknown"
            };

            string? oldValuesJson = null;
            string? newValuesJson = null;
            if (entry.State == EntityState.Modified)
            {
                var changed = entry.Properties
                    .Where(p => p.IsModified && !string.Equals(p.Metadata.Name, "UpdatedAt", StringComparison.Ordinal))
                    .ToList();
                if (changed.Count > 0)
                {
                    oldValuesJson = JsonSerialize(changed.ToDictionary(p => p.Metadata.Name, p => RedactIfSensitive(p.Metadata.Name, p.OriginalValue)));
                    newValuesJson = JsonSerialize(changed.ToDictionary(p => p.Metadata.Name, p => RedactIfSensitive(p.Metadata.Name, p.CurrentValue)));
                }
            }
            else if (entry.State == EntityState.Added)
            {
                newValuesJson = JsonSerialize(entry.Properties
                    .Where(p => p.CurrentValue is not null)
                    .ToDictionary(p => p.Metadata.Name, p => RedactIfSensitive(p.Metadata.Name, p.CurrentValue)));
            }

            list.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                CreatedAt = now,
                TenantId = entityTenantId is null ? tenantId : Guid.Parse(entityTenantId),
                UserId = userId,
                EntityName = clrType.Name,
                EntityId = idValue,
                Action = action,
                Category = "Data",
                OldValues = oldValuesJson,
                NewValues = newValuesJson
            });
        }
        return list;
    }

    private static readonly System.Text.Json.JsonSerializerOptions _jsonOpts = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private static string JsonSerialize(object? value)
    {
        try { return System.Text.Json.JsonSerializer.Serialize(value, _jsonOpts); }
        catch { return "{}"; }
    }

    private static object? RedactIfSensitive(string propertyName, object? value)
    {
        if (value is null) return null;
        if (propertyName.Contains("Password", StringComparison.OrdinalIgnoreCase)
            || propertyName.Contains("Token", StringComparison.OrdinalIgnoreCase)
            || propertyName.Contains("Secret", StringComparison.OrdinalIgnoreCase)
            || propertyName.Contains("ApiKey", StringComparison.OrdinalIgnoreCase))
        {
            return "***";
        }
        return value;
    }

    private void ApplyAuditAndTenantStamps()
    {
        var now = _clock.UtcNow;
        var tenantId = _currentUser.TenantId;
        // PlatformAdmin / PlatformEmployee can legitimately write across tenants
        // (e.g. provisioning a new tenant from the public registration queue).
        // Everyone else MUST stay inside their own tenant — guard below.
        var isPrivileged = _currentUser.IsPlatformLevel;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity.CreatedAt == default)
                        entry.Entity.CreatedAt = now;
                    if (entry.Entity is TenantEntity addedTenantEntity)
                    {
                        if (addedTenantEntity.TenantId == Guid.Empty && tenantId.HasValue)
                        {
                            addedTenantEntity.TenantId = tenantId.Value;
                        }
                        // Cross-tenant write guard: a non-platform user creating a row
                        // explicitly for ANOTHER tenant is either compromised or a bug.
                        // We refuse rather than persist.
                        else if (!isPrivileged && tenantId.HasValue
                                 && addedTenantEntity.TenantId != tenantId.Value)
                        {
                            throw new InvalidOperationException(
                                $"Cross-tenant write blocked: tried to insert {entry.Entity.GetType().Name} into tenant {addedTenantEntity.TenantId} from session of tenant {tenantId.Value}.");
                        }
                    }
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    // Same guard on UPDATE — protects against an attacker loading a row
                    // via IgnoreQueryFilters() then mutating it. Compares the ORIGINAL
                    // TenantId so a malicious change to TenantId itself is also caught.
                    if (entry.Entity is TenantEntity modTenantEntity && !isPrivileged && tenantId.HasValue)
                    {
                        var original = entry.OriginalValues[nameof(TenantEntity.TenantId)];
                        var originalTid = original is Guid og ? og : modTenantEntity.TenantId;
                        if (originalTid != tenantId.Value || modTenantEntity.TenantId != tenantId.Value)
                        {
                            throw new InvalidOperationException(
                                $"Cross-tenant write blocked: tried to update {entry.Entity.GetType().Name} from tenant {originalTid} → {modTenantEntity.TenantId} (session tenant {tenantId.Value}).");
                        }
                    }
                    break;

                case EntityState.Deleted:
                    // Same guard on DELETE.
                    if (entry.Entity is TenantEntity delTenantEntity && !isPrivileged && tenantId.HasValue
                        && delTenantEntity.TenantId != tenantId.Value)
                    {
                        throw new InvalidOperationException(
                            $"Cross-tenant delete blocked: tried to delete {entry.Entity.GetType().Name} from tenant {delTenantEntity.TenantId} (session tenant {tenantId.Value}).");
                    }
                    entry.State = EntityState.Modified;
                    entry.Entity.DeletedAt = now;
                    break;
            }
        }
    }

    private LambdaExpression BuildSoftDeleteFilter(Type clrType)
    {
        var parameter = Expression.Parameter(clrType, "e");
        var prop = Expression.Property(parameter, nameof(BaseEntity.DeletedAt));
        var body = Expression.Equal(prop, Expression.Constant(null, typeof(DateTime?)));
        return Expression.Lambda(body, parameter);
    }

    private LambdaExpression BuildTenantAndSoftDeleteFilter(Type clrType)
    {
        var parameter = Expression.Parameter(clrType, "e");

        var deletedProp = Expression.Property(parameter, nameof(BaseEntity.DeletedAt));
        var notDeleted = Expression.Equal(deletedProp, Expression.Constant(null, typeof(DateTime?)));

        var thisExpr = Expression.Constant(this);
        var tenantProp = Expression.Property(thisExpr, nameof(CurrentTenantId));
        var bypassProp = Expression.Property(thisExpr, nameof(BypassTenantFilter));

        var entityTenant = Expression.Property(parameter, nameof(TenantEntity.TenantId));
        var tenantMatch = Expression.Equal(entityTenant, tenantProp);

        var tenantCheck = Expression.OrElse(bypassProp, tenantMatch);
        var body = Expression.AndAlso(notDeleted, tenantCheck);

        return Expression.Lambda(body, parameter);
    }
}
