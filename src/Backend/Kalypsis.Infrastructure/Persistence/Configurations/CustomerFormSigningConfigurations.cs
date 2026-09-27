using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class TenantGdprSigningSettingsConfiguration : IEntityTypeConfiguration<TenantGdprSigningSettings>
{
    public void Configure(EntityTypeBuilder<TenantGdprSigningSettings> b)
    {
        b.ToTable("tenant_gdpr_signing_settings");
        b.HasIndex(x => x.TenantId).IsUnique();
        b.Property(x => x.TemplateCode).HasMaxLength(80).IsRequired();
        b.Property(x => x.LinkExpirationDays).HasDefaultValue(30);
    }
}

public sealed class CustomerFormSigningConfiguration : IEntityTypeConfiguration<CustomerFormSigning>
{
    public void Configure(EntityTypeBuilder<CustomerFormSigning> b)
    {
        b.ToTable("customer_form_signings");
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.CreatedAt });
        b.HasIndex(x => new { x.TenantId, x.FormCode, x.Status });
        b.Property(x => x.FormCode).HasMaxLength(80).IsRequired();
        b.Property(x => x.FormVersion).HasMaxLength(40).IsRequired();
        b.Property(x => x.CustomerFullNameSnapshot).HasMaxLength(240).IsRequired();
        b.Property(x => x.RequireOfficeSignature).IsRequired();
        b.Property(x => x.RequireInsurerSignature).IsRequired();
        b.Property(x => x.SendInsurerEmail).IsRequired();
        b.Property(x => x.CustomerEmailSnapshot).HasMaxLength(254);
        b.Property(x => x.OfficeEmailSnapshot).HasMaxLength(254);
        b.Property(x => x.InsurerEmailSnapshot).HasMaxLength(254);
        b.Property(x => x.CustomerSignaturePath).HasMaxLength(500);
        b.Property(x => x.OfficeSignaturePath).HasMaxLength(500);
        b.Property(x => x.InsurerSignaturePath).HasMaxLength(500);
        b.Property(x => x.DraftDocumentPath).HasMaxLength(500);
        b.Property(x => x.FinalDocumentPath).HasMaxLength(500);
        b.Property(x => x.FileName).HasMaxLength(240).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class CustomerFormSigningLinkConfiguration : IEntityTypeConfiguration<CustomerFormSigningLink>
{
    public void Configure(EntityTypeBuilder<CustomerFormSigningLink> b)
    {
        b.ToTable("customer_form_signing_links");
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.SigningId, x.RecipientRole });
        b.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.Email).HasMaxLength(254).IsRequired();
        b.Property(x => x.DisplayName).HasMaxLength(240).IsRequired();
        b.Property(x => x.IpAddress).HasMaxLength(80);
        b.Property(x => x.UserAgent).HasMaxLength(500);
        b.HasOne(x => x.Signing).WithMany(x => x.Links).HasForeignKey(x => x.SigningId).OnDelete(DeleteBehavior.Cascade);
    }
}
