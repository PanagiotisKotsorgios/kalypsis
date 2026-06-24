using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class InsuranceCompanyConfiguration : IEntityTypeConfiguration<InsuranceCompany>
{
    public void Configure(EntityTypeBuilder<InsuranceCompany> b)
    {
        b.ToTable("insurance_companies");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Code).HasMaxLength(64).IsRequired();
        b.Property(x => x.Country).HasMaxLength(80);
        b.Property(x => x.Website).HasMaxLength(255);
        // Phase 8.7 — extended fields
        b.Property(x => x.AgentCode).HasMaxLength(80);
        b.Property(x => x.ContactName).HasMaxLength(160);
        b.Property(x => x.ContactEmail).HasMaxLength(160);
        b.Property(x => x.ContactPhone).HasMaxLength(40);
        b.Property(x => x.AfmVat).HasMaxLength(40);
        b.Property(x => x.Notes).HasMaxLength(2000);
        // Code is unique GLOBALLY for null-tenant rows, but tenant-owned rows
        // can reuse the same code as a global one. We relax the unique to per-tenant.
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
    }
}
