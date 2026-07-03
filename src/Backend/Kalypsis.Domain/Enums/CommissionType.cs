namespace Kalypsis.Domain.Enums;

public enum CommissionType
{
    Percentage = 1,
    FixedAmount = 2
}

public enum CommissionTransactionStatus
{
    Pending = 1,
    Approved = 2,
    Paid = 3,
    Cancelled = 4
}

/// <summary>
/// Which side supplies the per-cover commission rate when both a bridge value
/// and a CommissionRule value are available for the same policy cover:
///
///   • Parametrization — the CommissionRule always wins. The bridge % that
///     the carrier's file mentioned for each cover is stored but ignored for
///     accounting. Use when the office negotiated its own rates independently
///     of what appears on the carrier's monthly file.
///
///   • Bridge — the carrier's per-cover % from the file wins; the rule only
///     kicks in as a fallback when the cover has no bridge %. Use when the
///     office wants to inherit whatever the bridge reports.
///
/// Applies at the rule-scope level (per producer × carrier × PolicyType).
/// </summary>
public enum CommissionRateSource
{
    Parametrization = 1,
    Bridge = 2
}
