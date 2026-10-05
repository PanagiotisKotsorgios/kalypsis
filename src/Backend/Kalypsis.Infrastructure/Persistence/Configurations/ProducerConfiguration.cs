using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class ProducerConfiguration : IEntityTypeConfiguration<Producer>
{
    public void Configure(EntityTypeBuilder<Producer> b)
    {
        b.ToTable("producers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(64).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.SecondaryEmail).HasMaxLength(256);
        b.Property(x => x.SecondaryPhone).HasMaxLength(40);
        b.Property(x => x.TaxId).HasMaxLength(32);
        b.Property(x => x.TaxOffice).HasMaxLength(160);
        b.Property(x => x.BusinessType).HasMaxLength(80);
        b.Property(x => x.ProfessionalCategory).HasMaxLength(120);
        b.Property(x => x.ContractNumber).HasMaxLength(120);
        b.Property(x => x.Address).HasMaxLength(240);
        b.Property(x => x.City).HasMaxLength(120);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Website).HasMaxLength(512);
        b.Property(x => x.IdentityNumber).HasMaxLength(80);
        b.Property(x => x.ProfessionalLicenseNumber).HasMaxLength(120);
        b.Property(x => x.Iban).HasMaxLength(64);
        b.Property(x => x.BankName).HasMaxLength(160);
        b.Property(x => x.PaymentMethod).HasMaxLength(80);
        b.Property(x => x.AdditionalInfoJson).HasColumnType("longtext");
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.GoalBaseCommissionPercent).HasPrecision(7, 2);
        b.Property(x => x.GoalFirstTargetPremium).HasPrecision(14, 2);
        b.Property(x => x.GoalPremiumStep).HasPrecision(14, 2);
        b.Property(x => x.GoalTargetMode).HasMaxLength(16).IsRequired();
        b.Property(x => x.GoalCommissionIncreasePercent).HasPrecision(7, 2);
        b.Property(x => x.GoalMaximumCommissionPercent).HasPrecision(7, 2);
        b.Property(x => x.Status).HasConversion<int>();
        // Producer entity's C# initializer already sets HierarchyLevel = Producer,
        // so no DB-generated default is needed. Removing HasDefaultValue also
        // silences EF's sentinel-value warning (CLR 0 vs enum default) on boot.
        b.Property(x => x.HierarchyLevel).HasConversion<int>();
        // Self-referencing FK for the commission hierarchy. Restrict on delete
        // so we don't accidentally cascade-nuke a whole team when a manager is
        // removed — the application layer should reassign children first.
        b.HasOne(x => x.ParentProducer).WithMany()
            .HasForeignKey(x => x.ParentProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.ParentProducerId });
    }
}
