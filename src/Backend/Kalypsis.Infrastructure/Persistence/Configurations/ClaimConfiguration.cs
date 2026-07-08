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

public class ClaimInvolvedPartyConfiguration : IEntityTypeConfiguration<ClaimInvolvedParty>
{
    public void Configure(EntityTypeBuilder<ClaimInvolvedParty> b)
    {
        b.ToTable("claim_involved_parties");
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).HasMaxLength(40).IsRequired();
        b.Property(x => x.FullName).HasMaxLength(160).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Email).HasMaxLength(160);
        b.Property(x => x.VatNumber).HasMaxLength(20);
        b.Property(x => x.VehiclePlate).HasMaxLength(20);
        b.Property(x => x.InsuranceCompany).HasMaxLength(160);
        b.Property(x => x.PolicyNumber).HasMaxLength(64);
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.Claim).WithMany().HasForeignKey(x => x.ClaimId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.ClaimId });
    }
}
