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

    /// <summary>
    /// Simple producer/office split — the % of <see cref="GrossAmount"/> the
    /// producer keeps. Office (έδρα) gets the rest (100 - this). No auto-
    /// lookup against rules yet; the operator keys the % per line. Default
    /// 100 means everything goes to the producer.
    /// </summary>
    public decimal ProducerSharePercent { get; set; } = 100m;

    public Guid? EnteredByUserId { get; set; }

    /// <summary>
    /// Optional custom period start when the carrier's πινάκιο covers a
    /// span other than one whole calendar month (e.g. bi-monthly, ad-hoc
    /// campaigns). If null, Year+Month are the only period signal.
    /// </summary>
    public DateTime? PeriodFrom { get; set; }
    public DateTime? PeriodTo   { get; set; }

    // ── Underlying premiums that generated this over-commission bonus.
    //    ERGO's monthly πινάκιο ships four numeric columns per producer
    //    (ΜΙΚΤΑ ασφάλιστρα / ΚΑΘΑΡΑ ασφάλιστρα / ΠΡΟΜ.ΣΥΝΕΡΓΑΤΗ /
    //    ΥΠΕΡΠΡΟΜΗΘΕΙΑ). GrossAmount above stores the ΥΠΕΡΠΡΟΜΗΘΕΙΑ (the
    //    bonus to the office) but the operator also wants the raw context
    //    for reporting: how much premium the producer's book actually
    //    generated to earn that bonus. All optional — set only when the
    //    source system (ERGO importer today, other bridges later) supplies
    //    them.
    /// <summary>ΜΙΚΤΑ ΑΣΦΑΛΙΣΤΡΑ of the underlying policies that generated the bonus.</summary>
    public decimal? BasePremiumsGross { get; set; }
    /// <summary>ΚΑΘΑΡΑ ΑΣΦΑΛΙΣΤΡΑ of the underlying policies (net of tax/deductions).</summary>
    public decimal? BasePremiumsNet   { get; set; }
    /// <summary>ΠΡΟΜ. ΣΥΝΕΡΓΑΤΗ — the producer's own commission on the base premiums,
    /// paid to them separately from the over-commission bonus.</summary>
    public decimal? ProducerDirectCommission { get; set; }
}
