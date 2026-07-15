using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class DataBreachIncidentConfiguration : IEntityTypeConfiguration<DataBreachIncident>
{
    public void Configure(EntityTypeBuilder<DataBreachIncident> b)
    {
        b.ToTable("data_breach_incidents");
        b.HasKey(x => x.Id);

        b.Property(x => x.IncidentCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.Severity).HasConversion<int>();
        b.Property(x => x.ContainmentStatus).HasConversion<int>();
        b.Property(x => x.TenantsScope).HasConversion<int>();
        b.Property(x => x.Nature).HasMaxLength(2000).IsRequired();
        b.Property(x => x.AffectedDataCategories).HasMaxLength(500);
        b.Property(x => x.Mitigations).HasMaxLength(2000);
        b.Property(x => x.AuthorityReference).HasMaxLength(100);
        b.Property(x => x.ClosureNotes).HasMaxLength(2000);
        b.Property(x => x.AffectedTenantIdsJson).HasColumnType("longtext");

        b.HasIndex(x => x.IncidentCode).IsUnique();
        b.HasIndex(x => x.DiscoveredAt);

        b.HasOne(x => x.ReportedByUser)
            .WithMany()
            .HasForeignKey(x => x.ReportedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
