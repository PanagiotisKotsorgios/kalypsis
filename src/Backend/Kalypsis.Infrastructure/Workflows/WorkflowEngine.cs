using System.Text.Json;
using System.Net;
using System.Net.Http.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Workflows;

/// <summary>
/// Declarative workflow engine. Every business event is dispatched here; the
/// engine finds all active <see cref="WorkflowRule"/> rows for the tenant
/// matching the event, evaluates the ConditionsJson, and runs every action.
/// Actions are intentionally idempotent so retries are safe.
/// </summary>
public class WorkflowEngine : IWorkflowEngine
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<WorkflowEngine> _log;
    private readonly IHttpClientFactory _http;

    public WorkflowEngine(IServiceScopeFactory scopes, ILogger<WorkflowEngine> log, IHttpClientFactory http)
    {
        _scopes = scopes;
        _log = log;
        _http = http;
    }

    public async Task FireAsync(WorkflowFireRequest request, CancellationToken ct = default)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var email = scope.ServiceProvider.GetService<IEmailSender>();
        var sms = scope.ServiceProvider.GetService<ISmsSender>();

        Guid? tenantId = request.Context.TryGetValue("tenantId", out var tid) && tid is Guid g ? g : null;
        if (tenantId is null) return;

        var rules = await db.WorkflowRules.IgnoreQueryFilters()
            .Include(r => r.Actions)
            .Where(r => r.TenantId == tenantId && r.TriggerEvent == request.Event && r.IsActive && r.DeletedAt == null)
            .OrderBy(r => r.Priority)
            .ToListAsync(ct);

        foreach (var rule in rules)
        {
            if (!Matches(rule.ConditionsJson, request.Context))
            {
                continue;
            }

            var success = true;
            var summaries = new List<string>();
            foreach (var action in rule.Actions.OrderBy(a => a.Order))
            {
                try
                {
                    var summary = await RunActionAsync(action, request.Context, db, email, sms, _http, ct);
                    summaries.Add($"{action.Action}: {summary}");
                }
                catch (Exception ex)
                {
                    success = false;
                    summaries.Add($"{action.Action} FAILED: {ex.Message}");
                    _log.LogError(ex, "Workflow action failed: {Action}", action.Action);
                }
            }

            var resultSummary = string.Join(" | ", summaries);
            db.WorkflowExecutions.Add(new WorkflowExecution
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                RuleId = rule.Id,
                Event = request.Event,
                EntityRef = request.Context.GetValueOrDefault("entityRef")?.ToString(),
                ExecutedAt = DateTime.UtcNow,
                Success = success,
                ResultSummary = resultSummary[..Math.Min(900, resultSummary.Length)]
            });
        }
        await db.SaveChangesAsync(ct);
    }

    private static bool Matches(string? conditionsJson, IReadOnlyDictionary<string, object?> ctx)
    {
        if (string.IsNullOrWhiteSpace(conditionsJson)) return true;
        try
        {
            using var doc = JsonDocument.Parse(conditionsJson);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var key = prop.Name;
                var ctxValue = ctx.GetValueOrDefault(key)?.ToString();
                var ruleValue = prop.Value.ToString();
                if (!string.Equals(ctxValue, ruleValue, StringComparison.OrdinalIgnoreCase)) return false;
            }
            return true;
        }
        catch { return true; }
    }

    private static async Task<string> RunActionAsync(
        WorkflowRuleAction action,
        IReadOnlyDictionary<string, object?> ctx,
        AppDbContext db,
        IEmailSender? email,
        ISmsSender? sms,
        IHttpClientFactory http,
        CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(action.PayloadJson) ? "{}" : action.PayloadJson);
        var payload = doc.RootElement;

        switch (action.Action)
        {
            case WorkflowAction.SendEmail:
                if (email is null) return "skipped (no IEmailSender)";
                var to = payload.GetPropertyOrEmpty("to");
                var subj = Render(payload.GetPropertyOrEmpty("subject"), ctx);
                var body = Render(payload.GetPropertyOrEmpty("body"), ctx);
                if (string.IsNullOrWhiteSpace(to)) return "skipped (no recipient)";
                var workflowTenant = ctx.TryGetValue("tenantId", out var tenantValue) && tenantValue is Guid tenantGuid
                    ? tenantGuid : (Guid?)null;
                await email.SendAsync(new EmailMessage(to, to, subj, body,
                    AllowCustomerRecipient: true, TenantId: workflowTenant), ct);
                return $"emailed {to}";

            case WorkflowAction.SendSms:
                if (sms is null) return "skipped (no ISmsSender)";
                var phone = payload.GetPropertyOrEmpty("phone");
                var smsBody = Render(payload.GetPropertyOrEmpty("body"), ctx);
                if (string.IsNullOrWhiteSpace(phone)) return "skipped (no phone)";
                var smsTenant = ctx.TryGetValue("tenantId", out var smsTenantValue) && smsTenantValue is Guid smsTenantGuid
                    ? smsTenantGuid : (Guid?)null;
                await sms.SendAsync(new SmsMessage(phone, smsBody, smsTenant), ct);
                return $"sms→ {phone}";

            case WorkflowAction.CreateNotification:
                if (!ctx.TryGetValue("tenantId", out var t) || t is not Guid tg) return "skipped";
                Guid? uid = ctx.TryGetValue("userId", out var u) && u is Guid ug ? ug : null;
                if (uid is null) return "skipped (no userId)";
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = tg,
                    UserId = uid.Value,
                    Title = Render(payload.GetPropertyOrEmpty("title"), ctx),
                    Body = Render(payload.GetPropertyOrEmpty("body"), ctx),
                    Category = payload.GetPropertyOrEmpty("category"),
                    Link = payload.GetPropertyOrEmpty("link")
                });
                return "notification queued";

            case WorkflowAction.CreateTask:
                if (!ctx.TryGetValue("tenantId", out var taskTenantValue) || taskTenantValue is not Guid taskTenant)
                    return "skipped (no tenantId)";
                var title = Render(payload.GetPropertyOrEmpty("title"), ctx);
                if (string.IsNullOrWhiteSpace(title)) return "skipped (no title)";
                var task = new AgencyTask
                {
                    Id = Guid.NewGuid(),
                    TenantId = taskTenant,
                    Title = title[..Math.Min(200, title.Length)],
                    Description = Render(payload.GetPropertyOrEmpty("description"), ctx),
                    Priority = ParsePriority(payload.GetPropertyOrEmpty("priority")),
                    DueAt = ParseDateTime(payload.GetPropertyOrEmpty("dueAt")),
                    AssignedToUserId = ParseGuid(payload.GetPropertyOrEmpty("assignedToUserId")),
                    CustomerId = ParseGuid(payload.GetPropertyOrEmpty("customerId")) ?? ParseGuid(ctx.GetValueOrDefault("customerId")?.ToString()),
                    PolicyId = ParseGuid(payload.GetPropertyOrEmpty("policyId")) ?? ParseGuid(ctx.GetValueOrDefault("policyId")?.ToString()),
                    ProducerId = ParseGuid(payload.GetPropertyOrEmpty("producerId")) ?? ParseGuid(ctx.GetValueOrDefault("producerId")?.ToString())
                };
                if (task.AssignedToUserId.HasValue && !await db.Users.AnyAsync(x => x.Id == task.AssignedToUserId && x.TenantId == taskTenant && x.DeletedAt == null, ct)) task.AssignedToUserId = null;
                if (task.CustomerId.HasValue && !await db.Customers.AnyAsync(x => x.Id == task.CustomerId && x.TenantId == taskTenant && x.DeletedAt == null, ct)) task.CustomerId = null;
                if (task.PolicyId.HasValue && !await db.Policies.AnyAsync(x => x.Id == task.PolicyId && x.TenantId == taskTenant && x.DeletedAt == null, ct)) task.PolicyId = null;
                if (task.ProducerId.HasValue && !await db.Producers.AnyAsync(x => x.Id == task.ProducerId && x.TenantId == taskTenant && x.DeletedAt == null, ct)) task.ProducerId = null;
                db.AgencyTasks.Add(task);
                return $"task created: {task.Title}";

            case WorkflowAction.TagCustomer:
                if (!ctx.TryGetValue("tenantId", out var tagTenantValue) || tagTenantValue is not Guid tagTenant)
                    return "skipped (no tenantId)";
                var customerId = ParseGuid(payload.GetPropertyOrEmpty("customerId")) ?? ParseGuid(ctx.GetValueOrDefault("customerId")?.ToString());
                var tag = Render(payload.GetPropertyOrEmpty("tag"), ctx).Trim();
                if (!customerId.HasValue || string.IsNullOrWhiteSpace(tag)) return "skipped (customer/tag missing)";
                var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == customerId && x.TenantId == tagTenant && x.DeletedAt == null, ct);
                if (customer is null) return "skipped (customer not found)";
                var tags = ParseTags(customer.TagsJson);
                if (!tags.Contains(tag, StringComparer.OrdinalIgnoreCase)) tags.Add(tag);
                customer.TagsJson = JsonSerializer.Serialize(tags);
                return $"tagged customer: {tag}";

            case WorkflowAction.Webhook:
            {
                var url = payload.GetPropertyOrEmpty("url").Trim();
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
                    return "skipped (webhook requires HTTPS URL)";
                if (IPAddress.TryParse(uri.Host, out var ip) && (IPAddress.IsLoopback(ip) || ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal))
                    return "skipped (private webhook address)";
                var client = http.CreateClient("workflow-webhook");
                using var response = await client.PostAsJsonAsync(uri, ctx, cancellationToken: ct);
                return $"webhook {(int)response.StatusCode}";
            }

            default:
                return "noop";
        }
    }

    private static string Render(string template, IReadOnlyDictionary<string, object?> ctx)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        var output = template;
        foreach (var kv in ctx)
        {
            output = output.Replace($"{{{{{kv.Key}}}}}", kv.Value?.ToString() ?? "");
        }
        return output;
    }

    private static Guid? ParseGuid(string? value) => Guid.TryParse(value, out var id) ? id : null;

    private static DateTime? ParseDateTime(string value) => DateTime.TryParse(value, out var parsed) ? parsed : null;

    private static AgencyTaskPriority ParsePriority(string value)
        => Enum.TryParse<AgencyTaskPriority>(value, true, out var priority)
            ? priority
            : int.TryParse(value, out var number) && Enum.IsDefined(typeof(AgencyTaskPriority), number)
                ? (AgencyTaskPriority)number : AgencyTaskPriority.Normal;

    private static List<string> ParseTags(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<string>();
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>(); }
        catch { return new List<string>(); }
    }
}

internal static class JsonElementExtensions
{
    public static string GetPropertyOrEmpty(this JsonElement e, string name) =>
        e.TryGetProperty(name, out var v)
            ? v.ValueKind == JsonValueKind.String ? v.GetString() ?? string.Empty : v.ToString()
            : string.Empty;
}
