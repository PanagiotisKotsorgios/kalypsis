using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CarrierParametricFileConfiguration : IEntityTypeConfiguration<CarrierParametricFile>
{
    public void Configure(EntityTypeBuilder<CarrierParametricFile> b)
    {
        b.HasIndex(x => new { x.TenantId, x.InsuranceCompanyCode, x.Kind, x.IsActive });
        b.HasIndex(x => new { x.InsuranceCompanyCode, x.Version, x.Kind });
        b.HasOne(x => x.BroadcastFile).WithMany().HasForeignKey(x => x.BroadcastFileId).OnDelete(DeleteBehavior.SetNull);
        b.Property(x => x.InsuranceCompanyCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.InsuranceCompanyName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(40).IsRequired();
        b.Property(x => x.Version).HasMaxLength(40).IsRequired();
        b.Property(x => x.FileKey).HasMaxLength(400);
        b.Property(x => x.OriginalFileName).HasMaxLength(200);
        b.Property(x => x.FileContentType).HasMaxLength(120);
        b.Property(x => x.ChangelogNotes).HasMaxLength(2000);
    }
}
