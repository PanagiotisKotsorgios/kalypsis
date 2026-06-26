using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class RegistrationRequestConfiguration : IEntityTypeConfiguration<RegistrationRequest>
{
    public void Configure(EntityTypeBuilder<RegistrationRequest> b)
    {
        b.ToTable("registration_requests");
        b.HasKey(x => x.Id);
        b.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(100).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(50).IsRequired();
        b.Property(x => x.OrganizationName).HasMaxLength(200);
        b.Property(x => x.VatNumber).HasMaxLength(20);
        b.Property(x => x.LicenseNumber).HasMaxLength(60);
        b.Property(x => x.City).HasMaxLength(120);
        b.Property(x => x.Message).HasMaxLength(2000);
        b.Property(x => x.ReferenceCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.ReviewNotes).HasMaxLength(2000);
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.Property(x => x.UserAgent).HasMaxLength(500);

        b.HasIndex(x => x.ReferenceCode).IsUnique();
        b.HasIndex(x => new { x.Status, x.CreatedAt });
        b.HasIndex(x => x.Email);
    }
}
