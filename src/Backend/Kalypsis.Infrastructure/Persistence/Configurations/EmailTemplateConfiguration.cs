using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class EmailTemplateConfiguration : IEntityTypeConfiguration<EmailTemplate>
{
    public void Configure(EntityTypeBuilder<EmailTemplate> b)
    {
        b.ToTable("email_templates");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(80).IsRequired();
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        b.Property(x => x.BodyHtml).IsRequired();
        b.Property(x => x.Language).HasMaxLength(8).IsRequired();
        b.Property(x => x.PolicyTrigger).HasMaxLength(40);
        b.Property(x => x.SmsBody).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.Code, x.Language }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.PolicyTrigger });
    }
}
