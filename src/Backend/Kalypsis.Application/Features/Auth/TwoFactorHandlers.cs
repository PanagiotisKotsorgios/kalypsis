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
            throw AppException.Conflict("Το 2FA είναι ήδη ενεργό.");

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
            throw AppException.Validation("Δεν έχει ξεκινήσει η εγγραφή 2FA.");

        if (!_totp.VerifyCode(user.TotpSecret, request.Code))
            throw AppException.Validation("Λανθασμένος κωδικός.");

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
