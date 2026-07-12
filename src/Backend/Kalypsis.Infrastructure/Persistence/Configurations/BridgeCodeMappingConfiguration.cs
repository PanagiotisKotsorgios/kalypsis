using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class BridgeCodeMappingConfiguration : IEntityTypeConfiguration<BridgeCodeMapping>
{
    public void Configure(EntityTypeBuilder<BridgeCodeMapping> b)
    {
        b.ToTable("bridge_code_mappings");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.SourceCarrier).HasMaxLength(120);
        b.Property(x => x.RawCode).HasMaxLength(200).IsRequired();
        b.Property(x => x.RawLabel).HasMaxLength(400);
        b.Property(x => x.Notes).HasMaxLength(2000);

        // Non-cascade target FKs — deleting the target entity should nullify
        // the pointer so the mapping surfaces as broken (and the operator gets
        // a nudge to re-link) rather than silently vanish.
        b.HasOne(x => x.TargetInsuranceCompany)
            .WithMany()
            .HasForeignKey(x => x.TargetInsuranceCompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(x => x.TargetParameterItem)
            .WithMany()
            .HasForeignKey(x => x.TargetParameterItemId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(x => x.TargetProducer)
            .WithMany()
            .HasForeignKey(x => x.TargetProducerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Unique per (tenant, kind, source carrier, raw code) — two mappings
        // for the same raw code inside the same feed would race on import.
        b.HasIndex(x => new { x.TenantId, x.Kind, x.SourceCarrier, x.RawCode })
            .IsUnique();
        b.HasIndex(x => new { x.TenantId, x.SourceCarrier });
    }
}
