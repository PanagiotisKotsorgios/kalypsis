using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformAdmin;

// Superadmin-only endpoint: create a Producer entity + a linked User account
// with Role=Producer in one shot. Motivation: standalone «field agents» who
// don't have an office admin to onboard them — the platform admin does it
// directly. Every field of the resulting Producer/User pair is populated here
// so the producer can log in immediately with the returned temp password.

public record CreateStandaloneProducerUserBody(
    Guid TenantId,
    string Code,
    string Name,
    string Email,
    string? Phone);

public record CreateStandaloneProducerUserResponse(
    Guid ProducerId,
    Guid UserId,
    string Email,
    string TemporaryPassword);

public record CreateStandaloneProducerUserCommand(CreateStandaloneProducerUserBody Body)
    : IRequest<CreateStandaloneProducerUserResponse>;

public class CreateStandaloneProducerUserHandler
    : IRequestHandler<CreateStandaloneProducerUserCommand, CreateStandaloneProducerUserResponse>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public CreateStandaloneProducerUserHandler(IAppDbContext db, IPasswordHasher hasher)
    { _db = db; _hasher = hasher; }

    public async Task<CreateStandaloneProducerUserResponse> Handle(
        CreateStandaloneProducerUserCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (string.IsNullOrWhiteSpace(b.Code) || string.IsNullOrWhiteSpace(b.Name)
            || string.IsNullOrWhiteSpace(b.Email))
            throw new AppException("bad_body", "Απαιτούνται κωδικός, όνομα και email.", 400);

        var email = b.Email.Trim().ToLowerInvariant();
        var code = b.Code.Trim().ToUpperInvariant();

        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == b.TenantId && t.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Γραφείο");

        if (await _db.Producers.IgnoreQueryFilters()
                .AnyAsync(p => p.TenantId == tenant.Id && p.Code == code && p.DeletedAt == null, ct))
            throw new AppException("producer_code_taken",
                $"Παραγωγός με κωδικό {code} υπάρχει ήδη σε αυτό το γραφείο.", 409);

        if (await _db.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.TenantId == tenant.Id && u.Email == email && u.DeletedAt == null, ct))
            throw new AppException("email_taken",
                $"Χρήστης με email {email} υπάρχει ήδη σε αυτό το γραφείο.", 409);

        var nameParts = b.Name.Trim().Split(' ', 2);
        var producer = new Producer
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Code = code,
            Name = b.Name.Trim(),
            Email = email,
            Phone = b.Phone?.Trim(),
            Status = ProducerStatus.Active,
        };
        _db.Producers.Add(producer);

        var tempPassword = GeneratePassword();
        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Email = email,
            PasswordHash = _hasher.Hash(tempPassword),
            FirstName = nameParts[0],
            LastName = nameParts.Length > 1 ? nameParts[1] : "",
            Phone = b.Phone?.Trim(),
            Role = Role.Producer,
            ProducerId = producer.Id,
            IsActive = true,
            PreferredLanguage = "el",
        };
        _db.Users.Add(user);

        await _db.SaveChangesAsync(ct);

        return new CreateStandaloneProducerUserResponse(producer.Id, user.Id, email, tempPassword);
    }

    private static string GeneratePassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        const string symbols = "!@#$%&*";
        var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        var buf = new char[12];
        var bytes = new byte[16];
        rng.GetBytes(bytes);
        for (int i = 0; i < 10; i++) buf[i] = alphabet[bytes[i] % alphabet.Length];
        buf[10] = symbols[bytes[10] % symbols.Length];
        buf[11] = (char)('0' + (bytes[11] % 10));
        return new string(buf);
    }
}
