using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class ServiceRequest : TenantEntity
{
    public string RequestNumber { get; set; } = string.Empty;

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public ServiceRequestType Type { get; set; }
    public ServiceRequestStatus Status { get; set; } = ServiceRequestStatus.Submitted;

    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    public Guid? RelatedPolicyId { get; set; }
    public Policy? RelatedPolicy { get; set; }

    public DateOnly? IncidentDate { get; set; }
    public string? IncidentLocation { get; set; }
    public string? OtherPartyInfo { get; set; }

    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }

    public string? AgencyNotes { get; set; }
    public DateTime? ResolvedAt { get; set; }

    public ICollection<ServiceRequestAttachment> Attachments { get; set; } = new List<ServiceRequestAttachment>();
}

public class ServiceRequestAttachment : TenantEntity
{
    public Guid ServiceRequestId { get; set; }
    public ServiceRequest ServiceRequest { get; set; } = null!;

    public AttachmentCategory Category { get; set; } = AttachmentCategory.Other;
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }

    public Guid? UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }
}
