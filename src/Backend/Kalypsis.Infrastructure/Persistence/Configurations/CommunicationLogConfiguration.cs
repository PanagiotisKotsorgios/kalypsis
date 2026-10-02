using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class CommunicationLogConfiguration : IEntityTypeConfiguration<CommunicationLog>
{
    public void Configure(EntityTypeBuilder<CommunicationLog> b)
    {
        b.ToTable("communication_logs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.Direction).HasConversion<int>();
        b.Property(x => x.Outcome).HasConversion<int>();
        b.Property(x => x.Subject).HasMaxLength(200).IsRequired();
        b.Property(x => x.Body).HasMaxLength(4000);
        b.Property(x => x.RelatedPolicyNumber).HasMaxLength(64);
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.OccurredAt });
        b.HasOne(x => x.Customer).WithMany(c => c.Communications)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.RelatedPolicy).WithMany()
            .HasForeignKey(x => x.RelatedPolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class CrmGroupConfiguration : IEntityTypeConfiguration<CrmGroup>
{
    public void Configure(EntityTypeBuilder<CrmGroup> b)
    {
        b.ToTable("crm_groups");
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.TenantId, x.EntityType, x.Name }).IsUnique();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.EntityType).HasMaxLength(20).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.FilterJson).HasColumnType("longtext");
        b.HasMany(x => x.Members).WithOne(x => x.Group).HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CrmGroupMemberConfiguration : IEntityTypeConfiguration<CrmGroupMember>
{
    public void Configure(EntityTypeBuilder<CrmGroupMember> b)
    {
        b.ToTable("crm_group_members");
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.TenantId, x.GroupId, x.EntityType, x.EntityId }).IsUnique();
        b.Property(x => x.EntityType).HasMaxLength(20).IsRequired();
    }
}

public sealed class ProducerCommunicationLogConfiguration : IEntityTypeConfiguration<ProducerCommunicationLog>
{
    public void Configure(EntityTypeBuilder<ProducerCommunicationLog> b)
    {
        b.ToTable("producer_communication_logs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.Direction).HasConversion<int>();
        b.Property(x => x.Outcome).HasConversion<int>();
        b.Property(x => x.Subject).HasMaxLength(200).IsRequired();
        b.Property(x => x.Body).HasMaxLength(4000);
        b.HasIndex(x => new { x.TenantId, x.ProducerId, x.OccurredAt });
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class CrmOpportunityConfiguration : IEntityTypeConfiguration<CrmOpportunity>
{
    public void Configure(EntityTypeBuilder<CrmOpportunity> b)
    {
        b.ToTable("crm_opportunities");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(240).IsRequired();
        b.Property(x => x.Stage).HasMaxLength(32).IsRequired();
        b.Property(x => x.Product).HasMaxLength(160);
        b.Property(x => x.Carrier).HasMaxLength(160);
        b.Property(x => x.EstimatedValue).HasPrecision(18, 2);
        b.Property(x => x.LostReason).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasIndex(x => new { x.TenantId, x.Stage, x.NextActionAt });
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Producer).WithMany().HasForeignKey(x => x.ProducerId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.AssignedToUser).WithMany().HasForeignKey(x => x.AssignedToUserId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class MarketingDeliveryLogConfiguration : IEntityTypeConfiguration<MarketingDeliveryLog>
{
    public void Configure(EntityTypeBuilder<MarketingDeliveryLog> b)
    {
        b.ToTable("marketing_delivery_logs");
        b.HasKey(x => x.Id);
        b.Property(x => x.CampaignName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Channel).HasMaxLength(20).IsRequired();
        b.Property(x => x.Provider).HasMaxLength(80).IsRequired();
        b.Property(x => x.Status).HasMaxLength(40).IsRequired();
        b.Property(x => x.RecipientName).HasMaxLength(240);
        b.Property(x => x.Recipient).HasMaxLength(320).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(300);
        b.Property(x => x.BodyHtml).HasColumnType("longtext");
        b.Property(x => x.BodyText).HasColumnType("longtext");
        b.Property(x => x.ProviderMessageId).HasMaxLength(200);
        b.Property(x => x.ErrorMessage).HasMaxLength(2000);
        b.HasIndex(x => new { x.TenantId, x.SentAt });
        b.HasIndex(x => new { x.TenantId, x.CampaignId, x.Status });
        b.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}
