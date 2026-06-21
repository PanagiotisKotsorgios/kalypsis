using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json.Serialization;
using Kalypsis.Api.Middleware;
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

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
          ?? throw new InvalidOperationException("Jwt configuration section is missing.");

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

builder.Services.AddCors(o => o.AddPolicy("frontend", p =>
    p.WithOrigins(
            builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:5173"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

builder.Services.AddControllers().AddJsonOptions(opt =>
{
    opt.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Auth endpoints get an aggressive sliding-window limiter so credential-stuffing
// can't slip past account lockout (which is keyed per user).
builder.Services.AddRateLimiter(opt =>
{
    opt.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    opt.AddPolicy("auth", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new System.Threading.RateLimiting.SlidingWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 4,
                QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

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

app.MapControllers();

await DataSeeder.SeedAsync(app.Services);

app.Run();
