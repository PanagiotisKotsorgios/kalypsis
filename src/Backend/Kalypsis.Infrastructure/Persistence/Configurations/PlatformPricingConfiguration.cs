using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

// Pins the runtime table name to the snake_case one the safety-net + any
// future migration will use — without this, EF falls back to the DbSet's
// PascalCase name («PlatformPricings») and every SELECT/INSERT 500s on
// Linux MySQL (case-sensitive collation).
public class PlatformPricingConfiguration : IEntityTypeConfiguration<PlatformPricing>
{
    public void Configure(EntityTypeBuilder<PlatformPricing> b)
    {
        b.ToTable("platform_pricings");
        b.Property(x => x.CatalogJson).HasColumnType("longtext").IsRequired();
        b.Property(x => x.Version).IsRequired();
        b.HasOne(x => x.LastUpdatedByUser)
            .WithMany()
            .HasForeignKey(x => x.LastUpdatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
