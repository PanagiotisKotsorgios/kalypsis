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
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.FirstName).HasMaxLength(100);
        b.Property(x => x.LastName).HasMaxLength(100);
        b.Property(x => x.CompanyName).HasMaxLength(200);
        b.Property(x => x.VatNumber).HasMaxLength(40);
        b.Property(x => x.TaxOffice).HasMaxLength(60);
        b.Property(x => x.GemiNumber).HasMaxLength(40);
        b.Property(x => x.LegalForm).HasMaxLength(20);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.AltPhone).HasMaxLength(40);
        b.Property(x => x.MobilePhone).HasMaxLength(40);
        b.Property(x => x.Amka).HasMaxLength(32);
        b.Property(x => x.IdNumber).HasMaxLength(32);
        b.Property(x => x.PassportNumber).HasMaxLength(32);
        b.Property(x => x.Address).HasMaxLength(255);
        b.Property(x => x.City).HasMaxLength(100);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Region).HasMaxLength(100);
        b.Property(x => x.Gender).HasMaxLength(20);
        b.Property(x => x.MaritalStatus).HasMaxLength(20);
        b.Property(x => x.Occupation).HasMaxLength(120);
        b.Property(x => x.Employer).HasMaxLength(200);
        b.Property(x => x.Source).HasMaxLength(60);
        b.Property(x => x.TagsJson).HasMaxLength(2000);
        b.Property(x => x.PhotoUrl).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.AssignedAdvisor)
            .WithMany()
            .HasForeignKey(x => x.AssignedAdvisorId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(x => new { x.TenantId, x.CustomerNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.VatNumber });
        b.HasIndex(x => new { x.TenantId, x.Email });
        b.HasIndex(x => new { x.TenantId, x.LastName });
        b.HasIndex(x => new { x.TenantId, x.Status });
    }
}
