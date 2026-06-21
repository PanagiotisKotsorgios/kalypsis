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
    public DbSet<Producer> Producers => Set<Producer>();
    public DbSet<InsuranceCompany> InsuranceCompanies => Set<InsuranceCompany>();
    public DbSet<Policy> Policies => Set<Policy>();
    public DbSet<PolicyDocument> PolicyDocuments => Set<PolicyDocument>();
    public DbSet<Claim> Claims => Set<Claim>();
    public DbSet<CommissionRule> CommissionRules => Set<CommissionRule>();
    public DbSet<CommissionTransaction> CommissionTransactions => Set<CommissionTransaction>();
    public DbSet<AgencyTask> AgencyTasks => Set<AgencyTask>();
    public DbSet<Notification> Notifications => Set<Notification>();
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
    public DbSet<PlatformPartner> PlatformPartners => Set<PlatformPartner>();
    public DbSet<ConsentRecord> ConsentRecords => Set<ConsentRecord>();
    public DbSet<CommunicationLog> CommunicationLogs => Set<CommunicationLog>();
    public DbSet<CustomerContact> CustomerContacts => Set<CustomerContact>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<TwoFactorRecoveryCode> TwoFactorRecoveryCodes => Set<TwoFactorRecoveryCode>();

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

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity.CreatedAt == default)
                        entry.Entity.CreatedAt = now;
                    if (entry.Entity is TenantEntity addedTenantEntity && addedTenantEntity.TenantId == Guid.Empty && tenantId.HasValue)
                    {
                        addedTenantEntity.TenantId = tenantId.Value;
                    }
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;

                case EntityState.Deleted:
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
