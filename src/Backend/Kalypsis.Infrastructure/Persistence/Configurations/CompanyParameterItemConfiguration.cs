using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CompanyParameterItemConfiguration : IEntityTypeConfiguration<CompanyParameterItem>
{
    public void Configure(EntityTypeBuilder<CompanyParameterItem> b)
    {
        b.ToTable("company_parameter_items");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.PolicyType).HasConversion<int?>();
        b.Property(x => x.VehicleUseCategory).HasConversion<int?>();
        b.Property(x => x.Code).HasMaxLength(80).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.ParentCode).HasMaxLength(80);
        b.Property(x => x.BridgeSystem).HasMaxLength(80);
        b.Property(x => x.BridgeCode).HasMaxLength(120);
        b.Property(x => x.BridgeField).HasMaxLength(120);
        b.Property(x => x.DefaultValuesJson).HasColumnType("longtext");
        b.Property(x => x.Source).HasMaxLength(80).HasDefaultValue("Manual");
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.InsuranceCompany)
            .WithMany()
            .HasForeignKey(x => x.InsuranceCompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => new { x.InsuranceCompanyId, x.Kind, x.Code });
        b.HasIndex(x => new { x.Kind, x.IsActive });
        b.HasIndex(x => new { x.BridgeSystem, x.BridgeCode });
    }
}
