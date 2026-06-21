using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class ConsentRecordConfiguration : IEntityTypeConfiguration<ConsentRecord>
{
    public void Configure(EntityTypeBuilder<ConsentRecord> b)
    {
        b.ToTable("consent_records");
        b.HasKey(x => x.Id);
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.Method).HasConversion<int>();
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.Property(x => x.Version).HasMaxLength(32);
        b.Property(x => x.Notes).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.Type });
        b.HasOne(x => x.Customer).WithMany(c => c.Consents)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
    }
}
