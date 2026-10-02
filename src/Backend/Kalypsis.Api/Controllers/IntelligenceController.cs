using System.Globalization;
using System.Text;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
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
    private readonly IAiService _ai;
    public IntelligenceController(AppDbContext db, ICurrentUser current, IAiService ai)
    { _db = db; _current = current; _ai = ai; }

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
        int BudgetPercent, string Suggestion, decimal EstimatedCostEur, decimal? CostLimitEur,
        int CostPercent, bool Blocked, string Health, DateTime? LastCalculatedAt);
    public sealed record PortfolioIntelligenceDto(
        DateOnly From, DateOnly To, DateTime GeneratedAt, bool AiConfigured,
        IntelligenceKpis Kpis, IReadOnlyList<PolicyRiskDto> Policies,
        IReadOnlyList<CustomerRiskDto> Customers, IReadOnlyList<MonthlyInsightDto> Trend,
        IReadOnlyList<KeyValuePair<string, int>> RiskBands,
        IReadOnlyList<KeyValuePair<string, int>> ClaimStatuses, AiUsageDto AiUsage);

    public sealed record PromptTemplateDto(Guid Id, string Name, string Purpose, string Template, string ContextScope, bool IsActive);
    public sealed record ConversationDto(Guid Id, string Title, string Kind, Guid? PromptTemplateId, Guid? CustomerId,
        Guid? PolicyId, DateTime? LastMessageAt, string Status, int MessageCount, string? ResultPreview);
    public sealed record AiRunDto(Guid Id, string Task, string Model, bool Success, int PromptTokens, int CompletionTokens,
        DateTime CreatedAt, string? Error, string? PromptSummary, string? Result);
    public sealed record AutomationDto(Guid Id, string Name, string Trigger, bool IsActive, int Actions);
    public sealed record WorkbenchDto(IReadOnlyList<PromptTemplateDto> Prompts, IReadOnlyList<ConversationDto> Conversations,
        IReadOnlyList<AiRunDto> Runs, IReadOnlyList<AutomationDto> Automations, bool StoreResults);
    public sealed record PromptBody(string Name, string Purpose, string Template, string ContextScope, bool IsActive = true);
    public sealed record RunBody(Guid? CustomerId, Guid? PolicyId, string? PromptOverride);
    public sealed record ChatBody(Guid? ConversationId, string Message, Guid? CustomerId, Guid? PolicyId);

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
        var costLimitRaw = await _db.IntegrationSettings.AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.Service == "Ai" || x.Service == "OpenAI")
                && x.KeyName == "OpenAiMonthlyCostLimitEur")
            .Select(x => x.Value).FirstOrDefaultAsync(ct);
        var costLimit = decimal.TryParse(costLimitRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedCostLimit) && parsedCostLimit > 0m ? parsedCostLimit : (decimal?)null;
        var estimatedCost = usageRows.Sum(x => EstimateCostEur(x.Model, x.PromptTokens ?? 0, x.CompletionTokens ?? 0));
        var costPercent = costLimit.HasValue ? Math.Min(100, (int)Math.Round(estimatedCost * 100m / costLimit.Value)) : 0;
        var hardStopRaw = await _db.IntegrationSettings.AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.Service == "Ai" || x.Service == "OpenAI")
                && x.KeyName == "OpenAiHardStop")
            .Select(x => x.Value).FirstOrDefaultAsync(ct);
        var hardStop = !string.Equals(hardStopRaw, "false", StringComparison.OrdinalIgnoreCase) && hardStopRaw != "0";
        var blocked = hardStop && ((budget.HasValue && totalTokens >= budget.Value) || (costLimit.HasValue && estimatedCost >= costLimit.Value));
        var health = !aiConfigured ? "not-configured" : usageRows.Any(x => !x.Success && x.CreatedAt >= DateTime.UtcNow.AddDays(-30)) ? "degraded" : "healthy";
        var lastCalculatedAt = await _db.ChurnScores.AsNoTracking().Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .OrderByDescending(x => x.ComputedAt).Select(x => (DateTime?)x.ComputedAt).FirstOrDefaultAsync(ct);
        var suggestion = budgetPercent >= 90
            ? "Η χρήση AI πλησιάζει το μηνιαίο όριο. Μειώστε μεγάλα prompts ή αυξήστε το όριο."
            : budgetPercent >= 70
                ? "Η χρήση AI είναι αυξημένη. Προτιμήστε σύντομες αναλύσεις και μαζικές αναφορές."
                : totalTokens > 0
                    ? "Η χρήση AI είναι εντός ορίου. Ελέγχετε την καρτέλα κάθε μήνα για κόστος και όρια."
                    : "Δεν έχει καταγραφεί χρήση AI αυτόν τον μήνα. Ρυθμίστε office OpenAI key για GPT αναλύσεις.";
        if (blocked) suggestion = "Το μηνιαίο όριο AI έχει φτάσει. Οι νέες κλήσεις μπλοκάρονται μέχρι τον επόμενο μήνα ή μέχρι να αυξήσει το γραφείο το όριο.";
        var aiUsage = new AiUsageDto(usageRows.Count, usageRows.Count(x => x.Success), usageRows.Count(x => !x.Success),
            promptTokens, completionTokens, totalTokens, usageRows.OrderByDescending(x => x.CreatedAt).Select(x => (DateTime?)x.CreatedAt).FirstOrDefault(),
            budget, budgetPercent, suggestion, Math.Round(estimatedCost, 4), costLimit, costPercent, blocked, health, lastCalculatedAt);

        return Ok(new PortfolioIntelligenceDto(rangeFrom, rangeTo, DateTime.UtcNow, aiConfigured,
            kpis, policyRisks.OrderByDescending(p => p.Score).ThenBy(p => p.EndDate).ToList(),
            customerRisks, trend, bands, claimStatuses, aiUsage));
    }

    /// <summary>Persists the current transparent risk snapshot for audit and reporting.</summary>
    [HttpPost("recalculate")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> Recalculate(CancellationToken ct = default)
    {
        var result = await Portfolio(null, null, null, null, null, null, null, true, ct);
        if (result.Result is not OkObjectResult ok || ok.Value is not PortfolioIntelligenceDto dto) return BadRequest();
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var now = DateTime.UtcNow;
        var existing = await _db.ChurnScores.Where(x => x.TenantId == tenantId && x.DeletedAt == null).ToDictionaryAsync(x => x.CustomerId, ct);
        foreach (var customer in dto.Customers)
        {
            if (!existing.TryGetValue(customer.Id, out var row))
            {
                row = new ChurnScore { Id = Guid.NewGuid(), TenantId = tenantId, CustomerId = customer.Id };
                _db.ChurnScores.Add(row);
            }
            row.Score = customer.Score / 100d;
            row.Band = customer.Band;
            row.TopFactorsJson = System.Text.Json.JsonSerializer.Serialize(customer.Factors);
            row.ComputedAt = now;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new { calculatedAt = now, customers = dto.Customers.Count });
    }

    [HttpPost("policies/{policyId:guid}/task")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> CreatePolicyTask(Guid policyId, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var policy = await _db.Policies.AsNoTracking().Where(p => p.TenantId == tenantId && p.Id == policyId && p.DeletedAt == null)
            .Select(p => new { p.Id, p.PolicyNumber, p.CustomerId, Customer = p.Customer.CompanyName ?? ((p.Customer.FirstName ?? "") + " " + (p.Customer.LastName ?? "")).Trim() }).FirstOrDefaultAsync(ct);
        if (policy is null) return NotFound();
        var task = new AgencyTask { Id = Guid.NewGuid(), TenantId = tenantId, PolicyId = policy.Id, CustomerId = policy.CustomerId,
            Title = $"Follow-up ασφαλιστηρίου {policy.PolicyNumber}", Description = $"Επικοινωνία με {policy.Customer} μετά την ανάλυση κινδύνου Intelligence.",
            Priority = AgencyTaskPriority.High, Status = AgencyTaskStatus.Open, DueAt = DateTime.UtcNow.AddDays(3) };
        _db.AgencyTasks.Add(task);
        await _db.SaveChangesAsync(ct);
        return Ok(new { taskId = task.Id });
    }

    [HttpPost("customers/{customerId:guid}/outcome")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> RecordOutcome(Guid customerId, [FromBody] OutcomeBody body, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        if (!await _db.Customers.AnyAsync(c => c.TenantId == tenantId && c.Id == customerId && c.DeletedAt == null, ct)) return NotFound();
        var allowed = new[] { "renewed", "lost", "claim-resolved", "payment-received", "contacted" };
        if (!allowed.Contains(body.Outcome, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { error = "Unsupported outcome" });
        _db.AuditLogs.Add(new AuditLog { Id = Guid.NewGuid(), TenantId = tenantId, UserId = _current.UserId,
            EntityName = "IntelligenceOutcome", EntityId = customerId.ToString(), Action = body.Outcome,
            Category = "Intelligence", Metadata = "source=portfolio-risk" });
        await _db.SaveChangesAsync(ct);
        return Ok(new { recorded = true });
    }

    public sealed record OutcomeBody(string Outcome);

    [HttpGet("workbench")]
    public async Task<ActionResult<WorkbenchDto>> Workbench(CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var prompts = await _db.AiPromptTemplates.AsNoTracking().Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .OrderBy(x => x.Name).Select(x => new PromptTemplateDto(x.Id, x.Name, x.Purpose, x.Template, x.ContextScope, x.IsActive)).ToListAsync(ct);
        var conversations = await _db.AiConversations.AsNoTracking().Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .OrderByDescending(x => x.LastMessageAt ?? x.CreatedAt).Take(40)
            .Select(x => new ConversationDto(x.Id, x.Title, x.Kind, x.PromptTemplateId, x.CustomerId, x.PolicyId,
                x.LastMessageAt, x.Status, _db.AiConversationMessages.Count(m => m.ConversationId == x.Id && m.DeletedAt == null), x.ResultPreview)).ToListAsync(ct);
        var runConversations = await _db.AiConversations.AsNoTracking().Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.Kind == "PromptRun")
            .OrderByDescending(x => x.LastMessageAt ?? x.CreatedAt).Take(50).ToListAsync(ct);
        var runIds = runConversations.Select(x => x.Id).ToList();
        var runMessages = await _db.AiConversationMessages.AsNoTracking().Where(x => x.TenantId == tenantId && runIds.Contains(x.ConversationId)).ToListAsync(ct);
        var runs = runConversations.Select(x => {
            var messages = runMessages.Where(m => m.ConversationId == x.Id).ToList();
            var failed = x.Status.Equals("Failed", StringComparison.OrdinalIgnoreCase);
            return new AiRunDto(x.Id, "PromptRun", "office-model", !failed,
                messages.Sum(m => m.PromptTokens ?? 0), messages.Sum(m => m.CompletionTokens ?? 0), x.LastMessageAt ?? x.CreatedAt,
                failed ? "Η εκτέλεση απέτυχε." : null, x.Title, x.ResultPreview);
        }).ToList();
        var automations = await _db.WorkflowRules.AsNoTracking().Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .OrderBy(x => x.Priority).ThenBy(x => x.Name).Take(50)
            .Select(x => new AutomationDto(x.Id, x.Name, x.TriggerEvent.ToString(), x.IsActive, x.Actions.Count)).ToListAsync(ct);
        var storeRaw = await _db.IntegrationSettings.AsNoTracking().Where(x => x.TenantId == tenantId
            && (x.Service == "Ai" || x.Service == "OpenAI") && x.KeyName == "OpenAiStoreResults").Select(x => x.Value).FirstOrDefaultAsync(ct);
        var store = string.Equals(storeRaw, "true", StringComparison.OrdinalIgnoreCase) || storeRaw == "1";
        return Ok(new WorkbenchDto(prompts, conversations, runs, automations, store));
    }

    [HttpPost("prompts")]
    [RequirePermission("tasks.write")]
    public async Task<ActionResult<PromptTemplateDto>> CreatePrompt([FromBody] PromptBody body, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Template)) return BadRequest(new { error = "Name και prompt είναι υποχρεωτικά." });
        var allowed = new[] { "General", "Customer", "Policy", "Portfolio" };
        if (!allowed.Contains(body.ContextScope, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { error = "Μη έγκυρο context scope." });
        var row = new AiPromptTemplate { Id = Guid.NewGuid(), TenantId = tenantId, CreatedAt = DateTime.UtcNow, CreatedByUserId = _current.UserId,
            Name = body.Name.Trim(), Purpose = body.Purpose?.Trim() ?? "", Template = body.Template.Trim()[..Math.Min(body.Template.Trim().Length, 12000)],
            ContextScope = allowed.First(x => string.Equals(x, body.ContextScope, StringComparison.OrdinalIgnoreCase)), IsActive = body.IsActive };
        _db.AiPromptTemplates.Add(row); await _db.SaveChangesAsync(ct);
        return Ok(new PromptTemplateDto(row.Id, row.Name, row.Purpose, row.Template, row.ContextScope, row.IsActive));
    }

    [HttpPut("prompts/{id:guid}")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> UpdatePrompt(Guid id, [FromBody] PromptBody body, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var row = await _db.AiPromptTemplates.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.DeletedAt == null, ct);
        if (row is null) return NotFound();
        if (string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Template)) return BadRequest(new { error = "Name και prompt είναι υποχρεωτικά." });
        row.Name = body.Name.Trim(); row.Purpose = body.Purpose?.Trim() ?? ""; row.Template = body.Template.Trim()[..Math.Min(body.Template.Trim().Length, 12000)]; row.IsActive = body.IsActive; row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("prompts/{id:guid}")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> DeletePrompt(Guid id, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var row = await _db.AiPromptTemplates.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.DeletedAt == null, ct);
        if (row is null) return NotFound(); row.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("prompts/{id:guid}/run")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> RunPrompt(Guid id, [FromBody] RunBody body, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var template = await _db.AiPromptTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.DeletedAt == null && x.IsActive, ct);
        if (template is null) return NotFound();
        var context = await BuildContextAsync(tenantId, body.CustomerId, body.PolicyId, ct);
        if (template.ContextScope.Equals("Customer", StringComparison.OrdinalIgnoreCase) && body.CustomerId is null) return BadRequest(new { error = "Επίλεξε πελάτη για αυτό το prompt." });
        if (template.ContextScope.Equals("Policy", StringComparison.OrdinalIgnoreCase) && body.PolicyId is null) return BadRequest(new { error = "Επίλεξε συμβόλαιο για αυτό το prompt." });
        var basePrompt = string.IsNullOrWhiteSpace(body.PromptOverride) ? template.Template : body.PromptOverride!;
        var prompt = ApplyVariables(basePrompt, context) + "\n\nContext που επέλεξε ο χρήστης:\n" + context;
        var conversation = new AiConversation { Id = Guid.NewGuid(), TenantId = tenantId, CreatedAt = DateTime.UtcNow, Title = template.Name,
            Kind = "PromptRun", PromptTemplateId = template.Id, CustomerId = body.CustomerId, PolicyId = body.PolicyId, UserId = _current.UserId, LastMessageAt = DateTime.UtcNow };
        _db.AiConversations.Add(conversation);
        var result = await _ai.CompleteTextAsync(prompt[..Math.Min(prompt.Length, 18000)], AiTaskType.CustomPrompt, ct);
        var store = await ShouldStoreResultsAsync(tenantId, ct);
        _db.AiConversationMessages.Add(new AiConversationMessage { Id = Guid.NewGuid(), TenantId = tenantId, ConversationId = conversation.Id, CreatedAt = DateTime.UtcNow, Role = "user", Content = store ? prompt[..Math.Min(prompt.Length, 20000)] : null, ContentStored = store });
        _db.AiConversationMessages.Add(new AiConversationMessage { Id = Guid.NewGuid(), TenantId = tenantId, ConversationId = conversation.Id, CreatedAt = DateTime.UtcNow, Role = "assistant", Content = store && result.Success ? result.Text : null, ContentStored = store && result.Success, PromptTokens = result.PromptTokens, CompletionTokens = result.CompletionTokens });
        conversation.ResultPreview = store && result.Success && !string.IsNullOrWhiteSpace(result.Text) ? result.Text[..Math.Min(result.Text.Length, 2000)] : null;
        await _db.SaveChangesAsync(ct);
        return Ok(new { conversationId = conversation.Id, success = result.Success, text = result.Text, error = result.ErrorMessage, model = result.Model, promptTokens = result.PromptTokens, completionTokens = result.CompletionTokens, resultStored = store });
    }

    [HttpPost("chat")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> Chat([FromBody] ChatBody body, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.Message)) return BadRequest(new { error = "Γράψε πρώτα ένα μήνυμα." });
        AiConversation? conversation = null;
        if (body.ConversationId.HasValue) conversation = await _db.AiConversations.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == body.ConversationId && x.DeletedAt == null, ct);
        conversation ??= new AiConversation { Id = Guid.NewGuid(), TenantId = tenantId, CreatedAt = DateTime.UtcNow, Title = "Νέα συνομιλία AI", Kind = "Chat", CustomerId = body.CustomerId, PolicyId = body.PolicyId, UserId = _current.UserId };
        var prior = await _db.AiConversationMessages.AsNoTracking().Where(x => x.TenantId == tenantId && x.ConversationId == conversation.Id && x.ContentStored && x.Content != null).OrderByDescending(x => x.CreatedAt).Take(12).OrderBy(x => x.CreatedAt).Select(x => $"{x.Role}: {x.Content}").ToListAsync(ct);
        var context = await BuildContextAsync(tenantId, body.CustomerId ?? conversation.CustomerId, body.PolicyId ?? conversation.PolicyId, ct);
        var prompt = "Απάντησε στα ελληνικά ως βοηθός ασφαλιστικού γραφείου. Μην παρέχεις δεσμευτική νομική ή ασφαλιστική συμβουλή.\n" + string.Join("\n", prior) + $"\nContext: {context}\nuser: {body.Message.Trim()}";
        var result = await _ai.CompleteTextAsync(prompt[..Math.Min(prompt.Length, 18000)], AiTaskType.Chat, ct);
        var store = await ShouldStoreResultsAsync(tenantId, ct); var now = DateTime.UtcNow;
        if (_db.Entry(conversation).State == EntityState.Detached) _db.AiConversations.Add(conversation);
        conversation.LastMessageAt = now; conversation.UpdatedAt = now;
        conversation.ResultPreview = store && result.Success && !string.IsNullOrWhiteSpace(result.Text) ? result.Text[..Math.Min(result.Text.Length, 2000)] : conversation.ResultPreview;
        _db.AiConversationMessages.Add(new AiConversationMessage { Id = Guid.NewGuid(), TenantId = tenantId, ConversationId = conversation.Id, CreatedAt = now, Role = "user", Content = store ? body.Message.Trim() : null, ContentStored = store });
        _db.AiConversationMessages.Add(new AiConversationMessage { Id = Guid.NewGuid(), TenantId = tenantId, ConversationId = conversation.Id, CreatedAt = now.AddMilliseconds(1), Role = "assistant", Content = store && result.Success ? result.Text : null, ContentStored = store && result.Success, PromptTokens = result.PromptTokens, CompletionTokens = result.CompletionTokens });
        await _db.SaveChangesAsync(ct);
        return Ok(new { conversationId = conversation.Id, success = result.Success, text = result.Text, error = result.ErrorMessage, resultStored = store });
    }

    [HttpGet("chats/{id:guid}")]
    public async Task<IActionResult> ChatHistory(Guid id, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var conversation = await _db.AiConversations.AsNoTracking().Where(x => x.TenantId == tenantId && x.Id == id && x.DeletedAt == null)
            .Select(x => new { x.Id, x.Title, x.Kind, x.CustomerId, x.PolicyId, x.LastMessageAt }).FirstOrDefaultAsync(ct);
        if (conversation is null) return NotFound();
        var messages = await _db.AiConversationMessages.AsNoTracking().Where(x => x.TenantId == tenantId && x.ConversationId == id && x.ContentStored)
            .OrderBy(x => x.CreatedAt).Select(x => new { x.Role, x.Content, x.CreatedAt, x.PromptTokens, x.CompletionTokens }).ToListAsync(ct);
        return Ok(new { conversation, messages });
    }

    private async Task<string> BuildContextAsync(Guid tenantId, Guid? customerId, Guid? policyId, CancellationToken ct)
    {
        var parts = new List<string>();
        if (customerId is Guid cid)
        {
            var c = await _db.Customers.AsNoTracking().Where(x => x.TenantId == tenantId && x.Id == cid && x.DeletedAt == null)
                .Select(x => new { x.FirstName, x.LastName, x.CompanyName, x.Occupation, x.City, x.Status, x.Notes }).FirstOrDefaultAsync(ct);
            if (c is null) throw Kalypsis.Application.Common.AppException.NotFound("Customer");
            var policyCount = await _db.Policies.AsNoTracking().CountAsync(x => x.TenantId == tenantId && x.CustomerId == cid && x.DeletedAt == null, ct);
            parts.Add($"Πελάτης: {c.CompanyName ?? ($"{c.FirstName} {c.LastName}").Trim()}; κατάσταση: {c.Status}; επάγγελμα: {c.Occupation}; πόλη: {c.City}; συμβόλαια: {policyCount}; σημειώσεις: {c.Notes}");
        }
        if (policyId is Guid pid)
        {
            var p = await _db.Policies.AsNoTracking().Where(x => x.TenantId == tenantId && x.Id == pid && x.DeletedAt == null)
                .Select(x => new { x.PolicyNumber, x.StartDate, x.EndDate, x.Premium, x.NetPremium, x.PolicyType, x.Status, x.Characteristic, x.Notes, Carrier = x.InsuranceCompany.Name }).FirstOrDefaultAsync(ct);
            if (p is null) throw Kalypsis.Application.Common.AppException.NotFound("Policy");
            parts.Add($"Συμβόλαιο: {p.PolicyNumber}; εταιρεία: {p.Carrier}; κλάδος: {p.PolicyType}; κατάσταση: {p.Status}; έναρξη: {p.StartDate}; λήξη: {p.EndDate}; μικτό: {p.Premium:0.00}; καθαρό: {p.NetPremium:0.00}; χαρακτηριστικό: {p.Characteristic}; σημειώσεις: {p.Notes}");
        }
        return parts.Count == 0 ? "Δεν επιλέχθηκε συγκεκριμένος πελάτης ή συμβόλαιο." : string.Join("\n", parts);
    }
    private static string ApplyVariables(string template, string context) => template.Replace("{{context}}", context, StringComparison.OrdinalIgnoreCase);
    private async Task<bool> ShouldStoreResultsAsync(Guid tenantId, CancellationToken ct)
    {
        var raw = await _db.IntegrationSettings.AsNoTracking().Where(x => x.TenantId == tenantId && (x.Service == "Ai" || x.Service == "OpenAI") && x.KeyName == "OpenAiStoreResults").Select(x => x.Value).FirstOrDefaultAsync(ct);
        return string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase) || raw == "1";
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
    private static decimal EstimateCostEur(string? model, int inputTokens, int outputTokens)
    {
        // Approximate list pricing, converted to EUR for an office-facing guardrail.
        var (inputPerMillion, outputPerMillion) = (model ?? "").ToLowerInvariant() switch
        {
            var m when m.Contains("gpt-4o-mini") => (0.14m, 0.56m),
            var m when m.Contains("gpt-4o") => (2.30m, 9.20m),
            var m when m.Contains("gpt-4.1-mini") => (0.35m, 1.40m),
            _ => (0m, 0m)
        };
        return inputTokens / 1_000_000m * inputPerMillion + outputTokens / 1_000_000m * outputPerMillion;
    }
    private static string Csv(string? value) => string.IsNullOrEmpty(value) ? "" : (value.Contains(';') || value.Contains('"') || value.Contains('\n') ? $"\"{value.Replace("\"", "\"\"")}\"" : value);
}
