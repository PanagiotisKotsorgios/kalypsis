using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 8.5 — Platform-wide email templates managed by the superadmin.
/// Distinct from per-tenant <c>EmailTemplate</c>s. These are what Kalypsis itself
/// sends to its agency customers.
/// </summary>
[ApiController]
[Route("api/platform/email-templates")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformEmailTemplatesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly IEmailSender _email;

    public PlatformEmailTemplatesController(AppDbContext db, IDateTimeProvider clock, IEmailSender email)
    { _db = db; _clock = clock; _email = email; }

    public record TemplateDto(Guid Id, string Code, string Name, string Subject, string BodyHtml,
        string? BodyPlain, string Language, string? TriggerEvent, string? SampleVariablesJson,
        int? BrevoTemplateId, bool IsActive, bool IsSystem, DateTime? LastSentAt, int TimesSent);

    public record UpsertBody(string Code, string Name, string Subject, string BodyHtml,
        string? BodyPlain, string Language, string? TriggerEvent, string? SampleVariablesJson,
        int? BrevoTemplateId, bool IsActive);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TemplateDto>>> List(CancellationToken ct)
    {
        await EnsureSeededAsync(ct);
        return Ok(await _db.PlatformEmailTemplates.IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null)
            .OrderBy(t => t.Code)
            .Select(t => new TemplateDto(t.Id, t.Code, t.Name, t.Subject, t.BodyHtml, t.BodyPlain,
                t.Language, t.TriggerEvent, t.SampleVariablesJson, t.BrevoTemplateId,
                t.IsActive, t.IsSystem, t.LastSentAt, t.TimesSent))
            .ToListAsync(ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TemplateDto>> Get(Guid id, CancellationToken ct)
    {
        var t = await _db.PlatformEmailTemplates.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Template");
        return Ok(new TemplateDto(t.Id, t.Code, t.Name, t.Subject, t.BodyHtml, t.BodyPlain,
            t.Language, t.TriggerEvent, t.SampleVariablesJson, t.BrevoTemplateId,
            t.IsActive, t.IsSystem, t.LastSentAt, t.TimesSent));
    }

    [HttpPost]
    public async Task<ActionResult<TemplateDto>> Create([FromBody] UpsertBody body, CancellationToken ct)
    {
        if (await _db.PlatformEmailTemplates.IgnoreQueryFilters().AnyAsync(t => t.Code == body.Code, ct))
            return BadRequest(new { code = "code_taken", message = "Ο κωδικός χρησιμοποιείται ήδη." });
        var t = new PlatformEmailTemplate
        {
            Id = Guid.NewGuid(),
            Code = body.Code.Trim(),
            Name = body.Name.Trim(),
            Subject = body.Subject,
            BodyHtml = body.BodyHtml,
            BodyPlain = body.BodyPlain,
            Language = string.IsNullOrWhiteSpace(body.Language) ? "el" : body.Language,
            TriggerEvent = body.TriggerEvent,
            SampleVariablesJson = body.SampleVariablesJson,
            BrevoTemplateId = body.BrevoTemplateId,
            IsActive = body.IsActive,
            IsSystem = false
        };
        _db.PlatformEmailTemplates.Add(t);
        await _db.SaveChangesAsync(ct);
        return Ok(await GetAsDto(t.Id, ct));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TemplateDto>> Update(Guid id, [FromBody] UpsertBody body, CancellationToken ct)
    {
        var t = await _db.PlatformEmailTemplates.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Template");
        t.Code = body.Code.Trim();
        t.Name = body.Name.Trim();
        t.Subject = body.Subject;
        t.BodyHtml = body.BodyHtml;
        t.BodyPlain = body.BodyPlain;
        t.Language = body.Language;
        t.TriggerEvent = body.TriggerEvent;
        t.SampleVariablesJson = body.SampleVariablesJson;
        t.BrevoTemplateId = body.BrevoTemplateId;
        t.IsActive = body.IsActive;
        t.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(await GetAsDto(t.Id, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var t = await _db.PlatformEmailTemplates.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Template");
        if (t.IsSystem) return BadRequest(new { code = "system_template" });
        t.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record PreviewBody(string Subject, string BodyHtml, string? SampleVariablesJson);
    public record PreviewResponse(string RenderedSubject, string RenderedHtml);

    /// <summary>Renders {{merge}} tokens with the sample variables and returns the result for live preview.</summary>
    [HttpPost("preview")]
    public ActionResult<PreviewResponse> Preview([FromBody] PreviewBody body)
    {
        Dictionary<string, string> vars = new();
        try { vars = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(body.SampleVariablesJson ?? "{}") ?? new(); }
        catch { /* ignore */ }
        return Ok(new PreviewResponse(Render(body.Subject, vars), Render(body.BodyHtml, vars)));
    }

    public record SendTestBody(Guid TemplateId, string ToEmail);

    /// <summary>Send the rendered template via Brevo to a single recipient — for the superadmin's own QA.</summary>
    [HttpPost("send-test")]
    public async Task<ActionResult> SendTest([FromBody] SendTestBody body, CancellationToken ct)
    {
        var t = await _db.PlatformEmailTemplates.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == body.TemplateId, ct)
            ?? throw AppException.NotFound("Template");
        Dictionary<string, string> vars = new();
        try { vars = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(t.SampleVariablesJson ?? "{}") ?? new(); }
        catch { /* ignore */ }
        var html = Render(t.BodyHtml, vars);
        var subj = Render(t.Subject, vars);
        var plain = string.IsNullOrEmpty(t.BodyPlain) ? null : Render(t.BodyPlain!, vars);
        var result = await _email.SendAsync(new EmailMessage(body.ToEmail, body.ToEmail, subj, html, plain), ct);
        if (!result.Success) return BadRequest(new { code = "send_failed", message = result.ErrorMessage });
        t.LastSentAt = _clock.UtcNow;
        t.TimesSent += 1;
        await _db.SaveChangesAsync(ct);
        return Ok(new { sent = true });
    }

    private static string Render(string template, IDictionary<string, string> vars)
    {
        var s = template ?? "";
        foreach (var (k, v) in vars)
            s = s.Replace("{{" + k + "}}", v ?? "");
        return s;
    }

    private async Task<TemplateDto> GetAsDto(Guid id, CancellationToken ct)
    {
        var t = await _db.PlatformEmailTemplates.IgnoreQueryFilters().FirstAsync(x => x.Id == id, ct);
        return new TemplateDto(t.Id, t.Code, t.Name, t.Subject, t.BodyHtml, t.BodyPlain,
            t.Language, t.TriggerEvent, t.SampleVariablesJson, t.BrevoTemplateId,
            t.IsActive, t.IsSystem, t.LastSentAt, t.TimesSent);
    }

    /// <summary>
    /// Seed five flagship templates the first time the page is opened. Idempotent —
    /// existing rows are not overwritten so the superadmin's edits survive.
    /// </summary>
    private async Task EnsureSeededAsync(CancellationToken ct)
    {
        var existing = await _db.PlatformEmailTemplates.IgnoreQueryFilters()
            .Select(t => t.Code).ToListAsync(ct);
        var set = existing.ToHashSet();
        foreach (var seed in DefaultTemplates)
        {
            if (set.Contains(seed.Code)) continue;
            _db.PlatformEmailTemplates.Add(new PlatformEmailTemplate
            {
                Id = Guid.NewGuid(),
                Code = seed.Code,
                Name = seed.Name,
                Subject = seed.Subject,
                BodyHtml = seed.BodyHtml,
                BodyPlain = seed.BodyPlain,
                Language = seed.Language,
                TriggerEvent = seed.TriggerEvent,
                SampleVariablesJson = seed.SampleVariablesJson,
                IsActive = true,
                IsSystem = true
            });
        }
        if (_db.ChangeTracker.HasChanges()) await _db.SaveChangesAsync(ct);
    }

    private static readonly (string Code, string Name, string Subject, string BodyHtml, string? BodyPlain,
        string Language, string TriggerEvent, string SampleVariablesJson)[] DefaultTemplates = new[]
    {
        // Wrap-once shared shell. Each template re-emits the shell so editors can tune it without losing the rest.
        (
            Code: "platform.welcome",
            Name: "Καλωσόρισμα νέου γραφείου",
            Subject: "Καλώς ήρθατε στο Kalypsis, {{agencyName}}",
            BodyHtml: Shell(@"
                <h1 style=""font-family:Georgia,serif;font-size:28px;color:#0b2545;margin:0 0 8px"">Καλώς ήρθατε, {{agencyName}}.</h1>
                <p style=""font-size:16px;line-height:1.65;color:#3a5170;margin:0 0 16px"">
                    Είμαστε ενθουσιασμένοι που έχουμε εσάς και την ομάδα σας στο Kalypsis. Από σήμερα έχετε
                    πρόσβαση σε όλα τα πακέτα που υπογράψατε και η δωρεάν περίοδος ξεκινά τώρα.
                </p>
                <p style=""margin:0 0 24px""><a href=""{{appUrl}}"" style=""background:#0b2545;color:#f5ede1;padding:14px 26px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em"">ΕΙΣΟΔΟΣ ΣΤΗΝ ΕΦΑΡΜΟΓΗ</a></p>
                <p style=""font-size:14px;line-height:1.6;color:#6b6258;margin:0 0 0"">Με εκτίμηση, η ομάδα του Kalypsis.</p>
            "),
            BodyPlain: "Καλώς ήρθατε, {{agencyName}}.\n\nΗ συνδρομή σας στο Kalypsis ενεργοποιήθηκε. Είσοδος: {{appUrl}}",
            Language: "el",
            TriggerEvent: "tenant.created",
            SampleVariablesJson: @"{""agencyName"":""Δημόνστρα Ασφαλιστική Α.Ε."",""appUrl"":""https://app.kalypsis.gr""}"
        ),
        (
            "platform.contract.signed",
            "Συμβόλαιο υπεγράφη",
            "Επιβεβαίωση συμβολαίου — {{contractNumber}}",
            Shell(@"
                <h1 style=""font-family:Georgia,serif;font-size:24px;color:#0b2545;margin:0 0 8px"">Συμβόλαιο υπεγράφη επιτυχώς.</h1>
                <p style=""font-size:16px;line-height:1.65;color:#3a5170;margin:0 0 16px"">
                    Το συμβόλαιο <strong>{{contractNumber}}</strong> ενεργοποιήθηκε για το γραφείο <strong>{{agencyName}}</strong>.
                </p>
                <table style=""border-collapse:collapse;width:100%;margin:0 0 24px"">
                    <tr><td style=""padding:8px 0;color:#6b6258;font-size:14px"">Πλάνο</td><td style=""padding:8px 0;text-align:right;font-weight:700"">{{plan}}</td></tr>
                    <tr><td style=""padding:8px 0;color:#6b6258;font-size:14px"">Μηνιαία χρέωση</td><td style=""padding:8px 0;text-align:right;font-weight:700"">{{monthlyAmount}} {{currency}}</td></tr>
                    <tr><td style=""padding:8px 0;color:#6b6258;font-size:14px"">Έναρξη ισχύος</td><td style=""padding:8px 0;text-align:right;font-weight:700"">{{effectiveFrom}}</td></tr>
                </table>
                <p style=""font-size:14px;line-height:1.6;color:#6b6258;margin:0"">Το υπογεγραμμένο PDF είναι διαθέσιμο από τις ρυθμίσεις γραφείου.</p>
            "),
            null, "el", "tenant.contract.signed",
            @"{""contractNumber"":""KAL-2026-DEMO"",""agencyName"":""Δημόνστρα Α.Ε."",""plan"":""Pro"",""monthlyAmount"":""89.00"",""currency"":""EUR"",""effectiveFrom"":""01/06/2026""}"
        ),
        (
            "platform.package.enabled",
            "Νέο πακέτο ενεργοποιήθηκε",
            "Το πακέτο {{packageName}} είναι πλέον διαθέσιμο",
            Shell(@"
                <h1 style=""font-family:Georgia,serif;font-size:24px;color:#0b2545;margin:0 0 8px"">Νέο πακέτο διαθέσιμο.</h1>
                <p style=""font-size:16px;line-height:1.65;color:#3a5170;margin:0 0 16px"">
                    Το πακέτο <strong>{{packageName}}</strong> ενεργοποιήθηκε για το γραφείο σας. Όλοι οι χρήστες θα δουν αυτόματα τις νέες δυνατότητες στο μενού.
                </p>
                <p style=""margin:0 0 24px""><a href=""{{appUrl}}"" style=""background:#b08a3e;color:#f5ede1;padding:14px 26px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em"">ΑΝΑΚΑΛΥΨΗ</a></p>
            "),
            null, "el", "tenant.package.enabled",
            @"{""packageName"":""FrontOffice — Παραγωγή"",""appUrl"":""https://app.kalypsis.gr""}"
        ),
        (
            "platform.invoice.monthly",
            "Μηνιαία χρέωση",
            "Μηνιαίο τιμολόγιο — {{period}}",
            Shell(@"
                <h1 style=""font-family:Georgia,serif;font-size:24px;color:#0b2545;margin:0 0 8px"">Μηνιαία χρέωση — {{period}}.</h1>
                <p style=""font-size:16px;line-height:1.65;color:#3a5170;margin:0 0 16px"">Συνολικά: <strong style=""font-size:22px;color:#0b2545"">{{total}} {{currency}}</strong></p>
                <table style=""border-collapse:collapse;width:100%;margin:0 0 24px"">
                    <tr style=""background:#efe7d8""><th style=""text-align:left;padding:10px;font-size:12px;letter-spacing:0.06em;color:#3a5170"">ΠΕΡΙΓΡΑΦΗ</th><th style=""text-align:right;padding:10px;font-size:12px;letter-spacing:0.06em;color:#3a5170"">ΠΟΣΟ</th></tr>
                    <tr><td style=""padding:10px;border-bottom:1px solid #d6c6ab"">Βάση πακέτου ({{plan}})</td><td style=""padding:10px;text-align:right;border-bottom:1px solid #d6c6ab"">{{baseAmount}} {{currency}}</td></tr>
                    <tr><td style=""padding:10px;border-bottom:1px solid #d6c6ab"">Επιπλέον υποκαταστήματα ({{extraOffices}})</td><td style=""padding:10px;text-align:right;border-bottom:1px solid #d6c6ab"">{{officeSurcharge}} {{currency}}</td></tr>
                </table>
                <p style=""font-size:14px;line-height:1.6;color:#6b6258;margin:0"">Το PDF είναι διαθέσιμο στις ρυθμίσεις λογαριασμού.</p>
            "),
            null, "el", "tenant.invoice.generated",
            @"{""period"":""Ιούνιος 2026"",""total"":""139.00"",""currency"":""EUR"",""plan"":""Pro"",""baseAmount"":""89.00"",""extraOffices"":""2"",""officeSurcharge"":""50.00""}"
        ),
        (
            "platform.announcement",
            "Ανακοίνωση πλατφόρμας",
            "{{subject}}",
            Shell(@"
                <h1 style=""font-family:Georgia,serif;font-size:24px;color:#0b2545;margin:0 0 8px"">{{subject}}</h1>
                <div style=""font-size:16px;line-height:1.65;color:#3a5170;margin:0 0 16px"">
                    {{messageHtml}}
                </div>
            "),
            null, "el", "platform.announcement.sent",
            @"{""subject"":""Νέες δυνατότητες αυτό το μήνα"",""messageHtml"":""Αυτό το μήνα ενεργοποιήσαμε την πολυτιμολόγηση σε 8 ασφαλιστικές...""}"
        )
    };

    /// <summary>
    /// Wraps the body in a branded shell — header with the Kalypsis wordmark on a
    /// dark ink background, paper-cream body, signature footer with contact info.
    /// </summary>
    private static string Shell(string innerHtml) => $@"<!doctype html>
<html lang=""el""><head><meta charset=""utf-8""><title>Kalypsis</title></head>
<body style=""margin:0;padding:0;background:#0b2545;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#0b2545"">
    <tr><td align=""center"">
      <table role=""presentation"" width=""600"" cellpadding=""0"" cellspacing=""0"" style=""max-width:600px;width:100%"">
        <tr><td style=""padding:32px 32px 16px""><div style=""font-family:Georgia,'Times New Roman',serif;font-size:32px;color:#f5ede1;letter-spacing:-0.02em;font-weight:600"">Kalypsis</div></td></tr>
        <tr><td style=""background:#f5ede1;padding:40px 32px 32px"">{innerHtml}</td></tr>
        <tr><td style=""padding:24px 32px;color:rgba(245,237,225,0.62);font-size:12px;line-height:1.5"">
          Kalypsis Platform · Λ. Κηφισίας 268, 152 32 Χαλάνδρι · info@mykalypsis.gr<br/>
          Λάβατε αυτό το email επειδή το γραφείο σας έχει ενεργή συνδρομή στην πλατφόρμα Kalypsis.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>";
}
