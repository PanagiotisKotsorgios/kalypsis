using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> b)
    {
        b.ToTable("password_reset_tokens");
        b.HasKey(x => x.Id);
        b.Property(x => x.TokenHash).HasMaxLength(255).IsRequired();
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => x.UserId);
        b.Property(x => x.RequestIp).HasMaxLength(64);

        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PlatformSettingConfiguration : IEntityTypeConfiguration<PlatformSetting>
{
    public void Configure(EntityTypeBuilder<PlatformSetting> b)
    {
        b.ToTable("platform_settings");
        b.HasKey(x => x.Id);
        b.Property(x => x.BrevoApiKey).HasMaxLength(512);
        b.Property(x => x.BrevoSenderEmail).HasMaxLength(256);
        b.Property(x => x.BrevoSenderName).HasMaxLength(200);
        b.Property(x => x.SupportEmail).HasMaxLength(256);
        b.Property(x => x.AppBaseUrl).HasMaxLength(512);

        b.HasOne(x => x.LastUpdatedByUser).WithMany().HasForeignKey(x => x.LastUpdatedByUserId).OnDelete(DeleteBehavior.SetNull);
    }
}
