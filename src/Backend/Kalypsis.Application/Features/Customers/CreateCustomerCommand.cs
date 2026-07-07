using System.Security.Cryptography;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record CreateCustomerCommand(CreateCustomerRequest Request) : IRequest<CreateCustomerResponse>;

public class CreateCustomerCommandValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerCommandValidator()
    {
        When(x => x.Request.CreatePortalAccount, () => RuleFor(x => x.Request.Email).NotEmpty().EmailAddress());
        When(x => !string.IsNullOrWhiteSpace(x.Request.Email), () => RuleFor(x => x.Request.Email).EmailAddress());
        When(x => x.Request.Type == CustomerType.Individual, () =>
        {
            RuleFor(x => x.Request.FirstName).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Request.LastName).NotEmpty().MaximumLength(100);
        });
        When(x => x.Request.Type == CustomerType.Company, () =>
        {
            RuleFor(x => x.Request.CompanyName).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Request.VatNumber).NotEmpty().MaximumLength(40);
        });
    }
}

public class CreateCustomerCommandHandler : IRequestHandler<CreateCustomerCommand, CreateCustomerResponse>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IPasswordHasher _hasher;

    public CreateCustomerCommandHandler(IAppDbContext db, ICurrentUser currentUser, IPasswordHasher hasher)
    {
        _db = db;
        _currentUser = currentUser;
        _hasher = hasher;
    }

    public async Task<CreateCustomerResponse> Handle(CreateCustomerCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId
            ?? throw AppException.Forbidden();

        var r = request.Request;
        var email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();

        if (r.CreatePortalAccount)
        {
            var emailExists = await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email!, cancellationToken);
            if (emailExists) throw new AppException("email_taken",
                $"Υπάρχει ήδη λογαριασμός με email '{email}'.", 409,
                title: "Email σε χρήση",
                why: $"Το email {email} χρησιμοποιείται από άλλον λογαριασμό — πιθανώς ο πελάτης υπάρχει ήδη, ή χρησιμοποιείται ως email υπαλλήλου/παραγωγού.",
                fix: "Αναζητήστε τον πελάτη πρώτα — μπορεί να υπάρχει ήδη. Αν είναι νέος, χρησιμοποιήστε διαφορετική διεύθυνση email ή απενεργοποιήστε το «Δημιουργία portal account».",
                fixLink: "/app/customers");
        }

        var lastNumber = await _db.Customers
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId)
            .CountAsync(cancellationToken);

        var customerNumber = $"C-{(lastNumber + 1):D6}";

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerNumber = customerNumber,
            Type = r.Type,
            FirstName = r.FirstName?.Trim(),
            LastName = r.LastName?.Trim(),
            CompanyName = r.CompanyName?.Trim(),
            VatNumber = r.VatNumber?.Trim(),
            Email = email,
            Phone = r.Phone?.Trim(),
            Address = r.Address?.Trim(),
            City = r.City?.Trim(),
            PostalCode = r.PostalCode?.Trim(),
            BirthDate = r.BirthDate,
            Occupation = r.Occupation?.Trim(),
            Notes = r.Notes?.Trim(),
            FatherName = r.FatherName?.Trim(),
            MotherName = r.MotherName?.Trim(),
            SpouseName = r.SpouseName?.Trim(),
            Nationality = r.Nationality?.Trim(),
            Zone = r.Zone?.Trim(),
            ActivityCode = r.ActivityCode?.Trim()
        };
        _db.Customers.Add(customer);

        string? tempPassword = null;
        if (r.CreatePortalAccount)
        {
            tempPassword = GenerateTemporaryPassword();
            var portalUser = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = email!,
                PasswordHash = _hasher.Hash(tempPassword),
                FirstName = r.Type == CustomerType.Individual ? (r.FirstName ?? "Πελάτης") : "Επικοινωνία",
                LastName = r.Type == CustomerType.Individual ? (r.LastName ?? "") : (r.CompanyName ?? ""),
                Phone = r.Phone?.Trim(),
                Role = Role.Customer,
                IsActive = true,
                PreferredLanguage = "el",
                CustomerId = customer.Id
            };
            _db.Users.Add(portalUser);
        }

        await _db.SaveChangesAsync(cancellationToken);

        var dto = new CustomerDto(
            customer.Id, customer.CustomerNumber, customer.Type,
            customer.FirstName, customer.LastName, customer.CompanyName,
            customer.VatNumber, customer.Email, customer.Phone, customer.City,
            customer.CreatedAt, r.CreatePortalAccount);

        return new CreateCustomerResponse(
            dto,
            r.CreatePortalAccount ? email : null,
            tempPassword);
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
