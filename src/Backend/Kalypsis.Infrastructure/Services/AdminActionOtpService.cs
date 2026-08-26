using System.Security.Cryptography;
using System.Text;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Services;

/// <summary>
/// Concrete OTP service. Codes = 6-digit CSPRNG. Storage = hashed
/// via SHA-256 (a DB dump alone reveals nothing usable). Codes have a
/// 5-minute lifetime + 5-attempt cap. Verified challenges are usable
/// for a further 15 minutes so the operator has time to click «Confirm
/// destructive action» after typing the code.
///
/// Email delivery via IEmailSender (Brevo). ALWAYS goes to the
/// hard-coded platform inbox — an attacker who tricks the request
/// endpoint into a custom target cannot redirect the code.
/// </summary>
public sealed class AdminActionOtpService : IAdminActionOtpService
{
    private const int CodeAttemptsMax = 5;
    private const string PlatformNotifyEmail = "info@mykalypsis.gr";
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan VerifiedLifetime = TimeSpan.FromMinutes(15);

    private readonly AppDbContext _db;
    private readonly IEmailSender _email;
    private readonly IDateTimeProvider _clock;
    private readonly ILogger<AdminActionOtpService> _log;

    public AdminActionOtpService(AppDbContext db, IEmailSender email,
        IDateTimeProvider clock, ILogger<AdminActionOtpService> log)
    { _db = db; _email = email; _clock = clock; _log = log; }

    public async Task<RequestChallengeResult> RequestAsync(string action, string? target,
        Guid requestedByUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(action))
            throw new ArgumentException("Action required.", nameof(action));

        // 6-digit code via CSPRNG (not System.Random — that's predictable).
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        // Opaque bearer token — 32 bytes of CSPRNG → 43 base64url chars.
        // Enough entropy that brute-forcing the DB index is infeasible.
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var now = _clock.UtcNow;
        var row = new AdminActionChallenge
        {
            Id = Guid.NewGuid(),
            Action = action.Trim(),
            Target = string.IsNullOrWhiteSpace(target) ? null : target.Trim(),
            TokenHash = Sha256Hex(token),
            CodeHash = Sha256Hex(code),
            RequestedByUserId = requestedByUserId,
            ExpiresAt = now.Add(CodeLifetime),
            EmailedTo = PlatformNotifyEmail,
            CreatedAt = now,
        };
        _db.AdminActionChallenges.Add(row);
        await _db.SaveChangesAsync(ct);

