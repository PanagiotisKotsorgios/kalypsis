using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record UpdateCustomerStatusBody(CustomerStatus Status);

public record UpdateCustomerStatusCommand(Guid CustomerId, CustomerStatus Status) : IRequest;

public class UpdateCustomerStatusCommandHandler : IRequestHandler<UpdateCustomerStatusCommand>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public UpdateCustomerStatusCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task Handle(UpdateCustomerStatusCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customer = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId
                && c.TenantId == tenantId && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Customer");

        customer.Status = request.Status;
        customer.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
