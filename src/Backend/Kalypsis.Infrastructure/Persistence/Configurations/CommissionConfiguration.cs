using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CommissionRuleConfiguration : IEntityTypeConfiguration<CommissionRule>
{
    public void Configure(EntityTypeBuilder<CommissionRule> b)
    {
        b.ToTable("commission_rules");
        b.HasKey(x => x.Id);
        b.Property(x => x.CommissionType).HasConversion<int>();
        b.Property(x => x.PolicyType).HasConversion<int?>();
        b.Property(x => x.CoverCode).HasMaxLength(80);
        b.Property(x => x.Value).HasPrecision(10, 4);

        b.HasOne(x => x.Producer).WithMany(p => p.CommissionRules).HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.ProducerId });
    }
}

public class PolicyCommissionSplitConfiguration : IEntityTypeConfiguration<PolicyCommissionSplit>
{
    public void Configure(EntityTypeBuilder<PolicyCommissionSplit> b)
    {
        b.ToTable("policy_commission_splits");
        b.HasKey(x => x.Id);
        b.Property(x => x.HierarchyLevel).HasConversion<int>();
        b.Property(x => x.Percent).HasPrecision(8, 4);
        b.Property(x => x.GrossAmount).HasPrecision(14, 2);
        b.Property(x => x.TaxWithholdingAmount).HasPrecision(14, 2);
        b.Property(x => x.NetAmount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");

        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
        b.HasIndex(x => new { x.TenantId, x.ProducerId });
    }
}

public class CommissionTransactionConfiguration : IEntityTypeConfiguration<CommissionTransaction>
{
    public void Configure(EntityTypeBuilder<CommissionTransaction> b)
    {
        b.ToTable("commission_transactions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Amount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.Status).HasConversion<int>();

        b.HasOne(x => x.Policy).WithMany(p => p.CommissionTransactions).HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
    }
}
