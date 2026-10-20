using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record CustomerCommunicationFieldBody(string Field, string? Value);
public record UpdateCustomerCommunicationField(Guid CustomerId, CustomerCommunicationFieldBody Body) : IRequest;

public class UpdateCustomerCommunicationFieldValidator : AbstractValidator<UpdateCustomerCommunicationField>
{
    public UpdateCustomerCommunicationFieldValidator()
    {
        RuleFor(x => x.Body.Field).Must(f => f is "thirdPhone" or "secondaryMobilePhone" or "secondaryEmail")
            .WithMessage("Το πεδίο επικοινωνίας δεν υποστηρίζεται.");
        RuleFor(x => x.Body.Value).MaximumLength(40).When(x => x.Body.Field != "secondaryEmail");
        RuleFor(x => x.Body.Value).MaximumLength(256).When(x => x.Body.Field == "secondaryEmail");
        RuleFor(x => x.Body.Value).EmailAddress().When(x => x.Body.Field == "secondaryEmail" && !string.IsNullOrWhiteSpace(x.Body.Value));
    }
}

/// <summary>Updates one additional channel without overwriting other customer fields.</summary>
public class UpdateCustomerCommunicationFieldHandler(IAppDbContext db, ICurrentUser current)
    : IRequestHandler<UpdateCustomerCommunicationField>
{
    public async Task Handle(UpdateCustomerCommunicationField request, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == tenant && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");
        var value = string.IsNullOrWhiteSpace(request.Body.Value) ? null : request.Body.Value.Trim();
        switch (request.Body.Field)
        {
            case "thirdPhone": customer.ThirdPhone = value; break;
            case "secondaryMobilePhone": customer.SecondaryMobilePhone = value; break;
            case "secondaryEmail": customer.SecondaryEmail = value?.ToLowerInvariant(); break;
            default: throw AppException.Validation("Το πεδίο επικοινωνίας δεν υποστηρίζεται.");
        }
        await db.SaveChangesAsync(ct);
    }
}
