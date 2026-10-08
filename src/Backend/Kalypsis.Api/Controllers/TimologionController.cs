using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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
/// Server-side connector for the Timologion electronic-invoicing provider.
/// Secrets live in encrypted IntegrationSettings and are never returned to
/// the SPA. All invoice operations are proxied server-to-server.
/// </summary>
[ApiController]
[Route("api/timologion")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Integrations)]
public sealed class TimologionController : ControllerBase
{
    private const string Service = "Timologion";
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _configuration;

    public TimologionController(AppDbContext db, ICurrentUser current, IHttpClientFactory http, IConfiguration configuration)
    { _db = db; _current = current; _http = http; _configuration = configuration; }

    private Guid TenantId => _current.TenantId ?? throw new InvalidOperationException("Δεν υπάρχει γραφείο.");

    private async Task<Dictionary<string, string?>> Settings(CancellationToken ct)
    {
        var rows = await _db.IntegrationSettings.AsNoTracking()
            .Where(x => x.TenantId == TenantId && x.Service == Service)
            .ToListAsync(ct);
        return rows.ToDictionary(x => x.KeyName, x => x.Value, StringComparer.OrdinalIgnoreCase);
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var settings = await Settings(ct);
        var baseUrl = settings.GetValueOrDefault("BaseUrl") ?? _configuration["Timologion:BaseUrl"] ?? "https://timologion.gr";
        var apiKey = settings.GetValueOrDefault("ApiKey");
        return Ok(new
        {
            configured = !string.IsNullOrWhiteSpace(apiKey),
            enabled = string.Equals(settings.GetValueOrDefault("Enabled"), "true", StringComparison.OrdinalIgnoreCase),
            baseUrl,
            environment = settings.GetValueOrDefault("Environment") ?? "sandbox",
            hasApiKey = !string.IsNullOrWhiteSpace(apiKey),
            maskedApiKey = string.IsNullOrWhiteSpace(apiKey) ? null : $"{apiKey[..Math.Min(8, apiKey.Length)]}…",
        });
    }

    public sealed record SettingsBody(string? BaseUrl, string? ApiKey, bool Enabled, string? Environment);

