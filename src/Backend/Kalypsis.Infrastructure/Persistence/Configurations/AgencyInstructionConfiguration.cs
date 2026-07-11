using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class AgencyInstructionConfiguration : IEntityTypeConfiguration<AgencyInstruction>
{
    public void Configure(EntityTypeBuilder<AgencyInstruction> b)
    {
        b.ToTable("agency_instructions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.ContentHtml).HasColumnType("MEDIUMTEXT").IsRequired();
        b.Property(x => x.UpdatedByName).HasMaxLength(200);
        b.HasIndex(x => x.TenantId).IsUnique();
    }
}
