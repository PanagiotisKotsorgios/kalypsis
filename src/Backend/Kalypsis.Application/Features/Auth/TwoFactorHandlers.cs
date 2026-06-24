using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

public record TwoFactorStatusDto(bool Enabled, DateTime? EnabledAt);
public record TwoFactorEnrollmentDto(string Secret, string OtpAuthUri);
public record TwoFactorConfirmBody(string Code);
public record TwoFactorVerifyResult(bool Success, IReadOnlyList<string>? RecoveryCodes);

/* ===== Status ===== */

public record GetTwoFactorStatusQuery() : IRequest<TwoFactorStatusDto>;

public class GetTwoFactorStatusHandler : IRequestHandler<GetTwoFactorStatusQuery, TwoFactorStatusDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetTwoFactorStatusHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<TwoFactorStatusDto> Handle(GetTwoFactorStatusQuery request, CancellationToken ct)
    {
        var uid = _current.UserId ?? throw AppException.Unauthorized();
        var user = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == uid, ct) ?? throw AppException.NotFound("Χρήστης");
        return new TwoFactorStatusDto(user.TwoFactorEnabled, user.TwoFactorEnabledAt);
    }
}

/* ===== Begin enrollment — returns a fresh otpauth:// URI ===== */

public record BeginTwoFactorEnrollmentCommand() : IRequest<TwoFactorEnrollmentDto>;

public class BeginTwoFactorEnrollmentHandler : IRequestHandler<BeginTwoFactorEnrollmentCommand, TwoFactorEnrollmentDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly ITotpService _totp;

    public BeginTwoFactorEnrollmentHandler(IAppDbContext db, ICurrentUser current, ITotpService totp)
    {
        _db = db;
        _current = current;
        _totp = totp;
    }

    public async Task<TwoFactorEnrollmentDto> Handle(BeginTwoFactorEnrollmentCommand request, CancellationToken ct)
    {
        var uid = _current.UserId ?? throw AppException.Unauthorized();
        var user = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == uid, ct) ?? throw AppException.NotFound("Χρήστης");

        if (user.TwoFactorEnabled)
            throw new AppException("2fa_already_active",
                "Το 2FA είναι ήδη ενεργό.", 409,
                title: "Το 2FA είναι ενεργό",
                why: "Έχετε ήδη ενεργοποιήσει την επαλήθευση δύο παραγόντων. Δεν χρειάζεται να την ενεργοποιήσετε ξανά.",
                fix: "Αν χάσατε το αυθεντικοποιητή (Google/Microsoft Authenticator), απενεργοποιήστε πρώτα το 2FA από τις «Ρυθμίσεις λογαριασμού» και μετά ενεργοποιήστε ξανά.",
                fixLink: "/app/profile");

        var secret = _totp.GenerateSecret();
        user.TotpSecret = secret; // stored, but not yet enabled — confirmed by next call
        await _db.SaveChangesAsync(ct);

        var uri = _totp.BuildOtpAuthUri(secret, "Kalypsis", user.Email);
        return new TwoFactorEnrollmentDto(secret, uri);
    }
}

/* ===== Confirm enrollment with a typed code ===== */

public record ConfirmTwoFactorCommand(string Code) : IRequest<TwoFactorVerifyResult>;

public class ConfirmTwoFactorHandler : IRequestHandler<ConfirmTwoFactorCommand, TwoFactorVerifyResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly ITotpService _totp;
    private readonly IDateTimeProvider _clock;

    public ConfirmTwoFactorHandler(IAppDbContext db, ICurrentUser current, ITotpService totp, IDateTimeProvider clock)
    {
        _db = db; _current = current; _totp = totp; _clock = clock;
    }

    public async Task<TwoFactorVerifyResult> Handle(ConfirmTwoFactorCommand request, CancellationToken ct)
    {
        var uid = _current.UserId ?? throw AppException.Unauthorized();
        var user = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == uid, ct) ?? throw AppException.NotFound("Χρήστης");

        if (string.IsNullOrEmpty(user.TotpSecret))
            throw new AppException("2fa_no_enrollment",
                "Δεν έχει ξεκινήσει η εγγραφή 2FA.", 400,
                title: "Δεν υπάρχει εκκρεμής εγγραφή",
                why: "Προσπαθήσατε να επιβεβαιώσετε κωδικό 2FA χωρίς να έχετε ξεκινήσει τη διαδικασία ενεργοποίησης.",
                fix: "Πατήστε «Ενεργοποίηση 2FA» πρώτα για να σαρώσετε τον QR κώδικα με τον αυθεντικοποιητή σας.",
                fixLink: "/app/profile");

        if (!_totp.VerifyCode(user.TotpSecret, request.Code))
            throw new AppException("2fa_wrong_code",
                "Λανθασμένος κωδικός.", 400,
                title: "Λανθασμένος κωδικός 2FA",
                why: "Ο 6-ψήφιος κωδικός δεν ταιριάζει. Πιθανές αιτίες: (1) έχετε σαρώσει λάθος QR, (2) η ώρα του κινητού δεν συγχρονίζεται με το internet (οι κωδικοί 2FA εξαρτώνται από την ώρα), (3) πληκτρολογήσατε λάθος.",
                fix: "Ελέγξτε ότι το κινητό σας έχει σωστή ώρα (Ρυθμίσεις > Ώρα > Αυτόματη). Δοκιμάστε τον επόμενο κωδικό που εμφανίζει η εφαρμογή.");

        user.TwoFactorEnabled = true;
        user.TwoFactorEnabledAt = _clock.UtcNow;

        var pairs = _totp.GenerateRecoveryCodes(8);
        foreach (var (_, hash) in pairs)
        {
            _db.TwoFactorRecoveryCodes.Add(new TwoFactorRecoveryCode
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                CodeHash = hash
            });
        }
        await _db.SaveChangesAsync(ct);

        return new TwoFactorVerifyResult(true, pairs.Select(p => p.Plain).ToList());
    }
}

/* ===== Disable ===== */

public record DisableTwoFactorCommand() : IRequest<Unit>;

public class DisableTwoFactorHandler : IRequestHandler<DisableTwoFactorCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DisableTwoFactorHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Unit> Handle(DisableTwoFactorCommand request, CancellationToken ct)
    {
        var uid = _current.UserId ?? throw AppException.Unauthorized();
        var user = await _db.Users.IgnoreQueryFilters()
            .Include(u => u.RecoveryCodes)
            .FirstOrDefaultAsync(u => u.Id == uid, ct) ?? throw AppException.NotFound("Χρήστης");

        user.TwoFactorEnabled = false;
        user.TwoFactorEnabledAt = null;
        user.TotpSecret = null;
        _db.TwoFactorRecoveryCodes.RemoveRange(user.RecoveryCodes);
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
