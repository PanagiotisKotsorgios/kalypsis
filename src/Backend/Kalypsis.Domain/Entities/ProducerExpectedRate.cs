using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Producer-side «παραμετροποίηση προμηθειών»: the rate a producer thinks they
/// should be getting for a given (company × policy type × vehicle use) tuple.
/// Mirrors <see cref="CommissionRule"/> on the agency side and is what the
/// producer-facing reconciliation view compares against — «i said 10%, my
/// γραφείο said 8%, that's why the numbers don't match».
///
/// Kept intentionally lightweight (no CoverCode, no min/max floors) because
/// producers negotiate agreements at company/package level, not per-cover.
/// </summary>
public class ProducerExpectedRate : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer? Producer { get; set; }

    /// <summary>Null = «any company».</summary>
    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    /// <summary>Null = «any package».</summary>
    public PolicyType? PolicyType { get; set; }

    /// <summary>Null = «any vehicle use», mostly relevant for auto packages.</summary>
    public VehicleUseCategory? VehicleUseCategory { get; set; }

    /// <summary>Rate the producer expects, 0-100.</summary>
    public decimal ExpectedPercent { get; set; }

    public string? Notes { get; set; }
}
