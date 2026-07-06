using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Premium;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reconciliation;

// ============================================================================
// Producer reconciliation MVP. The producer (logged in via the portal) submits
// the commission amount they expected for a given policy. We compare against
// the most recent CommissionRunLine the agency recorded for that producer×policy
// and write a Notification to the agency admins if the numbers diverge.
//
// Available to every agency (previously gated by producer-reconciliation).
// ============================================================================

public record ProducerDeclarationDto(
    Guid Id,
    Guid PolicyId,
    string PolicyNumber,
    Guid ProducerId,
    string ProducerName,
    decimal ExpectedAmount,
    decimal? ExpectedPercent,
    decimal? RecordedAmount,
    decimal? DifferenceAmount,
    string ReconciliationStatus,
    string Currency,
    string? Notes,
    DateTime DeclaredAt);

public record CreateProducerDeclarationBody(
    Guid PolicyId,
    decimal ExpectedAmount,
    decimal? ExpectedPercent,
    string? Notes,
    string Currency = "EUR");

// ===== Producer-side: submit a declaration ==================================

public record CreateMyDeclarationCommand(CreateProducerDeclarationBody Body) : IRequest<ProducerDeclarationDto>;

public class CreateMyDeclarationHandler : IRequestHandler<CreateMyDeclarationCommand, ProducerDeclarationDto>
{
    private const decimal LargeDiffThreshold = 0.50m; // EUR — anything above this is "flagged"
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public CreateMyDeclarationHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerDeclarationDto> Handle(CreateMyDeclarationCommand cmd, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var b = cmd.Body;
        if (b.ExpectedAmount < 0) throw new AppException("amount_invalid", "Το ποσό δεν μπορεί να είναι αρνητικό.", 400);

        var producerId = await _db.Users.Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
        if (producerId is null) throw AppException.NotFound("Producer");

        var policy = await _db.Policies.FirstOrDefaultAsync(p => p.Id == b.PolicyId
                                                                  && p.TenantId == tenantId
                                                                  && p.ProducerId == producerId, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var recorded = await _db.CommissionRunLines
            .Where(l => l.ProducerId == producerId && l.PolicyId == b.PolicyId && !l.IsOverCommission)
            .OrderByDescending(l => l.CommissionRun.Year)
            .ThenByDescending(l => l.CommissionRun.Month)
            .Select(l => (decimal?)l.CommissionAmount)
            .FirstOrDefaultAsync(ct);

        var diff = recorded.HasValue ? recorded.Value - b.ExpectedAmount : (decimal?)null;
        var status = ComputeStatus(recorded, b.ExpectedAmount);

        var declaration = new ProducerCommissionDeclaration
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProducerId = producerId.Value,
            PolicyId = policy.Id,
            ExpectedAmount = b.ExpectedAmount,
            ExpectedPercent = b.ExpectedPercent,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency,
            Notes = b.Notes,
            DeclaredAt = DateTime.UtcNow,
            RecordedAmount = recorded,
            DifferenceAmount = diff,
            ReconciliationStatus = status,
            CreatedAt = DateTime.UtcNow
        };
        _db.ProducerCommissionDeclarations.Add(declaration);

        // If there's a flag-worthy gap, notify all AgencyAdmin users of the tenant.
        if (status is "diff_large" or "missing")
        {
            var producerName = await _db.Producers.Where(p => p.Id == producerId).Select(p => p.Name).FirstOrDefaultAsync(ct) ?? "Συνεργάτης";
            var admins = await _db.Users.Where(u => u.TenantId == tenantId && u.Role == Role.AgencyAdmin && u.DeletedAt == null).Select(u => u.Id).ToListAsync(ct);
            var diffPct = recorded.HasValue && recorded.Value != 0
                ? Math.Abs((recorded.Value - b.ExpectedAmount) / recorded.Value) * 100m
                : (decimal?)null;
            var body = status == "missing"
                ? $"Ο συνεργάτης {producerName} δηλώνει αναμενόμενη προμήθεια {b.ExpectedAmount:0.00} {declaration.Currency} για το συμβόλαιο {policy.PolicyNumber}, αλλά δεν υπάρχει καταχωρημένη εκκαθάριση στο σύστημα."
                : $"Διαφορά προμήθειας για το συμβόλαιο {policy.PolicyNumber}. Καταχωρημένο: {recorded:0.00} · Δηλωμένο: {b.ExpectedAmount:0.00} {declaration.Currency} · Διαφορά: {diff:0.00}{(diffPct.HasValue ? $" ({diffPct:0.0}%)" : "")}. Παρακαλώ ελέγξτε τη σύμβαση.";
            foreach (var adminUserId in admins)
            {
                _db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = adminUserId,
                    Title = $"Έλεγχος προμήθειας · {policy.PolicyNumber}",
                    Body = body,
                    Category = "ProducerReconciliation",
                    Link = $"/app/producers",
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        var producerNameOut = await _db.Producers.Where(p => p.Id == producerId).Select(p => p.Name).FirstOrDefaultAsync(ct) ?? "";
        return new ProducerDeclarationDto(
            declaration.Id, policy.Id, policy.PolicyNumber, producerId.Value, producerNameOut,
            declaration.ExpectedAmount, declaration.ExpectedPercent, declaration.RecordedAmount,
            declaration.DifferenceAmount, declaration.ReconciliationStatus, declaration.Currency,
            declaration.Notes, declaration.DeclaredAt);
    }

    private static string ComputeStatus(decimal? recorded, decimal expected)
    {
        if (!recorded.HasValue) return "missing";
        var diff = Math.Abs(recorded.Value - expected);
        if (diff < 0.01m) return "match";
        if (diff < LargeDiffThreshold) return "diff_small";
        return "diff_large";
    }
}

// ===== Producer-side: list my declarations ===================================

public record ListMyDeclarationsQuery() : IRequest<IReadOnlyList<ProducerDeclarationDto>>;

public class ListMyDeclarationsHandler : IRequestHandler<ListMyDeclarationsQuery, IReadOnlyList<ProducerDeclarationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListMyDeclarationsHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<ProducerDeclarationDto>> Handle(ListMyDeclarationsQuery _, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var producerId = await _db.Users.Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
        if (producerId is null) return Array.Empty<ProducerDeclarationDto>();

        var rows = await _db.ProducerCommissionDeclarations
            .Include(d => d.Policy)
            .Include(d => d.Producer)
            .Where(d => d.ProducerId == producerId && d.DeletedAt == null)
            .OrderByDescending(d => d.DeclaredAt)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    private static ProducerDeclarationDto Map(ProducerCommissionDeclaration d) => new(
        d.Id, d.PolicyId, d.Policy?.PolicyNumber ?? "", d.ProducerId, d.Producer?.Name ?? "",
        d.ExpectedAmount, d.ExpectedPercent, d.RecordedAmount, d.DifferenceAmount,
        d.ReconciliationStatus, d.Currency, d.Notes, d.DeclaredAt);
}

// ===== Agency-side: list declarations (optionally filtered by producer) ====

public record ListAgencyDeclarationsQuery(Guid? ProducerId) : IRequest<IReadOnlyList<ProducerDeclarationDto>>;

public class ListAgencyDeclarationsHandler : IRequestHandler<ListAgencyDeclarationsQuery, IReadOnlyList<ProducerDeclarationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListAgencyDeclarationsHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<ProducerDeclarationDto>> Handle(ListAgencyDeclarationsQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        try
        {
            var q = _db.ProducerCommissionDeclarations
                .Include(d => d.Policy)
                .Include(d => d.Producer)
                .Where(d => d.TenantId == tenantId && d.DeletedAt == null);
            if (r.ProducerId.HasValue) q = q.Where(d => d.ProducerId == r.ProducerId);

            var rows = await q.OrderByDescending(d => d.DeclaredAt).Take(500).ToListAsync(ct);

            // ── Live agency-side computation ────────────────────────────
            // Ταυτοποίηση Συνεργατών was reading RecordedAmount from stale
            // batch CommissionRunLines. Switch to a LIVE compute: for each
            // declaration, look up the tenant's CommissionRule for that
            // producer × policy type × cover code, multiply by the policy
            // premium, and compare against the declaration. This keeps the
            // number identical to what the operator sees on the Λίστες
            // Παραγωγής page (also derived from CommissionRules) — no more
            // «my declaration matches the run but the production list
            // disagrees» drift.
            var rules = await _db.CommissionRules
                .Where(rl => rl.TenantId == tenantId && rl.DeletedAt == null)
                .ToListAsync(ct);

            decimal ComputeAgencyExpected(Kalypsis.Domain.Entities.Policy p, Guid producerId)
            {
                var match = rules
                    .Where(rl =>
                        (!rl.ProducerId.HasValue          || rl.ProducerId == producerId) &&
                        (!rl.PolicyType.HasValue          || rl.PolicyType == p.PolicyType) &&
                        (!rl.VehicleUseCategory.HasValue  || rl.VehicleUseCategory == p.VehicleUseCategory) &&
                        (!rl.InsuranceCompanyId.HasValue  || rl.InsuranceCompanyId == p.InsuranceCompanyId))
                    .OrderByDescending(rl =>
                        (rl.ProducerId.HasValue         ? 8 : 0) +
                        (rl.PolicyType.HasValue         ? 4 : 0) +
                        (rl.VehicleUseCategory.HasValue ? 2 : 0) +
                        (rl.InsuranceCompanyId.HasValue ? 1 : 0))
                    .FirstOrDefault();
                if (match is null) return 0m;
                var pct = match.ProducerPercent
                    ?? (match.CommissionType == Kalypsis.Domain.Enums.CommissionType.Percentage ? match.Value : 0m);
                return decimal.Round(p.Premium * pct / 100m, 2);
            }

            const decimal smallDiffLimit = 5m;
            return rows.Select(d =>
            {
                decimal? agencyLive = d.Policy is null ? null
                    : (decimal?)ComputeAgencyExpected(d.Policy, d.ProducerId);
                decimal? diff = agencyLive.HasValue ? agencyLive - d.ExpectedAmount : null;
                string status;
                if (!agencyLive.HasValue || agencyLive.Value == 0m) status = "missing";
                else if (diff.HasValue && Math.Abs(diff.Value) < 0.01m) status = "match";
                else if (diff.HasValue && Math.Abs(diff.Value) < smallDiffLimit) status = "diff_small";
                else status = "diff_large";

                return new ProducerDeclarationDto(
                    d.Id, d.PolicyId, d.Policy?.PolicyNumber ?? "", d.ProducerId, d.Producer?.Name ?? "",
                    d.ExpectedAmount, d.ExpectedPercent,
                    // RecordedAmount now returns the LIVE agency-side computed
                    // value so the frontend doesn't need a schema change —
                    // it already renders «Καταχωρημένο vs Δηλωμένο».
                    agencyLive, diff,
                    status, d.Currency, d.Notes, d.DeclaredAt);
            }).ToList();
        }
        catch
        {
            // If the paired migration hasn't applied yet the table can be
            // missing on a partial deploy — treat as "no declarations" so the
            // page renders instead of the frontend flashing a red error.
            // The schema safety net will create it on the next boot.
            return Array.Empty<ProducerDeclarationDto>();
        }
    }
}

// ===== Agency-side: aggregate by CommissionRule (default view) ==============
//
// The per-contract handler above is fine when the operator wants to drill down
// row-by-row, but the day-to-day question is «for THIS producer working with
// THIS carrier under THIS package, are they on the same page as our
// παραμετροποίηση?». That's a per-rule question, not a per-policy one.
//
// This handler walks every CommissionRule scoped to a producer and, for each,
// aggregates:
//   • Παραμετροποίηση (γραφείο): rule.ProducerPercent × Σ(active policy premiums
//     matching this rule's scope), which is the same live compute the Λίστες
//     Παραγωγής page uses.
//   • Δηλωμένο (συνεργάτης):     Σ(ExpectedAmount) from all declarations whose
//     policy matches this rule's scope.
//
// The frontend renders one row per rule (grouped by producer) with a click-to-
// expand explanation dialog that spells out the numbers in plain Greek.

public record RuleReconciliationDto(
    Guid RuleId,
    Guid ProducerId,
    string ProducerName,
    Guid? InsuranceCompanyId,
    string? InsuranceCompanyName,
    PolicyType? PolicyType,
    VehicleUseCategory? VehicleUseCategory,
    string? CoverCode,
    decimal ConfiguredPercent,
    int PolicyCount,
    decimal AgencyExpectedTotal,
    int DeclarationCount,
    decimal ProducerDeclaredTotal,
    decimal? ImpliedProducerPercent,
    decimal DifferenceAmount,
    string Status,
    string Currency);

public record ListAgencyReconciliationByRuleQuery(Guid? ProducerId) : IRequest<IReadOnlyList<RuleReconciliationDto>>;

public class ListAgencyReconciliationByRuleHandler
    : IRequestHandler<ListAgencyReconciliationByRuleQuery, IReadOnlyList<RuleReconciliationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListAgencyReconciliationByRuleHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<RuleReconciliationDto>> Handle(
        ListAgencyReconciliationByRuleQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        try
        {
            // Load every rule for the tenant — producer-specific *and*
            // producer-agnostic (wildcard). Previously we restricted this to
            // rules with an explicit ProducerId, which meant tenants whose
            // παραμετροποίηση was configured only at the policy-type level
            // (the seeded demo, and any office that hasn't drilled into
            // per-producer overrides yet) saw an empty view even though the
            // ανά-συμβόλαιο view rendered plenty of rows.
            var rules = await _db.CommissionRules
                .Where(rl => rl.TenantId == tenantId && rl.DeletedAt == null)
                .ToListAsync(ct);
            if (r.ProducerId.HasValue)
                rules = rules.Where(rl => !rl.ProducerId.HasValue || rl.ProducerId == r.ProducerId).ToList();
            if (rules.Count == 0) return Array.Empty<RuleReconciliationDto>();

            // Producer fan-out: producer-agnostic rules apply to every
            // producer in the tenant, so we materialise one row per
            // (rule × producer with activity). Restrict to the requested
            // producer when the caller has filtered.
            var producersQuery = _db.Producers
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null);
            if (r.ProducerId.HasValue) producersQuery = producersQuery.Where(p => p.Id == r.ProducerId);
            var producerList = await producersQuery.ToListAsync(ct);
            if (producerList.Count == 0) return Array.Empty<RuleReconciliationDto>();

            var producerIds = producerList.Select(p => p.Id).ToList();
            var producers = producerList.ToDictionary(p => p.Id, p => p.Name);

            var carrierIds = rules.Where(rl => rl.InsuranceCompanyId.HasValue)
                .Select(rl => rl.InsuranceCompanyId!.Value).Distinct().ToList();
            var carriers = await _db.InsuranceCompanies
                .Where(c => carrierIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

            var activePolicies = await _db.Policies
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                            && p.Status == PolicyStatus.Active
                            && producerIds.Contains(p.ProducerId!.Value))
                .ToListAsync(ct);

            var declarations = await _db.ProducerCommissionDeclarations
                .Where(d => d.TenantId == tenantId && d.DeletedAt == null
                            && producerIds.Contains(d.ProducerId))
                .ToListAsync(ct);
            var declPolicyIds = declarations.Select(d => d.PolicyId).Distinct().ToList();
            var declPolicies = await _db.Policies
                .IgnoreQueryFilters()
                .Where(p => declPolicyIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p, ct);

            // A rule matches a policy when every scope field the rule declares
            // is either null (wildcard) or equal to the policy's value.
            static bool RuleMatchesPolicy(CommissionRule rl, Policy p) =>
                (!rl.ProducerId.HasValue         || rl.ProducerId == p.ProducerId) &&
                (!rl.PolicyType.HasValue         || rl.PolicyType == p.PolicyType) &&
                (!rl.VehicleUseCategory.HasValue || rl.VehicleUseCategory == p.VehicleUseCategory) &&
                (!rl.InsuranceCompanyId.HasValue || rl.InsuranceCompanyId == p.InsuranceCompanyId);

            var result = new List<RuleReconciliationDto>(rules.Count);
            foreach (var rule in rules)
            {
                var pct = rule.ProducerPercent
                    ?? (rule.CommissionType == CommissionType.Percentage ? rule.Value : 0m);

                // Producer-specific rule → target that producer only.
                // Producer-agnostic rule → fan out across every producer.
                var targetProducerIds = rule.ProducerId.HasValue
                    ? new[] { rule.ProducerId.Value }.Where(id => producers.ContainsKey(id))
                    : (IEnumerable<Guid>)producerIds;

                foreach (var pid in targetProducerIds)
                {
                    var scopedPolicies = activePolicies
                        .Where(p => p.ProducerId == pid && RuleMatchesPolicy(rule, p))
                        .ToList();
                    var agencyTotal = decimal.Round(
                        scopedPolicies.Sum(p => p.Premium * pct / 100m), 2);

                    var scopedDecls = declarations.Where(d =>
                        d.ProducerId == pid
                        && declPolicies.TryGetValue(d.PolicyId, out var p)
                        && RuleMatchesPolicy(rule, p))
                        .ToList();
                    var declaredTotal = scopedDecls.Sum(d => d.ExpectedAmount);

                    // Skip pure-noise rows — no policies AND no declarations for
                    // this producer in this scope means the wildcard rule simply
                    // doesn't apply to them.
                    if (scopedPolicies.Count == 0 && scopedDecls.Count == 0) continue;

                    var declaredPremium = scopedDecls.Sum(d =>
                        declPolicies.TryGetValue(d.PolicyId, out var p) ? p.Premium : 0m);
                    decimal? impliedPct = declaredPremium > 0
                        ? decimal.Round(declaredTotal * 100m / declaredPremium, 2)
                        : (decimal?)null;

                    var diff = decimal.Round(agencyTotal - declaredTotal, 2);
                    string status;
                    if (declaredTotal == 0m && agencyTotal == 0m) status = "empty";
                    else if (declaredTotal == 0m) status = "no_declarations";
                    else if (Math.Abs(diff) < 0.01m) status = "match";
                    else if (Math.Abs(diff) < 5m) status = "diff_small";
                    else status = "diff_large";

                    result.Add(new RuleReconciliationDto(
                        rule.Id,
                        pid,
                        producers.TryGetValue(pid, out var pn) ? pn : "—",
                        rule.InsuranceCompanyId,
                        rule.InsuranceCompanyId.HasValue && carriers.TryGetValue(rule.InsuranceCompanyId.Value, out var cn)
                            ? cn : null,
                        rule.PolicyType,
                        rule.VehicleUseCategory,
                        rule.CoverCode,
                        pct,
                        scopedPolicies.Count,
                        agencyTotal,
                        scopedDecls.Count,
                        declaredTotal,
                        impliedPct,
                        diff,
                        status,
                        "EUR"));
                }
            }

            return result
                .OrderBy(x => x.ProducerName)
                .ThenByDescending(x => Math.Abs(x.DifferenceAmount))
                .ToList();
        }
        catch
        {
            return Array.Empty<RuleReconciliationDto>();
        }
    }
}
