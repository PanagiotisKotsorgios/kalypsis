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

    /// <summary>
    /// Optional per-hierarchy-level percentages, as a JSON map like
    ///   {"Producer":12,"Manager":3,"Unit":2,"Assistant":1,"Agency":40}
    /// When populated, the calculator materialises a PolicyCommissionSplit
    /// row per level whose producer node exists in the chain. When null we
    /// fall back to the two-level <see cref="AgencyPercent"/> /
    /// <see cref="ProducerPercent"/> split so existing tenants stay working
    /// without touching a single rule. Kept as JSON so we can add new levels
    /// later without a schema change.
    /// </summary>
    public string? LevelPercentsJson { get; set; }

    /// <summary>
    /// Override the tenant-level <c>DefaultTaxWithholdingPercent</c> for this
    /// specific rule scope. Useful when a specific carrier or branch has
    /// a different παρακράτηση φόρου rate. Null = use tenant default.
    /// </summary>
    public decimal? TaxWithholdingPercent { get; set; }

    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }

    /// <summary>
    /// Which side supplies the per-cover % when both a bridge value and this
    /// rule are available. Default <see cref="CommissionRateSource.Parametrization"/>
    /// so existing rows keep their current behaviour (rule always wins).
    /// See <see cref="CommissionRateSource"/> for the full trade-off.
    /// </summary>
    public CommissionRateSource RateSource { get; set; } = CommissionRateSource.Parametrization;
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
