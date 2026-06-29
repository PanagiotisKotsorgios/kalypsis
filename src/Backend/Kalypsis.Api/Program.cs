using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Kalypsis.Api.Middleware;
using Kalypsis.Api.Defense;
using Kalypsis.Application;
using Kalypsis.Infrastructure;
using Kalypsis.Infrastructure.Auth;
using Kalypsis.Infrastructure.Persistence.Seeders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Phase 13 — external integration stub clients (replace with real implementations once credentials wired in IntegrationSettings)
builder.Services.AddScoped<Kalypsis.Application.Features.Phase13.IAadeClient, Kalypsis.Application.Features.Phase13.StubAadeClient>();
builder.Services.AddScoped<Kalypsis.Application.Features.Phase13.IGemiClient, Kalypsis.Application.Features.Phase13.StubGemiClient>();
builder.Services.AddScoped<Kalypsis.Application.Features.Phase13.IUsaeClient, Kalypsis.Application.Features.Phase13.StubUsaeClient>();
builder.Services.AddScoped<Kalypsis.Application.Features.Phase13.IDiasClient, Kalypsis.Application.Features.Phase13.StubDiasClient>();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
          ?? throw new InvalidOperationException("Jwt configuration section is missing.");

// Production-only secret sanity checks.
//   - HARD refuse only on JWT secret (token forgery boundary). Without a real
//     secret, every signed token in the system is suspect.
//   - DB connection: refuse only if missing entirely — if it's set but oddly
//     formatted (Coolify-managed MySQL strings vary), we trust the operator
//     and let it fail loudly at first DB call instead of preventing boot.
//   - CORS / Brevo: WARN loudly to stderr but never block boot. A misconfigured
//     CORS origin means the SPA can't talk to the API, but the operator needs
//     a running container in order to FIX the env var in Coolify.
if (!builder.Environment.IsDevelopment())
{
    if (string.IsNullOrWhiteSpace(jwt.Secret) || jwt.Secret.Length < 48)
        throw new InvalidOperationException(
            "Jwt:Secret must be at least 48 chars in production. Generate from a CSPRNG (e.g. openssl rand -base64 48). See SECURITY.md.");
    if (LooksLikePlaceholder(jwt.Secret))
        throw new InvalidOperationException("Jwt:Secret looks like a placeholder — refuse to start. See SECURITY.md.");

    var conn = builder.Configuration.GetConnectionString("Default") ?? string.Empty;
    if (string.IsNullOrWhiteSpace(conn))
        throw new InvalidOperationException("ConnectionStrings:Default is required in production.");
    if (!HasNonEmptyPassword(conn))
        Console.Error.WriteLine("[BOOT] WARNING: ConnectionStrings:Default does not appear to include a password. If your DB allows passwordless auth on the docker network this is fine, otherwise set one and redeploy.");

    var origins = builder.Configuration["Cors:FrontendOrigin"] ?? string.Empty;
    if (string.IsNullOrWhiteSpace(origins))
        Console.Error.WriteLine("[BOOT] WARNING: Cors:FrontendOrigin unset — the SPA will get CORS errors. Set Cors__FrontendOrigin to your https origin in Coolify.");
    else if (origins.Contains("localhost", StringComparison.OrdinalIgnoreCase)
             || (origins.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !origins.Contains("https://", StringComparison.OrdinalIgnoreCase)))
        Console.Error.WriteLine($"[BOOT] WARNING: Cors:FrontendOrigin '{origins}' is not an https:// origin. The SPA will fail mixed-content checks.");

    var brevoKey = builder.Configuration["Brevo:ApiKey"];
    if (string.IsNullOrWhiteSpace(brevoKey))
        Console.Error.WriteLine("[BOOT] WARNING: Brevo:ApiKey unset — password reset / contact form will not send email.");
}

static bool LooksLikePlaceholder(string s) =>
    s.Equals("change-me", StringComparison.OrdinalIgnoreCase)
    || s.Contains("placeholder", StringComparison.OrdinalIgnoreCase)
    || s.Contains("changeme", StringComparison.OrdinalIgnoreCase)
    || s.Contains("xxxx", StringComparison.OrdinalIgnoreCase);

