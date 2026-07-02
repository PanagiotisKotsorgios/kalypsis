using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> b)
    {
        b.ToTable("appointments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.Location).HasMaxLength(200);
        b.Property(x => x.Status).HasConversion<int>();
        b.HasOne(x => x.AssignedToUser).WithMany().HasForeignKey(x => x.AssignedToUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.StartsAt });
    }
}

public class TariffConfiguration : IEntityTypeConfiguration<Tariff>
{
    public void Configure(EntityTypeBuilder<Tariff> b)
    {
        b.ToTable("tariffs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PolicyType).HasConversion<int>();
        b.Property(x => x.BasePremium).HasPrecision(14, 2);
        b.Property(x => x.CommissionPercent).HasPrecision(8, 4);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.FactorsJson).HasColumnType("longtext");
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.PolicyType, x.IsActive });
    }
}

public class CoverNoteConfiguration : IEntityTypeConfiguration<CoverNote>
{
    public void Configure(EntityTypeBuilder<CoverNote> b)
    {
        b.ToTable("cover_notes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Number).HasMaxLength(80).IsRequired();
        b.Property(x => x.PolicyType).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.EstimatedPremium).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.Subject).HasMaxLength(400);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.ConvertedToPolicy).WithMany().HasForeignKey(x => x.ConvertedToPolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
    }
}

public class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> b)
    {
        b.ToTable("branches");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.FieldsJson).HasColumnType("longtext");
        b.Property(x => x.CoveragesJson).HasColumnType("longtext");
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
    }
}

public class OverCommissionRuleConfiguration : IEntityTypeConfiguration<OverCommissionRule>
{
    public void Configure(EntityTypeBuilder<OverCommissionRule> b)
    {
        b.ToTable("over_commission_rules");
        b.HasKey(x => x.Id);
        b.Property(x => x.Percentage).HasPrecision(8, 4);
        b.Property(x => x.PolicyType).HasConversion<int?>();
        b.HasOne(x => x.ManagerProducer).WithMany().HasForeignKey(x => x.ManagerProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SubordinateProducer).WithMany().HasForeignKey(x => x.SubordinateProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.ManagerProducerId, x.SubordinateProducerId });
    }
}

public class ProductionGoalConfiguration : IEntityTypeConfiguration<ProductionGoal>
{
    public void Configure(EntityTypeBuilder<ProductionGoal> b)
    {
        b.ToTable("production_goals");
        b.HasKey(x => x.Id);
        b.Property(x => x.TargetPremium).HasPrecision(14, 2);
        b.Property(x => x.PolicyType).HasConversion<int?>();
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.ProducerId, x.Year });
    }
}

public class ReceiptConfiguration : IEntityTypeConfiguration<Receipt>
{
    public void Configure(EntityTypeBuilder<Receipt> b)
    {
        b.ToTable("receipts");
        b.HasKey(x => x.Id);
        b.Property(x => x.Number).HasMaxLength(40).IsRequired();
        b.Property(x => x.Method).HasConversion<int>();
        b.Property(x => x.Amount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.TransactionReference).HasMaxLength(80);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.RecordedByUser).WithMany().HasForeignKey(x => x.RecordedByUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.ReceivedOn });
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.ToTable("payments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Number).HasMaxLength(40).IsRequired();
        b.Property(x => x.BeneficiaryType).HasConversion<int>();
        b.Property(x => x.Method).HasConversion<int>();
        b.Property(x => x.Amount).HasPrecision(14, 2);
        b.Property(x => x.CommissionsNetted).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.BeneficiaryName).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.TransactionReference).HasMaxLength(80);
        b.HasOne(x => x.BeneficiaryInsuranceCompany).WithMany().HasForeignKey(x => x.BeneficiaryInsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.BeneficiaryProducer).WithMany().HasForeignKey(x => x.BeneficiaryProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.PaidOn });
    }
}

public class SecurityConfiguration : IEntityTypeConfiguration<Security>
{
    public void Configure(EntityTypeBuilder<Security> b)
    {
        b.ToTable("securities");
        b.HasKey(x => x.Id);
        b.Property(x => x.Number).HasMaxLength(40).IsRequired();
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Amount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.IssuingBank).WithMany().HasForeignKey(x => x.IssuingBankId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.MaturityDate });
    }
}

public class FinancialMovementConfiguration : IEntityTypeConfiguration<FinancialMovement>
{
    public void Configure(EntityTypeBuilder<FinancialMovement> b)
    {
        b.ToTable("financial_movements");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.Amount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.InsuranceCompany).WithMany().HasForeignKey(x => x.InsuranceCompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Receipt).WithMany().HasForeignKey(x => x.ReceiptId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.MovementDate });
    }
}

