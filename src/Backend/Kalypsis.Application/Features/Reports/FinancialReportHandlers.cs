using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reports;

// ==== Καταμερισμός Προμηθειών (Commission Distribution) =====================
//
// "Ποιος πήρε τι από κάθε συμβόλαιο, σε ποιο επίπεδο ιεραρχίας." Aggregates
// PolicyCommissionSplits over a period, one row per (producer × level). The
// operator uses this to answer "πόσα βγήκαν στον Χ φέτος" without opening
// individual policy cards.
public record CommissionDistributionRow(
    string Key,
    string ProducerName,
    string Level,        // "Παραγωγός" / "Προϊστάμενος ομάδας" / ...
    int PolicyCount,
    decimal Gross,
    decimal TaxWithholding,
    decimal Net);

public record CommissionDistributionDto(
    IReadOnlyList<CommissionDistributionRow> Rows,
    CommissionDistributionRow Totals,
    DateOnly From,
    DateOnly To);

public record GetCommissionDistributionQuery(
    DateOnly? From, DateOnly? To,
    Guid? ProducerId,
    Guid? CarrierId,
    string? Level          // "Producer" / "Manager" / "Unit" / "Assistant" / "Agency" / null = all
) : IRequest<CommissionDistributionDto>;

public class GetCommissionDistributionQueryHandler
    : IRequestHandler<GetCommissionDistributionQuery, CommissionDistributionDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public GetCommissionDistributionQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    // Keep in sync with HIERARCHY_LABEL on the frontend so the CSV export and
    // on-screen chip say the same thing. Duplicated intentionally rather than
    // introducing a shared string catalogue for one enum.
    private static string LabelFor(HierarchyLevel lvl) => lvl switch
    {
        HierarchyLevel.Producer  => "Παραγωγός",
        HierarchyLevel.Manager   => "Προϊστάμενος ομάδας",
        HierarchyLevel.Unit      => "Υπεύθυνος μονάδας",
        HierarchyLevel.Assistant => "Βοηθός διοίκησης",
        HierarchyLevel.Agency    => "Γραφείο",
        _ => lvl.ToString(),
    };

    public async Task<CommissionDistributionDto> Handle(GetCommissionDistributionQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var today = DateOnly.FromDateTime(_clock.UtcNow.Date);
        var from = request.From ?? new DateOnly(today.Year, 1, 1);
        var to = request.To ?? new DateOnly(today.Year, 12, 31);

        // Anchor on the policy's StartDate so «what was earned in 2026»
        // matches the production report's totals for the same window —
        // otherwise the two reports never tie out and the operator loses
        // trust in both.
        var policies = _db.Policies.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.Status != PolicyStatus.Draft && p.Status != PolicyStatus.Cancelled
                && p.StartDate >= from && p.StartDate <= to);
        if (request.CarrierId is Guid cid)
            policies = policies.Where(p => p.InsuranceCompanyId == cid);
        var policyIds = await policies.Select(p => p.Id).ToListAsync(ct);

        if (policyIds.Count == 0)
        {
            var empty = new CommissionDistributionRow("", "", "", 0, 0m, 0m, 0m);
            return new CommissionDistributionDto(Array.Empty<CommissionDistributionRow>(), empty, from, to);
        }

        var splitsQ = _db.PolicyCommissionSplits.IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null && policyIds.Contains(s.PolicyId));
        if (request.ProducerId is Guid pid)
            splitsQ = splitsQ.Where(s => s.ProducerId == pid);
        if (!string.IsNullOrEmpty(request.Level) && Enum.TryParse<HierarchyLevel>(request.Level, true, out var lvl))
            splitsQ = splitsQ.Where(s => s.HierarchyLevel == lvl);

        var raw = await splitsQ
            .Select(s => new {
                s.PolicyId, s.ProducerId, s.HierarchyLevel,
                s.GrossAmount, s.TaxWithholdingAmount, s.NetAmount
            })
            .ToListAsync(ct);

        var producerNames = await _db.Producers.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .ToDictionaryAsync(p => p.Id, p => p.Name, ct);

        var rows = raw
            .GroupBy(x => (x.ProducerId, x.HierarchyLevel))
            .Select(g => {
                var name = g.Key.ProducerId is Guid gid && producerNames.TryGetValue(gid, out var pn)
                    ? pn
                    : g.Key.HierarchyLevel == HierarchyLevel.Agency ? "Γραφείο (χωρίς ονομαστική ανάθεση)" : "—";
                return new CommissionDistributionRow(
                    Key: $"{g.Key.ProducerId?.ToString() ?? "-"}|{g.Key.HierarchyLevel}",
                    ProducerName: name,
                    Level: LabelFor(g.Key.HierarchyLevel),
                    PolicyCount: g.Select(x => x.PolicyId).Distinct().Count(),
                    Gross: g.Sum(x => x.GrossAmount),
                    TaxWithholding: g.Sum(x => x.TaxWithholdingAmount),
                    Net: g.Sum(x => x.NetAmount));
            })
            .OrderByDescending(r => r.Gross)
            .ToList();

        var totals = new CommissionDistributionRow(
            Key: "TOTAL",
            ProducerName: "Σύνολο",
            Level: "",
            PolicyCount: raw.Select(x => x.PolicyId).Distinct().Count(),
            Gross: rows.Sum(r => r.Gross),
            TaxWithholding: rows.Sum(r => r.TaxWithholding),
            Net: rows.Sum(r => r.Net));

        return new CommissionDistributionDto(rows, totals, from, to);
    }
}

