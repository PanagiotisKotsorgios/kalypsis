using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class OfficeWebsiteConfiguration : IEntityTypeConfiguration<OfficeWebsite>
{
    public void Configure(EntityTypeBuilder<OfficeWebsite> b)
    {
        b.ToTable("office_websites");
        b.HasKey(x => x.Id);
        b.Property(x => x.Slug).HasMaxLength(120).IsRequired();
        b.Property(x => x.CustomDomain).HasMaxLength(255);
        b.Property(x => x.SiteName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Tagline).HasMaxLength(500).IsRequired();
        b.Property(x => x.HeroTitle).HasMaxLength(300).IsRequired();
        b.Property(x => x.HeroBody).HasMaxLength(4000).IsRequired();
        b.Property(x => x.LogoUrl).HasMaxLength(500);
        b.Property(x => x.BrandColorHex).HasMaxLength(16).IsRequired();
        b.Property(x => x.PostsJson).HasColumnType("longtext").IsRequired();
        b.Property(x => x.OffersJson).HasColumnType("longtext").IsRequired();
        b.Property(x => x.BannersJson).HasColumnType("longtext").IsRequired();
        b.Property(x => x.FormConfigJson).HasColumnType("longtext").IsRequired();
        b.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
        b.HasIndex(x => x.CustomDomain).IsUnique();
    }
}

public sealed class OfficeWebsiteRequestConfiguration : IEntityTypeConfiguration<OfficeWebsiteRequest>
{
    public void Configure(EntityTypeBuilder<OfficeWebsiteRequest> b)
    {
        b.ToTable("office_website_requests");
        b.HasKey(x => x.Id);
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Email).HasMaxLength(254).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(50);
        b.Property(x => x.Product).HasMaxLength(120);
        b.Property(x => x.Message).HasMaxLength(5000).IsRequired();
        b.Property(x => x.PreferredContact).HasMaxLength(30);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.Source).HasMaxLength(100);
        b.Property(x => x.InternalNotes).HasMaxLength(4000);
        b.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
        b.HasOne(x => x.OfficeWebsite).WithMany(x => x.Requests)
            .HasForeignKey(x => x.OfficeWebsiteId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OfficeWebsiteEventConfiguration : IEntityTypeConfiguration<OfficeWebsiteEvent>
{
    public void Configure(EntityTypeBuilder<OfficeWebsiteEvent> b)
    {
        b.ToTable("office_website_events");
        b.HasKey(x => x.Id);
        b.Property(x => x.EventType).HasMaxLength(30).IsRequired();
        b.Property(x => x.Path).HasMaxLength(500);
        b.Property(x => x.Referrer).HasMaxLength(500);
        b.Property(x => x.Source).HasMaxLength(120);
        b.Property(x => x.Campaign).HasMaxLength(160);
        b.Property(x => x.Device).HasMaxLength(30);
        b.Property(x => x.SessionKeyHash).HasMaxLength(64);
        b.HasIndex(x => new { x.TenantId, x.OfficeWebsiteId, x.CreatedAt });
        b.HasIndex(x => new { x.TenantId, x.EventType, x.CreatedAt });
        b.HasOne(x => x.OfficeWebsite).WithMany().HasForeignKey(x => x.OfficeWebsiteId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
