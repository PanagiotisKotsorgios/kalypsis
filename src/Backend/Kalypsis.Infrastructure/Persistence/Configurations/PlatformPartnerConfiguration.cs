using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class PlatformPartnerConfiguration : IEntityTypeConfiguration<PlatformPartner>
{
    public void Configure(EntityTypeBuilder<PlatformPartner> b)
    {
        b.ToTable("platform_partners");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.LogoUrl).HasMaxLength(500);
        b.Property(x => x.Url).HasMaxLength(500);
        b.HasIndex(x => new { x.IsActive, x.DisplayOrder });
    }
}