    [HttpPut("settings")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<IActionResult> SaveSettings([FromBody] SettingsBody body, CancellationToken ct)
    {
        var values = new Dictionary<string, string?>
        {
            ["BaseUrl"] = string.IsNullOrWhiteSpace(body.BaseUrl) ? "https://timologion.gr" : body.BaseUrl.Trim().TrimEnd('/'),
            ["Enabled"] = body.Enabled ? "true" : "false",
            ["Environment"] = string.Equals(body.Environment, "production", StringComparison.OrdinalIgnoreCase) ? "production" : "sandbox",
        };
        if (!string.IsNullOrWhiteSpace(body.ApiKey)) values["ApiKey"] = body.ApiKey.Trim();
        foreach (var pair in values)
        {
            var row = await _db.IntegrationSettings.FirstOrDefaultAsync(x => x.TenantId == TenantId && x.Service == Service && x.KeyName == pair.Key, ct);
            if (row is null)
            {
                row = new IntegrationSetting { Id = Guid.NewGuid(), TenantId = TenantId, Service = Service, KeyName = pair.Key };
                _db.IntegrationSettings.Add(row);
            }
            if (pair.Key != "ApiKey" || !string.IsNullOrWhiteSpace(pair.Value)) row.Value = pair.Value;
            row.IsSecret = pair.Key == "ApiKey";
            row.Notes = "Σύνδεση παρόχου Timologion από το Kalypsis.";
        }
        await _db.SaveChangesAsync(ct);
        return await Status(ct);
    }

    [HttpPost("test")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<IActionResult> Test(CancellationToken ct)
        => await Proxy(HttpMethod.Get, "/api/integrations/kalypsis/status", null, ct);

    [HttpPost("sync/customers")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<IActionResult> SyncCustomers(CancellationToken ct)
    {
        var settings = await Settings(ct);
        var count = 0;
        var failed = 0;
        var customers = await _db.Customers.AsNoTracking().Take(2000).ToListAsync(ct);
        foreach (var customer in customers)
        {
            var response = await Proxy(HttpMethod.Post, "/api/integrations/kalypsis/clients", new
            {
                externalId = customer.Id.ToString(),
                legalName = string.IsNullOrWhiteSpace(customer.CompanyName)
                    ? $"{customer.FirstName} {customer.LastName}".Trim()
                    : customer.CompanyName,
                vatNumber = customer.VatNumber,
                taxOffice = customer.TaxOffice,
                activity = customer.Occupation,
                addressLine = customer.Address,
                city = customer.City,
                postalCode = customer.PostalCode,
                country = "GR",
                email = customer.Email,
                phone = customer.MobilePhone ?? customer.Phone,
                notes = customer.Notes,
            }, ct, knownSettings: settings);
            if (response is ObjectResult { StatusCode: >= 200 and < 300 }) count++; else failed++;
        }
        return Ok(new { ok = failed == 0, synced = count, failed });
    }

    [HttpGet("clients")]
    public async Task<IActionResult> Clients([FromQuery] string? search, CancellationToken ct)
        => await Proxy(HttpMethod.Get, "/api/integrations/kalypsis/clients" + (string.IsNullOrWhiteSpace(search) ? "" : $"?search={Uri.EscapeDataString(search)}"), null, ct);

    [HttpGet("documents")]
    public async Task<IActionResult> Documents([FromQuery] string? status, CancellationToken ct)
        => await Proxy(HttpMethod.Get, "/api/integrations/kalypsis/documents" + (string.IsNullOrWhiteSpace(status) ? "" : $"?status={Uri.EscapeDataString(status)}"), null, ct);

    [HttpGet("payments")]
    public async Task<IActionResult> Payments([FromQuery] string? clientId, CancellationToken ct)
        => await Proxy(HttpMethod.Get, "/api/integrations/kalypsis/payments" + (string.IsNullOrWhiteSpace(clientId) ? "" : $"?clientId={Uri.EscapeDataString(clientId)}"), null, ct);

    [HttpPost("invoices/preview")]
    public async Task<IActionResult> Preview([FromBody] JsonElement body, CancellationToken ct)
        => await Proxy(HttpMethod.Post, "/api/integrations/kalypsis/invoices/preview", body, ct);

    [HttpPost("invoices/draft")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<IActionResult> Draft([FromBody] JsonElement body, CancellationToken ct)
        => await Proxy(HttpMethod.Post, "/api/integrations/kalypsis/invoices", body, ct);

    [HttpPost("invoices/issue")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<IActionResult> Issue([FromBody] JsonElement body, CancellationToken ct)
    {
        // The remote endpoint has its own independent production guard. This
        // local guard prevents a future UI mistake from even reaching it.
        if (!Request.Headers.TryGetValue("X-Kalypsis-Production-Confirm", out var confirm) || confirm != "issue-production")
            return StatusCode(428, new { ok = false, error = "Απαιτείται ρητή επιβεβαίωση έκδοσης παραγωγής." });
        return await Proxy(HttpMethod.Post, "/api/integrations/kalypsis/invoices/issue", body, ct,
            extraHeaders: new Dictionary<string, string> { ["X-Kalypsis-Production-Confirm"] = "issue-production" });
    }

    private async Task<IActionResult> Proxy(HttpMethod method, string path, object? body, CancellationToken ct,
        Dictionary<string, string>? extraHeaders = null)
        => await Proxy(method, path, body, ct, null, extraHeaders);

    private async Task<IActionResult> Proxy(HttpMethod method, string path, object? body, CancellationToken ct,
        Dictionary<string, string?>? knownSettings, Dictionary<string, string>? extraHeaders = null)
    {
        var settings = knownSettings ?? await Settings(ct);
        var baseUrl = settings.GetValueOrDefault("BaseUrl") ?? _configuration["Timologion:BaseUrl"] ?? "https://timologion.gr";
        var apiKey = settings.GetValueOrDefault("ApiKey");
        if (string.IsNullOrWhiteSpace(apiKey)) return BadRequest(new { ok = false, error = "Δεν έχει ρυθμιστεί κλειδί Timologion για το γραφείο." });
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var root) || root.Scheme != Uri.UriSchemeHttps && !root.IsLoopback)
            return BadRequest(new { ok = false, error = "Η διεύθυνση Timologion δεν είναι ασφαλής." });
        var client = _http.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(30);
        using var request = new HttpRequestMessage(method, new Uri(root, path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        if (extraHeaders is not null) foreach (var h in extraHeaders) request.Headers.TryAddWithoutValidation(h.Key, h.Value);
        if (body is not null && method != HttpMethod.Get)
        {
            var json = body is JsonElement element ? element.GetRawText() : JsonSerializer.Serialize(body);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        try
        {
            using var response = await client.SendAsync(request, ct);
            var text = await response.Content.ReadAsStringAsync(ct);
            return new ContentResult { StatusCode = (int)response.StatusCode, Content = text, ContentType = "application/json" };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return StatusCode(502, new { ok = false, error = "Δεν ήταν δυνατή η επικοινωνία με το Timologion.", detail = ex.Message });
        }
    }
}