static bool HasNonEmptyPassword(string connectionString)
{
    foreach (var part in connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    {
        var eq = part.IndexOf('=');
        if (eq <= 0) continue;
        var k = part[..eq].Trim();
        var v = part[(eq + 1)..].Trim();
        if (k.Equals("Password", StringComparison.OrdinalIgnoreCase) || k.Equals("Pwd", StringComparison.OrdinalIgnoreCase))
            return !string.IsNullOrWhiteSpace(v) && v.Length >= 8 && !LooksLikePlaceholder(v);
    }
    return false;
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = true;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = "role",
            NameClaimType = "sub"
        };
    });

builder.Services.AddAuthorization(opt =>
{
    opt.AddPolicy("PlatformAdmin", p => p.RequireClaim("role", nameof(Kalypsis.Domain.Enums.Role.PlatformAdmin)));
    opt.AddPolicy("PlatformLevel", p => p.RequireClaim("role",
        nameof(Kalypsis.Domain.Enums.Role.PlatformAdmin),
        nameof(Kalypsis.Domain.Enums.Role.PlatformEmployee)));
    // PlatformAdmin / PlatformEmployee are allowed everywhere so that, while
    // impersonating a tenant via X-Impersonate-Tenant, they can hit the same
    // endpoints the tenant's own staff would.
    opt.AddPolicy("AgencyAdmin", p => p.RequireClaim("role",
        nameof(Kalypsis.Domain.Enums.Role.AgencyAdmin),
        nameof(Kalypsis.Domain.Enums.Role.PlatformAdmin),
        nameof(Kalypsis.Domain.Enums.Role.PlatformEmployee)));
    opt.AddPolicy("AgencyStaff", p => p.RequireClaim("role",
        nameof(Kalypsis.Domain.Enums.Role.AgencyAdmin),
        nameof(Kalypsis.Domain.Enums.Role.AgencyUser),
        nameof(Kalypsis.Domain.Enums.Role.PlatformAdmin),
        nameof(Kalypsis.Domain.Enums.Role.PlatformEmployee)));
    opt.AddPolicy("Producer", p => p.RequireClaim("role", nameof(Kalypsis.Domain.Enums.Role.Producer)));
});

// CORS — restrict origins to the configured frontend (comma-separated allowed).
// AllowCredentials is required only if cookies were used; we use bearer tokens
// via the Authorization header so we keep it off (also relaxes the spec rule
// against AllowCredentials + wildcard origins / methods).
builder.Services.AddCors(o => o.AddPolicy("frontend", p =>
{
    var raw = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:5173";
    var origins = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    p.WithOrigins(origins)
        .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .WithHeaders("Content-Type", "Authorization", "X-Impersonate-Tenant", "Accept", "Accept-Language");
}));

// IP block list — sees rate-limit rejections and known-bad probe paths.
builder.Services.AddSingleton<IpBlockService>();

builder.Services.AddControllers(mvc =>
{
    // Global request audit — writes an AuditLog row per state-changing or
    // sensitive HTTP call. Reads/exports/auth-failures captured here.
    mvc.Filters.Add<Kalypsis.Api.Middleware.RequestAuditFilter>();
}).AddJsonOptions(opt =>
{
    opt.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    // Reject unknown JSON properties. Stops mass-assignment attacks where the
    // attacker tacks on fields like {"role":"PlatformAdmin","isActive":true,...}
    // hoping the model binder will quietly set them. Now they 400 instead.
    opt.JsonSerializerOptions.UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow;
});

