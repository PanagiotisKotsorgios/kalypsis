using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class InsuranceCompanyPartnerConfiguration : IEntityTypeConfiguration<InsuranceCompanyPartner>
{
    public void Configure(EntityTypeBuilder<InsuranceCompanyPartner> b)
    {
        b.ToTable("insurance_company_partners");
        b.HasKey(x => x.Id);
        b.Property(x => x.RelationshipType).HasMaxLength(120).IsRequired();
        b.Property(x => x.CooperationCode).HasMaxLength(120);
        b.Property(x => x.ContactName).HasMaxLength(160);
        b.Property(x => x.ContactEmail).HasMaxLength(254);
        b.Property(x => x.ContactPhone).HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId, x.PartnerInsuranceCompanyId })
            .IsUnique();
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyId, x.IsActive });
        b.HasOne(x => x.InsuranceCompany)
            .WithMany()
            .HasForeignKey(x => x.InsuranceCompanyId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.PartnerInsuranceCompany)
            .WithMany()
            .HasForeignKey(x => x.PartnerInsuranceCompanyId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
