using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TenantChargeableConfiguration : IEntityTypeConfiguration<TenantChargeable>
{
    public void Configure(EntityTypeBuilder<TenantChargeable> b)
    {
        b.ToTable("tenant_chargeables");
        b.HasIndex(x => x.TenantId);
        b.HasIndex(x => x.InvoiceLineId);
        b.Property(x => x.ServiceCode).HasMaxLength(60).IsRequired();
        b.Property(x => x.Description).HasMaxLength(400).IsRequired();
        b.Property(x => x.UnitLabel).HasMaxLength(40).IsRequired();
        b.Property(x => x.UnitPrice).HasColumnType("decimal(12,2)");
        b.Property(x => x.Quantity).HasColumnType("decimal(12,2)");
        b.Property(x => x.LineTotal).HasColumnType("decimal(14,2)");
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.InvoiceLine).WithMany().HasForeignKey(x => x.InvoiceLineId).OnDelete(DeleteBehavior.SetNull);
    }
}