// Hard cap on request body size — 8 MB. Uploads that exceed this get a 413 at
// the Kestrel level before any controller code runs. File-upload endpoints
// that legitimately need more can opt out per-action with [RequestSizeLimit].
builder.Services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(o =>
{
    o.Limits.MaxRequestBodySize = 8 * 1024 * 1024;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Per-purpose rate limits. Each policy is keyed by IP so a burst from one bot
// doesn't lock out everyone behind a NAT. Endpoints opt-in via [EnableRateLimiting].
//
// We also tap OnRejected to feed the IP block service: an IP that gets rate-limited
// repeatedly accumulates violations and eventually gets temp-banned at the edge.
builder.Services.AddRateLimiter(opt =>
{
    opt.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    static string IpKey(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "anonymous";

    // 1) Login: 10 / minute / IP (per-user lockout handles slow brute-force on a single account).
    opt.AddPolicy("login", ctx => RateLimitPartition.GetSlidingWindowLimiter(IpKey(ctx),
        _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 10, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 4, QueueLimit = 0
        }));

    // 2) Account creation: 5 / hour / IP. Brand-new registrations should be rare per IP.
    opt.AddPolicy("register", ctx => RateLimitPartition.GetFixedWindowLimiter(IpKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromHours(1), QueueLimit = 0 }));

    // 3) Forgot/reset password: 5 / 15-min / IP. Tight so the reset link can't be spammed.
    opt.AddPolicy("password-reset", ctx => RateLimitPartition.GetFixedWindowLimiter(IpKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));

    // 4) Public contact form: 5 / hour / IP.
    opt.AddPolicy("public-contact", ctx => RateLimitPartition.GetFixedWindowLimiter(IpKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromHours(1), QueueLimit = 0 }));

    // 5) Legacy "auth" alias — kept so existing [EnableRateLimiting("auth")] usages don't drop.
    opt.AddPolicy("auth", ctx => RateLimitPartition.GetSlidingWindowLimiter(IpKey(ctx),
        _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 20, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 4, QueueLimit = 0
        }));

    // 6) Global IP-wide ceiling. Anything not covered by a specific policy still
    // can't fire >300 req/min from a single IP — that's well above human use,
    // well below a brute force.
    opt.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetSlidingWindowLimiter(IpKey(ctx),
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 300, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0
            }));

    opt.OnRejected = async (ctx, ct) =>
    {
        var ip = IpKey(ctx.HttpContext);
        var blocks = ctx.HttpContext.RequestServices.GetRequiredService<IpBlockService>();
        // weight=1 so it takes a sustained burst (≥12 rejections in 10 min) to earn a ban
        blocks.RecordViolation(ip, "rate-limit", weight: 1);
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsync(
            "{\"code\":\"rate_limited\",\"message\":\"Πάρα πολλά αιτήματα. Δοκιμάστε ξανά σε λίγο.\"}", ct);
    };
});

// HSTS / HTTPS redirect in non-dev.
if (!builder.Environment.IsDevelopment())
{
    builder.Services.AddHsts(o =>
    {
        o.Preload = true;
        o.IncludeSubDomains = true;
        o.MaxAge = TimeSpan.FromDays(365);
    });
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

// Pipeline order matters. Cheapest checks first:
//   1) Security headers — set early so they're present even on early-aborted responses.
//   2) IP block + probe filter — drops banned IPs and obvious scanner traffic with no
//      DB or controller work behind them.
//   3) Exception middleware — turns any throw below into a clean JSON response.
//   4) CORS, rate limiter, auth, controllers.
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ApiVersionHeaderMiddleware>();
app.UseMiddleware<IpBlockMiddleware>();
app.UseMiddleware<ExceptionMiddleware>();
app.UseStaticFiles();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    service = "kalypsis-api",
    utcNow = DateTime.UtcNow
}));

// Lightweight contract-discovery endpoint. Clients hit this on boot to confirm
// they're talking to a compatible API version (today: 1). When a breaking
// change ships, this returns supported + deprecated + sunset dates.
app.MapGet("/api/version", () => Results.Ok(new
{
    current = Kalypsis.Api.Middleware.ApiVersionHeaderMiddleware.CurrentVersion,
    supported = new[] { "1" }
}));

app.MapControllers();

await DataSeeder.SeedAsync(app.Services);
await DemoDataSeeder.SeedAsync(app.Services);

app.Run();
