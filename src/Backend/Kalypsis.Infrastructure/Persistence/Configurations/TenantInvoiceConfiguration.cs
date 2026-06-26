using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TenantInvoiceConfiguration : IEntityTypeConfiguration<TenantInvoice>
{
    public void Configure(EntityTypeBuilder<TenantInvoice> b)
    {
        b.ToTable("tenant_invoices");
        b.HasKey(x => x.Id);
        b.Property(x => x.InvoiceNumber).HasMaxLength(40).IsRequired();
        b.HasIndex(x => x.InvoiceNumber).IsUnique();
        // One invoice per (tenant, period) — prevents accidental double-generation.
        b.HasIndex(x => new { x.TenantId, x.PeriodYear, x.PeriodMonth })
            .IsUnique().HasFilter("`DeletedAt` IS NULL");

        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Subtotal).HasColumnType("decimal(12,2)");
        b.Property(x => x.VatRate).HasColumnType("decimal(5,4)");
        b.Property(x => x.VatAmount).HasColumnType("decimal(12,2)");
        b.Property(x => x.Total).HasColumnType("decimal(12,2)");
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.PdfStorageKey).HasMaxLength(500);

        b.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Lines).WithOne(x => x.Invoice!)
            .HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class TenantInvoiceLineConfiguration : IEntityTypeConfiguration<TenantInvoiceLine>
{
    public void Configure(EntityTypeBuilder<TenantInvoiceLine> b)
    {
        b.ToTable("tenant_invoice_lines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Package).HasConversion<int>();
        b.Property(x => x.Description).HasMaxLength(200).IsRequired();
        b.Property(x => x.MonthlyPrice).HasColumnType("decimal(12,2)");
        b.Property(x => x.LineTotal).HasColumnType("decimal(12,2)");
        b.HasIndex(x => x.InvoiceId);
    }
}
