using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class PlatformEmailTemplateConfiguration : IEntityTypeConfiguration<PlatformEmailTemplate>
{
    public void Configure(EntityTypeBuilder<PlatformEmailTemplate> b)
    {
        b.HasIndex(x => x.Code).IsUnique();
        b.HasIndex(x => x.TriggerEvent);
        b.Property(x => x.Code).HasMaxLength(80).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        b.Property(x => x.BodyHtml).HasColumnType("longtext").IsRequired();
        b.Property(x => x.BodyPlain).HasColumnType("longtext");
        b.Property(x => x.Language).HasMaxLength(8).IsRequired();
        b.Property(x => x.TriggerEvent).HasMaxLength(80);
        b.Property(x => x.SampleVariablesJson).HasColumnType("longtext");
    }
}
