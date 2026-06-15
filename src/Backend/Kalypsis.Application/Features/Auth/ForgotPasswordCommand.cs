using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

public record ForgotPasswordRequest(string Email);
public record ForgotPasswordResponse(bool Ok, string Message);

public record ForgotPasswordCommand(string Email, string? RequestIp) : IRequest<ForgotPasswordResponse>;

public class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public class ForgotPasswordCommandHandler : IRequestHandler<ForgotPasswordCommand, ForgotPasswordResponse>
{
    private readonly IAppDbContext _db;
    private readonly IEmailSender _email;
    private readonly IDateTimeProvider _clock;

    public ForgotPasswordCommandHandler(IAppDbContext db, IEmailSender email, IDateTimeProvider clock)
    {
        _db = db;
        _email = email;
        _clock = clock;
    }

    public async Task<ForgotPasswordResponse> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == email && u.DeletedAt == null && u.IsActive, cancellationToken);

        // Always behave the same to prevent enumeration.
        var genericResponse = new ForgotPasswordResponse(true,
            "Αν το email υπάρχει στο σύστημα, στείλαμε οδηγίες ανάκτησης κωδικού.");

        if (user is null) return genericResponse;

        // Generate a token. Send the plain version, store only its SHA256.
        var plain = GenerateToken();
        var hash = Sha256Hex(plain);

        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = _clock.UtcNow.AddHours(1),
            RequestIp = request.RequestIp
        });
        await _db.SaveChangesAsync(cancellationToken);

        // Build reset link from PlatformSetting.AppBaseUrl, fall back to a relative path.
        var baseUrl = await _db.PlatformSettings
            .IgnoreQueryFilters()
            .OrderBy(s => s.CreatedAt)
            .Select(s => s.AppBaseUrl)
            .FirstOrDefaultAsync(cancellationToken)
            ?? "http://localhost:5173";

        var resetLink = $"{baseUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(plain)}";

        var html = $@"
<!doctype html>
<html lang=""el"">
  <body style=""font-family:Inter,Segoe UI,Arial,sans-serif;background:#f5f7fb;padding:24px;color:#0b2545"">
    <div style=""max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 18px rgba(0,0,0,0.06)"">
      <h1 style=""margin:0 0 16px;font-size:22px;color:#0b2545"">Ανάκτηση κωδικού</h1>
      <p style=""margin:0 0 16px;line-height:1.6"">Γεια σας {user.FirstName},</p>
      <p style=""margin:0 0 16px;line-height:1.6"">Λάβαμε αίτημα για επαναφορά του κωδικού σας στο Kalypsis. Πατήστε το παρακάτω κουμπί για να ορίσετε νέο κωδικό. Ο σύνδεσμος ισχύει για 1 ώρα.</p>
      <p style=""margin:24px 0""><a href=""{resetLink}"" style=""display:inline-block;background:#0b2545;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px"">Ορισμός νέου κωδικού</a></p>
      <p style=""margin:16px 0;font-size:13px;color:#456079"">Ή αντιγράψτε τη διεύθυνση: <br><span style=""word-break:break-all;color:#0b2545"">{resetLink}</span></p>
      <p style=""margin:24px 0 0;font-size:13px;color:#456079"">Αν δεν ζητήσατε εσείς αυτή την επαναφορά, αγνοήστε αυτό το email. Ο κωδικός σας παραμένει ως έχει.</p>
    </div>
  </body>
</html>";

        await _email.SendAsync(new EmailMessage(
            ToEmail: user.Email,
            ToName: $"{user.FirstName} {user.LastName}".Trim(),
            Subject: "Kalypsis — Ανάκτηση κωδικού",
            HtmlBody: html), cancellationToken);

        return genericResponse;
    }

    private static string GenerateToken()
    {
        var buf = RandomNumberGenerator.GetBytes(48);
        return Convert.ToBase64String(buf).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }
}
