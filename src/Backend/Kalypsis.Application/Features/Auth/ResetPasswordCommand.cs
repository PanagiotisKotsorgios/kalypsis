using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

public record ResetPasswordRequest(string Token, string NewPassword);
public record ResetPasswordResponse(bool Ok);

public record ResetPasswordCommand(string Token, string NewPassword) : IRequest<ResetPasswordResponse>;

public class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
    }
}

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand, ResetPasswordResponse>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IDateTimeProvider _clock;

    public ResetPasswordCommandHandler(IAppDbContext db, IPasswordHasher hasher, IDateTimeProvider clock)
    {
        _db = db;
        _hasher = hasher;
        _clock = clock;
    }

    public async Task<ResetPasswordResponse> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var hash = Sha256Hex(request.Token);
        var record = await _db.PasswordResetTokens
            .IgnoreQueryFilters()
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken)
            ?? throw new AppException("reset_link_invalid",
                "Ο σύνδεσμος ανάκτησης δεν είναι έγκυρος.", 400,
                title: "Λανθασμένος σύνδεσμος",
                why: "Ο σύνδεσμος που πατήσατε δεν αντιστοιχεί σε αίτηση ανάκτησης κωδικού. Πιθανώς έγινε copy-paste μερικώς ή τροποποιήθηκε.",
                fix: "Επιστρέψτε στη σελίδα εισόδου και ζητήστε νέο σύνδεσμο ανάκτησης.",
                fixLink: "/forgot-password");

        if (record.UsedAt is not null)
            throw new AppException("reset_link_used",
                "Ο σύνδεσμος ανάκτησης έχει ήδη χρησιμοποιηθεί.", 400,
                title: "Σύνδεσμος χρησιμοποιημένος",
                why: $"Αυτός ο σύνδεσμος χρησιμοποιήθηκε στις {record.UsedAt:dd/MM/yyyy HH:mm}. Για ασφάλεια, κάθε σύνδεσμος ανάκτησης ισχύει για μία μόνο χρήση.",
                fix: "Αν δεν θυμάστε τον κωδικό σας, ζητήστε νέο σύνδεσμο ανάκτησης.",
                fixLink: "/forgot-password");

        if (record.ExpiresAt < _clock.UtcNow)
            throw new AppException("reset_link_expired",
                "Ο σύνδεσμος ανάκτησης έχει λήξει.", 400,
                title: "Σύνδεσμος έληξε",
                why: $"Οι σύνδεσμοι ανάκτησης ισχύουν για περιορισμένο χρόνο για ασφάλεια. Αυτός έληξε στις {record.ExpiresAt:dd/MM/yyyy HH:mm}.",
                fix: "Ζητήστε νέο σύνδεσμο ανάκτησης — θα φτάσει στο email σας μέσα σε λίγα λεπτά.",
                fixLink: "/forgot-password");

        var now = _clock.UtcNow;
        record.User.PasswordHash = _hasher.Hash(request.NewPassword);
        record.User.FailedLoginAttempts = 0;
        record.User.LockedUntil = null;
        record.UsedAt = now;

        // Revoke any other active reset tokens for the same user.
        var others = await _db.PasswordResetTokens
            .IgnoreQueryFilters()
            .Where(t => t.UserId == record.UserId && t.UsedAt == null && t.Id != record.Id)
            .ToListAsync(cancellationToken);
        foreach (var t in others) t.UsedAt = now;

        // A password reset means the credential may have been compromised.
        // Kill every active refresh token so any stolen session is dead too.
        await RefreshTokenRevoker.RevokeAllForUserAsync(
            _db, record.UserId, now, "password_reset_revoke_all", cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return new ResetPasswordResponse(true);
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }
}
