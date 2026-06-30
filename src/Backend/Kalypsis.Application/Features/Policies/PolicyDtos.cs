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
    DateTime CreatedAt);

public record CreatePolicyBody(
    Guid CustomerId,
    Guid InsuranceCompanyId,
    Guid? ProducerId,
    PolicyType PolicyType,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium,
    string Currency = "EUR",
    PolicyStatus Status = PolicyStatus.Active,
    VehicleUseCategory? VehicleUseCategory = null,
    string? CoverCode = null,
    string? PackageCode = null);

public record UpdatePolicyBody(
    Guid InsuranceCompanyId,
    Guid? ProducerId,
    PolicyType PolicyType,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium,
    string Currency,
    PolicyStatus Status,
    VehicleUseCategory? VehicleUseCategory = null,
    string? CoverCode = null,
    string? PackageCode = null);

public record RenewPolicyBody(
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium);

public record CancelPolicyBody(string? Reason);

public record InsuranceCompanyDto(
    Guid Id, string Name, string Code, string? Country, bool IsActive,
    bool IsBroker = false,
    Guid? ParentCompanyId = null);
