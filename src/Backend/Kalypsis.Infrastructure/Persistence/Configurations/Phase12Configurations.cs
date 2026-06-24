using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

// Phase 12 — BluByte parity entities.

public class FriendlySettlementConfiguration : IEntityTypeConfiguration<FriendlySettlement>
{
    public void Configure(EntityTypeBuilder<FriendlySettlement> b)
    {
        b.HasIndex(x => new { x.TenantId, x.SettlementFileNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.ClaimId });
        b.HasOne(x => x.Claim).WithMany().HasForeignKey(x => x.ClaimId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Victims).WithOne(v => v.FriendlySettlement!).HasForeignKey(v => v.FriendlySettlementId).OnDelete(DeleteBehavior.SetNull);
        b.Property(x => x.SettlementFileNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.SettlementAuthority).HasMaxLength(120);
        b.Property(x => x.AgreedAmount).HasPrecision(12, 2);
        b.Property(x => x.VatAmount).HasPrecision(12, 2);
        b.Property(x => x.FeeAmount).HasPrecision(12, 2);
        b.Property(x => x.InterestAmount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.OtherPartyInsurer).HasMaxLength(200);
        b.Property(x => x.OtherPartyPolicy).HasMaxLength(80);
        b.Property(x => x.AppraisorName).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class ClaimVictimConfiguration : IEntityTypeConfiguration<ClaimVictim>
{
    public void Configure(EntityTypeBuilder<ClaimVictim> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ClaimId });
        b.HasOne(x => x.Claim).WithMany().HasForeignKey(x => x.ClaimId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Payments).WithOne(p => p.Victim!).HasForeignKey(p => p.ClaimVictimId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Afm).HasMaxLength(20);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Address).HasMaxLength(300);
        b.Property(x => x.VictimType).HasMaxLength(20);
        b.Property(x => x.VehiclePlate).HasMaxLength(20);
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.ReserveAmount).HasPrecision(12, 2);
        b.Property(x => x.PaidAmount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.Status).HasMaxLength(20);
    }
}

public class SettlementPaymentConfiguration : IEntityTypeConfiguration<SettlementPayment>
{
    public void Configure(EntityTypeBuilder<SettlementPayment> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ClaimVictimId });
        b.HasOne(x => x.Victim).WithMany(v => v.Payments).HasForeignKey(x => x.ClaimVictimId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.PayeeType).HasMaxLength(20);
        b.Property(x => x.PayeeName).HasMaxLength(200);
        b.Property(x => x.NetAmount).HasPrecision(12, 2);
        b.Property(x => x.VatAmount).HasPrecision(12, 2);
        b.Property(x => x.FeeAmount).HasPrecision(12, 2);
        b.Property(x => x.InterestAmount).HasPrecision(12, 2);
        b.Property(x => x.TotalAmount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.PaymentMethod).HasMaxLength(40);
        b.Property(x => x.Reference).HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class CallerIdLogConfiguration : IEntityTypeConfiguration<CallerIdLog>
{
    public void Configure(EntityTypeBuilder<CallerIdLog> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ReceivedAt });
        b.HasIndex(x => new { x.TenantId, x.CallerNumber });
        b.HasOne(x => x.MatchedCustomer).WithMany().HasForeignKey(x => x.MatchedCustomerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.HandledByUser).WithMany().HasForeignKey(x => x.HandledByUserId).OnDelete(DeleteBehavior.SetNull);
        b.Property(x => x.CallerNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.MatchedCustomerName).HasMaxLength(200);
        b.Property(x => x.Direction).HasMaxLength(10);
        b.Property(x => x.Notes).HasMaxLength(1000);
    }
}

public class UsaeSubmissionConfiguration : IEntityTypeConfiguration<UsaeSubmission>
{
    public void Configure(EntityTypeBuilder<UsaeSubmission> b)
    {
        b.HasIndex(x => new { x.TenantId, x.SubmissionNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.ClaimId });
        b.HasOne(x => x.Claim).WithMany().HasForeignKey(x => x.ClaimId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.SubmissionNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.AcknowledgementCode).HasMaxLength(80);
        b.Property(x => x.ErrorMessage).HasMaxLength(2000);
        b.Property(x => x.PayloadJson).HasColumnType("longtext");
    }
}

public class VehicleModelConfiguration : IEntityTypeConfiguration<VehicleModel>
{
    public void Configure(EntityTypeBuilder<VehicleModel> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Manufacturer, x.Model });
        b.Property(x => x.Manufacturer).HasMaxLength(80).IsRequired();
        b.Property(x => x.Model).HasMaxLength(80).IsRequired();
        b.Property(x => x.Trim).HasMaxLength(80);
        b.Property(x => x.FuelType).HasMaxLength(40);
        b.Property(x => x.Category).HasMaxLength(40);
    }
}
