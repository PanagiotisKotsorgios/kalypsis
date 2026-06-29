using Kalypsis.Api.Defense;

namespace Kalypsis.Api.Middleware;

/// <summary>
/// First-line gate: if the requesting IP is currently auto-blocked or admin-blocked,
/// short-circuit with 403 before any other middleware does work. Also records
/// suspicious request shapes (oversized URLs, traversal patterns) as violations.
/// </summary>
public sealed class IpBlockMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IpBlockService _blocks;
    private readonly ILogger<IpBlockMiddleware> _logger;

    public IpBlockMiddleware(RequestDelegate next, IpBlockService blocks, ILogger<IpBlockMiddleware> logger)
    {
        _next = next;
        _blocks = blocks;
        _logger = logger;
    }

    public async Task Invoke(HttpContext ctx)
    {
        var ip = ctx.Connection.RemoteIpAddress?.ToString();
        if (_blocks.IsBlocked(ip))
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync("{\"code\":\"ip_blocked\",\"message\":\"Πρόσβαση από αυτή τη διεύθυνση έχει ανασταλεί προσωρινά.\"}");
            return;
        }

        // Cheap-but-strong probe heuristics. Path traversal / wp-admin scanning /
        // .env probes / oversized URI all earn a heavy violation weight so a
        // single suspicious request alone isn't a block but a flurry is.
        var path = ctx.Request.Path.Value ?? string.Empty;
        if (LooksMalicious(path))
        {
            _blocks.RecordViolation(ip, "probe", weight: 4);
            _logger.LogInformation("Probe-like path {Path} from {Ip}", path, ip);
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        if (ctx.Request.Path.HasValue && ctx.Request.Path.Value.Length > 2048)
        {
            _blocks.RecordViolation(ip, "oversize-path", weight: 4);
            ctx.Response.StatusCode = StatusCodes.Status414RequestUriTooLong;
            return;
        }

        await _next(ctx);
    }

    private static bool LooksMalicious(string path)
    {
        if (string.IsNullOrEmpty(path)) return false;
        // Quick allow for our own routes — strip them so the probe list doesn't accidentally hit a real path.
        if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return false;
        var lower = path.ToLowerInvariant();
        ReadOnlySpan<string> bad =
        [
            "/wp-admin", "/wp-login", "/wp-content", "/xmlrpc.php",
            "/.env", "/.git", "/.svn", "/phpmyadmin", "/phpinfo",
            "/cgi-bin/", "/etc/passwd", "/boot.ini",
            "/.aws/", "/.ssh/", "/web.config",
            "//", "%00", "..%2f", "../"
        ];
        foreach (var b in bad)
            if (lower.Contains(b, StringComparison.Ordinal)) return true;
        return false;
    }
}
