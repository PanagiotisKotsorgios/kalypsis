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
            ?? throw AppException.Validation("Ο σύνδεσμος ανάκτησης δεν είναι έγκυρος.");

        if (record.UsedAt is not null)
            throw AppException.Validation("Ο σύνδεσμος ανάκτησης έχει ήδη χρησιμοποιηθεί.");
        if (record.ExpiresAt < _clock.UtcNow)
            throw AppException.Validation("Ο σύνδεσμος ανάκτησης έχει λήξει.");

        record.User.PasswordHash = _hasher.Hash(request.NewPassword);
        record.UsedAt = _clock.UtcNow;

        // Revoke any other active reset tokens for the same user.
        var others = await _db.PasswordResetTokens
            .IgnoreQueryFilters()
            .Where(t => t.UserId == record.UserId && t.UsedAt == null && t.Id != record.Id)
            .ToListAsync(cancellationToken);
        foreach (var t in others) t.UsedAt = _clock.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return new ResetPasswordResponse(true);
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }
}
