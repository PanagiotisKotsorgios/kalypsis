using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Policies;

public record PolicyDto(
    Guid Id,
    string PolicyNumber,
    Guid CustomerId,
    string CustomerDisplay,
    Guid InsuranceCompanyId,
    string InsuranceCompanyName,
    Guid? ProducerId,
    string? ProducerName,
    PolicyType PolicyType,
    PolicyStatus Status,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium,
    string Currency,
    DateTime CreatedAt,
    // ALIS-parity fields (nullable — safe to omit)
    string? ApplicationNumber = null,
    Guid? ContractPartyCustomerId = null,
    string? ContractPartyDisplay = null,
    Guid? PreviousInsuranceCompanyId = null,
    string? PreviousInsuranceCompanyName = null,
    DateOnly? IssuedAt = null,
    string? VehicleRegistrationPlate = null);

public record CreatePolicyBody(
    Guid CustomerId,
    Guid InsuranceCompanyId,
    Guid? ProducerId,
    // Accepts the strict PolicyType enum name ("Auto", "Home", …) OR a
    // Παραμετρικά code the office invented (e.g. LANCA's «ΑΥΤΟ»). Handler
    // parses: enum-match → Policy.PolicyType; non-match → PolicyType.Other
    // + Policy.CarrierBranchCode.
    string PolicyType,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium,
    string Currency = "EUR",
    PolicyStatus Status = PolicyStatus.Active,
    // Same split contract for VehicleUseCategory (enum vs Παραμετρικά code).
    string? VehicleUseCategory = null,
    string? CoverCode = null,
    string? PackageCode = null,
    // ALIS-parity fields
    string? ApplicationNumber = null,
    Guid? ContractPartyCustomerId = null,
    Guid? PreviousInsuranceCompanyId = null,
    DateOnly? IssuedAt = null,
    string? VehicleRegistrationPlate = null);

public record UpdatePolicyBody(
    Guid InsuranceCompanyId,
    Guid? ProducerId,
    string PolicyType,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium,
    string Currency,
    PolicyStatus Status,
    string? VehicleUseCategory = null,
    string? CoverCode = null,
    string? PackageCode = null,
    // ALIS-parity fields
    string? ApplicationNumber = null,
    Guid? ContractPartyCustomerId = null,
    Guid? PreviousInsuranceCompanyId = null,
    DateOnly? IssuedAt = null,
    string? VehicleRegistrationPlate = null);

public record RenewPolicyBody(
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium,
    // Optional overrides for the new policy — leaving any of these null
    // keeps the source policy's value. Covers common renewal-time edits
    // so the operator doesn't have to open the policy in edit mode after
    // renewal to tweak coverages, producer, or the commission override.
    Guid? ProducerId = null,
    // Accepts either the strict VehicleUseCategory enum name ("EIX", "FIX", …)
    // or a free-form Παραμετρικά code (e.g. «Ε.Ι.Χ.ΜΟΤ»). Handler parses:
    // enum-match → Policy.VehicleUseCategory; non-match → Policy.CarrierUseCode.
    string? VehicleUseCategory = null,
    string? CoverCode = null,
    string? PackageCode = null,
    string? ApplicationNumber = null,
    string? VehicleRegistrationPlate = null,
    decimal? SpecialCommissionPercent = null);

public record CancelPolicyBody(string? Reason);

public record InsuranceCompanyDto(
    Guid Id, string Name, string Code, string? Country, bool IsActive,
    bool IsBroker = false,
    Guid? ParentCompanyId = null);
