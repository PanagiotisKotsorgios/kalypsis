using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class StatutoryInsuranceBranchConfiguration : IEntityTypeConfiguration<StatutoryInsuranceBranch>
{
    public void Configure(EntityTypeBuilder<StatutoryInsuranceBranch> b)
    {
        b.ToTable("statutory_insurance_branches");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(8).IsRequired();
        b.Property(x => x.SeedCode).HasMaxLength(8);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Category).HasMaxLength(20).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId, x.Code }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId, x.DisplayOrder });
    }
}

public sealed class OfficeVehicleUseConfiguration : IEntityTypeConfiguration<OfficeVehicleUse>
{
    public void Configure(EntityTypeBuilder<OfficeVehicleUse> b)
    {
        b.ToTable("office_vehicle_uses");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.SeedCode).HasMaxLength(20);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId, x.Code }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId, x.DisplayOrder });
    }
}
