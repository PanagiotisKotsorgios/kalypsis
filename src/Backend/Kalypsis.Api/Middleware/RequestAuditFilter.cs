using System.Diagnostics;
using System.Security.Claims;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Kalypsis.Api.Middleware;

/// <summary>
/// Action filter that writes one AuditLog row per state-changing or sensitive
/// HTTP request. Catches what the SaveChanges audit pipeline can't see:
///
///   - Pure GET reads of sensitive endpoints (exports, audit log queries,
///     ip-blocks, premium-features lookups).
///   - 4xx / 5xx outcomes (rejected attempts, errors).
///   - Endpoints that don't write to the DB (login challenge step etc).
///
/// Rules:
///   - GET requests are logged only for paths matched in <see cref="SensitiveGetPrefixes"/>.
///   - POST/PUT/PATCH/DELETE are always logged.
///   - We never log request bodies — only method, path (query-string stripped),
///     status code, duration, user, tenant, ip. PII / passwords stay out.
///   - Failed auth (401) / forbidden (403) / rate-limited (429) are also logged
///     because those are the events a security review cares about most.
/// </summary>
public sealed class RequestAuditFilter : IAsyncActionFilter
{
    // GET paths considered sensitive enough to audit even without a write.
    private static readonly string[] SensitiveGetPrefixes =
    {
        "/api/data-exports/",
        "/api/exports/",
        "/api/paragogi-exports/",
        "/api/platform/",
        "/api/audit",
        "/api/me/premium-features",
        "/api/me/2fa",
        "/api/customers/",
        "/api/policies/",
        "/api/producer-reconciliation"
    };

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var sw = Stopwatch.StartNew();
        var executed = await next();
        sw.Stop();

        var http = context.HttpContext;
        var method = http.Request.Method;
        var path = http.Request.Path.Value ?? "";
        var status = http.Response.StatusCode;

        if (!ShouldAudit(method, path, status)) return;

        try
        {
            var db = http.RequestServices.GetService<AppDbContext>();
            if (db is null) return;

            var current = http.RequestServices.GetService<ICurrentUser>();
            var userId = current?.UserId;
            var tenantId = current?.TenantId;
            // Fallback: pull straight from the principal when ICurrentUser isn't filled in
            // (e.g., anonymous endpoints where the filter still runs).
            if (userId is null && Guid.TryParse(http.User.FindFirstValue("sub"), out var u)) userId = u;

            // Strip query string — never log it (may contain search terms etc).
            var safePath = path.Length > 256 ? path[..256] : path;
            // Action column is `varchar(64)`. Build verb+path then truncate.
            // The PagePath column holds the full path separately, so no info
            // is lost — just the duplicated "METHOD /path" composite is short.
            var actionFull = $"{method} {safePath}";
            var actionTruncated = actionFull.Length > 64 ? actionFull[..64] : actionFull;

            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow,
                TenantId = tenantId,
                UserId = userId,
                EntityName = "HttpRequest",
                EntityId = string.Empty,
                Action = actionTruncated,
                Category = ClassifyCategory(method, safePath, status),
                PagePath = safePath,
                Metadata = $"{{\"status\":{status},\"durMs\":{sw.ElapsedMilliseconds}}}",
                IpAddress = http.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Trim(http.Request.Headers.UserAgent.ToString(), 512)
            });
            await db.SaveChangesAsync(http.RequestAborted);
        }
        catch
        {
            // Audit must NEVER block the request. Drop silently on failure
            // — observability is best-effort, the response is the contract.
        }
    }

    private static bool ShouldAudit(string method, string path, int status)
    {
        // Always audit auth failures, forbids, rate-limits, server errors.
        if (status == 401 || status == 403 || status == 429 || status >= 500) return true;

        // Skip health checks and noisy meta endpoints.
        if (path.StartsWith("/api/health", StringComparison.OrdinalIgnoreCase)) return false;
        if (path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase)) return false;

        if (method == "GET")
        {
            foreach (var p in SensitiveGetPrefixes)
                if (path.StartsWith(p, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        // Every state-changing verb is auditable.
        return method is "POST" or "PUT" or "PATCH" or "DELETE";
    }

    private static string ClassifyCategory(string method, string path, int status)
    {
        if (status is 401 or 403) return "Security";
        if (status == 429) return "Security";
        if (path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase)) return "Authentication";
        if (path.StartsWith("/api/data-exports/", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/exports/", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/paragogi-exports/", StringComparison.OrdinalIgnoreCase)) return "Export";
        if (path.StartsWith("/api/platform/", StringComparison.OrdinalIgnoreCase)) return "Admin";
        return method == "GET" ? "Read" : "Data";
    }

    private static string? Trim(string? s, int max) =>
        string.IsNullOrEmpty(s) ? s : (s.Length <= max ? s : s[..max]);
}
