using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Requests;

public record ServiceRequestAttachmentDto(
    Guid Id,
    AttachmentCategory Category,
    string FileName,
    string MimeType,
    long SizeBytes,
    DateTime CreatedAt);

public record ServiceRequestMessageDto(
    Guid Id,
    string AuthorRole,
    string Body,
    DateTime CreatedAt);

public record ServiceRequestDto(
    Guid Id,
    string RequestNumber,
    Guid CustomerId,
    string CustomerDisplay,
    ServiceRequestType Type,
    ServiceRequestStatus Status,
    string Subject,
    string Description,
    Guid? RelatedPolicyId,
    DateOnly? IncidentDate,
    string? IncidentLocation,
    string? OtherPartyInfo,
    string? AgencyNotes,
    DateTime CreatedAt,
    DateTime? ResolvedAt,
    bool IsRead,
    DateTime? ReadAt,
    DateTime? ArchivedAt,
    IReadOnlyList<ServiceRequestAttachmentDto> Attachments,
    IReadOnlyList<ServiceRequestMessageDto> Messages);

public record CreateServiceRequestBody(
    ServiceRequestType Type,
    string Subject,
    string Description,
    Guid? RelatedPolicyId,
    DateOnly? IncidentDate,
    string? IncidentLocation,
    string? OtherPartyInfo,
    Guid? CustomerId);

public record UpdateServiceRequestStatusBody(
    ServiceRequestStatus Status,
    string? AgencyNotes,
    Guid? AssignedToUserId);

public record ReplyToServiceRequestBody(string Message, ServiceRequestStatus? Status = null);
