using System.Net.Http.Headers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Sms;

/// <summary>
/// Office-owned Bulker.gr HTTP gateway. The endpoint follows Bulker's v1
/// HTTP API (auth_key/from/to/text). A message without a tenant id is kept on
/// the old development path so platform/system workflows never accidentally
/// consume an office's credits.
/// </summary>
public sealed class BulkerSmsSender : ISmsSender
{
    private const string DefaultEndpoint = "https://api.bulker.gr/http/sms.php";
    private readonly IHttpClientFactory _httpFactory;
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly ILogger<BulkerSmsSender> _logger;

    public BulkerSmsSender(IHttpClientFactory httpFactory, AppDbContext db, ICurrentUser current, ILogger<BulkerSmsSender> logger)
    {
        _httpFactory = httpFactory;
        _db = db;
        _current = current;
        _logger = logger;
    }

    public async Task<bool> IsConfiguredAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = _current.TenantId;
        if (!tenantId.HasValue) return false;
        var settings = await LoadAsync(tenantId.Value, cancellationToken);
        return !string.IsNullOrWhiteSpace(settings.AuthKey)
            && !string.IsNullOrWhiteSpace(settings.From);
    }

    public async Task<SmsResult> SendAsync(SmsMessage message, CancellationToken cancellationToken = default)
    {
        var tenantId = message.TenantId ?? _current.TenantId;
        if (!tenantId.HasValue)
        {
            _logger.LogInformation("SMS skipped: no tenant provider selected for {Phone}", message.ToPhone);
            return new SmsResult(false, "Δεν έχει επιλεγεί γραφείο για την αποστολή SMS.");
        }

        var settings = await LoadAsync(tenantId.Value, cancellationToken);
        if (string.IsNullOrWhiteSpace(settings.AuthKey) || string.IsNullOrWhiteSpace(settings.From))
            return new SmsResult(false, "Το CRM SMS δεν έχει ρυθμιστεί για το συγκεκριμένο γραφείο. Συμπληρώστε Bulker Auth Key και αποστολέα στις Ρυθμίσεις CRM.");

        var endpoint = string.IsNullOrWhiteSpace(settings.Endpoint) ? DefaultEndpoint : settings.Endpoint.Trim();
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            return new SmsResult(false, "Το Bulker endpoint δεν είναι έγκυρο.");

        var form = new Dictionary<string, string>
        {
            ["auth_key"] = settings.AuthKey.Trim(),
            ["from"] = settings.From.Trim(),
            ["to"] = NormalizePhone(message.ToPhone),
            ["text"] = message.Body
        };

        try
        {
            var client = _httpFactory.CreateClient("bulker");
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("text/plain"));
            using var response = await client.PostAsync(uri, new FormUrlEncodedContent(form), cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Bulker send failed ({Status}): {Body}", (int)response.StatusCode, body);
                return new SmsResult(false, $"Bulker HTTP {(int)response.StatusCode}: {body}");
            }

            // Bulker may return CSV/plain text. Keep the raw response only in
            // the result for the SmsLog provider id; never log the auth key.
            if (body.Contains("error", StringComparison.OrdinalIgnoreCase)
                || body.Contains("failed", StringComparison.OrdinalIgnoreCase))
                return new SmsResult(false, body.Trim());
            return new SmsResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bulker SMS send threw");
            return new SmsResult(false, ex.Message);
        }
    }

    private async Task<BulkerSettings> LoadAsync(Guid tenantId, CancellationToken ct)
    {
        var rows = await _db.IntegrationSettings.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && (x.Service == "Crm" || x.Service == "Bulker"))
            .ToListAsync(ct);

        string? Get(params string[] names) => rows
            .Where(x => names.Contains(x.KeyName, StringComparer.OrdinalIgnoreCase))
            .OrderByDescending(x => x.Service.Equals("Crm", StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Value)
            .FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

        return new BulkerSettings(
            Get("BulkerAuthKey", "AuthKey", "ApiKey"),
            Get("BulkerFrom", "From", "Sender"),
            Get("BulkerEndpoint", "Endpoint"));
    }

    private static string NormalizePhone(string phone)
    {
        var value = new string(phone.Where(char.IsDigit).ToArray());
        if (value.StartsWith("00", StringComparison.Ordinal)) value = value[2..];
        if (value.StartsWith('6')) value = "30" + value;
        return value.StartsWith('+') ? value : "+" + value;
    }

    private sealed record BulkerSettings(string? AuthKey, string? From, string? Endpoint);
}
