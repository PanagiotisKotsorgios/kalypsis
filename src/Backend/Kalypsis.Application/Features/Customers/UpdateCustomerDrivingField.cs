using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record CustomerDrivingFieldBody(string Field, bool? Value);
public record UpdateCustomerDrivingField(Guid CustomerId, CustomerDrivingFieldBody Body) : IRequest;

/// <summary>Independent PATCH keeps older full-customer clients from clearing new facts.</summary>
public class UpdateCustomerDrivingFieldHandler(IAppDbContext db, ICurrentUser current) : IRequestHandler<UpdateCustomerDrivingField>
{
    public async Task Handle(UpdateCustomerDrivingField request, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == tenant && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");
        switch (request.Body.Field)
        {
            case "hasDrivingLicense": customer.HasDrivingLicense = request.Body.Value; break;
            case "isDriver": customer.IsDriver = request.Body.Value; break;
            case "isNewDriver": customer.IsNewDriver = request.Body.Value; break;
            default: throw AppException.Validation("Το πεδίο οδηγού δεν υποστηρίζεται.");
        }
        await db.SaveChangesAsync(ct);
    }
}
