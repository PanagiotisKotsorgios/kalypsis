using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CommunicationLogConfiguration : IEntityTypeConfiguration<CommunicationLog>
{
    public void Configure(EntityTypeBuilder<CommunicationLog> b)
    {
        b.ToTable("communication_logs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.Direction).HasConversion<int>();
        b.Property(x => x.Outcome).HasConversion<int>();
        b.Property(x => x.Subject).HasMaxLength(200).IsRequired();
        b.Property(x => x.Body).HasMaxLength(4000);
        b.Property(x => x.RelatedPolicyNumber).HasMaxLength(64);
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.OccurredAt });
        b.HasOne(x => x.Customer).WithMany(c => c.Communications)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.RelatedPolicy).WithMany()
            .HasForeignKey(x => x.RelatedPolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}