public class BankConnectionConfiguration : IEntityTypeConfiguration<BankConnection>
{
    public void Configure(EntityTypeBuilder<BankConnection> b)
    {
        b.ToTable("bank_connections");
        b.HasKey(x => x.Id);
        b.Property(x => x.BankName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Iban).HasMaxLength(40);
        b.Property(x => x.Bic).HasMaxLength(20);
        b.Property(x => x.AccountName).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.BankName });
    }
}

public class MarketingCampaignConfiguration : IEntityTypeConfiguration<MarketingCampaign>
{
    public void Configure(EntityTypeBuilder<MarketingCampaign> b)
    {
        b.ToTable("marketing_campaigns");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        b.Property(x => x.BodyHtml).HasColumnType("longtext");
        b.Property(x => x.SmsBody).HasMaxLength(1600);
        b.Property(x => x.ViberBody).HasMaxLength(4000);
        b.Property(x => x.ChannelsJson).HasMaxLength(200).IsRequired();
        b.Property(x => x.SegmentKey).HasMaxLength(80);
        b.Property(x => x.OccupationFilter).HasMaxLength(120);
        b.Property(x => x.NeedKindFilter).HasMaxLength(40);
        b.Property(x => x.Status).HasConversion<int>();
        b.HasIndex(x => new { x.TenantId, x.Status });
    }
}

public class DeliveryRecordConfiguration : IEntityTypeConfiguration<DeliveryRecord>
{
    public void Configure(EntityTypeBuilder<DeliveryRecord> b)
    {
        b.ToTable("delivery_records");
        b.HasKey(x => x.Id);
        b.Property(x => x.Channel).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Reference).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.Status });
    }
}

public class DocumentFolderConfiguration : IEntityTypeConfiguration<DocumentFolder>
{
    public void Configure(EntityTypeBuilder<DocumentFolder> b)
    {
        b.ToTable("document_folders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.Color).HasMaxLength(20);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Parent).WithMany().HasForeignKey(x => x.ParentFolderId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
    }
}

public class PartnerPortalAccessConfiguration : IEntityTypeConfiguration<PartnerPortalAccess>
{
    public void Configure(EntityTypeBuilder<PartnerPortalAccess> b)
    {
        b.ToTable("partner_portal_accesses");
        b.HasKey(x => x.Id);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.ProducerId }).IsUnique();
    }
}

public class ThirdPartyApiKeyConfiguration : IEntityTypeConfiguration<ThirdPartyApiKey>
{
    public void Configure(EntityTypeBuilder<ThirdPartyApiKey> b)
    {
        b.ToTable("third_party_api_keys");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.KeyPrefix).HasMaxLength(20).IsRequired();
        b.Property(x => x.KeyHash).HasMaxLength(120).IsRequired();
        b.Property(x => x.Scopes).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.KeyPrefix }).IsUnique();
    }
}

public class DiasCodeConfiguration : IEntityTypeConfiguration<DiasCode>
{
    public void Configure(EntityTypeBuilder<DiasCode> b)
    {
        b.ToTable("dias_codes");
        b.HasKey(x => x.Id);
        b.Property(x => x.RfCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.Amount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3).HasDefaultValue("EUR");
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.BankReference).HasMaxLength(80);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.RfCode }).IsUnique();
    }
}

public class AccountingExportConfiguration : IEntityTypeConfiguration<AccountingExport>
{
    public void Configure(EntityTypeBuilder<AccountingExport> b)
    {
        b.ToTable("accounting_exports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.FileName).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.Year, x.Month });
    }
}

public class KepyoReportConfiguration : IEntityTypeConfiguration<KepyoReport>
{
    public void Configure(EntityTypeBuilder<KepyoReport> b)
    {
        b.ToTable("kepyo_reports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.TotalAmount).HasPrecision(14, 2);
        b.Property(x => x.FileName).HasMaxLength(200);
        b.HasIndex(x => new { x.TenantId, x.Year });
    }
}

public class MagneticImportConfiguration : IEntityTypeConfiguration<MagneticImport>
{
    public void Configure(EntityTypeBuilder<MagneticImport> b)
    {
        b.ToTable("magnetic_imports");
        b.HasKey(x => x.Id);
        b.Property(x => x.FileName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Source).HasMaxLength(200);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.Status });
    }
}
