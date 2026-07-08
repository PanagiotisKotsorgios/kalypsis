using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.ClaimInvolvedParties;

// ============================================================================
// «F5 Ζημιάδες Εμπλεκόμενοι» — persons / entities involved in a claim beyond
// the policyholder. Read via customer aggregate (one call fills the tab),
// write via claim-scoped endpoints (the claim is always the anchor).
// ============================================================================

public record ClaimInvolvedPartyDto(
    Guid Id,
    Guid ClaimId,
    string ClaimNumber,
    string? ClaimIncidentDate,
    Guid PolicyId,
    string PolicyNumber,
    string Role,
    string FullName,
    string? Phone,
    string? Email,
    string? VatNumber,
    string? VehiclePlate,
    string? InsuranceCompany,
    string? PolicyNumberOther,
    string? Notes,
    DateTime CreatedAt);

public record ClaimInvolvedPartyBody(
    string Role,
    string FullName,
    string? Phone,
    string? Email,
    string? VatNumber,
    string? VehiclePlate,
    string? InsuranceCompany,
    string? PolicyNumberOther,
    string? Notes);

public class ClaimInvolvedPartyBodyValidator : AbstractValidator<ClaimInvolvedPartyBody>
{
    public ClaimInvolvedPartyBodyValidator()
    {
        RuleFor(x => x.Role).NotEmpty().MaximumLength(40);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(160);
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.Email).MaximumLength(160);
        RuleFor(x => x.VatNumber).MaximumLength(20);
        RuleFor(x => x.VehiclePlate).MaximumLength(20);
        RuleFor(x => x.InsuranceCompany).MaximumLength(160);
        RuleFor(x => x.PolicyNumberOther).MaximumLength(64);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

/* ============ List by customer (aggregate across every claim) ============ */

public record ListInvolvedPartiesByCustomerQuery(Guid CustomerId) : IRequest<IReadOnlyList<ClaimInvolvedPartyDto>>;

public class ListInvolvedPartiesByCustomerHandler
    : IRequestHandler<ListInvolvedPartiesByCustomerQuery, IReadOnlyList<ClaimInvolvedPartyDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListInvolvedPartiesByCustomerHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<IReadOnlyList<ClaimInvolvedPartyDto>> Handle(
        ListInvolvedPartiesByCustomerQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Materialise the join: parties → claims → policies (to filter by
        // customer). Left as a single query so we render the tab in one
        // round-trip and can group by claim on the frontend.
        var rows = await (
            from p in _db.ClaimInvolvedParties
            join c in _db.Claims on p.ClaimId equals c.Id
            join pol in _db.Policies on c.PolicyId equals pol.Id
            where p.TenantId == tenantId && p.DeletedAt == null
                  && pol.CustomerId == r.CustomerId && pol.DeletedAt == null
                  && c.DeletedAt == null
            orderby c.IncidentDate descending, p.CreatedAt descending
            select new ClaimInvolvedPartyDto(
                p.Id, c.Id, c.ClaimNumber,
                c.IncidentDate == default ? null : c.IncidentDate.ToString("yyyy-MM-dd"),
                pol.Id, pol.PolicyNumber,
                p.Role, p.FullName,
                p.Phone, p.Email, p.VatNumber, p.VehiclePlate,
                p.InsuranceCompany, p.PolicyNumber, p.Notes,
                p.CreatedAt)
        ).ToListAsync(ct);
        return rows;
    }
}

/* ============ Create for a claim ======================================= */

public record CreateInvolvedPartyCommand(Guid ClaimId, ClaimInvolvedPartyBody Body)
    : IRequest<ClaimInvolvedPartyDto>;

public class CreateInvolvedPartyHandler
    : IRequestHandler<CreateInvolvedPartyCommand, ClaimInvolvedPartyDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateInvolvedPartyHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<ClaimInvolvedPartyDto> Handle(
        CreateInvolvedPartyCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        new ClaimInvolvedPartyBodyValidator().ValidateAndThrow(r.Body);

        var claim = await _db.Claims.IgnoreQueryFilters()
            .Include(c => c.Policy)
            .FirstOrDefaultAsync(c => c.Id == r.ClaimId && c.TenantId == tenantId && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Ζημιά");

        var p = new ClaimInvolvedParty
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ClaimId = claim.Id,
            Role = r.Body.Role.Trim(),
            FullName = r.Body.FullName.Trim(),
            Phone = TrimOrNull(r.Body.Phone),
            Email = TrimOrNull(r.Body.Email)?.ToLowerInvariant(),
            VatNumber = TrimOrNull(r.Body.VatNumber),
            VehiclePlate = TrimOrNull(r.Body.VehiclePlate)?.ToUpperInvariant(),
            InsuranceCompany = TrimOrNull(r.Body.InsuranceCompany),
            PolicyNumber = TrimOrNull(r.Body.PolicyNumberOther),
            Notes = TrimOrNull(r.Body.Notes),
            CreatedAt = DateTime.UtcNow
        };
        _db.ClaimInvolvedParties.Add(p);
        await _db.SaveChangesAsync(ct);

        return new ClaimInvolvedPartyDto(
            p.Id, claim.Id, claim.ClaimNumber,
            claim.IncidentDate == default ? null : claim.IncidentDate.ToString("yyyy-MM-dd"),
            claim.Policy.Id, claim.Policy.PolicyNumber,
            p.Role, p.FullName,
            p.Phone, p.Email, p.VatNumber, p.VehiclePlate,
            p.InsuranceCompany, p.PolicyNumber, p.Notes,
            p.CreatedAt);
    }

