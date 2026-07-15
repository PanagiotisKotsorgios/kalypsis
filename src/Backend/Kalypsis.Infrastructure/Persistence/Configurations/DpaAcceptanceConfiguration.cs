using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class DpaAcceptanceConfiguration : IEntityTypeConfiguration<DpaAcceptance>
{
    public void Configure(EntityTypeBuilder<DpaAcceptance> b)
    {
        b.ToTable("dpa_acceptances");
        b.HasKey(x => x.Id);

        b.Property(x => x.Version).HasMaxLength(20).IsRequired();
        b.Property(x => x.AcceptedByName).HasMaxLength(200).IsRequired();
        b.Property(x => x.AcceptedByEmail).HasMaxLength(200).IsRequired();
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.Property(x => x.UserAgent).HasMaxLength(500);

        b.HasOne(x => x.AcceptedByUser)
            .WithMany()
            .HasForeignKey(x => x.AcceptedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Ένα γραφείο μπορεί να έχει αποδεχθεί το ίδιο version μόνο μία φορά.
        b.HasIndex(x => new { x.TenantId, x.Version }).IsUnique();
    }
}
