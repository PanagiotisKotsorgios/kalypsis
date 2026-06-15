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

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
