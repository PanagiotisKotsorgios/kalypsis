using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class IntegrationSettingConfiguration : IEntityTypeConfiguration<IntegrationSetting>
{
    public void Configure(EntityTypeBuilder<IntegrationSetting> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Service, x.KeyName }).IsUnique();
        b.Property(x => x.Service).HasMaxLength(40).IsRequired();
        b.Property(x => x.KeyName).HasMaxLength(80).IsRequired();
        b.Property(x => x.Value).HasMaxLength(2000);
        b.Property(x => x.Notes).HasMaxLength(500);
    }
}

public class CustomFieldDefinitionConfiguration : IEntityTypeConfiguration<CustomFieldDefinition>
{
    public void Configure(EntityTypeBuilder<CustomFieldDefinition> b)
    {
        b.HasIndex(x => new { x.TenantId, x.EntityType, x.Code }).IsUnique();
        b.Property(x => x.EntityType).HasMaxLength(40).IsRequired();
        b.Property(x => x.Code).HasMaxLength(60).IsRequired();
        b.Property(x => x.Label).HasMaxLength(160).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(20);
        b.Property(x => x.Options).HasMaxLength(2000);
        b.Property(x => x.LookupEntity).HasMaxLength(40);
        b.Property(x => x.HelpText).HasMaxLength(500);
    }
}

public class CustomFieldValueConfiguration : IEntityTypeConfiguration<CustomFieldValue>
{
    public void Configure(EntityTypeBuilder<CustomFieldValue> b)
    {
        b.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId });
        b.HasIndex(x => new { x.TenantId, x.FieldId, x.EntityId }).IsUnique();
        b.HasOne(x => x.Field).WithMany().HasForeignKey(x => x.FieldId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.EntityType).HasMaxLength(40).IsRequired();
        b.Property(x => x.Value).HasMaxLength(2000);
    }
}

public class MovementTypeConfiguration : IEntityTypeConfiguration<MovementType>
{
    public void Configure(EntityTypeBuilder<MovementType> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.Category).HasMaxLength(20);
        b.Property(x => x.Party).HasMaxLength(20);
        b.Property(x => x.ReceiptNumberPrefix).HasMaxLength(20);
    }
}

public class BonusMalusRuleConfiguration : IEntityTypeConfiguration<BonusMalusRule>
{
    public void Configure(EntityTypeBuilder<BonusMalusRule> b)
    {
        b.HasIndex(x => new { x.TenantId, x.IsActive, x.EffectiveFrom });
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PolicyTypeFilter).HasMaxLength(20);
        b.Property(x => x.AdjustmentPercent).HasPrecision(6, 2);
        b.Property(x => x.AdjustmentDirection).HasMaxLength(20);
    }
}

public class RenewalRuleConfiguration : IEntityTypeConfiguration<RenewalRule>
{
    public void Configure(EntityTypeBuilder<RenewalRule> b)
    {
        b.HasIndex(x => new { x.TenantId, x.IsActive, x.DisplayOrder });
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PolicyTypeFilter).HasMaxLength(20);
        b.Property(x => x.ConditionJson).HasColumnType("longtext").IsRequired();
        b.Property(x => x.ActionJson).HasColumnType("longtext").IsRequired();
    }
}

public class RegisterTemplateConfiguration : IEntityTypeConfiguration<RegisterTemplate>
{
    public void Configure(EntityTypeBuilder<RegisterTemplate> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PolicyTypeFilter).HasMaxLength(20);
        b.Property(x => x.GroupByField).HasMaxLength(60);
        b.Property(x => x.ColumnsJson).HasColumnType("longtext").IsRequired();
    }
}

