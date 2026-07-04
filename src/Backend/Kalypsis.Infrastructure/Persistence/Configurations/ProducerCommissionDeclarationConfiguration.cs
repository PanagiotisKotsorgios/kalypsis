using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

// The migration + schema safety net both create `producer_commission_declarations`
// (snake_case), and the snapshot expects that name — but the entity had no config,
// so EF was defaulting the runtime model to the PascalCase DbSet name
// `ProducerCommissionDeclarations`. On MySQL running on Linux (Coolify) that mismatch
// meant every SELECT/INSERT hit «Table doesn't exist» and the wipe-and-reseed
// aborted mid-flight. This config pins the runtime model to the same snake_case
// name everywhere else in the codebase already uses.
public class ProducerCommissionDeclarationConfiguration : IEntityTypeConfiguration<ProducerCommissionDeclaration>
{
    public void Configure(EntityTypeBuilder<ProducerCommissionDeclaration> b)
    {
        b.ToTable("producer_commission_declarations");
        b.HasIndex(x => new { x.TenantId, x.ProducerId });
        b.HasIndex(x => x.PolicyId);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.ReconciliationStatus).HasMaxLength(40).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
    }
}
