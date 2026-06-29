namespace Kalypsis.Api.Middleware;

/// <summary>
/// Stamps every API response with an X-API-Version header so clients can
/// detect the contract they're talking to. URL paths are intentionally NOT
/// versioned — this is a SaaS with live tenants whose installed frontend
/// would 404 the day a /v1/ prefix appeared. Versioning here is informational
/// for now; when a breaking change is actually shipped, new routes carry a
/// "/v2/" prefix alongside the old ones for an overlap window.
/// </summary>
public sealed class ApiVersionHeaderMiddleware
{
    public const string CurrentVersion = "1";
    public const string HeaderName = "X-API-Version";

    private readonly RequestDelegate _next;
    public ApiVersionHeaderMiddleware(RequestDelegate next) { _next = next; }

    public Task Invoke(HttpContext ctx)
    {
        ctx.Response.OnStarting(() =>
        {
            if (!ctx.Response.Headers.ContainsKey(HeaderName))
                ctx.Response.Headers[HeaderName] = CurrentVersion;
            return Task.CompletedTask;
        });
        return _next(ctx);
    }
}
