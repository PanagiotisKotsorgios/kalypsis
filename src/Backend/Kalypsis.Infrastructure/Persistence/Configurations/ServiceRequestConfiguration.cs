using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kalypsis.Infrastructure.Persistence.Configurations;

public class ServiceRequestConfiguration : IEntityTypeConfiguration<ServiceRequest>
{
    public void Configure(EntityTypeBuilder<ServiceRequest> b)
    {
        b.ToTable("service_requests");
        b.HasKey(x => x.Id);
        b.Property(x => x.RequestNumber).HasMaxLength(32).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.RequestNumber }).IsUnique();
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Subject).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(4000).IsRequired();
        b.Property(x => x.IncidentLocation).HasMaxLength(300);
        b.Property(x => x.OtherPartyInfo).HasMaxLength(1000);
        b.Property(x => x.AgencyNotes).HasMaxLength(4000);

        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.RelatedPolicy).WithMany().HasForeignKey(x => x.RelatedPolicyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.AssignedToUser).WithMany().HasForeignKey(x => x.AssignedToUserId).OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(x => new { x.TenantId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
    }
}

public class ServiceRequestAttachmentConfiguration : IEntityTypeConfiguration<ServiceRequestAttachment>
{
    public void Configure(EntityTypeBuilder<ServiceRequestAttachment> b)
    {
        b.ToTable("service_request_attachments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Category).HasConversion<int>();
        b.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        b.Property(x => x.StoragePath).HasMaxLength(512).IsRequired();
        b.Property(x => x.MimeType).HasMaxLength(128).IsRequired();

        b.HasOne(x => x.ServiceRequest)
            .WithMany(s => s.Attachments)
            .HasForeignKey(x => x.ServiceRequestId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.UploadedByUser).WithMany().HasForeignKey(x => x.UploadedByUserId).OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(x => x.ServiceRequestId);
    }
}
