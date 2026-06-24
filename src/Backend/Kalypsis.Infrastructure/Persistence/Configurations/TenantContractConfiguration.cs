using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TenantContractConfiguration : IEntityTypeConfiguration<TenantContract>
{
    public void Configure(EntityTypeBuilder<TenantContract> b)
    {
        b.HasIndex(x => new { x.TenantId, x.IsActive });
        b.HasIndex(x => x.ContractNumber);
        b.Property(x => x.ContractNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Plan).HasMaxLength(40).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.MonthlyBaseAmount).HasPrecision(12, 2);
        b.Property(x => x.OfficeSurchargePerExtra).HasPrecision(12, 2);
        b.Property(x => x.SignedByName).HasMaxLength(160);
        b.Property(x => x.SignedByEmail).HasMaxLength(160);
        b.Property(x => x.SignedByRole).HasMaxLength(80);
        b.Property(x => x.ContractFileKey).HasMaxLength(400);
        b.Property(x => x.ContractFileName).HasMaxLength(200);
        b.Property(x => x.TerminationReason).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.RenewedFromContract).WithMany().HasForeignKey(x => x.RenewedFromContractId).OnDelete(DeleteBehavior.SetNull);
    }
}
