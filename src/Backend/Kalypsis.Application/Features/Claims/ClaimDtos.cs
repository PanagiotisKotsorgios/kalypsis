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
    DateTime CreatedAt,
    // Enriched from the linked Policy so the claims filter row can scope
    // by carrier / sub / use / cover / package without an extra fetch.
    Guid? InsuranceCompanyId = null,
    VehicleUseCategory? VehicleUseCategory = null,
    string? CoverCode = null,
    string? PackageCode = null,
    // Greek insurance / ΥΣΑΕ fields. Kept optional for compatibility with
    // legacy clients while exposing the complete claim profile to the UI.
    bool AffectsBonusMalus = true,
    string? UsaeCode = null,
    string? UsaeKind = null,
    string UsaeStatus = "NotSent",
    decimal? LiabilityPercent = null,
    bool IsInternalDamage = false,
    DateTime? UsaeSentAt = null,
    string? UsaeReceiptCode = null,
    bool IsFriendlySettlement = false,
    string Kind = "VehicleDamage",
    decimal? SettledAmount = null,
    string Currency = "EUR",
    DateTime? UpdatedAt = null);

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
    string? Description,
    string? ClaimNumber = null,
    ClaimStatus? Status = null,
    string? Kind = null,
    decimal? SettledAmount = null,
    string? Currency = null,
    bool? AffectsBonusMalus = null,
    string? UsaeCode = null,
    string? UsaeKind = null,
    string? UsaeStatus = null,
    decimal? LiabilityPercent = null,
    bool? IsInternalDamage = null,
    DateTime? UsaeSentAt = null,
    string? UsaeReceiptCode = null,
    bool? IsFriendlySettlement = null,
    bool ReplaceAdditional = false);

public record UpdateClaimStatusBody(ClaimStatus Status, decimal? ApprovedAmount);
