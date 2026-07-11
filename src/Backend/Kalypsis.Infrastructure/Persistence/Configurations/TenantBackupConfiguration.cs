using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TenantBackupConfiguration : IEntityTypeConfiguration<TenantBackup>
{
    public void Configure(EntityTypeBuilder<TenantBackup> b)
    {
        b.ToTable("tenant_backups");
        b.HasKey(x => x.Id);
        b.Property(x => x.FileName).HasMaxLength(300).IsRequired();
        b.Property(x => x.StoragePath).HasMaxLength(800).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(20).IsRequired();
        b.Property(x => x.SummaryJson).HasColumnType("TEXT");
        b.Property(x => x.CreatedByName).HasMaxLength(200);
        b.HasIndex(x => new { x.TenantId, x.CreatedAt });
    }
}

public class TenantBackupPolicyConfiguration : IEntityTypeConfiguration<TenantBackupPolicy>
{
    public void Configure(EntityTypeBuilder<TenantBackupPolicy> b)
    {
        b.ToTable("tenant_backup_policies");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.TenantId).IsUnique();
    }
}

public class GdprErasureRequestConfiguration : IEntityTypeConfiguration<GdprErasureRequest>
{
    public void Configure(EntityTypeBuilder<GdprErasureRequest> b)
    {
        b.ToTable("gdpr_erasure_requests");
        b.HasKey(x => x.Id);
        b.Property(x => x.RequesterName).HasMaxLength(200).IsRequired();
        b.Property(x => x.RequesterEmail).HasMaxLength(200).IsRequired();
        b.Property(x => x.RequesterPhone).HasMaxLength(40);
        b.Property(x => x.Reason).HasColumnType("TEXT").IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Notes).HasColumnType("TEXT");
        b.Property(x => x.HandledByName).HasMaxLength(200);
        b.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
        b.HasOne(x => x.Customer).WithMany()
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}
