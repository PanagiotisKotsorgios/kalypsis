using System.Net.Http.Headers;
using System.Net.Http.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Services;

public sealed class BrevoEmailSender : IEmailSender
{
    private const string BrevoEndpoint = "https://api.brevo.com/v3/smtp/email";
    private readonly IHttpClientFactory _httpFactory;
    private readonly AppDbContext _db;
    private readonly ILogger<BrevoEmailSender> _logger;

    public BrevoEmailSender(IHttpClientFactory httpFactory, AppDbContext db, ILogger<BrevoEmailSender> logger)
    {
        _httpFactory = httpFactory;
        _db = db;
        _logger = logger;
    }

    public async Task<bool> IsConfiguredAsync(CancellationToken cancellationToken = default)
    {
        var settings = await GetSettingsAsync(cancellationToken);
        return !string.IsNullOrWhiteSpace(settings?.BrevoApiKey)
               && !string.IsNullOrWhiteSpace(settings?.BrevoSenderEmail);
    }

    public async Task<EmailResult> SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var settings = await GetSettingsAsync(cancellationToken);
        if (settings is null
            || string.IsNullOrWhiteSpace(settings.BrevoApiKey)
            || string.IsNullOrWhiteSpace(settings.BrevoSenderEmail))
        {
            _logger.LogWarning("Brevo not configured; refusing to send email to {Email}", message.ToEmail);
            return new EmailResult(false, "Email sending is not configured by the platform administrator.");
        }

        var client = _httpFactory.CreateClient("brevo");
        client.DefaultRequestHeaders.Accept.Clear();
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.Remove("api-key");
        client.DefaultRequestHeaders.Add("api-key", settings.BrevoApiKey);

        var payload = new
        {
            sender = new
            {
                name = settings.BrevoSenderName ?? "Kalypsis",
                email = settings.BrevoSenderEmail
            },
            to = new[] { new { email = message.ToEmail, name = message.ToName } },
            subject = message.Subject,
            htmlContent = message.HtmlBody,
            textContent = message.TextBody ?? StripHtml(message.HtmlBody)
        };

        try
        {
            var resp = await client.PostAsJsonAsync(BrevoEndpoint, payload, cancellationToken);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Brevo send failed ({Status}): {Body}", (int)resp.StatusCode, body);
                return new EmailResult(false, $"Brevo HTTP {(int)resp.StatusCode}: {body}");
            }
            return new EmailResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Brevo send threw");
            return new EmailResult(false, ex.Message);
        }
    }

    public async Task<KeyValidationResult> ValidateKeyAsync(CancellationToken cancellationToken = default)
    {
        var settings = await GetSettingsAsync(cancellationToken);
        var key = settings?.BrevoApiKey?.Trim();
        if (string.IsNullOrWhiteSpace(key))
            return new KeyValidationResult(false, null, null, null,
                "Δεν έχει αποθηκευτεί Brevo API key. Δημιουργήστε κλειδί από Brevo → SMTP & API και κάντε το paste εδώ.");

        // Sanity-check the key shape BEFORE hitting Brevo. Real Brevo v3
        // API keys are always `xkeysib-<64-hex>-<16-alnum>` — if the
        // admin pasted the SMTP password or the masked display value
        // («**********xxxxxx»), the shape check catches it instantly
        // without a round-trip.
        var preview = MaskKey(key);
        if (!key.StartsWith("xkeysib-", StringComparison.Ordinal))
            return new KeyValidationResult(false, null, null, preview,
                $"Το κλειδί που αποθηκεύσατε ξεκινά με «{key[..Math.Min(8, key.Length)]}…» — αναμενόμενη μορφή Brevo κλειδιού είναι «xkeysib-…». Πιθανό να αντιγράψατε τον SMTP κωδικό αντί για το API key ή τη μασκαρισμένη τιμή αντί για το πλήρες κλειδί.");
        if (key.Length < 60)
            return new KeyValidationResult(false, null, null, preview,
                $"Το κλειδί έχει {key.Length} χαρακτήρες — τα Brevo κλειδιά είναι συνήθως ~87. Πιθανό να χάθηκε τμήμα κατά το paste.");
        if (key.Contains('•') || key.Contains('*') || key.Contains('…'))
            return new KeyValidationResult(false, null, null, preview,
                "Το κλειδί περιέχει bullet/asterisk/ellipsis χαρακτήρες. Πιθανό να αντιγράψατε τη μασκαρισμένη τιμή («**********xxxxxx») αντί για το πλήρες κλειδί που εμφανίζεται μία μόνο φορά κατά τη δημιουργία στο Brevo.");

        // Hit Brevo's /v3/account endpoint — needs only the API key, no
        // sender / template. If this fails with 401 the key itself is
        // wrong; anything else (2xx) means the key is fine and any send
        // failure is a sender-verification / DKIM / quota problem.
        var client = _httpFactory.CreateClient("brevo");
        client.DefaultRequestHeaders.Accept.Clear();
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.Remove("api-key");
        client.DefaultRequestHeaders.Add("api-key", key);
        try
        {
            var resp = await client.GetAsync("https://api.brevo.com/v3/account", cancellationToken);
            var body = await resp.Content.ReadAsStringAsync(cancellationToken);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogError("Brevo /v3/account failed ({Status}): {Body}", (int)resp.StatusCode, body);
                var hint = (int)resp.StatusCode == 401
                    ? " → Το αποθηκευμένο κλειδί δεν αναγνωρίζεται. Ελέγξτε στο Brevo → SMTP & API αν το κλειδί (τελικά ψηφία που φαίνονται) ταιριάζει με αυτό εδώ, και ότι δεν έχετε ήδη σβήσει/regenerate."
                    : "";
                return new KeyValidationResult(false, null, null, preview,
                    $"Brevo HTTP {(int)resp.StatusCode}: {body}{hint}");
            }

            // Extract email + plan from the response for the OK case.
            var doc = System.Text.Json.JsonDocument.Parse(body);
            var email = doc.RootElement.TryGetProperty("email", out var e) ? e.GetString() : null;
            string? plan = null;
            if (doc.RootElement.TryGetProperty("plan", out var planEl) && planEl.ValueKind == System.Text.Json.JsonValueKind.Array && planEl.GetArrayLength() > 0)
                if (planEl[0].TryGetProperty("type", out var t)) plan = t.GetString();
            return new KeyValidationResult(true, email, plan, preview, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Brevo key validation threw");
            return new KeyValidationResult(false, null, null, preview, ex.Message);
        }
    }

    /// <summary>Masks the API key to «xkeysib-…LAST6» for display so
    /// the admin can cross-check the stored value against what Brevo's
    /// UI shows on the API-key list page — same masking style.</summary>
    private static string MaskKey(string key)
    {
        if (string.IsNullOrEmpty(key)) return "";
        if (key.Length <= 10) return new string('•', key.Length);
        var prefix = key.StartsWith("xkeysib-", StringComparison.Ordinal) ? "xkeysib-" : key[..4];
        var tail = key[^6..];
        return $"{prefix}…{tail}";
    }

    private Task<Kalypsis.Domain.Entities.PlatformSetting?> GetSettingsAsync(CancellationToken ct)
        => _db.PlatformSettings.IgnoreQueryFilters().OrderBy(s => s.CreatedAt).FirstOrDefaultAsync(ct);

    private static string StripHtml(string html) =>
        System.Text.RegularExpressions.Regex.Replace(html, "<.*?>", string.Empty);
}
