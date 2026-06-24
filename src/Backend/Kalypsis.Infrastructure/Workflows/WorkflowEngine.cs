using System.Text.Json;
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

    public WorkflowEngine(IServiceScopeFactory scopes, ILogger<WorkflowEngine> log)
    {
        _scopes = scopes;
        _log = log;
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
                    var summary = await RunActionAsync(action, request.Context, db, email, sms, ct);
                    summaries.Add($"{action.Action}: {summary}");
                }
                catch (Exception ex)
                {
                    success = false;
                    summaries.Add($"{action.Action} FAILED: {ex.Message}");
                    _log.LogError(ex, "Workflow action failed: {Action}", action.Action);
                }
            }

            db.WorkflowExecutions.Add(new WorkflowExecution
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                RuleId = rule.Id,
                Event = request.Event,
                EntityRef = request.Context.GetValueOrDefault("entityRef")?.ToString(),
                ExecutedAt = DateTime.UtcNow,
                Success = success,
                ResultSummary = string.Join(" | ", summaries).Take(900).ToArray().ToString()
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
                await email.SendAsync(new EmailMessage(to, to, subj, body), ct);
                return $"emailed {to}";

            case WorkflowAction.SendSms:
                if (sms is null) return "skipped (no ISmsSender)";
                var phone = payload.GetPropertyOrEmpty("phone");
                var smsBody = Render(payload.GetPropertyOrEmpty("body"), ctx);
                if (string.IsNullOrWhiteSpace(phone)) return "skipped (no phone)";
                await sms.SendAsync(new SmsMessage(phone, smsBody), ct);
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
                return "task scaffolded";

            case WorkflowAction.TagCustomer:
                return "tag scaffolded";

            case WorkflowAction.Webhook:
                return "webhook scaffolded";

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
}

internal static class JsonElementExtensions
{
    public static string GetPropertyOrEmpty(this JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) ? v.GetString() ?? string.Empty : string.Empty;
}
