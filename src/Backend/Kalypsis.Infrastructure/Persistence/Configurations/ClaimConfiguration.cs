using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class ClaimConfiguration : IEntityTypeConfiguration<Claim>
{
    public void Configure(EntityTypeBuilder<Claim> b)
    {
        b.ToTable("claims");
        b.HasKey(x => x.Id);
        b.Property(x => x.ClaimNumber).HasMaxLength(64).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.ClaimedAmount).HasPrecision(14, 2);
        b.Property(x => x.ApprovedAmount).HasPrecision(14, 2);
        b.Property(x => x.Description).HasMaxLength(2000);

        b.HasOne(x => x.Policy).WithMany(p => p.Claims).HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.ClaimNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
    }
}
