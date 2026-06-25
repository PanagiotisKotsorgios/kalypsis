using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record GetCustomerQuery(Guid Id) : IRequest<CustomerDto>;

public class GetCustomerQueryHandler : IRequestHandler<GetCustomerQuery, CustomerDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetCustomerQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerDto> Handle(GetCustomerQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var c = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == q.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");

        // Producers can only view customers they have a policy with.
        if (_current.Role == Role.Producer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var producerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
            if (producerId is null) throw AppException.Forbidden();
            var owns = await _db.Policies.IgnoreQueryFilters()
                .AnyAsync(p => p.CustomerId == c.Id && p.ProducerId == producerId && p.DeletedAt == null, ct);
            if (!owns) throw AppException.Forbidden();
        }
        if (_current.Role == Role.Customer && _current.UserId is Guid uid)
        {
            var ownsAsCustomer = await _db.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.Id == uid && u.CustomerId == c.Id, ct);
            if (!ownsAsCustomer) throw AppException.Forbidden();
        }

        return new CustomerDto(
            c.Id, c.CustomerNumber, c.Type, c.FirstName, c.LastName,
            c.CompanyName, c.VatNumber, c.Email, c.Phone, c.City, c.CreatedAt,
            await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.CustomerId == c.Id && u.DeletedAt == null, ct));
    }
}
