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
        await _db.SaveChangesAsync(ct);
        return new CustomerDto(c.Id, c.CustomerNumber, c.Type, c.Status, c.FirstName, c.LastName, c.CompanyName,
            c.VatNumber, c.Email, c.Phone, c.City, c.Notes, c.CreatedAt, false);
    }
}
