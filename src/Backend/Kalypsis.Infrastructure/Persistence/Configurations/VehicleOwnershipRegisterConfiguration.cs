using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Kalypsis.Infrastructure.Persistence.Configurations;
public sealed class VehicleOwnershipRegisterConfiguration : IEntityTypeConfiguration<VehicleOwnershipRegister>
{
    public void Configure(EntityTypeBuilder<VehicleOwnershipRegister> b)
    {
        b.ToTable("vehicle_ownership_registers");
        b.HasKey(x => x.Id);
        b.Property(x => x.VehicleKey).HasMaxLength(160).IsRequired();
        b.Property(x => x.Plate).HasMaxLength(40).IsRequired();
        b.Property(x => x.Vin).HasMaxLength(80).IsRequired();
        b.Property(x => x.LedgerJson).HasColumnType("longtext").IsRequired();
        b.Property(x => x.Revision).IsConcurrencyToken();
        b.HasIndex(x => new { x.TenantId, x.VehicleKey }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Plate });
        b.HasOne<Customer>().WithMany().HasForeignKey(x => x.PrimaryCustomerId).OnDelete(DeleteBehavior.Restrict);
    }
}
