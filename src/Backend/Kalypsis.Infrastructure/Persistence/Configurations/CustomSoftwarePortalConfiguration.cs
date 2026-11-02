using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class CustomSoftwarePortalAccountConfiguration : IEntityTypeConfiguration<CustomSoftwarePortalAccount>
{
    public void Configure(EntityTypeBuilder<CustomSoftwarePortalAccount> b)
    {
        b.ToTable("custom_software_portal_accounts");
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).HasMaxLength(320).IsRequired();
        b.Property(x => x.PasswordHash).HasMaxLength(100).IsRequired();
        b.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(100).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.PreferencesJson).HasColumnType("json").IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
    }
}

public sealed class CustomSoftwareProjectConfiguration : IEntityTypeConfiguration<CustomSoftwareProject>
{
    public void Configure(EntityTypeBuilder<CustomSoftwareProject> b)
    {
        b.ToTable("custom_software_projects");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Summary).HasMaxLength(1000);
        b.Property(x => x.Description).HasColumnType("longtext");
        b.Property(x => x.Status).HasMaxLength(40).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.TotalCost).HasPrecision(18, 2);
        b.Property(x => x.RepositoryUrl).HasMaxLength(1000);
        b.Property(x => x.ProjectDownloadUrl).HasMaxLength(1000);
        b.Property(x => x.AdminNotes).HasMaxLength(4000);
        b.HasIndex(x => new { x.Status, x.CreatedAt });
    }
}

public sealed class CustomSoftwareProjectAccessConfiguration : IEntityTypeConfiguration<CustomSoftwareProjectAccess>
{
    public void Configure(EntityTypeBuilder<CustomSoftwareProjectAccess> b)
    {
        b.ToTable("custom_software_project_access");
        b.HasKey(x => x.Id);
        b.Property(x => x.AccessLevel).HasMaxLength(30).IsRequired();
        b.HasIndex(x => new { x.AccountId, x.ProjectId }).IsUnique();
        b.HasOne(x => x.Project).WithMany(x => x.UserAccesses).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Account).WithMany(x => x.ProjectAccesses).HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CustomSoftwareProjectRecordConfiguration : IEntityTypeConfiguration<CustomSoftwareProjectRecord>
{
    public void Configure(EntityTypeBuilder<CustomSoftwareProjectRecord> b)
    {
        b.ToTable("custom_software_project_records");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(40).IsRequired();
        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Description).HasMaxLength(4000);
        b.Property(x => x.Status).HasMaxLength(40);
        b.Property(x => x.DetailsJson).HasColumnType("json");
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.StorageKey).HasMaxLength(1000);
        b.Property(x => x.FileName).HasMaxLength(255);
        b.Property(x => x.ContentType).HasMaxLength(150);
        b.HasIndex(x => new { x.ProjectId, x.Kind, x.SortOrder });
        b.HasOne(x => x.Project).WithMany(x => x.Records).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.ParentRecord).WithMany().HasForeignKey(x => x.ParentRecordId).OnDelete(DeleteBehavior.SetNull);
    }
}
