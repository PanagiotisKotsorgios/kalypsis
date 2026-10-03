using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class InsuranceCompanyCommunicationConfiguration : IEntityTypeConfiguration<InsuranceCompanyCommunication>
{
    public void Configure(EntityTypeBuilder<InsuranceCompanyCommunication> b)
    {
        b.ToTable("insurance_company_communications");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(40).IsRequired();
        b.Property(x => x.Direction).HasMaxLength(40).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(240);
        b.Property(x => x.Body).HasMaxLength(10000);
        b.Property(x => x.ContactName).HasMaxLength(160);
        b.Property(x => x.ContactEmail).HasMaxLength(254);
        b.Property(x => x.ContactPhone).HasMaxLength(80);
        b.HasIndex(x => new { x.InsuranceCompanyId, x.OccurredAt });
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}
