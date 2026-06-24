using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class AgencyOfficeConfiguration : IEntityTypeConfiguration<AgencyOffice>
{
    public void Configure(EntityTypeBuilder<AgencyOffice> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.IsActive });
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.City).HasMaxLength(80);
        b.Property(x => x.Address).HasMaxLength(200);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Email).HasMaxLength(160);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasMany(x => x.UserAssignments).WithOne(x => x.AgencyOffice!).HasForeignKey(x => x.AgencyOfficeId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserAgencyOfficeConfiguration : IEntityTypeConfiguration<UserAgencyOffice>
{
    public void Configure(EntityTypeBuilder<UserAgencyOffice> b)
    {
        b.HasIndex(x => new { x.TenantId, x.UserId, x.AgencyOfficeId }).IsUnique();
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        // AgencyOffice navigation set on the AgencyOffice side already.
    }
}
