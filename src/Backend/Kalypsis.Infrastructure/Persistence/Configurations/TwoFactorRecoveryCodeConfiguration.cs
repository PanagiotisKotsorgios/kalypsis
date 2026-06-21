using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class TwoFactorRecoveryCodeConfiguration : IEntityTypeConfiguration<TwoFactorRecoveryCode>
{
    public void Configure(EntityTypeBuilder<TwoFactorRecoveryCode> b)
    {
        b.ToTable("two_factor_recovery_codes");
        b.HasKey(x => x.Id);
        b.Property(x => x.CodeHash).HasMaxLength(128).IsRequired();
        b.HasIndex(x => x.UserId);
        b.HasOne(x => x.User).WithMany(u => u.RecoveryCodes).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
