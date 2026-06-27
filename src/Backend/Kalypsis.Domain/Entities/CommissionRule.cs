using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class CommissionRule : TenantEntity
{
    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    /// <summary>
    /// When ProducerId is null but ProducerTier is set, the rule applies to
    /// every producer in that tier. The lookup picks per-producer rules first,
    /// then per-tier, then global.
    /// </summary>
    public ProducerTier? ProducerTier { get; set; }

    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    public PolicyType? PolicyType { get; set; }

    /// <summary>
    /// Optional coverage code, aligned with DefaultValueRule.CoverCode and carrier
    /// parametric files. Null means any coverage under the selected scope.
    /// </summary>
    public string? CoverCode { get; set; }

    /// <summary>
    /// Optional further scope-narrowing for motor policies — e.g. an ΕΙΧ rule
    /// can pay a different producer percentage than a ΦΔΧ rule under the same
    /// (carrier × policyType) pair. Null = any use category.
    /// </summary>
    public VehicleUseCategory? VehicleUseCategory { get; set; }

    public CommissionType CommissionType { get; set; }
    /// <summary>Legacy single-value column. Kept for backwards compatibility;
    /// new rules should populate <see cref="AgencyPercent"/> and
    /// <see cref="ProducerPercent"/> instead.</summary>
    public decimal Value { get; set; }

    /// <summary>Percentage retained by the agency. When set, takes precedence
    /// over <see cref="Value"/> during commission calculation.</summary>
    public decimal? AgencyPercent { get; set; }
    /// <summary>Percentage paid through to the producer.</summary>
    public decimal? ProducerPercent { get; set; }

    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

public class CommissionTransaction : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";

    public CommissionTransactionStatus Status { get; set; } = CommissionTransactionStatus.Pending;

    public DateOnly TransactionDate { get; set; }
    public DateOnly? SettledDate { get; set; }
}
