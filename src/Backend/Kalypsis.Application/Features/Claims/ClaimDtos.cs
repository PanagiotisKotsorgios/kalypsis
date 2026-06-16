using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Claims;

public record ClaimDto(
    Guid Id,
    string ClaimNumber,
    Guid PolicyId,
    string PolicyNumber,
    Guid CustomerId,
    string CustomerDisplay,
    PolicyType PolicyType,
    string InsuranceCompanyName,
    DateOnly IncidentDate,
    DateOnly ReportedDate,
    ClaimStatus Status,
    decimal? ClaimedAmount,
    decimal? ApprovedAmount,
    string? Description,
    DateTime CreatedAt);

public record CreateClaimBody(
    Guid PolicyId,
    DateOnly IncidentDate,
    DateOnly? ReportedDate,
    decimal? ClaimedAmount,
    string? Description);

public record UpdateClaimBody(
    DateOnly IncidentDate,
    DateOnly ReportedDate,
    decimal? ClaimedAmount,
    decimal? ApprovedAmount,
    string? Description);

public record UpdateClaimStatusBody(ClaimStatus Status, decimal? ApprovedAmount);
