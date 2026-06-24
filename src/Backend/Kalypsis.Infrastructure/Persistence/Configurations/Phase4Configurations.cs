using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class RiskProfileConfiguration : IEntityTypeConfiguration<RiskProfile>
{
    public void Configure(EntityTypeBuilder<RiskProfile> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ProductType, x.Key });
        b.HasIndex(x => x.CustomerId);
        b.Property(x => x.ProductType).HasMaxLength(40).IsRequired();
        b.Property(x => x.Key).HasMaxLength(80).IsRequired();
        b.Property(x => x.Label).HasMaxLength(160).IsRequired();
        b.Property(x => x.InputsJson).HasColumnType("longtext").IsRequired();
    }
}

public class CoverageOptionConfiguration : IEntityTypeConfiguration<CoverageOption>
{
    public void Configure(EntityTypeBuilder<CoverageOption> b)
    {
        b.HasIndex(x => new { x.TenantId, x.CarrierConnectionId, x.Code }).IsUnique();
        b.HasOne(x => x.CarrierConnection).WithMany().HasForeignKey(x => x.CarrierConnectionId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.ProductType).HasMaxLength(40);
        b.Property(x => x.AddonPremium).HasPrecision(12, 2);
    }
}

public class PendingItemConfiguration : IEntityTypeConfiguration<PendingItem>
{
    public void Configure(EntityTypeBuilder<PendingItem> b)
    {
        b.HasIndex(x => new { x.TenantId, x.PolicyApplicationId, x.ResolvedAt });
        b.HasOne(x => x.PolicyApplication).WithMany().HasForeignKey(x => x.PolicyApplicationId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.Description).HasMaxLength(1000).IsRequired();
        b.Property(x => x.Category).HasMaxLength(40);
    }
}

public class PaymentNoticeConfiguration : IEntityTypeConfiguration<PaymentNotice>
{
    public void Configure(EntityTypeBuilder<PaymentNotice> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Kind, x.Status });
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
        b.HasIndex(x => new { x.TenantId, x.PolicyApplicationId });
        b.HasIndex(x => new { x.TenantId, x.ProducerId });
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.PaymentReference).HasMaxLength(120);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasMany(x => x.Lines).WithOne(x => x.PaymentNotice!).HasForeignKey(x => x.PaymentNoticeId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PaymentNoticeLineConfiguration : IEntityTypeConfiguration<PaymentNoticeLine>
{
    public void Configure(EntityTypeBuilder<PaymentNoticeLine> b)
    {
        b.HasIndex(x => new { x.TenantId, x.PaymentNoticeId });
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.Description).HasMaxLength(500);
    }
}

public class ProducerPlafondConfiguration : IEntityTypeConfiguration<ProducerPlafond>
{
    public void Configure(EntityTypeBuilder<ProducerPlafond> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ProducerId }).IsUnique();
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.CreditLimit).HasPrecision(14, 2);
        b.Property(x => x.CurrentBalance).HasPrecision(14, 2);
        b.Property(x => x.LockReason).HasMaxLength(500);
    }
}

public class KoumparasLineConfiguration : IEntityTypeConfiguration<KoumparasLine>
{
    public void Configure(EntityTypeBuilder<KoumparasLine> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ProducerId, x.OccurredAt });
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.Amount).HasPrecision(14, 2);
        b.Property(x => x.Reference).HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(1000);
    }
}

public class CarrierOrderConfiguration : IEntityTypeConfiguration<CarrierOrder>
{
    public void Configure(EntityTypeBuilder<CarrierOrder> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ProducerId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.CarrierCode });
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Restrict);
        b.Property(x => x.CarrierCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.OperationType).HasMaxLength(40).IsRequired();
        b.Property(x => x.InstructionsText).HasColumnType("text").IsRequired();
        b.Property(x => x.ResultFileKey).HasMaxLength(400);
        b.Property(x => x.ResultNotes).HasMaxLength(2000);
        b.Property(x => x.ChargedAmount).HasPrecision(12, 2);
    }
}

public class OnlinePaymentSessionConfiguration : IEntityTypeConfiguration<OnlinePaymentSession>
{
    public void Configure(EntityTypeBuilder<OnlinePaymentSession> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Gateway, x.Status });
        b.HasIndex(x => new { x.TenantId, x.ExternalSessionId });
        b.Property(x => x.ExternalSessionId).HasMaxLength(160);
        b.Property(x => x.CheckoutUrl).HasMaxLength(800);
        b.Property(x => x.RawCreatePayload).HasColumnType("text");
        b.Property(x => x.RawCallbackPayload).HasColumnType("text");
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.FailureReason).HasMaxLength(500);
    }
}

public class BackofficeBridgeConnectionConfiguration : IEntityTypeConfiguration<BackofficeBridgeConnection>
{
    public void Configure(EntityTypeBuilder<BackofficeBridgeConnection> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Bridge }).IsUnique();
        b.Property(x => x.BaseUrl).HasMaxLength(400);
        b.Property(x => x.AccountCode).HasMaxLength(80);
        b.Property(x => x.UsernameOrClientId).HasMaxLength(160);
        b.Property(x => x.SecretEncrypted).HasMaxLength(800);
        b.Property(x => x.LastSyncResult).HasMaxLength(1000);
    }
}

public class SmsLogConfiguration : IEntityTypeConfiguration<SmsLog>
{
    public void Configure(EntityTypeBuilder<SmsLog> b)
    {
        b.HasIndex(x => new { x.TenantId, x.QueuedAt });
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
        b.Property(x => x.ToNumber).HasMaxLength(30).IsRequired();
        b.Property(x => x.Body).HasMaxLength(1600).IsRequired();
        b.Property(x => x.ProviderMessageId).HasMaxLength(120);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.FailureReason).HasMaxLength(500);
    }
}

public class ViberLogConfiguration : IEntityTypeConfiguration<ViberLog>
{
    public void Configure(EntityTypeBuilder<ViberLog> b)
    {
        b.HasIndex(x => new { x.TenantId, x.QueuedAt });
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
        b.Property(x => x.ToNumber).HasMaxLength(30).IsRequired();
        b.Property(x => x.Body).HasMaxLength(4000).IsRequired();
        b.Property(x => x.ProviderMessageId).HasMaxLength(120);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.FailureReason).HasMaxLength(500);
    }
}
