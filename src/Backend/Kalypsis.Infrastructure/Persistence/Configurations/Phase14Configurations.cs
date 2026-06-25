using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class DefaultValueRuleConfiguration : IEntityTypeConfiguration<DefaultValueRule>
{
    public void Configure(EntityTypeBuilder<DefaultValueRule> b)
    {
        b.HasIndex(x => new { x.TenantId, x.IsActive, x.Priority });
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.CoverCode).HasMaxLength(40);
        b.Property(x => x.PackageCode).HasMaxLength(40);
        b.Property(x => x.ValuesJson).HasColumnType("longtext").IsRequired();
        b.Property(x => x.Notes).HasMaxLength(500);
    }
}

public class CompanyBridgeRunConfiguration : IEntityTypeConfiguration<CompanyBridgeRun>
{
    public void Configure(EntityTypeBuilder<CompanyBridgeRun> b)
    {
        b.HasIndex(x => new { x.TenantId, x.BridgeId, x.StartedAt });
        b.HasOne(x => x.Bridge).WithMany().HasForeignKey(x => x.BridgeId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.SourceFile).HasMaxLength(400);
        b.Property(x => x.ResultJson).HasColumnType("longtext");
        b.Property(x => x.ErrorMessage).HasMaxLength(2000);
    }
}
