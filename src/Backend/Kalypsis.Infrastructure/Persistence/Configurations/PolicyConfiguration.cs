using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class PolicyConfiguration : IEntityTypeConfiguration<Policy>
{
    public void Configure(EntityTypeBuilder<Policy> b)
    {
        b.ToTable("policies");
        b.HasKey(x => x.Id);
        b.Property(x => x.PolicyNumber).HasMaxLength(64).IsRequired();
        b.Property(x => x.PolicyType).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Premium).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.NetPremium).HasColumnType("decimal(14,2)");
        b.Property(x => x.VatAmount).HasColumnType("decimal(14,2)");
        b.Property(x => x.StampDutyAmount).HasColumnType("decimal(14,2)");
        b.Property(x => x.InsuranceContributionAmount).HasColumnType("decimal(14,2)");
        b.Property(x => x.OtherChargesAmount).HasColumnType("decimal(14,2)");

        b.HasIndex(x => new { x.TenantId, x.PolicyNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.HasIndex(x => new { x.TenantId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.EndDate });

        b.HasOne(x => x.Customer).WithMany(c => c.Policies).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.InsuranceCompany).WithMany(i => i.Policies).HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Producer).WithMany(p => p.Policies).HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.RenewedFromPolicy).WithMany().HasForeignKey(x => x.RenewedFromPolicyId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class PolicyDocumentConfiguration : IEntityTypeConfiguration<PolicyDocument>
{
    public void Configure(EntityTypeBuilder<PolicyDocument> b)
    {
        b.ToTable("policy_documents");
        b.HasKey(x => x.Id);
        b.Property(x => x.DocumentType).HasConversion<int>();
        b.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        b.Property(x => x.StoragePath).HasMaxLength(512).IsRequired();
        b.Property(x => x.MimeType).HasMaxLength(128).IsRequired();

        b.HasOne(x => x.Policy).WithMany(p => p.Documents).HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.UploadedByUser).WithMany().HasForeignKey(x => x.UploadedByUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
    }
}
