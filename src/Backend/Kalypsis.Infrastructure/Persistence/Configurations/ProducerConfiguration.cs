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
