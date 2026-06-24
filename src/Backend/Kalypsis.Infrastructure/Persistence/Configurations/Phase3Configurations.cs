using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CarrierConnectionConfiguration : IEntityTypeConfiguration<CarrierConnection>
{
    public void Configure(EntityTypeBuilder<CarrierConnection> b)
    {
        b.ToTable("carrier_connections");
        b.HasKey(x => x.Id);
        b.Property(x => x.CarrierCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.BaseUrl).HasMaxLength(500);
        b.Property(x => x.ClientId).HasMaxLength(200);
        b.Property(x => x.ClientSecretEncrypted).HasMaxLength(500);
        b.Property(x => x.AgentCode).HasMaxLength(80);
        b.Property(x => x.AuthMode).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.CarrierCode }).IsUnique();
    }
}

public class CarrierOperationLogConfiguration : IEntityTypeConfiguration<CarrierOperationLog>
{
    public void Configure(EntityTypeBuilder<CarrierOperationLog> b)
    {
        b.ToTable("carrier_operation_logs");
        b.HasKey(x => x.Id);
        b.Property(x => x.CarrierCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.Operation).HasConversion<int>();
        b.Property(x => x.CorrelationId).HasMaxLength(64);
        b.Property(x => x.RequestSummary).HasMaxLength(2000);
        b.Property(x => x.ResponseSummary).HasMaxLength(2000);
        b.Property(x => x.ErrorMessage).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.CarrierCode, x.CreatedAt });
        b.HasOne(x => x.CarrierConnection).WithMany().HasForeignKey(x => x.CarrierConnectionId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class QuoteConfiguration : IEntityTypeConfiguration<Quote>
{
    public void Configure(EntityTypeBuilder<Quote> b)
    {
        b.ToTable("quotes");
        b.HasKey(x => x.Id);
        b.Property(x => x.QuoteNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.ProductType).HasMaxLength(20).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.RiskInputsJson).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.QuoteNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class QuoteOfferConfiguration : IEntityTypeConfiguration<QuoteOffer>
{
    public void Configure(EntityTypeBuilder<QuoteOffer> b)
    {
        b.ToTable("quote_offers");
        b.HasKey(x => x.Id);
        b.Property(x => x.CarrierCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.CarrierProductCode).HasMaxLength(80);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.CoverageSummary).HasMaxLength(2000);
        b.Property(x => x.RawResponseRedacted).HasMaxLength(4000);
        b.HasIndex(x => new { x.TenantId, x.QuoteId });
        b.HasOne(x => x.Quote).WithMany(q => q.Offers).HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PolicyApplicationConfiguration : IEntityTypeConfiguration<PolicyApplication>
{
    public void Configure(EntityTypeBuilder<PolicyApplication> b)
    {
        b.ToTable("policy_applications");
        b.HasKey(x => x.Id);
        b.Property(x => x.ApplicationNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.CarrierApplicationId).HasMaxLength(80);
        b.Property(x => x.CarrierResponseRedacted).HasMaxLength(4000);
        b.HasOne(x => x.Quote).WithMany().HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SelectedOffer).WithMany().HasForeignKey(x => x.SelectedOfferId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.IssuedPolicy).WithMany().HasForeignKey(x => x.IssuedPolicyId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class InstallmentConfiguration : IEntityTypeConfiguration<Installment>
{
    public void Configure(EntityTypeBuilder<Installment> b)
    {
        b.ToTable("installments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.PolicyId, x.SequenceNumber }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.DueDate, x.Status });
        b.HasOne(x => x.Policy).WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class InstallmentPaymentConfiguration : IEntityTypeConfiguration<InstallmentPayment>
{
    public void Configure(EntityTypeBuilder<InstallmentPayment> b)
    {
        b.ToTable("installment_payments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Method).HasMaxLength(40).IsRequired();
        b.Property(x => x.Reference).HasMaxLength(120);
        b.HasOne(x => x.Installment).WithMany(i => i.Payments).HasForeignKey(x => x.InstallmentId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class BankStatementImportConfiguration : IEntityTypeConfiguration<BankStatementImport>
{
    public void Configure(EntityTypeBuilder<BankStatementImport> b)
    {
        b.ToTable("bank_statement_imports");
        b.HasKey(x => x.Id);
        b.Property(x => x.FileName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Bank).HasMaxLength(40).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.ImportedAt });
    }
}

public class BankStatementLineConfiguration : IEntityTypeConfiguration<BankStatementLine>
{
    public void Configure(EntityTypeBuilder<BankStatementLine> b)
    {
        b.ToTable("bank_statement_lines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Reference).HasMaxLength(200);
        b.Property(x => x.CounterpartyName).HasMaxLength(200);
        b.Property(x => x.CounterpartyIban).HasMaxLength(40);
        b.Property(x => x.RawLine).HasMaxLength(1000);
        b.Property(x => x.MatchStatus).HasConversion<int>();
        b.HasIndex(x => new { x.TenantId, x.ImportId });
        b.HasOne(x => x.Import).WithMany(i => i.Lines).HasForeignKey(x => x.ImportId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.MatchedInstallment).WithMany().HasForeignKey(x => x.MatchedInstallmentId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class MyDataInvoiceConfiguration : IEntityTypeConfiguration<MyDataInvoice>
{
    public void Configure(EntityTypeBuilder<MyDataInvoice> b)
    {
        b.ToTable("mydata_invoices");
        b.HasKey(x => x.Id);
        b.Property(x => x.InvoiceNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.Series).HasMaxLength(10).IsRequired();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.CustomerVat).HasMaxLength(40).IsRequired();
        b.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.DocumentType).HasMaxLength(10).IsRequired();
        b.Property(x => x.MyDataMark).HasMaxLength(80);
        b.Property(x => x.MyDataUid).HasMaxLength(80);
        b.Property(x => x.CancellationMark).HasMaxLength(80);
        b.HasIndex(x => new { x.TenantId, x.InvoiceNumber, x.Series }).IsUnique();
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class MyDataInvoiceLineConfiguration : IEntityTypeConfiguration<MyDataInvoiceLine>
{
    public void Configure(EntityTypeBuilder<MyDataInvoiceLine> b)
    {
        b.ToTable("mydata_invoice_lines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Description).HasMaxLength(400).IsRequired();
        b.Property(x => x.IncomeClassification).HasMaxLength(30).IsRequired();
        b.HasOne(x => x.Invoice).WithMany(i => i.Lines).HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CommissionSplitConfiguration : IEntityTypeConfiguration<CommissionSplit>
{
    public void Configure(EntityTypeBuilder<CommissionSplit> b)
    {
        b.ToTable("commission_splits");
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).HasMaxLength(20).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.ParentTransactionId });
        b.HasOne(x => x.ParentTransaction).WithMany().HasForeignKey(x => x.ParentTransactionId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.RecipientUser).WithMany().HasForeignKey(x => x.RecipientUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.RecipientProducer).WithMany().HasForeignKey(x => x.RecipientProducerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class DocumentExtractionConfiguration : IEntityTypeConfiguration<DocumentExtraction>
{
    public void Configure(EntityTypeBuilder<DocumentExtraction> b)
    {
        b.ToTable("document_extractions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
        b.Property(x => x.Language).HasMaxLength(8);
        b.HasIndex(x => new { x.TenantId, x.DocumentId });
        b.HasOne(x => x.Document).WithMany().HasForeignKey(x => x.DocumentId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class FileScanResultConfiguration : IEntityTypeConfiguration<FileScanResult>
{
    public void Configure(EntityTypeBuilder<FileScanResult> b)
    {
        b.ToTable("file_scan_results");
        b.HasKey(x => x.Id);
        b.Property(x => x.FileKey).HasMaxLength(500).IsRequired();
        b.Property(x => x.Scanner).HasMaxLength(40).IsRequired();
        b.Property(x => x.Verdict).HasMaxLength(40);
        b.Property(x => x.Signature).HasMaxLength(200);
        b.HasIndex(x => x.FileKey);
    }
}

public class WorkflowRuleConfiguration : IEntityTypeConfiguration<WorkflowRule>
{
    public void Configure(EntityTypeBuilder<WorkflowRule> b)
    {
        b.ToTable("workflow_rules");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.TriggerEvent).HasConversion<int>();
        b.HasIndex(x => new { x.TenantId, x.TriggerEvent, x.IsActive });
    }
}
public class WorkflowRuleActionConfiguration : IEntityTypeConfiguration<WorkflowRuleAction>
{
    public void Configure(EntityTypeBuilder<WorkflowRuleAction> b)
    {
        b.ToTable("workflow_rule_actions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Action).HasConversion<int>();
        b.Property(x => x.PayloadJson).IsRequired();
        b.HasOne(x => x.Rule).WithMany(r => r.Actions).HasForeignKey(x => x.RuleId).OnDelete(DeleteBehavior.Cascade);
    }
}
public class WorkflowExecutionConfiguration : IEntityTypeConfiguration<WorkflowExecution>
{
    public void Configure(EntityTypeBuilder<WorkflowExecution> b)
    {
        b.ToTable("workflow_executions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Event).HasConversion<int>();
        b.Property(x => x.EntityRef).HasMaxLength(80);
        b.Property(x => x.ResultSummary).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.ExecutedAt });
        b.HasOne(x => x.Rule).WithMany().HasForeignKey(x => x.RuleId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class MailboxConnectionConfiguration : IEntityTypeConfiguration<MailboxConnection>
{
    public void Configure(EntityTypeBuilder<MailboxConnection> b)
    {
        b.ToTable("mailbox_connections");
        b.HasKey(x => x.Id);
        b.Property(x => x.Provider).HasConversion<int>();
        b.Property(x => x.EmailAddress).HasMaxLength(256).IsRequired();
        b.Property(x => x.AccessTokenEncrypted).HasMaxLength(2000);
        b.Property(x => x.RefreshTokenEncrypted).HasMaxLength(2000);
        b.Property(x => x.ImapHost).HasMaxLength(200);
        b.Property(x => x.ImapUsername).HasMaxLength(200);
        b.Property(x => x.ImapPasswordEncrypted).HasMaxLength(500);
        b.Property(x => x.LastSyncStatus).HasMaxLength(80);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.UserId });
    }
}
public class InboundMailConfiguration : IEntityTypeConfiguration<InboundMail>
{
    public void Configure(EntityTypeBuilder<InboundMail> b)
    {
        b.ToTable("inbound_mails");
        b.HasKey(x => x.Id);
        b.Property(x => x.MessageId).HasMaxLength(200);
        b.Property(x => x.ThreadId).HasMaxLength(200);
        b.Property(x => x.FromAddress).HasMaxLength(256).IsRequired();
        b.Property(x => x.FromName).HasMaxLength(256);
        b.Property(x => x.Subject).HasMaxLength(400).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.MailboxConnectionId, x.ReceivedAt });
        b.HasOne(x => x.MailboxConnection).WithMany().HasForeignKey(x => x.MailboxConnectionId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.MatchedCustomer).WithMany().HasForeignKey(x => x.MatchedCustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class TelephonyConnectionConfiguration : IEntityTypeConfiguration<TelephonyConnection>
{
    public void Configure(EntityTypeBuilder<TelephonyConnection> b)
    {
        b.ToTable("telephony_connections");
        b.HasKey(x => x.Id);
        b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
        b.Property(x => x.AccountSidEncrypted).HasMaxLength(500);
        b.Property(x => x.AuthTokenEncrypted).HasMaxLength(500);
        b.Property(x => x.CallerIdNumber).HasMaxLength(40);
        b.Property(x => x.WebhookSecret).HasMaxLength(200);
    }
}
public class CallRecordConfiguration : IEntityTypeConfiguration<CallRecord>
{
    public void Configure(EntityTypeBuilder<CallRecord> b)
    {
        b.ToTable("call_records");
        b.HasKey(x => x.Id);
        b.Property(x => x.Direction).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.FromNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.ToNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.RecordingUrl).HasMaxLength(500);
        b.Property(x => x.ProviderCallId).HasMaxLength(80);
        b.HasIndex(x => new { x.TenantId, x.StartedAt });
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Transcript).WithMany().HasForeignKey(x => x.TranscriptId).OnDelete(DeleteBehavior.SetNull);
    }
}
public class TranscriptConfiguration : IEntityTypeConfiguration<Transcript>
{
    public void Configure(EntityTypeBuilder<Transcript> b)
    {
        b.ToTable("transcripts");
        b.HasKey(x => x.Id);
        b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
        b.Property(x => x.Language).HasMaxLength(8).IsRequired();
        b.Property(x => x.FullText).IsRequired();
    }
}

public class AiInvocationConfiguration : IEntityTypeConfiguration<AiInvocation>
{
    public void Configure(EntityTypeBuilder<AiInvocation> b)
    {
        b.ToTable("ai_invocations");
        b.HasKey(x => x.Id);
        b.Property(x => x.TaskType).HasConversion<int>();
        b.Property(x => x.Model).HasMaxLength(60).IsRequired();
        b.Property(x => x.PromptRedacted).HasMaxLength(4000);
        b.Property(x => x.ResponseRedacted).HasMaxLength(4000);
        b.Property(x => x.ErrorMessage).HasMaxLength(1000);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.CreatedAt });
    }
}
public class ChurnScoreConfiguration : IEntityTypeConfiguration<ChurnScore>
{
    public void Configure(EntityTypeBuilder<ChurnScore> b)
    {
        b.ToTable("churn_scores");
        b.HasKey(x => x.Id);
        b.Property(x => x.Band).HasMaxLength(20).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProducerHierarchyLinkConfiguration : IEntityTypeConfiguration<ProducerHierarchyLink>
{
    public void Configure(EntityTypeBuilder<ProducerHierarchyLink> b)
    {
        b.ToTable("producer_hierarchy_links");
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).HasMaxLength(20).IsRequired();
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.ParentProducer).WithMany().HasForeignKey(x => x.ParentProducerId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.ProducerId, x.ParentProducerId }).IsUnique();
    }
}

public class TenantSubscriptionConfiguration : IEntityTypeConfiguration<TenantSubscription>
{
    public void Configure(EntityTypeBuilder<TenantSubscription> b)
    {
        b.ToTable("tenant_subscriptions");
        b.HasKey(x => x.Id);
        b.Property(x => x.ProviderCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.ProviderSubscriptionId).HasMaxLength(120);
        b.Property(x => x.ProviderCustomerId).HasMaxLength(120);
        b.Property(x => x.Plan).HasMaxLength(20).IsRequired();
        b.Property(x => x.State).HasConversion<int>();
        b.Property(x => x.PaymentMethodLast4).HasMaxLength(8);
        b.Property(x => x.LastWebhookEventId).HasMaxLength(120);
        b.HasIndex(x => x.TenantId).IsUnique();
    }
}
public class SubscriptionUsageConfiguration : IEntityTypeConfiguration<SubscriptionUsage>
{
    public void Configure(EntityTypeBuilder<SubscriptionUsage> b)
    {
        b.ToTable("subscription_usage");
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.TenantId, x.Month }).IsUnique();
    }
}

public class ReportDefinitionConfiguration : IEntityTypeConfiguration<ReportDefinition>
{
    public void Configure(EntityTypeBuilder<ReportDefinition> b)
    {
        b.ToTable("report_definitions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Entity).HasConversion<int>();
        b.Property(x => x.Visibility).HasMaxLength(20).IsRequired();
        b.Property(x => x.ScheduleCron).HasMaxLength(80);
        b.Property(x => x.DeliveryEmails).HasMaxLength(1000);
        b.HasIndex(x => new { x.TenantId, x.Name });
        b.HasOne(x => x.OwnerUser).WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.SetNull);
    }
}
