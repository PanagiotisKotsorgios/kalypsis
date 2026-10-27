using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record CustomerContactDto(
    Guid Id, Guid CustomerId, string FirstName, string LastName,
    string? Role, string? Email, string? Phone, string? Notes, bool IsPrimary,
    string? MobilePhone, string Kind);

public record UpsertCustomerContactBody(
    string FirstName, string LastName, string? Role, string? Email, string? Phone, string? Notes, bool IsPrimary,
    string? MobilePhone = null, string Kind = "Other");

public class UpsertCustomerContactBodyValidator : AbstractValidator<UpsertCustomerContactBody>
{
    public UpsertCustomerContactBodyValidator()
    {
        RuleFor(x => x.FirstName).MaximumLength(100);
        RuleFor(x => x.LastName).MaximumLength(100);
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.FirstName) || !string.IsNullOrWhiteSpace(x.LastName) ||
                                   !string.IsNullOrWhiteSpace(x.Email) || !string.IsNullOrWhiteSpace(x.Phone) ||
                                   !string.IsNullOrWhiteSpace(x.MobilePhone))
            .WithMessage("Συμπληρώστε όνομα ή ένα στοιχείο επικοινωνίας.");
        RuleFor(x => x.Email).MaximumLength(256);
        RuleFor(x => x.MobilePhone).MaximumLength(40);
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
            .Select(c => new CustomerContactDto(c.Id, c.CustomerId, c.FirstName, c.LastName, c.Role, c.Email, c.Phone, c.Notes, c.IsPrimary, c.MobilePhone, c.Kind))
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
        ContactValueRules.Ensure("Email", request.Body.Email);
        ContactValueRules.Ensure("Phone", request.Body.Phone);
        ContactValueRules.Ensure("Phone", request.Body.MobilePhone);

        if (request.Body.IsPrimary)
        {
            await DemoteCurrentPrimaryAsync(tenantId, customer.Id, ct);
        }

        var c = new CustomerContact
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customer.Id,
            FirstName = request.Body.FirstName?.Trim() ?? string.Empty,
            LastName = request.Body.LastName?.Trim() ?? string.Empty,
            Role = request.Body.Role?.Trim(),
            Email = request.Body.Email?.Trim(),
            Phone = request.Body.Phone?.Trim(),
            MobilePhone = request.Body.MobilePhone?.Trim(),
            Kind = string.IsNullOrWhiteSpace(request.Body.Kind) ? "Other" : request.Body.Kind.Trim(),
            Notes = request.Body.Notes,
            IsPrimary = request.Body.IsPrimary
        };
        _db.CustomerContacts.Add(c);
        await _db.SaveChangesAsync(ct);
        return new CustomerContactDto(c.Id, c.CustomerId, c.FirstName, c.LastName, c.Role, c.Email, c.Phone, c.Notes, c.IsPrimary, c.MobilePhone, c.Kind);
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

        ContactValueRules.Ensure("Email", request.Body.Email, c.Email, changedOnly: true);
        ContactValueRules.Ensure("Phone", request.Body.Phone, c.Phone, changedOnly: true);
        ContactValueRules.Ensure("Phone", request.Body.MobilePhone, c.MobilePhone, changedOnly: true);

        if (request.Body.IsPrimary && !c.IsPrimary)
        {
            var others = await _db.CustomerContacts
                .Where(x => x.TenantId == tenantId && x.CustomerId == request.CustomerId && x.IsPrimary)
                .ToListAsync(ct);
            foreach (var p in others) p.IsPrimary = false;
        }

        c.FirstName = request.Body.FirstName?.Trim() ?? string.Empty;
        c.LastName = request.Body.LastName?.Trim() ?? string.Empty;
        c.Role = request.Body.Role?.Trim();
        c.Email = request.Body.Email?.Trim();
        c.Phone = request.Body.Phone?.Trim();
        c.MobilePhone = request.Body.MobilePhone?.Trim();
        c.Kind = string.IsNullOrWhiteSpace(request.Body.Kind) ? "Other" : request.Body.Kind.Trim();
        c.Notes = request.Body.Notes;
        c.IsPrimary = request.Body.IsPrimary;
        await _db.SaveChangesAsync(ct);
        return new CustomerContactDto(c.Id, c.CustomerId, c.FirstName, c.LastName, c.Role, c.Email, c.Phone, c.Notes, c.IsPrimary, c.MobilePhone, c.Kind);
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
