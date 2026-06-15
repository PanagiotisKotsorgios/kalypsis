using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.ToTable("customers");
        b.HasKey(x => x.Id);
        b.Property(x => x.CustomerNumber).HasMaxLength(64).IsRequired();
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.FirstName).HasMaxLength(100);
        b.Property(x => x.LastName).HasMaxLength(100);
        b.Property(x => x.CompanyName).HasMaxLength(200);
        b.Property(x => x.VatNumber).HasMaxLength(40);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Address).HasMaxLength(255);
        b.Property(x => x.City).HasMaxLength(100);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasIndex(x => new { x.TenantId, x.CustomerNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.VatNumber });
        b.HasIndex(x => new { x.TenantId, x.Email });
        b.HasIndex(x => new { x.TenantId, x.LastName });
    }
}
