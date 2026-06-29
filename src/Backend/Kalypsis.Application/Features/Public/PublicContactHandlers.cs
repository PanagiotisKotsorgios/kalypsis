using System.Net;
using System.Text;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Public;

// ============================================================================
// Public (pre-login) contact / bug-report / complaint form. Forwards the
// submission via Brevo to PlatformSetting.SupportEmail (falls back to the
// configured Brevo sender) so the team gets one email per submission.
// ============================================================================

public record PublicContactBody(
    string InquiryType,   // "sales" | "support" | "bug" | "complaint" | "other"
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string? AgencyOrCity,
    string Subject,
    string Message,
    bool Consent);

public record PublicContactResult(string Reference, bool Delivered);

public record SubmitPublicContactCommand(PublicContactBody Body, string? ClientIp, string? UserAgent) : IRequest<PublicContactResult>;

public class SubmitPublicContactHandler : IRequestHandler<SubmitPublicContactCommand, PublicContactResult>
{
    private readonly IEmailSender _email;
    private readonly IAppDbContext _db;

    public SubmitPublicContactHandler(IEmailSender email, IAppDbContext db)
    {
        _email = email;
        _db = db;
    }

    public async Task<PublicContactResult> Handle(SubmitPublicContactCommand cmd, CancellationToken ct)
    {
        var b = cmd.Body;
        // Field guards — we already validate on the client, but never trust it.
        if (string.IsNullOrWhiteSpace(b.FirstName)) throw new AppException("contact_name", "Συμπληρώστε το όνομα.", 400);
        if (string.IsNullOrWhiteSpace(b.LastName)) throw new AppException("contact_name", "Συμπληρώστε το επώνυμο.", 400);
        if (!IsLikelyEmail(b.Email)) throw new AppException("contact_email", "Μη έγκυρο email.", 400);
        if (string.IsNullOrWhiteSpace(b.Subject)) throw new AppException("contact_subject", "Συμπληρώστε θέμα.", 400);
        if ((b.Message ?? "").Trim().Length < 10) throw new AppException("contact_message", "Το μήνυμα είναι πολύ σύντομο (≥ 10 χαρακτήρες).", 400);
        if (!b.Consent) throw new AppException("contact_consent", "Απαιτείται συγκατάθεση επικοινωνίας.", 400);
        if ((b.Subject ?? "").Length > 200) throw new AppException("contact_subject", "Το θέμα είναι πολύ μακρύ.", 400);
        if ((b.Message ?? "").Length > 5000) throw new AppException("contact_message", "Το μήνυμα είναι πολύ μακρύ.", 400);

        var reference = $"KLP-CT-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";

        var settings = await _db.PlatformSettings.IgnoreQueryFilters().OrderBy(s => s.CreatedAt).FirstOrDefaultAsync(ct);
        var to = !string.IsNullOrWhiteSpace(settings?.SupportEmail)
            ? settings!.SupportEmail!
            : (!string.IsNullOrWhiteSpace(settings?.BrevoSenderEmail) ? settings!.BrevoSenderEmail! : "hello@kalypsis.gr");

        var html = BuildHtml(b, reference, cmd.ClientIp, cmd.UserAgent);
        var subjectPrefix = b.InquiryType?.ToLowerInvariant() switch
        {
            "bug"       => "[BUG] ",
            "complaint" => "[ΠΑΡΑΠΟΝΟ] ",
            "support"   => "[ΥΠΟΣΤΗΡΙΞΗ] ",
            "sales"     => "[SALES] ",
            _ => "[ΕΠΙΚΟΙΝΩΝΙΑ] "
        };
        var subject = $"{subjectPrefix}{TruncForSubject(b.Subject)} ({reference})";

        var result = await _email.SendAsync(new EmailMessage(
            ToEmail: to,
            ToName: "Kalypsis support",
            Subject: subject,
            HtmlBody: html), ct);

        // We always succeed at the API level so the user gets their ref code; if
        // Brevo wasn't configured the message stays in logs and the team still
        // sees it via server alerts. Returning Delivered=false would only confuse
        // the visitor.
        return new PublicContactResult(reference, result.Success);
    }

    private static string TruncForSubject(string s)
    {
        s = s.Trim();
        return s.Length <= 80 ? s : s[..80] + "…";
    }

    private static bool IsLikelyEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var i = email.IndexOf('@');
        return i > 0 && i < email.Length - 3 && email.IndexOf('.', i) > i + 1;
    }

    private static string BuildHtml(PublicContactBody b, string reference, string? ip, string? userAgent)
    {
        var sb = new StringBuilder();
        sb.Append("<div style='font-family:Arial,sans-serif;font-size:14px;color:#0b2545'>");
        sb.Append($"<h2 style='margin:0 0 12px 0'>Νέο μήνυμα από τη φόρμα επικοινωνίας Kalypsis</h2>");
        sb.Append($"<p style='color:#456079;margin:0 0 16px 0'>Αναφορά: <code>{WebUtility.HtmlEncode(reference)}</code></p>");
        sb.Append("<table cellpadding='8' cellspacing='0' style='border-collapse:collapse;border:1px solid #d9e1ea;width:100%'>");
        Row(sb, "Τύπος", b.InquiryType ?? "—");
        Row(sb, "Όνομα", $"{b.FirstName} {b.LastName}".Trim());
        Row(sb, "Email", b.Email);
        Row(sb, "Τηλέφωνο", b.Phone ?? "—");
        Row(sb, "Γραφείο / Πόλη", b.AgencyOrCity ?? "—");
        Row(sb, "Θέμα", b.Subject);
        sb.Append("</table>");
        sb.Append("<h3 style='margin:18px 0 6px 0'>Μήνυμα</h3>");
        sb.Append($"<div style='white-space:pre-wrap;border-left:3px solid #1ea7e1;padding:8px 12px;background:#f4f6fa'>{WebUtility.HtmlEncode(b.Message ?? "")}</div>");
        sb.Append("<p style='color:#7a8aa0;font-size:12px;margin-top:18px'>");
        sb.Append($"IP: {WebUtility.HtmlEncode(ip ?? "—")} · UA: {WebUtility.HtmlEncode(userAgent ?? "—")}");
        sb.Append("</p>");
        sb.Append("</div>");
        return sb.ToString();
    }

    private static void Row(StringBuilder sb, string label, string value)
    {
        sb.Append("<tr>");
        sb.Append($"<td style='border:1px solid #d9e1ea;background:#f4f6fa;font-weight:700;width:160px'>{WebUtility.HtmlEncode(label)}</td>");
        sb.Append($"<td style='border:1px solid #d9e1ea'>{WebUtility.HtmlEncode(value)}</td>");
        sb.Append("</tr>");
    }
}
