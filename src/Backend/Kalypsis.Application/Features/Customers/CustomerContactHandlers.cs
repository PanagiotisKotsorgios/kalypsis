using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record CustomerContactDto(
    Guid Id, Guid CustomerId, string FirstName, string LastName,
    string? Role, string? Email, string? Phone, string? Notes, bool IsPrimary);

public record UpsertCustomerContactBody(
    string FirstName, string LastName, string? Role, string? Email, string? Phone, string? Notes, bool IsPrimary);

public class UpsertCustomerContactBodyValidator : AbstractValidator<UpsertCustomerContactBody>
{
    public UpsertCustomerContactBodyValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).MaximumLength(256);
    }
}

public record ListContactsQuery(Guid CustomerId) : IRequest<IReadOnlyList<CustomerContactDto>>;
public record CreateContactCommand(Guid CustomerId, UpsertCustomerContactBody Body) : IRequest<CustomerContactDto>;
public record UpdateContactCommand(Guid CustomerId, Guid ContactId, UpsertCustomerContactBody Body) : IRequest<CustomerContactDto>;
public record DeleteContactCommand(Guid CustomerId, Guid ContactId) : IRequest<Unit>;

public class ListContactsHandler : IRequestHandler<ListContactsQuery, IReadOnlyList<CustomerContactDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListContactsHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<CustomerContactDto>> Handle(ListContactsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        return await _db.CustomerContacts
            .Where(c => c.TenantId == tenantId && c.CustomerId == request.CustomerId && c.DeletedAt == null)
            .OrderByDescending(c => c.IsPrimary).ThenBy(c => c.LastName)
            .Select(c => new CustomerContactDto(c.Id, c.CustomerId, c.FirstName, c.LastName, c.Role, c.Email, c.Phone, c.Notes, c.IsPrimary))
            .ToListAsync(ct);
    }
}

public class CreateContactHandler : IRequestHandler<CreateContactCommand, CustomerContactDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateContactHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerContactDto> Handle(CreateContactCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == request.CustomerId, ct)
            ?? throw AppException.NotFound("Πελάτης");

        if (request.Body.IsPrimary)
        {
            await DemoteCurrentPrimaryAsync(tenantId, customer.Id, ct);
        }

        var c = new CustomerContact
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customer.Id,
            FirstName = request.Body.FirstName.Trim(),
            LastName = request.Body.LastName.Trim(),
            Role = request.Body.Role?.Trim(),
            Email = request.Body.Email?.Trim(),
            Phone = request.Body.Phone?.Trim(),
            Notes = request.Body.Notes,
            IsPrimary = request.Body.IsPrimary
        };
        _db.CustomerContacts.Add(c);
        await _db.SaveChangesAsync(ct);
        return new CustomerContactDto(c.Id, c.CustomerId, c.FirstName, c.LastName, c.Role, c.Email, c.Phone, c.Notes, c.IsPrimary);
    }

    private async Task DemoteCurrentPrimaryAsync(Guid tenantId, Guid customerId, CancellationToken ct)
    {
        var existing = await _db.CustomerContacts
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId && x.IsPrimary)
            .ToListAsync(ct);
        foreach (var p in existing) p.IsPrimary = false;
    }
}

public class UpdateContactHandler : IRequestHandler<UpdateContactCommand, CustomerContactDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateContactHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerContactDto> Handle(UpdateContactCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.CustomerContacts
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.CustomerId == request.CustomerId && x.Id == request.ContactId, ct)
            ?? throw AppException.NotFound("Επαφή");

        if (request.Body.IsPrimary && !c.IsPrimary)
        {
            var others = await _db.CustomerContacts
                .Where(x => x.TenantId == tenantId && x.CustomerId == request.CustomerId && x.IsPrimary)
                .ToListAsync(ct);
            foreach (var p in others) p.IsPrimary = false;
        }

        c.FirstName = request.Body.FirstName.Trim();
        c.LastName = request.Body.LastName.Trim();
        c.Role = request.Body.Role?.Trim();
        c.Email = request.Body.Email?.Trim();
        c.Phone = request.Body.Phone?.Trim();
        c.Notes = request.Body.Notes;
        c.IsPrimary = request.Body.IsPrimary;
        await _db.SaveChangesAsync(ct);
        return new CustomerContactDto(c.Id, c.CustomerId, c.FirstName, c.LastName, c.Role, c.Email, c.Phone, c.Notes, c.IsPrimary);
    }
}

public class DeleteContactHandler : IRequestHandler<DeleteContactCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public DeleteContactHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<Unit> Handle(DeleteContactCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.CustomerContacts
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.CustomerId == request.CustomerId && x.Id == request.ContactId, ct)
            ?? throw AppException.NotFound("Επαφή");
        c.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