// ==== Ετήσια Οικονομικά (Financial Snapshot) =================================
//
// "Πού πήγε το ταμείο." Aggregates FinancialMovement + Receipts + Payments
// per month so the operator sees cash-in vs cash-out at a glance.
public record FinancialMonthRow(
    string Month,                 // "yyyy-MM"
    decimal ReceiptsIn,           // εισπράξεις πελατών
    decimal PaymentsToCarriers,   // πληρωμές σε ασφαλιστικές
    decimal PaymentsToProducers,  // πληρωμές σε συνεργάτες
    decimal CommissionsEarned,    // αναγνωρισμένη προμήθεια γραφείου
    decimal NetCash);             // εισπράξεις - πληρωμές

public record FinancialReportDto(
    IReadOnlyList<FinancialMonthRow> Months,
    FinancialMonthRow Totals,
    decimal OpenCustomerReceivables,
    decimal OpenCarrierPayables,
    DateOnly From,
    DateOnly To);

public record GetFinancialReportQuery(DateOnly? From, DateOnly? To) : IRequest<FinancialReportDto>;

public class GetFinancialReportQueryHandler
    : IRequestHandler<GetFinancialReportQuery, FinancialReportDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public GetFinancialReportQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<FinancialReportDto> Handle(GetFinancialReportQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var today = DateOnly.FromDateTime(_clock.UtcNow.Date);
        var from = request.From ?? new DateOnly(today.Year, 1, 1);
        var to = request.To ?? new DateOnly(today.Year, 12, 31);

        var receipts = await _db.Receipts.IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null
                && r.ReceivedOn >= from && r.ReceivedOn <= to)
            .Select(r => new { r.ReceivedOn, r.Amount })
            .ToListAsync(ct);

        var payments = await _db.Payments.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.PaidOn >= from && p.PaidOn <= to)
            .Select(p => new { p.PaidOn, p.Amount, p.BeneficiaryType })
            .ToListAsync(ct);

        // CommissionEarned movements — the recognised revenue for the office,
        // as opposed to what has actually been paid by the carrier yet.
        var earned = await _db.FinancialMovements.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.DeletedAt == null
                && m.Kind == FinancialMovementKind.CommissionEarned
                && m.MovementDate >= from && m.MovementDate <= to)
            .Select(m => new { m.MovementDate, m.Amount })
            .ToListAsync(ct);

        // Materialise the month buckets so months with zero activity still
        // show up in the chart — otherwise February gaps make YoY analysis
        // read wrong.
        var months = new List<FinancialMonthRow>();
        var cursor = new DateOnly(from.Year, from.Month, 1);
        var end = new DateOnly(to.Year, to.Month, 1);
        while (cursor <= end)
        {
            var next = cursor.AddMonths(1);
            var mReceipts   = receipts.Where(r => r.ReceivedOn >= cursor && r.ReceivedOn < next).Sum(x => x.Amount);
            var mToCarriers = payments.Where(p => p.PaidOn >= cursor && p.PaidOn < next
                                                && p.BeneficiaryType == BeneficiaryType.InsuranceCompany).Sum(x => x.Amount);
            var mToProducers= payments.Where(p => p.PaidOn >= cursor && p.PaidOn < next
                                                && p.BeneficiaryType == BeneficiaryType.Producer).Sum(x => x.Amount);
            var mEarned     = earned.Where(e => e.MovementDate >= cursor && e.MovementDate < next).Sum(x => x.Amount);
            months.Add(new FinancialMonthRow(
                Month: cursor.ToString("yyyy-MM"),
                ReceiptsIn: mReceipts,
                PaymentsToCarriers: mToCarriers,
                PaymentsToProducers: mToProducers,
                CommissionsEarned: mEarned,
                NetCash: mReceipts - mToCarriers - mToProducers));
            cursor = next;
        }

        var totals = new FinancialMonthRow(
            Month: "TOTAL",
            ReceiptsIn: months.Sum(m => m.ReceiptsIn),
            PaymentsToCarriers: months.Sum(m => m.PaymentsToCarriers),
            PaymentsToProducers: months.Sum(m => m.PaymentsToProducers),
            CommissionsEarned: months.Sum(m => m.CommissionsEarned),
            NetCash: months.Sum(m => m.NetCash));

        // Snapshot balances — CustomerCharge minus CustomerCredit gives the
        // open receivable, CompanyCharge minus CompanyCredit the open payable.
        // Movements outside the period are excluded so the number matches
        // "how much do our customers owe us that fell inside 2026".
        var custCharges = await _db.FinancialMovements.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.DeletedAt == null
                && m.MovementDate >= from && m.MovementDate <= to
                && m.Kind == FinancialMovementKind.CustomerCharge)
            .SumAsync(m => (decimal?)m.Amount, ct) ?? 0m;
        var custCredits = await _db.FinancialMovements.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.DeletedAt == null
                && m.MovementDate >= from && m.MovementDate <= to
                && m.Kind == FinancialMovementKind.CustomerCredit)
            .SumAsync(m => (decimal?)m.Amount, ct) ?? 0m;
        var compCharges = await _db.FinancialMovements.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.DeletedAt == null
                && m.MovementDate >= from && m.MovementDate <= to
                && m.Kind == FinancialMovementKind.CompanyCharge)
            .SumAsync(m => (decimal?)m.Amount, ct) ?? 0m;
        var compCredits = await _db.FinancialMovements.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.DeletedAt == null
                && m.MovementDate >= from && m.MovementDate <= to
                && m.Kind == FinancialMovementKind.CompanyCredit)
            .SumAsync(m => (decimal?)m.Amount, ct) ?? 0m;

        return new FinancialReportDto(
            months, totals,
            OpenCustomerReceivables: custCharges - custCredits,
            OpenCarrierPayables: compCharges - compCredits,
            from, to);
    }
}

