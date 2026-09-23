using System.Security.Cryptography;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record CreateProducerPortalAccountResponse(Guid ProducerId, Guid UserId, string Email, string TemporaryPassword);

public record CreateProducerPortalAccountCommand(Guid ProducerId, string? Password = null) : IRequest<CreateProducerPortalAccountResponse>;

public class CreateProducerPortalAccountCommandHandler
    : IRequestHandler<CreateProducerPortalAccountCommand, CreateProducerPortalAccountResponse>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IPasswordHasher _hasher;

    public CreateProducerPortalAccountCommandHandler(IAppDbContext db, ICurrentUser current, IPasswordHasher hasher)
    {
        _db = db;
        _current = current;
        _hasher = hasher;
    }

    public async Task<CreateProducerPortalAccountResponse> Handle(CreateProducerPortalAccountCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producer = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == request.ProducerId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραγωγός");

        if (string.IsNullOrWhiteSpace(producer.Email))
            throw new AppException("producer_no_email",
                "Πρέπει πρώτα να καταχωρήσετε email για τον παραγωγό.", 400,
                title: "Λείπει email παραγωγού",
                why: "Για να δημιουργηθεί portal account χρειάζεται email αποστολής διαπιστευτηρίων.",
                fix: $"Ανοίξτε το προφίλ του παραγωγού «{producer.Name}» και συμπληρώστε email.",
                fixLink: $"/app/producers");

        var existing = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.ProducerId == producer.Id && u.DeletedAt == null, ct);
        if (existing is not null)
        {
            var resetPassword = string.IsNullOrWhiteSpace(request.Password)
                ? GenerateTemporaryPassword()
                : request.Password;
            if (resetPassword.Length < 8)
                throw new AppException("password_too_short", "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.", 400);

            existing.PasswordHash = _hasher.Hash(resetPassword);
            existing.Role = Role.Producer;
            existing.IsActive = true;
            await _db.SaveChangesAsync(ct);
            return new CreateProducerPortalAccountResponse(producer.Id, existing.Id, existing.Email, resetPassword);
        }

        var emailTaken = await _db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.Email == producer.Email && u.DeletedAt == null, ct);
        if (emailTaken)
            throw new AppException("email_taken",
                $"Υπάρχει ήδη λογαριασμός με email '{producer.Email}'.", 409,
                title: "Email σε χρήση",
                why: $"Το email {producer.Email} χρησιμοποιείται από άλλον χρήστη — πιθανώς από πελάτη, υπάλληλο ή άλλον παραγωγό.",
                fix: "Αλλάξτε το email του παραγωγού σε διαφορετική διεύθυνση.");

        var tempPassword = string.IsNullOrWhiteSpace(request.Password)
            ? GenerateTemporaryPassword()
            : request.Password;
        if (tempPassword.Length < 8)
            throw new AppException("password_too_short", "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.", 400);
        var firstName = producer.Name.Split(' ').FirstOrDefault() ?? producer.Name;
        var lastName = producer.Name.Length > firstName.Length ? producer.Name[(firstName.Length + 1)..] : "";

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = producer.Email!,
            PasswordHash = _hasher.Hash(tempPassword),
            FirstName = firstName,
            LastName = lastName,
            Phone = producer.Phone,
            Role = Role.Producer,
            IsActive = true,
            PreferredLanguage = "el",
            ProducerId = producer.Id
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return new CreateProducerPortalAccountResponse(producer.Id, user.Id, user.Email, tempPassword);
    }

    private static string GenerateTemporaryPassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        const string symbols = "!@#$%&*";
        Span<char> buf = stackalloc char[12];
        for (int i = 0; i < 10; i++)
            buf[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        buf[10] = symbols[RandomNumberGenerator.GetInt32(symbols.Length)];
        buf[11] = (char)('0' + RandomNumberGenerator.GetInt32(10));
        return new string(buf);
    }
}
