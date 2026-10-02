using System.Globalization;
using System.Text;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Server-side portfolio intelligence. Scores are transparent, deterministic
/// business rules (not a promise of insurance advice) and are calculated only
/// from the selected office/tenant's own records.
/// </summary>
[ApiController]
[Route("api/intelligence")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Intelligence)]
public sealed class IntelligenceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public IntelligenceController(AppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public sealed record RiskFactor(string Code, string Label, int Weight, string Detail);
    public sealed record PolicyRiskDto(
        Guid Id, string PolicyNumber, Guid CustomerId, string CustomerName, string? Email, string Carrier,
        string PolicyType, string Status, string StartDate, string EndDate, int? DaysToExpiry,
        decimal Premium, decimal? NetPremium, int ClaimsCount, decimal ClaimExposure,
        int Score, string Band, IReadOnlyList<RiskFactor> Factors, string NextAction);
    public sealed record CustomerRiskDto(
        Guid Id, string Name, string? Email, int PolicyCount, decimal Premium,
        int Score, string Band, string? LastContactAt, int OpenClaims,
        IReadOnlyList<RiskFactor> Factors, string NextAction);
    public sealed record MonthlyInsightDto(string Month, int NewPolicies, int Renewals, int Cancellations,
        int Expiring, decimal Premium, int Claims);
    public sealed record IntelligenceKpis(int Customers, int Policies, int ActivePolicies, decimal Premium,
        decimal NetPremium, int AtRiskPolicies, int CriticalPolicies, int Expiring30Days,
        int OpenClaims, decimal ClaimExposure, int UnpaidPolicies);
    public sealed record AiUsageDto(int Invocations, int Successful, int Failed, int PromptTokens,
        int CompletionTokens, int TotalTokens, DateTime? LastUsedAt, int? MonthlyBudget,
        int BudgetPercent, string Suggestion);
    public sealed record PortfolioIntelligenceDto(
        DateOnly From, DateOnly To, DateTime GeneratedAt, bool AiConfigured,
        IntelligenceKpis Kpis, IReadOnlyList<PolicyRiskDto> Policies,
        IReadOnlyList<CustomerRiskDto> Customers, IReadOnlyList<MonthlyInsightDto> Trend,
        IReadOnlyList<KeyValuePair<string, int>> RiskBands,
        IReadOnlyList<KeyValuePair<string, int>> ClaimStatuses, AiUsageDto AiUsage);

    [HttpGet("portfolio")]
    public async Task<ActionResult<PortfolioIntelligenceDto>> Portfolio(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] PolicyType? policyType,
        [FromQuery] Guid? carrierId,
        [FromQuery] Guid? producerId,
        [FromQuery] string? search,
        [FromQuery] string? riskBand,
        [FromQuery] bool includeProspects = true,
        CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rangeFrom = from ?? today.AddMonths(-12);
        var rangeTo = to ?? today.AddMonths(12);

        var policyQuery = _db.Policies
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.StartDate <= rangeTo && p.EndDate >= rangeFrom);
        if (policyType.HasValue) policyQuery = policyQuery.Where(p => p.PolicyType == policyType.Value);
        if (carrierId.HasValue) policyQuery = policyQuery.Where(p => p.InsuranceCompanyId == carrierId.Value);
        if (producerId.HasValue) policyQuery = policyQuery.Where(p => p.ProducerId == producerId.Value);
        if (!includeProspects) policyQuery = policyQuery.Where(p => p.Status != PolicyStatus.Prospect);

        var policies = await policyQuery.Select(p => new PolicySnapshot(
            p.Id, p.PolicyNumber, p.CustomerId,
            (p.Customer.CompanyName ?? ((p.Customer.FirstName ?? "") + " " + (p.Customer.LastName ?? "")).Trim()),
            p.Customer.Email, p.InsuranceCompany.Name, p.PolicyType, p.Status,
            p.StartDate, p.EndDate, p.Premium, p.NetPremium,
            p.PaidOnCredit, p.PaymentPromisedOn)).ToListAsync(ct);

        var policyIds = policies.Select(p => p.Id).ToArray();
        var claims = await _db.Claims.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && policyIds.Contains(c.PolicyId))
            .Select(c => new ClaimSnapshot(c.PolicyId, c.Status, c.ClaimedAmount, c.ApprovedAmount, c.ReportedDate))
            .ToListAsync(ct);
        var customerIds = policies.Select(p => p.CustomerId).Distinct().ToArray();
        var contacts = await _db.CommunicationLogs.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && customerIds.Contains(c.CustomerId))
            .GroupBy(c => c.CustomerId)
            .Select(g => new { CustomerId = g.Key, Last = g.Max(x => x.OccurredAt) })
            .ToDictionaryAsync(x => x.CustomerId, x => (DateTime?)x.Last, ct);

        var claimByPolicy = claims.GroupBy(c => c.PolicyId).ToDictionary(g => g.Key, g => g.ToList());
        var policyRisks = policies.Select(p => ScorePolicy(p, claimByPolicy.GetValueOrDefault(p.Id) ?? new List<ClaimSnapshot>(), today)).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            policyRisks = policyRisks.Where(p => p.PolicyNumber.Contains(term, StringComparison.OrdinalIgnoreCase)
                || p.CustomerName.Contains(term, StringComparison.OrdinalIgnoreCase)
                || p.Carrier.Contains(term, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        if (!string.IsNullOrWhiteSpace(riskBand))
            policyRisks = policyRisks.Where(p => string.Equals(p.Band, riskBand, StringComparison.OrdinalIgnoreCase)).ToList();

        var customerRisks = policyRisks.GroupBy(p => new { p.CustomerId, p.CustomerName })
            .Select(g => ScoreCustomer(g.Key.CustomerId, g.Key.CustomerName, g.ToList(), contacts.GetValueOrDefault(g.Key.CustomerId), today))
            .OrderByDescending(x => x.Score).ThenBy(x => x.Name).ToList();

        // Keep every KPI/chart aligned with the currently selected filters;
        // a search or risk-band filter must not leave claims from hidden
        // policies in the totals.
        var selectedPolicyIds = policyRisks.Select(p => p.Id).ToHashSet();
        var allClaims = claims.Where(c => selectedPolicyIds.Contains(c.PolicyId)).ToList();
        var activePolicies = policyRisks.Count(p => p.Status == PolicyStatus.Active.ToString());
        var premium = policyRisks.Sum(p => p.Premium);
        var netPremium = policyRisks.Sum(p => p.NetPremium ?? 0m);
        var openClaims = allClaims.Count(c => c.Status is not (ClaimStatus.Closed or ClaimStatus.Paid or ClaimStatus.Rejected));
        var exposure = allClaims.Sum(c => c.ApprovedAmount ?? c.ClaimedAmount ?? 0m);
        var kpis = new IntelligenceKpis(customerRisks.Count, policyRisks.Count, activePolicies, premium, netPremium,
            policyRisks.Count(p => p.Score >= 45), policyRisks.Count(p => p.Score >= 70),
            policyRisks.Count(p => p.DaysToExpiry is >= 0 and <= 30), openClaims, exposure,
            policyRisks.Count(p => p.Factors.Any(f => f.Code == "credit")));

        var bands = policyRisks.GroupBy(p => p.Band).OrderByDescending(g => g.Count())
            .Select(g => new KeyValuePair<string, int>(g.Key, g.Count())).ToList();
        var claimStatuses = allClaims.GroupBy(c => c.Status.ToString()).OrderByDescending(g => g.Count())
            .Select(g => new KeyValuePair<string, int>(g.Key, g.Count())).ToList();
        var trend = BuildTrend(policyRisks, allClaims, today);
        var aiConfigured = await _db.IntegrationSettings.AsNoTracking().AnyAsync(x => x.TenantId == tenantId
            && (x.Service == "Ai" || x.Service == "OpenAI") && x.KeyName == "OpenAiApiKey"
            && x.Value != null && x.Value != "", ct);
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var usageRows = await _db.AiInvocations.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CreatedAt >= monthStart).ToListAsync(ct);
        var promptTokens = usageRows.Sum(x => x.PromptTokens ?? 0);
        var completionTokens = usageRows.Sum(x => x.CompletionTokens ?? 0);
        var totalTokens = promptTokens + completionTokens;
        var budgetRaw = await _db.IntegrationSettings.AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.Service == "Ai" || x.Service == "OpenAI")
                && x.KeyName == "OpenAiMonthlyTokenBudget")
            .Select(x => x.Value).FirstOrDefaultAsync(ct);
        var budget = int.TryParse(budgetRaw, out var parsedBudget) && parsedBudget > 0 ? parsedBudget : (int?)null;
        var budgetPercent = budget.HasValue ? Math.Min(100, (int)Math.Round(totalTokens * 100d / budget.Value)) : 0;
        var suggestion = budgetPercent >= 90
            ? "Η χρήση AI πλησιάζει το μηνιαίο όριο. Μειώστε μεγάλα prompts ή αυξήστε το όριο."
            : budgetPercent >= 70
                ? "Η χρήση AI είναι αυξημένη. Προτιμήστε σύντομες αναλύσεις και μαζικές αναφορές."
                : totalTokens > 0
                    ? "Η χρήση AI είναι εντός ορίου. Ελέγχετε την καρτέλα κάθε μήνα για κόστος και όρια."
                    : "Δεν έχει καταγραφεί χρήση AI αυτόν τον μήνα. Ρυθμίστε office OpenAI key για GPT αναλύσεις.";
        var aiUsage = new AiUsageDto(usageRows.Count, usageRows.Count(x => x.Success), usageRows.Count(x => !x.Success),
            promptTokens, completionTokens, totalTokens, usageRows.OrderByDescending(x => x.CreatedAt).Select(x => (DateTime?)x.CreatedAt).FirstOrDefault(),
            budget, budgetPercent, suggestion);

        return Ok(new PortfolioIntelligenceDto(rangeFrom, rangeTo, DateTime.UtcNow, aiConfigured,
            kpis, policyRisks.OrderByDescending(p => p.Score).ThenBy(p => p.EndDate).ToList(),
            customerRisks, trend, bands, claimStatuses, aiUsage));
    }

    [HttpGet("portfolio/export.csv")]
    public async Task<IActionResult> Export([FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] PolicyType? policyType, [FromQuery] Guid? carrierId, [FromQuery] Guid? producerId,
        [FromQuery] string? search, [FromQuery] string? riskBand, [FromQuery] bool includeProspects = true,
        CancellationToken ct = default)
    {
        var result = await Portfolio(from, to, policyType, carrierId, producerId, search, riskBand, includeProspects, ct);
        var dto = (result.Result as OkObjectResult)?.Value as PortfolioIntelligenceDto;
        if (dto is null) return BadRequest();
        var el = CultureInfo.GetCultureInfo("el-GR");
        var sb = new StringBuilder("Πολιτική;Πελάτης;Εταιρεία;Κλάδος;Λήξη;Ημέρες;Ασφάλιστρο;Score;Ζώνη;Ζημιές;Έκθεση;Επόμενη ενέργεια\n");
        foreach (var p in dto.Policies)
            sb.AppendLine(string.Join(';', Csv(p.PolicyNumber), Csv(p.CustomerName), Csv(p.Carrier), p.PolicyType,
                p.EndDate, p.DaysToExpiry?.ToString() ?? "", p.Premium.ToString("F2", el), p.Score, p.Band,
                p.ClaimsCount, p.ClaimExposure.ToString("F2", el), Csv(p.NextAction)));
        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", $"intelligence-{DateTime.UtcNow:yyyyMMddHHmm}.csv");
    }

    private static PolicyRiskDto ScorePolicy(PolicySnapshot p, List<ClaimSnapshot> claims, DateOnly today)
    {
        var factors = new List<RiskFactor>();
        var days = p.EndDate.DayNumber - today.DayNumber;
        if (p.Status == PolicyStatus.Cancelled) factors.Add(new("cancelled", "Ακυρωμένο συμβόλαιο", 40, "Απαιτεί win-back ή διερεύνηση λόγου ακύρωσης."));
        if (p.Status == PolicyStatus.Expired) factors.Add(new("expired", "Έχει λήξει", 35, "Επικοινωνία για επανέκδοση/ανανεώση."));
        if (days < 0) factors.Add(new("overdue-renewal", "Ληγμένη ημερομηνία", 30, "Η ημερομηνία λήξης έχει παρέλθει."));
        else if (days <= 7) factors.Add(new("expiry-7", "Λήγει σε έως 7 ημέρες", 25, "Άμεση επικοινωνία για ανανέωση."));
        else if (days <= 30) factors.Add(new("expiry-30", "Λήγει σε έως 30 ημέρες", 18, "Προγραμματίστε υπενθύμιση ανανέωσης."));
        else if (days <= 90) factors.Add(new("expiry-90", "Λήγει σε έως 90 ημέρες", 8, "Προσθέστε σε λίστα προληπτικής επικοινωνίας."));
        if (claims.Count > 0) factors.Add(new("claims", "Ιστορικό ζημιών", Math.Min(20, claims.Count * 8), $"Βρέθηκαν {claims.Count} ζημιές."));
        if (p.PaidOnCredit) factors.Add(new("credit", "Πληρωμή επί πιστώσει", 8, "Ελέγξτε την ημερομηνία εξόφλησης."));
        if (p.PaymentPromisedOn is DateOnly promised && promised < today) factors.Add(new("overdue-payment", "Εκπρόθεσμη υπόσχεση πληρωμής", 15, "Απαιτείται οικονομικό follow-up."));
        if (p.Premium <= 0) factors.Add(new("missing-premium", "Χωρίς ποσό ασφαλίστρου", 8, "Ελέγξτε την καταχώρηση του συμβολαίου."));
        var score = Math.Min(100, factors.Sum(f => f.Weight));
        var band = score >= 70 ? "Critical" : score >= 45 ? "At-risk" : score >= 25 ? "Watch" : "Safe";
        var next = score >= 70 ? "Άμεση επικοινωνία και έλεγχος συμβολαίου" : score >= 45 ? "Follow-up μέσα στην εβδομάδα" : days <= 90 ? "Προγραμματισμός ανανέωσης" : "Παρακολούθηση";
        return new(p.Id, p.PolicyNumber, p.CustomerId, p.CustomerName, p.Email, p.Carrier, p.PolicyType.ToString(), p.Status.ToString(),
            p.StartDate.ToString("yyyy-MM-dd"), p.EndDate.ToString("yyyy-MM-dd"), days, p.Premium, p.NetPremium, claims.Count,
            claims.Sum(c => c.ApprovedAmount ?? c.ClaimedAmount ?? 0m), score, band, factors, next);
    }

    private static CustomerRiskDto ScoreCustomer(Guid id, string name, List<PolicyRiskDto> policies, DateTime? lastContact, DateOnly today)
    {
        var factors = new List<RiskFactor>();
        var max = policies.Max(p => p.Score);
        var avg = (int)Math.Round(policies.Average(p => p.Score));
        var score = Math.Max(max, avg);
        var daysSince = lastContact.HasValue ? (DateTime.UtcNow.Date - lastContact.Value.Date).Days : 999;
        if (daysSince > 180) { score = Math.Min(100, score + 15); factors.Add(new("no-contact", "Χωρίς πρόσφατη επικοινωνία", 15, "Δεν υπάρχει επικοινωνία στους τελευταίους 6 μήνες.")); }
        if (policies.Count == 1) factors.Add(new("single-policy", "Μοναδικό συμβόλαιο", 5, "Υπάρχει ευκαιρία cross-sell."));
        if (policies.Any(p => p.ClaimsCount > 0)) factors.Add(new("claims", "Ιστορικό ζημιών", 8, "Απαιτείται προληπτική εξυπηρέτηση."));
        var basePolicy = policies.OrderByDescending(p => p.Score).First();
        factors.AddRange(basePolicy.Factors.Take(3));
        score = Math.Min(100, score + factors.Where(f => f.Code is "no-contact" or "single-policy" or "claims").Sum(f => f.Weight));
        var band = score >= 70 ? "Critical" : score >= 45 ? "At-risk" : score >= 25 ? "Watch" : "Safe";
        var action = score >= 70 ? "Άμεση επικοινωνία" : score >= 45 ? "Follow-up σύντομα" : "Προληπτική παρακολούθηση";
        return new(id, name, policies.First().Email, policies.Count, policies.Sum(p => p.Premium), score, band,
            lastContact?.ToString("yyyy-MM-dd"), policies.Sum(p => p.ClaimsCount), factors.DistinctBy(f => f.Code).ToList(), action);
    }

    private static IReadOnlyList<MonthlyInsightDto> BuildTrend(List<PolicyRiskDto> policies, List<ClaimSnapshot> claims, DateOnly today)
    {
        var rows = new List<MonthlyInsightDto>();
        for (var i = 11; i >= 0; i--)
        {
            var start = new DateOnly(today.Year, today.Month, 1).AddMonths(-i);
            var end = start.AddMonths(1);
            var ps = policies.Where(p => DateOnly.Parse(p.StartDate) >= start && DateOnly.Parse(p.StartDate) < end).ToList();
            var cs = claims.Count(c => c.ReportedDate >= start && c.ReportedDate < end);
            rows.Add(new(start.ToString("yyyy-MM"), ps.Count(p => p.Status != PolicyStatus.Renewed.ToString()),
                ps.Count(p => p.Status == PolicyStatus.Renewed.ToString()), ps.Count(p => p.Status == PolicyStatus.Cancelled.ToString()),
                policies.Count(p => p.DaysToExpiry is >= 0 and <= 30 && DateOnly.Parse(p.EndDate) >= start && DateOnly.Parse(p.EndDate) < end),
                ps.Sum(p => p.Premium), cs));
        }
        return rows;
    }

    private sealed record PolicySnapshot(Guid Id, string PolicyNumber, Guid CustomerId, string CustomerName, string? Email,
        string Carrier, PolicyType PolicyType, PolicyStatus Status, DateOnly StartDate, DateOnly EndDate,
        decimal Premium, decimal? NetPremium, bool PaidOnCredit, DateOnly? PaymentPromisedOn);
    private sealed record ClaimSnapshot(Guid PolicyId, ClaimStatus Status, decimal? ClaimedAmount, decimal? ApprovedAmount, DateOnly ReportedDate);
    private static string Csv(string? value) => string.IsNullOrEmpty(value) ? "" : (value.Contains(';') || value.Contains('"') || value.Contains('\n') ? $"\"{value.Replace("\"", "\"\"")}\"" : value);
}
