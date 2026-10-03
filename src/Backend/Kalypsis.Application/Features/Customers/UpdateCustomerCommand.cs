using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record UpdateCustomerCommand(Guid CustomerId, CreateCustomerRequest Request) : IRequest<CustomerDto>;

public sealed class UpdateCustomerCommandHandler : IRequestHandler<UpdateCustomerCommand, CustomerDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateCustomerCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerDto> Handle(UpdateCustomerCommand command, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.Customers.FirstOrDefaultAsync(x => x.Id == command.CustomerId && x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Customer");
        var r = command.Request;
        c.Type = r.Type; c.Status = r.Status;
        c.FirstName = r.FirstName?.Trim(); c.LastName = r.LastName?.Trim(); c.CompanyName = r.CompanyName?.Trim();
        c.VatNumber = r.VatNumber?.Trim(); c.Email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();
        c.Phone = r.Phone?.Trim(); c.Address = r.Address?.Trim(); c.City = r.City?.Trim(); c.PostalCode = r.PostalCode?.Trim();
        c.Occupation = r.Occupation?.Trim(); c.Notes = r.Notes?.Trim(); c.BirthDate = r.BirthDate;
        c.FatherName = r.FatherName?.Trim(); c.MotherName = r.MotherName?.Trim(); c.SpouseName = r.SpouseName?.Trim();
        c.Nationality = r.Nationality?.Trim(); c.Zone = r.Zone?.Trim(); c.ActivityCode = r.ActivityCode?.Trim();
        c.TaxOffice = r.TaxOffice?.Trim(); c.GemiNumber = r.GemiNumber?.Trim(); c.LegalForm = r.LegalForm?.Trim();
        c.AltPhone = r.AltPhone?.Trim(); c.MobilePhone = r.MobilePhone?.Trim(); c.Amka = r.Amka?.Trim();
        c.IdNumber = r.IdNumber?.Trim(); c.PassportNumber = r.PassportNumber?.Trim(); c.Region = r.Region?.Trim();
        c.Gender = r.Gender?.Trim(); c.MaritalStatus = r.MaritalStatus?.Trim(); c.Employer = r.Employer?.Trim();
        c.DriverLicenseNumber = r.DriverLicenseNumber?.Trim(); c.DriverLicenseClass = r.DriverLicenseClass?.Trim();
        c.DriverLicenseIssueDate = r.DriverLicenseIssueDate; c.DriverLicenseExpiryDate = r.DriverLicenseExpiryDate;
        c.Source = r.Source?.Trim(); c.TagsJson = r.TagsJson?.Trim(); c.PhotoUrl = r.PhotoUrl?.Trim();
        c.AssignedAdvisorId = r.AssignedAdvisorId;
        c.PaymentDueDate = r.PaymentDueDate;
        await _db.SaveChangesAsync(ct);
        return new CustomerDto(c.Id, c.CustomerNumber, c.Type, c.Status, c.FirstName, c.LastName, c.CompanyName,
            c.VatNumber, c.Email, c.Phone, c.City, c.Notes, c.CreatedAt, false, c.PaymentDueDate,
            c.Address, c.PostalCode, c.BirthDate, c.Occupation, c.FatherName, c.MotherName, c.SpouseName,
            c.Nationality, c.Zone, c.ActivityCode, c.TaxOffice, c.GemiNumber, c.LegalForm, c.AltPhone,
            c.MobilePhone, c.Amka, c.IdNumber, c.PassportNumber, c.Region, c.Gender, c.MaritalStatus, c.Employer,
            c.DriverLicenseNumber, c.DriverLicenseClass, c.DriverLicenseIssueDate, c.DriverLicenseExpiryDate,
            c.Source, c.TagsJson, c.PhotoUrl);
    }
}