// ==== Εκκαθαριστικό Συνεργάτη (Producer Statement) ============================
//
// Per-policy detail of what a specific producer earned, plus the aggregate
// totals and — separately — what has actually been paid out to them. Used
// for the "εκκαθαριστικό συνεργάτη" print-out at the end of each period.
public record ProducerStatementLine(
    Guid PolicyId,
    string PolicyNumber,
    string CustomerName,
    string CarrierName,
    DateOnly StartDate,
    decimal Premium,
    string Level,
    decimal Percent,
    decimal Gross,
    decimal TaxWithholding,
    decimal Net);

public record ProducerStatementDto(
    Guid ProducerId,
    string ProducerName,
    DateOnly From,
    DateOnly To,
    IReadOnlyList<ProducerStatementLine> Lines,
    decimal GrossTotal,
    decimal TaxWithholdingTotal,
    decimal NetTotal,
    decimal AmountPaid,
    decimal AmountOutstanding);

public record GetProducerStatementQuery(Guid ProducerId, DateOnly? From, DateOnly? To)
    : IRequest<ProducerStatementDto>;

public class GetProducerStatementQueryHandler
    : IRequestHandler<GetProducerStatementQuery, ProducerStatementDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public GetProducerStatementQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    private static string LabelFor(HierarchyLevel lvl) => lvl switch
    {
        HierarchyLevel.Producer  => "Παραγωγός",
        HierarchyLevel.Manager   => "Προϊστάμενος ομάδας",
        HierarchyLevel.Unit      => "Υπεύθυνος μονάδας",
        HierarchyLevel.Assistant => "Βοηθός διοίκησης",
        HierarchyLevel.Agency    => "Γραφείο",
        _ => lvl.ToString(),
    };

    public async Task<ProducerStatementDto> Handle(GetProducerStatementQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var today = DateOnly.FromDateTime(_clock.UtcNow.Date);
        var from = request.From ?? new DateOnly(today.Year, 1, 1);
        var to = request.To ?? new DateOnly(today.Year, 12, 31);

        var producer = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == request.ProducerId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης");

        // The splits engine writes one row per policy × level the producer
        // shows up in — so a Manager who is *also* a fallback Producer on a
        // policy correctly earns for both slots. We join Policy for the
        // display columns rather than embed them in the split to keep the
        // ledger normalised.
        // Written as a method-chain rather than query syntax because `from`
        // is both my local variable and a LINQ query keyword — the parser
        // reads "p.StartDate >= from" ambiguously in the query form.
        var lines = await _db.PolicyCommissionSplits.IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null && s.ProducerId == request.ProducerId)
            .Join(_db.Policies.IgnoreQueryFilters(), s => s.PolicyId, p => p.Id, (s, p) => new { s, p })
            .Where(x => x.p.DeletedAt == null && x.p.Status != PolicyStatus.Draft && x.p.Status != PolicyStatus.Cancelled
                && x.p.StartDate >= from && x.p.StartDate <= to)
            .Join(_db.Customers.IgnoreQueryFilters(), sp => sp.p.CustomerId, c => c.Id, (sp, c) => new { sp.s, sp.p, c })
            .Join(_db.InsuranceCompanies.IgnoreQueryFilters(), spc => spc.p.InsuranceCompanyId, carrier => carrier.Id,
                (spc, carrier) => new {
                    spc.p.Id, spc.p.PolicyNumber,
                    // Customer can be physical (FirstName + LastName) or
                    // company (CompanyName) — pick whichever is populated.
                    CustomerName = spc.c.CompanyName ?? ((spc.c.FirstName ?? "") + " " + (spc.c.LastName ?? "")).Trim(),
                    CarrierName = carrier.Name, spc.p.StartDate,
                    spc.p.Premium,
                    spc.s.HierarchyLevel, spc.s.Percent,
                    spc.s.GrossAmount, spc.s.TaxWithholdingAmount, spc.s.NetAmount
                })
            .ToListAsync(ct);

        var mapped = lines
            .OrderBy(l => l.StartDate)
            .Select(l => new ProducerStatementLine(
                l.Id, l.PolicyNumber, l.CustomerName, l.CarrierName, l.StartDate,
                l.Premium, LabelFor(l.HierarchyLevel), l.Percent,
                l.GrossAmount, l.TaxWithholdingAmount, l.NetAmount))
            .ToList();

        var gross = mapped.Sum(l => l.Gross);
        var tax = mapped.Sum(l => l.TaxWithholding);
        var net = mapped.Sum(l => l.Net);

        // What we've actually paid the producer inside the window — used to
        // present the balance as «Οφείλονται € X».
        var paid = await _db.Payments.IgnoreQueryFilters()
            .Where(pmt => pmt.TenantId == tenantId && pmt.DeletedAt == null
                && pmt.BeneficiaryType == BeneficiaryType.Producer
                && pmt.BeneficiaryProducerId == request.ProducerId
                && pmt.PaidOn >= from && pmt.PaidOn <= to)
            .SumAsync(pmt => (decimal?)pmt.Amount, ct) ?? 0m;

        return new ProducerStatementDto(
            producer.Id, producer.Name, from, to, mapped,
            GrossTotal: gross,
            TaxWithholdingTotal: tax,
            NetTotal: net,
            AmountPaid: paid,
            AmountOutstanding: net - paid);
    }
}
