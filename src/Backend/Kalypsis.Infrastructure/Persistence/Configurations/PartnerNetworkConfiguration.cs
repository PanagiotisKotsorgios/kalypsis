using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public sealed class PartnerNetworkConfiguration : IEntityTypeConfiguration<PartnerNetwork>
{
    public void Configure(EntityTypeBuilder<PartnerNetwork> b)
    {
        b.ToTable("partner_networks");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(64).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.NetworkType).HasMaxLength(100).IsRequired();
        b.Property(x => x.Status).HasMaxLength(40).IsRequired();
        b.Property(x => x.ManagerName).HasMaxLength(200);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.SecondaryEmail).HasMaxLength(256);
        b.Property(x => x.SecondaryPhone).HasMaxLength(40);
        b.Property(x => x.TaxId).HasMaxLength(32);
        b.Property(x => x.TaxOffice).HasMaxLength(160);
        b.Property(x => x.BusinessType).HasMaxLength(120);
        b.Property(x => x.ProfessionalCategory).HasMaxLength(160);
        b.Property(x => x.Address).HasMaxLength(240);
        b.Property(x => x.City).HasMaxLength(120);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Website).HasMaxLength(512);
        b.Property(x => x.LogoPath).HasMaxLength(1024);
        b.Property(x => x.ContractNumber).HasMaxLength(120);
        b.Property(x => x.CommissionPolicyJson).HasColumnType("longtext");
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Status });
    }
}

public sealed class PartnerNetworkMemberConfiguration : IEntityTypeConfiguration<PartnerNetworkMember>
{
    public void Configure(EntityTypeBuilder<PartnerNetworkMember> b)
    {
        b.ToTable("partner_network_members");
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).HasMaxLength(120).IsRequired();
        b.Property(x => x.CommissionPercentOverride).HasPrecision(7, 2);
        b.Property(x => x.TargetPercent).HasPrecision(7, 2);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.PartnerNetwork).WithMany(x => x.Members)
            .HasForeignKey(x => x.PartnerNetworkId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Producer).WithMany()
            .HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.PartnerNetworkId, x.ProducerId }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.ProducerId });
    }
}

public sealed class PartnerNetworkDocumentConfiguration : IEntityTypeConfiguration<PartnerNetworkDocument>
{
    public void Configure(EntityTypeBuilder<PartnerNetworkDocument> b)
    {
        b.ToTable("partner_network_documents");
        b.HasKey(x => x.Id);
        b.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        b.Property(x => x.StoragePath).HasMaxLength(1024).IsRequired();
        b.Property(x => x.MimeType).HasMaxLength(160).IsRequired();
        b.Property(x => x.Category).HasMaxLength(120).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.PartnerNetwork).WithMany(x => x.Documents)
            .HasForeignKey(x => x.PartnerNetworkId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.PartnerNetworkId });
    }
}
