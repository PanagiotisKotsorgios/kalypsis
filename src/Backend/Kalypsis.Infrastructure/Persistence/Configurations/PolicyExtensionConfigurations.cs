using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class PolicyObjectConfiguration : IEntityTypeConfiguration<PolicyObject>
{
    public void Configure(EntityTypeBuilder<PolicyObject> b)
    {
        b.ToTable("policy_objects");
        b.HasKey(x => x.Id);
        b.Property(x => x.ObjectKind).HasMaxLength(64).IsRequired();
        b.Property(x => x.FbcLinkCode).HasMaxLength(32);
        b.Property(x => x.Identifier).HasMaxLength(128);
        b.Property(x => x.Description).HasMaxLength(512);
        b.Property(x => x.Characteristic).HasMaxLength(128);
        b.HasIndex(x => x.PolicyId);
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
        b.HasOne(x => x.Policy).WithMany(p => p.Objects).HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PolicyCoverConfiguration : IEntityTypeConfiguration<PolicyCover>
{
    public void Configure(EntityTypeBuilder<PolicyCover> b)
    {
        b.ToTable("policy_covers");
        b.HasKey(x => x.Id);
        b.Property(x => x.CoverCode).HasMaxLength(32).IsRequired();
        b.Property(x => x.CoverName).HasMaxLength(200);
        b.Property(x => x.GrossPremium).HasColumnType("decimal(14,2)");
        b.Property(x => x.NetPremium).HasColumnType("decimal(14,2)");
        b.Property(x => x.CoverageAmount).HasColumnType("decimal(18,2)");
        b.HasIndex(x => x.PolicyId);
        b.HasIndex(x => x.PolicyObjectId);
        b.HasOne(x => x.Policy).WithMany(p => p.Covers).HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.PolicyObject).WithMany(o => o.Covers).HasForeignKey(x => x.PolicyObjectId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class PolicyInstallmentConfiguration : IEntityTypeConfiguration<PolicyInstallment>
{
    public void Configure(EntityTypeBuilder<PolicyInstallment> b)
    {
        b.ToTable("policy_installments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Amount).HasColumnType("decimal(14,2)");
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.PaidVia).HasMaxLength(64);
        b.Property(x => x.ReceiptReference).HasMaxLength(128);
        b.HasIndex(x => x.PolicyId);
        b.HasIndex(x => new { x.TenantId, x.DueDate, x.PaidAt });
        b.HasOne(x => x.Policy).WithMany(p => p.Installments).HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class SavedReportConfiguration : IEntityTypeConfiguration<SavedReport>
{
    public void Configure(EntityTypeBuilder<SavedReport> b)
    {
        b.ToTable("saved_reports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Entity).HasMaxLength(64).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.FiltersJson).HasColumnType("longtext");
        b.HasIndex(x => new { x.TenantId, x.OwnerUserId, x.Entity });
        b.HasIndex(x => new { x.TenantId, x.Entity, x.IsShared });
    }
}
