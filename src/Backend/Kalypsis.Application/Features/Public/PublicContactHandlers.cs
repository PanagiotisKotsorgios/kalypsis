using System.Net;
using System.Text;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
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
    bool Consent,
    // Honeypot: this field is rendered as a CSS-hidden input in the form. A real
    // user never touches it; bots that auto-fill every field do. If it has any
    // value we silently drop the message (return success so the bot doesn't retry).
    string? Website = null,
    // Optional package selected from the public pricing page. Package-interest
    // submissions are also persisted in the platform admin request inbox.
    string? SelectedPackage = null,
    // Used by the public cooperation-contract request, not by account creation.
    string? CompanyName = null);

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
        // Honeypot — silently swallow bot submissions. Return a fake reference so
        // the bot's automation reports success and moves on.
        if (!string.IsNullOrWhiteSpace(b.Website))
        {
            return new PublicContactResult($"KLP-CT-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}", false);
        }

        var contractRequest = string.Equals(b.InquiryType?.Trim(), "contract", StringComparison.OrdinalIgnoreCase);
        if (contractRequest)
        {
            if (string.IsNullOrWhiteSpace(b.CompanyName) || b.CompanyName.Trim().Length > 200)
                throw AppException.Validation("Συμπληρώστε επωνυμία γραφείου / εταιρείας έως 200 χαρακτήρες.");
            var phone = b.Phone?.Trim() ?? "";
            var digits = phone.Count(char.IsAsciiDigit);
            if (digits < 10 || digits > 15 || !System.Text.RegularExpressions.Regex.IsMatch(phone, @"^\+?[0-9 ()-]+$"))
                throw AppException.Validation("Συμπληρώστε έγκυρο τηλέφωνο με 10–15 ψηφία.");
            if ((b.FirstName?.Length ?? 0) > 120 || (b.LastName?.Length ?? 0) > 120
                || (b.Email?.Length ?? 0) > 160 || (b.AgencyOrCity?.Length ?? 0) > 120 || phone.Length > 40)
                throw AppException.Validation("Κάποιο στοιχείο επικοινωνίας υπερβαίνει το επιτρεπόμενο μήκος.");
        }

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
        var selectedPackage = string.IsNullOrWhiteSpace(b.SelectedPackage)
            ? null
            : b.SelectedPackage.Trim();

        // Keep the existing email notification, and also put package-interest
        // leads in the normal platform-admin request workflow. This makes the
        // lead visible for triage/read/pending/follow-up even if email delivery
        // is temporarily unavailable. Regular contact submissions remain
        // email-only.
        if (selectedPackage is not null || contractRequest)
        {
            var registrationReference = reference;
            if (await _db.RegistrationRequests.AnyAsync(x => x.ReferenceCode == registrationReference, ct))
                registrationReference = $"KLP-CT-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
            reference = registrationReference;

            _db.RegistrationRequests.Add(new RegistrationRequest
            {
                Id = Guid.NewGuid(),
                FirstName = b.FirstName.Trim(),
                LastName = b.LastName.Trim(),
                Email = b.Email!.Trim().ToLowerInvariant(),
                Phone = b.Phone?.Trim() ?? string.Empty,
                City = string.IsNullOrWhiteSpace(b.AgencyOrCity) ? null : b.AgencyOrCity.Trim(),
                OrganizationName = contractRequest ? b.CompanyName!.Trim() : null,
                ReferenceCode = registrationReference,
                Category = contractRequest ? "Αίτημα σύμβασης συνεργασίας" : "Εκδήλωση ενδιαφέροντος πακέτου",
                Message = contractRequest ? $"{b.Message!.Trim()}\n\nΣυγκατάθεση επικοινωνίας: Ναι" : BuildPackageInterestMessage(selectedPackage!, b.Message ?? string.Empty),
                Status = RegistrationRequestStatus.New,
                TriageStatus = RegistrationRequestTriageStatus.New,
                IsRead = false,
                // Requesting a contract is not acceptance/signature of a DPA.
                DpaAccepted = !contractRequest && b.Consent,
                DpaVersion = !contractRequest && b.Consent ? "public-contact-v1" : null,
                DpaAcceptedAt = !contractRequest && b.Consent ? DateTime.UtcNow : null,
                IpAddress = string.IsNullOrWhiteSpace(cmd.ClientIp) ? null : cmd.ClientIp,
                UserAgent = string.IsNullOrWhiteSpace(cmd.UserAgent) ? null : cmd.UserAgent
            });
            await _db.SaveChangesAsync(ct);
        }

        var settings = await _db.PlatformSettings.IgnoreQueryFilters().OrderBy(s => s.CreatedAt).FirstOrDefaultAsync(ct);
        var to = !string.IsNullOrWhiteSpace(settings?.SupportEmail)
            ? settings!.SupportEmail!
            : (!string.IsNullOrWhiteSpace(settings?.BrevoSenderEmail) ? settings!.BrevoSenderEmail! : "info@mykalypsis.gr");

        var html = BuildHtml(b, reference, cmd.ClientIp, cmd.UserAgent);
        var subjectPrefix = b.InquiryType?.ToLowerInvariant() switch
        {
            "bug"       => "[BUG] ",
            "complaint" => "[ΠΑΡΑΠΟΝΟ] ",
            "support"   => "[ΥΠΟΣΤΗΡΙΞΗ] ",
            "sales"     => "[SALES] ",
            "contract"  => "[ΣΥΜΒΑΣΗ ΣΥΝΕΡΓΑΣΙΑΣ] ",
            _ => "[ΕΠΙΚΟΙΝΩΝΙΑ] "
        };
        var subject = $"{subjectPrefix}{TruncForSubject(b.Subject ?? string.Empty)} ({reference})";

        var result = await _email.SendAsync(new EmailMessage(
            ToEmail: to,
            ToName: "Kalypsis support",
            Subject: subject,
            HtmlBody: html), ct);

        // Contract/package requests remain in the admin inbox even if sending
        // fails. Report delivery separately from registration so their UI never
        // promises an email or contract that was not actually delivered.
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
        if (!string.IsNullOrWhiteSpace(b.CompanyName)) Row(sb, "Επωνυμία γραφείου / εταιρείας", b.CompanyName);
        if (!string.IsNullOrWhiteSpace(b.SelectedPackage))
            Row(sb, "Επιλεγμένο πακέτο", b.SelectedPackage!);
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

    private static string BuildPackageInterestMessage(string package, string message)
    {
        var details = string.IsNullOrWhiteSpace(message)
            ? "Δεν προστέθηκαν επιπλέον λεπτομέρειες."
            : message.Trim();
        return $"Πακέτο που επέλεξε ο χρήστης: {package}\n\nΛεπτομέρειες ενδιαφέροντος:\n{details}";
    }
}
