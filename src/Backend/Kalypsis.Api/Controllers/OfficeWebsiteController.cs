using System.Net.Mail;
using System.Text.Json;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>Office editor and request inbox for the FrontOffice website.</summary>
[ApiController]
[Route("api/office-website")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public sealed class OfficeWebsiteController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public OfficeWebsiteController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public sealed record WebsiteDto(Guid Id, string Slug, string? CustomDomain, string SiteName,
        string Tagline, string HeroTitle, string HeroBody, string? LogoUrl, string BrandColorHex,
        string PostsJson, string OffersJson, string BannersJson, string FormConfigJson, bool IsPublished);
    public sealed record SaveWebsiteBody(string? Slug, string? CustomDomain, string? SiteName,
        string? Tagline, string? HeroTitle, string? HeroBody, string? LogoUrl, string? BrandColorHex,
        string? PostsJson, string? OffersJson, string? BannersJson, string? FormConfigJson, bool IsPublished);
    public sealed record RequestDto(Guid Id, string FullName, string Email, string? Phone, string? Product,
        string Message, string? PreferredContact, bool ConsentGiven, string Status, string? Source,
        DateTime CreatedAt, DateTime? ContactedAt, string? InternalNotes);
    public sealed record UpdateRequestBody(string? Status, string? InternalNotes);

    [HttpGet]
    public async Task<ActionResult<WebsiteDto>> Get(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.OfficeWebsites.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        return Ok(ToDto(row ?? NewWebsite(tenantId)));
    }

    [HttpPut]
    [Authorize(Policy = "AgencyManager")]
    public async Task<ActionResult<WebsiteDto>> Save([FromBody] SaveWebsiteBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var slug = NormaliseSlug(body.Slug);
        var posts = ValidJson(body.PostsJson, "[]", requireArray: true);
        var offers = ValidJson(body.OffersJson, "[]", requireArray: true);
        var banners = ValidJson(body.BannersJson, "[]", requireArray: true);
        var formConfig = ValidJson(body.FormConfigJson, "{}", requireArray: false);
        var row = await _db.OfficeWebsites.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (row is null)
        {
            row = NewWebsite(tenantId);
            _db.OfficeWebsites.Add(row);
        }
        row.Slug = slug;
        row.CustomDomain = NormaliseDomain(body.CustomDomain);
        row.SiteName = Limit(body.SiteName, 200, "Το γραφείο μας");
        row.Tagline = Limit(body.Tagline, 500, "Ασφάλιση με προσωπική εξυπηρέτηση");
        row.HeroTitle = Limit(body.HeroTitle, 300, row.SiteName);
        row.HeroBody = Limit(body.HeroBody, 4000, "Ζητήστε ενημέρωση για τις ασφαλιστικές σας ανάγκες.");
        row.LogoUrl = LimitNullable(body.LogoUrl, 500);
        row.BrandColorHex = ValidColor(body.BrandColorHex) ? body.BrandColorHex!.Trim() : "#1f7bb3";
        row.PostsJson = posts; row.OffersJson = offers; row.BannersJson = banners; row.FormConfigJson = formConfig;
        row.IsPublished = body.IsPublished;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    [HttpGet("requests")]
    public async Task<ActionResult<IReadOnlyList<RequestDto>>> Requests([FromQuery] string? status, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var q = _db.OfficeWebsiteRequests.Where(x => x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(x => x.Status == status);
        var rows = await q.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);
        return Ok(rows.Select(ToDto).ToList());
    }

    [HttpPatch("requests/{id:guid}")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<ActionResult<RequestDto>> UpdateRequest(Guid id, [FromBody] UpdateRequestBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.OfficeWebsiteRequests.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (row is null) return NotFound();
        var allowed = new[] { "New", "InProgress", "Contacted", "Converted", "Closed" };
        if (!string.IsNullOrWhiteSpace(body.Status) && allowed.Contains(body.Status, StringComparer.OrdinalIgnoreCase))
        {
            row.Status = allowed.First(x => x.Equals(body.Status, StringComparison.OrdinalIgnoreCase));
            if (row.Status is "Contacted" or "Converted") row.ContactedAt ??= _clock.UtcNow;
        }
        if (body.InternalNotes is not null) row.InternalNotes = body.InternalNotes.Trim().Length > 4000 ? body.InternalNotes.Trim()[..4000] : body.InternalNotes.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    private static OfficeWebsite NewWebsite(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId, Slug = "to-grafeio-mas", SiteName = "Το γραφείο μας",
        Tagline = "Ασφάλιση με προσωπική εξυπηρέτηση", HeroTitle = "Είμαστε εδώ για την ασφάλειά σας",
        HeroBody = "Στείλτε μας το αίτημά σας και θα επικοινωνήσουμε μαζί σας.",
        PostsJson = "[]", OffersJson = "[]", BannersJson = "[]", FormConfigJson = "{}", BrandColorHex = "#1f7bb3"
    };

    private static WebsiteDto ToDto(OfficeWebsite x) => new(x.Id, x.Slug, x.CustomDomain, x.SiteName, x.Tagline,
        x.HeroTitle, x.HeroBody, x.LogoUrl, x.BrandColorHex, x.PostsJson, x.OffersJson, x.BannersJson, x.FormConfigJson, x.IsPublished);
    private static RequestDto ToDto(OfficeWebsiteRequest x) => new(x.Id, x.FullName, x.Email, x.Phone, x.Product,
        x.Message, x.PreferredContact, x.ConsentGiven, x.Status, x.Source, x.CreatedAt, x.ContactedAt, x.InternalNotes);
    private static string Limit(string? value, int max, string fallback) => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim()[..Math.Min(value.Trim().Length, max)];
    private static string? LimitNullable(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];
    private static string NormaliseSlug(string? value)
    {
        var s = (value ?? "to-grafeio-mas").Trim().ToLowerInvariant();
        s = System.Text.RegularExpressions.Regex.Replace(s, @"[^a-z0-9\-άέήίόύώα-ω]", "-");
        s = System.Text.RegularExpressions.Regex.Replace(s, "-+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(s) ? "to-grafeio-mas" : s[..Math.Min(s.Length, 120)];
    }
    private static string? NormaliseDomain(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant().Replace("https://", "").Replace("http://", "").TrimEnd('/');
    private static bool ValidColor(string? value) => value is not null && System.Text.RegularExpressions.Regex.IsMatch(value.Trim(), "^#[0-9a-fA-F]{6}$");
    private static string ValidJson(string? value, string fallback, bool requireArray)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        try
        {
            using var doc = JsonDocument.Parse(value);
            if (requireArray && doc.RootElement.ValueKind != JsonValueKind.Array) return fallback;
            if (!requireArray && doc.RootElement.ValueKind != JsonValueKind.Object) return fallback;
            return value.Length > 200_000 ? fallback : value;
        }
        catch { return fallback; }
    }
}

/// <summary>Unauthenticated public website API used by /site/{slug}.</summary>
[ApiController]
[Route("api/public/office-sites")]
public sealed class PublicOfficeWebsiteController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmailSender _email;
    private readonly IDateTimeProvider _clock;
    public PublicOfficeWebsiteController(AppDbContext db, IEmailSender email, IDateTimeProvider clock)
    { _db = db; _email = email; _clock = clock; }

    public sealed record PublicWebsiteDto(string Slug, string? CustomDomain, string SiteName, string Tagline,
        string HeroTitle, string HeroBody, string? LogoUrl, string BrandColorHex, string PostsJson,
        string OffersJson, string BannersJson, string FormConfigJson);
    public sealed record PublicRequestBody(string? FullName, string? Email, string? Phone, string? Product,
        string? Message, string? PreferredContact, bool ConsentGiven, string? Source);

    [HttpGet("{slug}")]
    [AllowAnonymous]
    public async Task<ActionResult<PublicWebsiteDto>> Get(string slug, CancellationToken ct)
    {
        var row = await _db.OfficeWebsites.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.DeletedAt == null && x.Slug == slug && x.IsPublished, ct);
        if (row is null) return NotFound();
        return Ok(new PublicWebsiteDto(row.Slug, row.CustomDomain, row.SiteName, row.Tagline, row.HeroTitle,
            row.HeroBody, row.LogoUrl, row.BrandColorHex, row.PostsJson, row.OffersJson, row.BannersJson, row.FormConfigJson));
    }

    [HttpPost("{slug}/requests")]
    [AllowAnonymous]
    public async Task<IActionResult> Submit(string slug, [FromBody] PublicRequestBody body, CancellationToken ct)
    {
        var row = await _db.OfficeWebsites.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.DeletedAt == null && x.Slug == slug && x.IsPublished, ct);
        if (row is null) return NotFound();
        var name = (body.FullName ?? "").Trim(); var email = (body.Email ?? "").Trim(); var message = (body.Message ?? "").Trim();
        if (name.Length < 2 || name.Length > 200 || message.Length < 5 || message.Length > 5000 || !body.ConsentGiven)
            return BadRequest(new { message = "Συμπληρώστε όνομα, μήνυμα και συγκατάθεση επικοινωνίας." });
        try { _ = new MailAddress(email); } catch { return BadRequest(new { message = "Το email δεν είναι έγκυρο." }); }
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == row.TenantId && x.IsActive, ct);
        if (tenant is null) return NotFound();
        var request = new OfficeWebsiteRequest
        {
            Id = Guid.NewGuid(), TenantId = row.TenantId, AgencyOfficeScopeId = row.AgencyOfficeScopeId,
            OfficeWebsiteId = row.Id, FullName = name, Email = email,
            Phone = Trim(body.Phone, 50), Product = Trim(body.Product, 120), Message = message,
            PreferredContact = Trim(body.PreferredContact, 30), ConsentGiven = true,
            Status = "New", Source = Trim(body.Source, 100) ?? "office-website"
        };
        _db.OfficeWebsiteRequests.Add(request);
        var admins = await _db.Users.IgnoreQueryFilters().Where(u => u.TenantId == row.TenantId && u.IsActive &&
            (u.Role == Role.AgencyAdmin || u.Role == Role.AgencyOfficeAdmin)).ToListAsync(ct);
        foreach (var admin in admins)
            _db.Notifications.Add(new Notification { Id = Guid.NewGuid(), TenantId = row.TenantId, UserId = admin.Id,
                Title = "Νέα αίτηση από την ιστοσελίδα", Body = $"{name} · {email}", Category = "OfficeWebsite", Link = "/app/office-website" });
        await _db.SaveChangesAsync(ct);
        var recipient = string.IsNullOrWhiteSpace(tenant.ContactEmail)
            ? admins.Select(x => x.Email).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))
            : tenant.ContactEmail;
        if (!string.IsNullOrWhiteSpace(recipient))
        {
            var html = $"<h2>Νέα αίτηση ασφάλισης</h2><p><strong>Ονοματεπώνυμο:</strong> {System.Net.WebUtility.HtmlEncode(name)}</p><p><strong>Email:</strong> {System.Net.WebUtility.HtmlEncode(email)}</p><p><strong>Τηλέφωνο:</strong> {System.Net.WebUtility.HtmlEncode(request.Phone ?? "—")}</p><p><strong>Κλάδος:</strong> {System.Net.WebUtility.HtmlEncode(request.Product ?? "—")}</p><p>{System.Net.WebUtility.HtmlEncode(message).Replace("\n", "<br>")}</p>";
            await _email.SendAsync(new EmailMessage(recipient!, tenant.Name, "Νέα αίτηση από την ιστοσελίδα του γραφείου", html,
                $"Νέα αίτηση από {name}: {message}", AllowCustomerRecipient: true, TenantId: row.TenantId), ct);
        }
        return Ok(new { message = "Το αίτημά σας καταχωρήθηκε. Θα επικοινωνήσουμε σύντομα." });
    }

    [HttpGet("resolve")]
    [AllowAnonymous]
    public async Task<ActionResult<PublicWebsiteDto>> Resolve([FromQuery] string? host, CancellationToken ct)
    {
        var normalised = (host ?? Request.Host.Host).Trim().ToLowerInvariant();
        var row = await _db.OfficeWebsites.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.DeletedAt == null && x.IsPublished && x.CustomDomain == normalised, ct);
        if (row is null) return NotFound();
        return Ok(new PublicWebsiteDto(row.Slug, row.CustomDomain, row.SiteName, row.Tagline, row.HeroTitle,
            row.HeroBody, row.LogoUrl, row.BrandColorHex, row.PostsJson, row.OffersJson, row.BannersJson, row.FormConfigJson));
    }

    private static string? Trim(string? v, int max) => string.IsNullOrWhiteSpace(v) ? null : v.Trim()[..Math.Min(v.Trim().Length, max)];
}
