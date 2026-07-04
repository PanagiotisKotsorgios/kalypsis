using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class ProducerExpectedRateConfiguration : IEntityTypeConfiguration<ProducerExpectedRate>
{
    public void Configure(EntityTypeBuilder<ProducerExpectedRate> b)
    {
        b.ToTable("producer_expected_rates");
        b.HasIndex(x => new { x.TenantId, x.ProducerId });
        b.Property(x => x.ExpectedPercent).HasColumnType("decimal(7,2)");
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
    }
}