    private static string? TrimOrNull(string? v)
    {
        var t = v?.Trim();
        return string.IsNullOrWhiteSpace(t) ? null : t;
    }
}

/* ============ Update ================================================== */

public record UpdateInvolvedPartyCommand(Guid Id, ClaimInvolvedPartyBody Body)
    : IRequest<ClaimInvolvedPartyDto>;

public class UpdateInvolvedPartyHandler
    : IRequestHandler<UpdateInvolvedPartyCommand, ClaimInvolvedPartyDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateInvolvedPartyHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<ClaimInvolvedPartyDto> Handle(
        UpdateInvolvedPartyCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        new ClaimInvolvedPartyBodyValidator().ValidateAndThrow(r.Body);

        var p = await _db.ClaimInvolvedParties
            .Include(x => x.Claim).ThenInclude(c => c.Policy)
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Εμπλεκόμενος");

        p.Role = r.Body.Role.Trim();
        p.FullName = r.Body.FullName.Trim();
        p.Phone = TrimOrNull(r.Body.Phone);
        p.Email = TrimOrNull(r.Body.Email)?.ToLowerInvariant();
        p.VatNumber = TrimOrNull(r.Body.VatNumber);
        p.VehiclePlate = TrimOrNull(r.Body.VehiclePlate)?.ToUpperInvariant();
        p.InsuranceCompany = TrimOrNull(r.Body.InsuranceCompany);
        p.PolicyNumber = TrimOrNull(r.Body.PolicyNumberOther);
        p.Notes = TrimOrNull(r.Body.Notes);
        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new ClaimInvolvedPartyDto(
            p.Id, p.ClaimId, p.Claim.ClaimNumber,
            p.Claim.IncidentDate == default ? null : p.Claim.IncidentDate.ToString("yyyy-MM-dd"),
            p.Claim.Policy.Id, p.Claim.Policy.PolicyNumber,
            p.Role, p.FullName,
            p.Phone, p.Email, p.VatNumber, p.VehiclePlate,
            p.InsuranceCompany, p.PolicyNumber, p.Notes,
            p.CreatedAt);
    }

    private static string? TrimOrNull(string? v)
    {
        var t = v?.Trim();
        return string.IsNullOrWhiteSpace(t) ? null : t;
    }
}

/* ============ Delete (soft) =========================================== */

public record DeleteInvolvedPartyCommand(Guid Id) : IRequest<Unit>;

public class DeleteInvolvedPartyHandler : IRequestHandler<DeleteInvolvedPartyCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteInvolvedPartyHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<Unit> Handle(DeleteInvolvedPartyCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.ClaimInvolvedParties
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Εμπλεκόμενος");
        p.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
