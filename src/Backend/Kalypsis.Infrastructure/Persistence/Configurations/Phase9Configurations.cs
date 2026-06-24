using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class PolicyEndorsementConfiguration : IEntityTypeConfiguration<PolicyEndorsement>
{
    public void Configure(EntityTypeBuilder<PolicyEndorsement> b)
    {
        b.HasIndex(x => new { x.TenantId, x.EndorsementNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.PolicyId, x.IssuedAt });
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.Property(x => x.EndorsementNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000).IsRequired();
        b.Property(x => x.CarrierReference).HasMaxLength(80);
        b.Property(x => x.PremiumDelta).HasPrecision(12, 2);
        b.Property(x => x.CommissionDelta).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.ChangesJson).HasColumnType("longtext");
        b.Property(x => x.DocumentFileKey).HasMaxLength(400);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.CancellationReasonText).HasMaxLength(500);
    }
}

public class CancellationReasonConfiguration : IEntityTypeConfiguration<CancellationReason>
{
    public void Configure(EntityTypeBuilder<CancellationReason> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
    }
}

public class PolicyCancellationConfiguration : IEntityTypeConfiguration<PolicyCancellation>
{
    public void Configure(EntityTypeBuilder<PolicyCancellation> b)
    {
        b.HasIndex(x => new { x.TenantId, x.CancellationNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Reason).WithMany().HasForeignKey(x => x.ReasonId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.CreditNote).WithMany().HasForeignKey(x => x.CreditNoteId).OnDelete(DeleteBehavior.SetNull);
        b.Property(x => x.CancellationNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.RefundMethod).HasMaxLength(20).IsRequired();
        b.Property(x => x.RefundAmount).HasPrecision(12, 2);
        b.Property(x => x.PenaltyAmount).HasPrecision(12, 2);
        b.Property(x => x.CommissionClawback).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.ReasonText).HasMaxLength(1000);
        b.Property(x => x.CarrierReference).HasMaxLength(80);
        b.Property(x => x.DocumentFileKey).HasMaxLength(400);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class CreditNoteConfiguration : IEntityTypeConfiguration<CreditNote>
{
    public void Configure(EntityTypeBuilder<CreditNote> b)
    {
        b.HasIndex(x => new { x.TenantId, x.CreditNoteNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.HasIndex(x => new { x.TenantId, x.PolicyId });
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.Property(x => x.CreditNoteNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.VatAmount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000).IsRequired();
        b.Property(x => x.RelatedDocumentRef).HasMaxLength(80);
        b.Property(x => x.DocumentFileKey).HasMaxLength(400);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

// ---- Reference catalogs ----

public class BankConfiguration : IEntityTypeConfiguration<Bank>
{
    public void Configure(EntityTypeBuilder<Bank> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Swift).HasMaxLength(20);
        b.Property(x => x.AccountIban).HasMaxLength(40);
    }
}

public class TaxOfficeConfiguration : IEntityTypeConfiguration<TaxOffice>
{
    public void Configure(EntityTypeBuilder<TaxOffice> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.City).HasMaxLength(80);
    }
}

public class CustomerCategoryConfiguration : IEntityTypeConfiguration<CustomerCategory>
{
    public void Configure(EntityTypeBuilder<CustomerCategory> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.ColorHex).HasMaxLength(8);
    }
}

public class ProducerCategoryConfiguration : IEntityTypeConfiguration<ProducerCategory>
{
    public void Configure(EntityTypeBuilder<ProducerCategory> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
    }
}

public class NationalityConfiguration : IEntityTypeConfiguration<Nationality>
{
    public void Configure(EntityTypeBuilder<Nationality> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Iso2 }).IsUnique();
        b.Property(x => x.Iso2).HasMaxLength(3).IsRequired();
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
    }
}

public class OccupationConfiguration : IEntityTypeConfiguration<Occupation>
{
    public void Configure(EntityTypeBuilder<Occupation> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.Category).HasMaxLength(80);
    }
}

public class CityConfiguration : IEntityTypeConfiguration<City>
{
    public void Configure(EntityTypeBuilder<City> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Name });
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Region).HasMaxLength(80);
        b.Property(x => x.PostalCode).HasMaxLength(20);
    }
}

public class LegalFormConfiguration : IEntityTypeConfiguration<LegalForm>
{
    public void Configure(EntityTypeBuilder<LegalForm> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
    }
}
