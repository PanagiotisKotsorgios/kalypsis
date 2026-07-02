using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TenantCarrierOptInConfiguration : IEntityTypeConfiguration<TenantCarrierOptIn>
{
    public void Configure(EntityTypeBuilder<TenantCarrierOptIn> b)
    {
        b.ToTable("tenant_carrier_optins");
        b.HasKey(x => x.Id);
        b.Property(x => x.EnabledAt).IsRequired();

        b.HasOne(x => x.InsuranceCompany)
            .WithMany()
            .HasForeignKey(x => x.InsuranceCompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per (tenant, carrier) — soft-delete-aware.
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId })
            .IsUnique()
            .HasFilter("`DeletedAt` IS NULL");
    }
}
