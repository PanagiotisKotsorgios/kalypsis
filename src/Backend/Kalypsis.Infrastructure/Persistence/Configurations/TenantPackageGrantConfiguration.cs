using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TenantPackageGrantConfiguration : IEntityTypeConfiguration<TenantPackageGrant>
{
    public void Configure(EntityTypeBuilder<TenantPackageGrant> b)
    {
        // One row per (tenant, package). A second row would mean a duplicate
        // grant, which the service refuses to create.
        b.HasIndex(x => new { x.TenantId, x.Package }).IsUnique()
            .HasFilter("`DeletedAt` IS NULL");
        b.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.Notes).HasMaxLength(500);
    }
}
