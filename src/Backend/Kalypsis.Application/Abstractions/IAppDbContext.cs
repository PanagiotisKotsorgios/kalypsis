using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Customer> Customers { get; }
    DbSet<Producer> Producers { get; }
    DbSet<InsuranceCompany> InsuranceCompanies { get; }
    DbSet<Policy> Policies { get; }
    DbSet<PolicyDocument> PolicyDocuments { get; }
    DbSet<Claim> Claims { get; }
    DbSet<CommissionRule> CommissionRules { get; }
    DbSet<CommissionTransaction> CommissionTransactions { get; }
    DbSet<AgencyTask> AgencyTasks { get; }
    DbSet<Notification> Notifications { get; }
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

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
