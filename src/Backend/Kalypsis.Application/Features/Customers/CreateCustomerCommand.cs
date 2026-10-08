using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Kalypsis.Application.Features.Customers;

public record CreateCustomerCommand(CreateCustomerRequest Request) : IRequest<CreateCustomerResponse>;

public class CreateCustomerCommandValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerCommandValidator()
    {
        RuleFor(x => x.Request.CreatePortalAccount).Must(_ => true)
            .WithMessage("Η δημιουργία λογαριασμού πελάτη στο portal είναι προσωρινά απενεργοποιημένη.");
        When(x => !string.IsNullOrWhiteSpace(x.Request.Email), () => RuleFor(x => x.Request.Email).EmailAddress());
        When(x => x.Request.CreatePortalAccount, () =>
            RuleFor(x => x.Request.Email).NotEmpty().EmailAddress()
                .WithMessage("Για λογαριασμό portal απαιτείται έγκυρο email πελάτη."));
        When(x => x.Request.Type == CustomerType.Individual, () =>
        {
            RuleFor(x => x.Request.FirstName).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Request.LastName).NotEmpty().MaximumLength(100);
        });
        When(x => x.Request.Type == CustomerType.Company, () =>
        {
            RuleFor(x => x.Request.CompanyName).NotEmpty().MaximumLength(200);
            When(x => x.Request.Status != CustomerStatus.Prospect, () =>
                RuleFor(x => x.Request.VatNumber).NotEmpty().MaximumLength(40));
        });
    }
}

public class CreateCustomerCommandHandler : IRequestHandler<CreateCustomerCommand, CreateCustomerResponse>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IPasswordHasher _hasher;
    private readonly IPackageService _packages;
    public CreateCustomerCommandHandler(IAppDbContext db, ICurrentUser currentUser,
        IPasswordHasher hasher, IPackageService packages)
    {
        _db = db;
        _currentUser = currentUser;
        _hasher = hasher;
        _packages = packages;
    }

    public async Task<CreateCustomerResponse> Handle(CreateCustomerCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId
            ?? throw AppException.Forbidden();

        var r = request.Request;
        var email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();

        if (r.CreatePortalAccount && !await _packages.HasAsync(tenantId, PackageCode.Crm, cancellationToken))
            throw new AppException("package_not_licensed",
                "Η πύλη πελάτη είναι διαθέσιμη μόνο όταν το γραφείο έχει ενεργό το πακέτο CRM.", 403);

        if (r.CreatePortalAccount && await _db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.TenantId == tenantId && u.Email == email && u.DeletedAt == null, cancellationToken))
            throw new AppException("portal_email_exists",
                "Υπάρχει ήδη λογαριασμός με αυτό το email στο γραφείο.", 409);

        var lastNumber = await _db.Customers

            .Where(c => c.TenantId == tenantId)
            .CountAsync(cancellationToken);

        var customerNumber = $"C-{(lastNumber + 1):D6}";

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerNumber = customerNumber,
            Type = r.Type,
            Status = r.Status,
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
            ActivityCode = r.ActivityCode?.Trim(),
            TaxOffice = r.TaxOffice?.Trim(),
            GemiNumber = r.GemiNumber?.Trim(),
            LegalForm = r.LegalForm?.Trim(),
            AltPhone = r.AltPhone?.Trim(),
            MobilePhone = r.MobilePhone?.Trim(),
            Amka = r.Amka?.Trim(),
            IdNumber = r.IdNumber?.Trim(),
            PassportNumber = r.PassportNumber?.Trim(),
            Region = r.Region?.Trim(),
            Gender = r.Gender?.Trim(),
            MaritalStatus = r.MaritalStatus?.Trim(),
            Employer = r.Employer?.Trim(),
            DriverLicenseNumber = r.DriverLicenseNumber?.Trim(),
            DriverLicenseClass = r.DriverLicenseClass?.Trim(),
            DriverLicenseIssueDate = r.DriverLicenseIssueDate,
            DriverLicenseExpiryDate = r.DriverLicenseExpiryDate,
            Source = r.Source?.Trim(),
            TagsJson = r.TagsJson?.Trim(),
            PhotoUrl = r.PhotoUrl?.Trim(),
            AssignedAdvisorId = r.AssignedAdvisorId,
            PaymentDueDate = r.PaymentDueDate
        };
        _db.Customers.Add(customer);

        await _db.SaveChangesAsync(cancellationToken);

        string? portalEmail = null;
        string? temporaryPassword = null;
        if (r.CreatePortalAccount)
        {
            temporaryPassword = GenerateTemporaryPassword();
            _db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = email!,
                PasswordHash = _hasher.Hash(temporaryPassword),
                FirstName = customer.FirstName ?? customer.CompanyName ?? "Πελάτης",
                LastName = customer.LastName ?? string.Empty,
                Role = Role.Customer,
                CustomerId = customer.Id,
                IsActive = true
            });
            portalEmail = email;
            await _db.SaveChangesAsync(cancellationToken);
        }

        var dto = new CustomerDto(
            customer.Id, customer.CustomerNumber, customer.Type, customer.Status,
            customer.FirstName, customer.LastName, customer.CompanyName,
            customer.VatNumber, customer.Email, customer.Phone, customer.City, customer.Notes,
            customer.CreatedAt, false, customer.PaymentDueDate, customer.Address, customer.PostalCode,
            customer.BirthDate, customer.Occupation, customer.FatherName, customer.MotherName, customer.SpouseName,
            customer.Nationality, customer.Zone, customer.ActivityCode, customer.TaxOffice, customer.GemiNumber,
            customer.LegalForm, customer.AltPhone, customer.MobilePhone, customer.Amka, customer.IdNumber,
            customer.PassportNumber, customer.Region, customer.Gender, customer.MaritalStatus, customer.Employer,
            customer.DriverLicenseNumber, customer.DriverLicenseClass, customer.DriverLicenseIssueDate,
            customer.DriverLicenseExpiryDate, customer.Source, customer.TagsJson, customer.PhotoUrl);

        return new CreateCustomerResponse(dto, portalEmail, temporaryPassword);
    }

    private static string GenerateTemporaryPassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        const string symbols = "!@#$%&*";
        Span<char> buffer = stackalloc char[12];
        for (var i = 0; i < 10; i++)
            buffer[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        buffer[10] = symbols[RandomNumberGenerator.GetInt32(symbols.Length)];
        buffer[11] = (char)('0' + RandomNumberGenerator.GetInt32(10));
        return new string(buffer);
    }
}