public class AdvancePaymentConfiguration : IEntityTypeConfiguration<AdvancePayment>
{
    public void Configure(EntityTypeBuilder<AdvancePayment> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Status });
        b.Property(x => x.Number).HasMaxLength(40).IsRequired();
        b.Property(x => x.PartyType).HasMaxLength(20);
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.AllocatedAmount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.PaymentMethod).HasMaxLength(40);
        b.Property(x => x.Reference).HasMaxLength(80);
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class ReconciliationLinkConfiguration : IEntityTypeConfiguration<ReconciliationLink>
{
    public void Configure(EntityTypeBuilder<ReconciliationLink> b)
    {
        b.HasIndex(x => new { x.TenantId, x.SourceType, x.SourceId });
        b.HasIndex(x => new { x.TenantId, x.TargetType, x.TargetId });
        b.Property(x => x.SourceType).HasMaxLength(40).IsRequired();
        b.Property(x => x.TargetType).HasMaxLength(40).IsRequired();
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.Notes).HasMaxLength(500);
    }
}

public class TachyPaymentBatchConfiguration : IEntityTypeConfiguration<TachyPaymentBatch>
{
    public void Configure(EntityTypeBuilder<TachyPaymentBatch> b)
    {
        b.HasIndex(x => new { x.TenantId, x.BatchNumber }).IsUnique();
        b.Property(x => x.BatchNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.TotalAmount).HasPrecision(14, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.ExportFilePath).HasMaxLength(400);
    }
}

public class TachyPaymentLineConfiguration : IEntityTypeConfiguration<TachyPaymentLine>
{
    public void Configure(EntityTypeBuilder<TachyPaymentLine> b)
    {
        b.HasIndex(x => new { x.TenantId, x.BatchId });
        b.HasOne(x => x.Batch).WithMany().HasForeignKey(x => x.BatchId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        b.Property(x => x.PaymentCode).HasMaxLength(40);
        b.Property(x => x.Amount).HasPrecision(12, 2);
        b.Property(x => x.Surcharge).HasPrecision(12, 2);
        b.Property(x => x.Status).HasMaxLength(20);
    }
}

public class ContactExportLogConfiguration : IEntityTypeConfiguration<ContactExportLog>
{
    public void Configure(EntityTypeBuilder<ContactExportLog> b)
    {
        b.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId });
        b.Property(x => x.EntityType).HasMaxLength(40).IsRequired();
        b.Property(x => x.Format).HasMaxLength(20);
    }
}

public class EditableDocumentConfiguration : IEntityTypeConfiguration<EditableDocument>
{
    public void Configure(EntityTypeBuilder<EditableDocument> b)
    {
        b.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId });
        b.Property(x => x.EntityType).HasMaxLength(40).IsRequired();
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.RenderedHtml).HasColumnType("longtext").IsRequired();
        b.Property(x => x.FileKey).HasMaxLength(400);
    }
}

public class InfoCenterExportConfiguration : IEntityTypeConfiguration<InfoCenterExport>
{
    public void Configure(EntityTypeBuilder<InfoCenterExport> b)
    {
        b.HasIndex(x => new { x.TenantId, x.BatchNumber }).IsUnique();
        b.Property(x => x.BatchNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(40);
        b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.FileKey).HasMaxLength(400);
        b.Property(x => x.ResponseCode).HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(2000);
    }
}

public class SapBridgeMappingConfiguration : IEntityTypeConfiguration<SapBridgeMapping>
{
    public void Configure(EntityTypeBuilder<SapBridgeMapping> b)
    {
        b.HasIndex(x => new { x.TenantId, x.MovementTypeId }).IsUnique();
        b.HasOne(x => x.MovementType).WithMany().HasForeignKey(x => x.MovementTypeId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.SapAccount).HasMaxLength(40).IsRequired();
        b.Property(x => x.CostCenter).HasMaxLength(40);
        b.Property(x => x.ProfitCenter).HasMaxLength(40);
    }
}

public class PeriodLockConfiguration : IEntityTypeConfiguration<PeriodLock>
{
    public void Configure(EntityTypeBuilder<PeriodLock> b)
    {
        b.HasIndex(x => new { x.TenantId, x.Scope }).IsUnique();
        b.Property(x => x.Scope).HasMaxLength(40).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(500);
    }
}
