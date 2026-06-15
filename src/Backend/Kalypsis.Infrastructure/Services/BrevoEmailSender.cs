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

    private Task<Kalypsis.Domain.Entities.PlatformSetting?> GetSettingsAsync(CancellationToken ct)
        => _db.PlatformSettings.IgnoreQueryFilters().OrderBy(s => s.CreatedAt).FirstOrDefaultAsync(ct);

    private static string StripHtml(string html) =>
        System.Text.RegularExpressions.Regex.Replace(html, "<.*?>", string.Empty);
}
