using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

// ============================================================================
// Phase 11 — Configurations for the remaining ALIS gap entities.
// ============================================================================

public class GroupPolicyConfiguration : IEntityTypeConfiguration<GroupPolicy>
{
    public void Configure(EntityTypeBuilder<GroupPolicy> b)
    {
        b.HasIndex(x => new { x.TenantId, x.GroupNumber }).IsUnique();
        b.HasOne(x => x.PolicyHolder).WithMany().HasForeignKey(x => x.PolicyHolderCustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Members).WithOne(m => m.GroupPolicy!).HasForeignKey(m => m.GroupPolicyId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.GroupNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Premium).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class GroupPolicyMemberConfiguration : IEntityTypeConfiguration<GroupPolicyMember>
{
    public void Configure(EntityTypeBuilder<GroupPolicyMember> b)
    {
        b.HasIndex(x => new { x.TenantId, x.GroupPolicyId });
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Afm).HasMaxLength(20);
        b.Property(x => x.Amka).HasMaxLength(20);
        b.Property(x => x.Relationship).HasMaxLength(40);
        b.Property(x => x.IndividualPremium).HasPrecision(12, 2);
    }
}

public class ClaimProvisionConfiguration : IEntityTypeConfiguration<ClaimProvision>
{
    public void Configure(EntityTypeBuilder<ClaimProvision> b)
    {
        b.HasIndex(x => new { x.TenantId, x.ClaimId });
        b.HasOne(x => x.Claim).WithMany().HasForeignKey(x => x.ClaimId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.ReserveAmount).HasPrecision(12, 2);
        b.Property(x => x.IncurredButNotReported).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.AssessorName).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class ClaimIndemnityConfiguration : IEntityTypeConfiguration<ClaimIndemnity>
{
    public void Configure(EntityTypeBuilder<ClaimIndemnity> b)
    {
        b.HasIndex(x => new { x.TenantId, x.PaymentNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.ClaimId });
        b.HasOne(x => x.Claim).WithMany().HasForeignKey(x => x.ClaimId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Garage).WithMany().HasForeignKey(x => x.GarageId).OnDelete(DeleteBehavior.SetNull);
        b.Property(x => x.PaymentNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.PayeeType).HasMaxLength(20);
        b.Property(x => x.PayeeName).HasMaxLength(200);
        b.Property(x => x.PaymentMethod).HasMaxLength(40);
        b.Property(x => x.Reference).HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class GarageConfiguration : IEntityTypeConfiguration<Garage>
{
    public void Configure(EntityTypeBuilder<Garage> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Afm).HasMaxLength(20);
        b.Property(x => x.Address).HasMaxLength(300);
        b.Property(x => x.City).HasMaxLength(120);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Email).HasMaxLength(160);
        b.Property(x => x.Specialty).HasMaxLength(80);
        b.Property(x => x.Iban).HasMaxLength(40);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class GlAccountConfiguration : IEntityTypeConfiguration<GlAccount>
{
    public void Configure(EntityTypeBuilder<GlAccount> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Type).HasMaxLength(20);
        b.Property(x => x.Category).HasMaxLength(80);
    }
}

public class GlEntryConfiguration : IEntityTypeConfiguration<GlEntry>
{
    public void Configure(EntityTypeBuilder<GlEntry> b)
    {
        b.HasIndex(x => new { x.TenantId, x.EntryDate });
        b.HasIndex(x => new { x.TenantId, x.EntryNumber });
        b.HasOne(x => x.Account).WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Restrict);
        b.Property(x => x.EntryNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500).IsRequired();
        b.Property(x => x.Debit).HasPrecision(12, 2);
        b.Property(x => x.Credit).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.RelatedDocumentRef).HasMaxLength(80);
    }
}

public class CashAccountConfiguration : IEntityTypeConfiguration<CashAccount>
{
    public void Configure(EntityTypeBuilder<CashAccount> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.CurrentBalance).HasPrecision(12, 2);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class CashMovementConfiguration : IEntityTypeConfiguration<CashMovement>
{
    public void Configure(EntityTypeBuilder<CashMovement> b)
    {
        b.HasIndex(x => new { x.TenantId, x.CashAccountId, x.MovementDate });
        b.HasOne(x => x.CashAccount).WithMany().HasForeignKey(x => x.CashAccountId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.Direction).HasMaxLength(8);
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.Reason).HasMaxLength(200);
        b.Property(x => x.Reference).HasMaxLength(80);
    }
}

public class NameDayConfiguration : IEntityTypeConfiguration<NameDay>
{
    public void Configure(EntityTypeBuilder<NameDay> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Name, x.Month, x.Day }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Month, x.Day });
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(400);
    }
}

public class MyDataSubmissionConfiguration : IEntityTypeConfiguration<MyDataSubmission>
{
    public void Configure(EntityTypeBuilder<MyDataSubmission> b)
    {
        b.HasIndex(x => new { x.TenantId, x.SubmissionNumber }).IsUnique();
        b.Property(x => x.SubmissionNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.TransmissionKind).HasMaxLength(20);
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.TotalAmount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.AadeMark).HasMaxLength(80);
        b.Property(x => x.AadeUid).HasMaxLength(80);
        b.Property(x => x.ErrorMessage).HasMaxLength(2000);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class DocumentTemplateConfiguration : IEntityTypeConfiguration<DocumentTemplate>
{
    public void Configure(EntityTypeBuilder<DocumentTemplate> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(40);
        b.Property(x => x.PageSize).HasMaxLength(20);
        b.Property(x => x.Orientation).HasMaxLength(20);
        b.Property(x => x.HeaderHtml).HasColumnType("longtext");
        b.Property(x => x.BodyHtml).HasColumnType("longtext");
        b.Property(x => x.FooterHtml).HasColumnType("longtext");
    }
}

public class DocumentNumberingRuleConfiguration : IEntityTypeConfiguration<DocumentNumberingRule>
{
    public void Configure(EntityTypeBuilder<DocumentNumberingRule> b)
    {
        b.HasIndex(x => new { x.TenantId, x.DocumentKind }).IsUnique();
        b.Property(x => x.DocumentKind).HasMaxLength(40).IsRequired();
        b.Property(x => x.Prefix).HasMaxLength(20);
        b.Property(x => x.Suffix).HasMaxLength(20);
    }
}
