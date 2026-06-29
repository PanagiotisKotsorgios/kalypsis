namespace Kalypsis.Api.Middleware;

/// <summary>
/// Sets a strict but JSON-API-friendly set of security headers on every response.
/// The API never serves HTML directly (the SPA is a separate container) so a
/// very tight CSP is fine here — even if someone tricks a browser into rendering
/// a response as HTML, scripts will be blocked.
///
/// References:
///   - OWASP Secure Headers Project
///   - MDN web security guides
///   - Mozilla observatory grading
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _isHttps;

    public SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment env)
    {
        _next = next;
        _isHttps = !env.IsDevelopment();
    }

    public Task Invoke(HttpContext ctx)
    {
        var h = ctx.Response.Headers;

        // Strip the server fingerprint so banner-scanners can't match versions.
        h.Remove("Server");
        h.Remove("X-Powered-By");
        h.Remove("X-AspNet-Version");
        h.Remove("X-AspNetMvc-Version");

        // Tells browsers to honour declared content-types and not sniff.
        h["X-Content-Type-Options"] = "nosniff";

        // Disable iframe embedding of API responses (clickjacking defense even
        // though the API doesn't return HTML — belt-and-braces).
        h["X-Frame-Options"] = "DENY";

        // Don't leak the referring URL beyond the origin.
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";

        // Lock down browser feature use for any HTML accidentally served from
        // the API origin. The legitimate UI lives on a different origin (SPA).
        h["Permissions-Policy"] =
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

        // Cross-origin isolation hints.
        h["Cross-Origin-Opener-Policy"] = "same-origin";
        h["Cross-Origin-Resource-Policy"] = "same-site";

        // A very tight CSP: the API only serves JSON/files, never executable HTML.
        // 'none' default means an attacker can't trick a browser into running JS
        // even if they coerce a response to text/html via a bug.
        h["Content-Security-Policy"] =
            "default-src 'none'; " +
            "frame-ancestors 'none'; " +
            "base-uri 'none'; " +
            "form-action 'none'";

        // HSTS in production only — browsers ignore it on http:// anyway, but
        // setting it during local http:// dev would just be noise.
        if (_isHttps)
        {
            h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
        }

        return _next(ctx);
    }
}