        // Email the code out-of-band. Failure to send is a HARD stop —
        // we don't want to hand the caller a token they cannot verify.
        var subject = $"Kalypsis: κωδικός επιβεβαίωσης «{action}»";
        var htmlBody = $@"<p>Ζητήθηκε επιβεβαίωση για την ενέργεια <b>{System.Net.WebUtility.HtmlEncode(action)}</b>
{(string.IsNullOrEmpty(target) ? "" : $" σε target <code>{System.Net.WebUtility.HtmlEncode(target)}</code>")}
από τον χρήστη id <code>{requestedByUserId}</code>.</p>
<p>Κωδικός (ισχύει 5 λεπτά):</p>
<p style=""font-family:monospace;font-size:28px;font-weight:800;letter-spacing:6px"">{code}</p>
<p>Αν ΔΕΝ έχετε ξεκινήσει εσείς αυτή την ενέργεια, <b>ΜΗΝ πληκτρολογήσετε
τον κωδικό</b>. Ενδέχεται να υπάρχει παραβίαση του PlatformAdmin
λογαριασμού — αλλάξτε αμέσως password + revoke sessions.</p>";
        var res = await _email.SendAsync(new EmailMessage(
            PlatformNotifyEmail, "Kalypsis Ops", subject, htmlBody), ct);
        if (!res.Success)
        {
            // Best-effort tombstone so the challenge doesn't sit valid without a code
            // ever reaching a human.
            row.DeletedAt = now;
            try { await _db.SaveChangesAsync(ct); } catch { /* best effort */ }
            _log.LogError("Admin OTP challenge {Id}: email failed ({Err}). Refusing challenge.", row.Id, res.ErrorMessage);
            // Surface the ACTUAL Brevo error to the admin so they can fix it
            // fast (wrong API key / unverified sender / hit their quota, etc).
            // Common cases:
            //   • «Key not found / unauthorized» → API key wrong / expired,
            //     open /app/settings and paste the current key from
            //     https://app.brevo.com/settings/keys/api
            //   • «Sender not verified» → verify info@mykalypsis.gr from
            //     https://app.brevo.com/senders/list
            //   • «Domain … not authenticated» → DKIM DNS record missing —
            //     see the Brevo domain settings for the record to add
            var hint = res.ErrorMessage?.Contains("unauthorized", StringComparison.OrdinalIgnoreCase) == true
                       || res.ErrorMessage?.Contains("Key not found", StringComparison.OrdinalIgnoreCase) == true
                ? " → Το Brevo API key δεν είναι έγκυρο. Ενημερώστε το στο /app/settings (Brevo API key)."
                : "";
            throw new InvalidOperationException(
                $"Ο 6-ψήφιος κωδικός ΔΕΝ στάλθηκε στο info@mykalypsis.gr μέσω Brevo. Απόκριση: {res.ErrorMessage}{hint}");
        }
        _log.LogInformation("Admin OTP challenge {Id} emailed for action='{Action}' target='{Target}'.",
            row.Id, row.Action, row.Target);
        return new RequestChallengeResult(token, row.ExpiresAt, PlatformNotifyEmail);
    }

    public async Task<VerifyChallengeResult> VerifyAsync(string token, string code,
        Guid verifiedByUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(code))
            return new VerifyChallengeResult(false, "missing_input", 0);
        var hash = Sha256Hex(token);
        var row = await _db.AdminActionChallenges
            .FirstOrDefaultAsync(x => x.TokenHash == hash && x.DeletedAt == null, ct);
        if (row is null) return new VerifyChallengeResult(false, "unknown_token", 0);
        if (row.RequestedByUserId != verifiedByUserId)
        {
            _log.LogWarning("Admin OTP {Id}: verifier {V} != requester {R}. Rejected.",
                row.Id, verifiedByUserId, row.RequestedByUserId);
            return new VerifyChallengeResult(false, "user_mismatch", 0);
        }
        if (row.VerifiedAt is not null)
            return new VerifyChallengeResult(true, null, CodeAttemptsMax - row.Attempts);
        if (row.ExpiresAt < _clock.UtcNow) return new VerifyChallengeResult(false, "expired", 0);
        if (row.Attempts >= CodeAttemptsMax) return new VerifyChallengeResult(false, "rate_limited", 0);

        row.Attempts++;
        var submitted = Sha256Hex(code.Trim());
        var ok = CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(submitted),
            Encoding.ASCII.GetBytes(row.CodeHash));
        if (!ok)
        {
            await _db.SaveChangesAsync(ct);
            return new VerifyChallengeResult(false, "wrong_code", CodeAttemptsMax - row.Attempts);
        }
        row.VerifiedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Admin OTP {Id} verified by user {U}.", row.Id, verifiedByUserId);
        return new VerifyChallengeResult(true, null, CodeAttemptsMax - row.Attempts);
    }

    public async Task<bool> ConsumeAsync(string token, string action, string? target,
        Guid actingUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;
        var hash = Sha256Hex(token);
        var row = await _db.AdminActionChallenges
            .FirstOrDefaultAsync(x => x.TokenHash == hash && x.DeletedAt == null, ct);
        if (row is null) return false;
        if (row.VerifiedAt is null) return false;
        if (row.ConsumedAt is not null) return false;              // no replay
        if (row.RequestedByUserId != actingUserId) return false;   // no cross-user reuse
        if (row.Action != action) return false;
        // Target must match — a code for backup A cannot delete backup B.
        var normalisedTarget = string.IsNullOrWhiteSpace(target) ? null : target.Trim();
        if (row.Target != normalisedTarget) return false;
        if (row.VerifiedAt.Value.Add(VerifiedLifetime) < _clock.UtcNow) return false;
        row.ConsumedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
