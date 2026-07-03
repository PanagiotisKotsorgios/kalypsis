using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class PolicyCoverAdjustmentConfiguration : IEntityTypeConfiguration<PolicyCoverAdjustment>
{
    public void Configure(EntityTypeBuilder<PolicyCoverAdjustment> b)
    {
        b.ToTable("policy_cover_adjustments");
        b.HasKey(x => x.Id);
        b.Property(x => x.OldAgencyPercent).HasColumnType("decimal(7,4)");
        b.Property(x => x.NewAgencyPercent).HasColumnType("decimal(7,4)");
        b.Property(x => x.OldProducerPercent).HasColumnType("decimal(7,4)");
        b.Property(x => x.NewProducerPercent).HasColumnType("decimal(7,4)");
        b.Property(x => x.AgencyAmountDelta).HasColumnType("decimal(14,2)");
        b.Property(x => x.ProducerAmountDelta).HasColumnType("decimal(14,2)");
        b.Property(x => x.Reason).HasMaxLength(1000);
        b.HasIndex(x => x.PolicyCoverId);
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
        b.HasOne(x => x.PolicyCover).WithMany().HasForeignKey(x => x.PolicyCoverId).OnDelete(DeleteBehavior.Cascade);
    }
}
