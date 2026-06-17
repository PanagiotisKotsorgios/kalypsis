using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CommissionRunConfiguration : IEntityTypeConfiguration<CommissionRun>
{
    public void Configure(EntityTypeBuilder<CommissionRun> b)
    {
        b.ToTable("commission_runs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.FilterPolicyType).HasConversion<int?>();
        b.Property(x => x.FilterPackageCode).HasMaxLength(80);
        b.Property(x => x.TotalCommission).HasPrecision(14, 2);
        b.Property(x => x.TotalPremium).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.GeneratedByUser).WithMany().HasForeignKey(x => x.GeneratedByUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.FilterInsuranceCompany).WithMany().HasForeignKey(x => x.FilterInsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.FilterProducer).WithMany().HasForeignKey(x => x.FilterProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.Year, x.Month });
    }
}

public class CommissionRunLineConfiguration : IEntityTypeConfiguration<CommissionRunLine>
{
    public void Configure(EntityTypeBuilder<CommissionRunLine> b)
    {
        b.ToTable("commission_run_lines");
        b.HasKey(x => x.Id);
        b.Property(x => x.PolicyType).HasConversion<int>();
        b.Property(x => x.PackageCode).HasMaxLength(80);
        b.Property(x => x.Premium).HasPrecision(14, 2);
        b.Property(x => x.RatePercent).HasPrecision(8, 4);
        b.Property(x => x.CommissionAmount).HasPrecision(14, 2);
        b.Property(x => x.OriginalCommissionAmount).HasPrecision(14, 2);
        b.Property(x => x.OverrideReason).HasMaxLength(500);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.HasOne(x => x.CommissionRun).WithMany(x => x.Lines).HasForeignKey(x => x.CommissionRunId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.OnBehalfOfProducer).WithMany().HasForeignKey(x => x.OnBehalfOfProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.CommissionRunId, x.ProducerId });
    }
}

public class CompanyBridgeConfiguration : IEntityTypeConfiguration<CompanyBridge>
{
    public void Configure(EntityTypeBuilder<CompanyBridge> b)
    {
        b.ToTable("company_bridges");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.ConfigJson).HasColumnType("longtext");
        b.Property(x => x.LastSyncStatus).HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId });
    }
}
