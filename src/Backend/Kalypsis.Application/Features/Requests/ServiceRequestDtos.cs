using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Requests;

public record ServiceRequestAttachmentDto(
    Guid Id,
    AttachmentCategory Category,
    string FileName,
    string MimeType,
    long SizeBytes,
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
    IReadOnlyList<ServiceRequestAttachmentDto> Attachments);

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
