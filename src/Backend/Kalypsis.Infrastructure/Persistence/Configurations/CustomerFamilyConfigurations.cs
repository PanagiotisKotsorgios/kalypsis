using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CustomerFamilyMemberConfiguration : IEntityTypeConfiguration<CustomerFamilyMember>
{
    public void Configure(EntityTypeBuilder<CustomerFamilyMember> b)
    {
        b.ToTable("customer_family_members");
        b.HasKey(x => x.Id);
        b.Property(x => x.Relation).HasMaxLength(40).IsRequired();
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Gender).HasMaxLength(40);
        b.Property(x => x.Amka).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.AfmVat).HasMaxLength(20);
        b.Property(x => x.Occupation).HasMaxLength(120);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.MobilePhone).HasMaxLength(40);
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
    }
}

public class CustomerAssetConfiguration : IEntityTypeConfiguration<CustomerAsset>
{
    public void Configure(EntityTypeBuilder<CustomerAsset> b)
    {
        b.ToTable("customer_assets");
        b.HasKey(x => x.Id);
        b.Property(x => x.AssetKind).HasMaxLength(40).IsRequired();
        b.Property(x => x.Plate).HasMaxLength(30);
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.HasIndex(x => new { x.TenantId, x.FamilyMemberId });
    }
}

public class CustomerRelationshipConfiguration : IEntityTypeConfiguration<CustomerRelationship>
{
    public void Configure(EntityTypeBuilder<CustomerRelationship> b)
    {
        b.ToTable("customer_relationships");
        b.HasKey(x => x.Id);
        b.Property(x => x.RelationshipType).HasConversion<int>();
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.RelatedCustomer).WithMany().HasForeignKey(x => x.RelatedCustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.RelatedCustomerId }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.RelatedCustomerId });
    }
}

public class CustomerInsuranceNeedConfiguration : IEntityTypeConfiguration<CustomerInsuranceNeed>
{
    public void Configure(EntityTypeBuilder<CustomerInsuranceNeed> b)
    {
        b.ToTable("customer_insurance_needs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(40).IsRequired();
        b.Property(x => x.Title).HasMaxLength(160).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.Kind });
        b.HasIndex(x => new { x.TenantId, x.Kind, x.HasAsset, x.IsInsured });
    }
}
