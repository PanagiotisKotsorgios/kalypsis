using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class GreenCardConfiguration : IEntityTypeConfiguration<GreenCard>
{
    public void Configure(EntityTypeBuilder<GreenCard> b)
    {
        b.ToTable("green_cards");
        b.HasKey(x => x.Id);
        b.Property(x => x.CardNumber).HasMaxLength(64).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.HolderName).HasMaxLength(200).IsRequired();
        b.Property(x => x.InsuredName).HasMaxLength(200).IsRequired();
        b.Property(x => x.VehicleRegistrationPlate).HasMaxLength(32).IsRequired();
        b.Property(x => x.VehicleMakeModel).HasMaxLength(200);
        b.Property(x => x.VehicleVin).HasMaxLength(64);
        b.Property(x => x.Territories).HasMaxLength(2000);
        b.Property(x => x.IssuingOffice).HasMaxLength(200);
        b.Property(x => x.DeliveryMethod).HasMaxLength(64);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
        b.HasIndex(x => new { x.TenantId, x.CardNumber }).IsUnique();
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.PolicyDocument).WithMany().HasForeignKey(x => x.PolicyDocumentId).OnDelete(DeleteBehavior.SetNull);
    }
}
