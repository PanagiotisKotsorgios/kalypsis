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

    public Guid CurrentTenantId => _currentUser.TenantId ?? Guid.Empty;
    public bool BypassTenantFilter => _currentUser.IsPlatformLevel;

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
        return await base.SaveChangesAsync(cancellationToken);
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
