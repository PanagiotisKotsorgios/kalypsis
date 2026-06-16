using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> b)
    {
        b.ToTable("tenants");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Code).HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.Code).IsUnique();
        b.Property(x => x.SubscriptionPlan).HasConversion<int>();
        b.Property(x => x.LogoUrl).HasMaxLength(512);
        b.Property(x => x.BrandColorHex).HasMaxLength(16);
        b.Property(x => x.ContactEmail).HasMaxLength(256);
        b.Property(x => x.ContactPhone).HasMaxLength(40);
        b.Property(x => x.AddressLine).HasMaxLength(300);
        b.Property(x => x.VatNumber).HasMaxLength(40);
        b.Property(x => x.DefaultCurrency).HasMaxLength(3).HasDefaultValue("EUR");
    }
}
