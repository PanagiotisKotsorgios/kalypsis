using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// One row per (tenant, insurance company, producer, year, month) capturing
/// the total over-commission the carrier paid the producer for that month.
/// Distinct from <c>OverCommissionRule</c> which is the % configuration —
/// this table stores actuals, either entered manually from the carrier's
/// «ΠΙΝΑΚΙΟ ΥΠΕΡΠΡΟΜΗΘΕΙΩΝ» statement or (later) imported from the xlsx feed.
///
/// A unique constraint on (tenant, carrier, producer, year, month) means the
/// upsert-by-natural-key path in the handler works idempotently — re-importing
/// the same monthly statement won't create duplicates.
/// </summary>
public class OverCommissionStatement : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    public Guid ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public int Year { get; set; }
    public int Month { get; set; }

    /// <summary>Total gross amount paid to the producer for this month.</summary>
    public decimal GrossAmount { get; set; }

    /// <summary>Net after withholdings if the carrier discloses it; otherwise = gross.</summary>
    public decimal NetAmount { get; set; }

    public string Currency { get; set; } = "EUR";

    /// <summary>Optional statement reference (e.g. carrier statement number).</summary>
    public string? Reference { get; set; }

    /// <summary>Free-text note (e.g. "Manual entry from πινάκιο 4/2026").</summary>
    public string? Notes { get; set; }

    /// <summary>When the amount was actually paid to the producer's account. Null = pending.</summary>
    public DateTime? PaidOn { get; set; }

    public Guid? EnteredByUserId { get; set; }
}
