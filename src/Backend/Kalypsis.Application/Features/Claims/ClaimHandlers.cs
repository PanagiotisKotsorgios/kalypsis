using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Claims;

/* ========= List ========= */

public record ListClaimsQuery(ClaimStatus? Status, Guid? PolicyId) : IRequest<IReadOnlyList<ClaimDto>>;

public class ListClaimsQueryHandler : IRequestHandler<ListClaimsQuery, IReadOnlyList<ClaimDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListClaimsQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<ClaimDto>> Handle(ListClaimsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var q = _db.Claims
            .IgnoreQueryFilters()
            .Include(c => c.Policy).ThenInclude(p => p.Customer)
            .Include(c => c.Policy).ThenInclude(p => p.InsuranceCompany)
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId is null) return Array.Empty<ClaimDto>();
            q = q.Where(c => c.Policy.CustomerId == customerId);
        }

        if (request.Status.HasValue) q = q.Where(c => c.Status == request.Status.Value);
        if (request.PolicyId.HasValue) q = q.Where(c => c.PolicyId == request.PolicyId.Value);

        var rows = await q.OrderByDescending(c => c.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    internal static ClaimDto ToDto(Claim c)
    {
        var customer = c.Policy?.Customer;
        var customerDisplay = customer is null
            ? string.Empty
            : customer.Type == CustomerType.Individual
                ? $"{customer.FirstName} {customer.LastName}".Trim()
                : customer.CompanyName ?? "—";

        return new ClaimDto(
            c.Id,
            c.ClaimNumber,
            c.PolicyId,
            c.Policy?.PolicyNumber ?? string.Empty,
            customer?.Id ?? Guid.Empty,
            customerDisplay,
            c.Policy?.PolicyType ?? PolicyType.Other,
            c.Policy?.InsuranceCompany?.Name ?? string.Empty,
            c.IncidentDate,
            c.ReportedDate,
            c.Status,
            c.ClaimedAmount,
            c.ApprovedAmount,
            c.Description,
            c.CreatedAt);
    }
}

/* ========= Create ========= */

public record CreateClaimCommand(CreateClaimBody Body) : IRequest<ClaimDto>;

public class CreateClaimCommandValidator : AbstractValidator<CreateClaimCommand>
{
    public CreateClaimCommandValidator()
    {
        RuleFor(x => x.Body.PolicyId).NotEqual(Guid.Empty);
        RuleFor(x => x.Body.ClaimedAmount).GreaterThanOrEqualTo(0).When(x => x.Body.ClaimedAmount.HasValue);
        RuleFor(x => x.Body.Description).MaximumLength(2000);
    }
}

public class CreateClaimCommandHandler : IRequestHandler<CreateClaimCommand, ClaimDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public CreateClaimCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public async Task<ClaimDto> Handle(CreateClaimCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var r = request.Body;

        var policy = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == r.PolicyId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw new AppException("policy_not_found",
                "Το συμβόλαιο δεν βρέθηκε.", 400,
                title: "Λείπει το συμβόλαιο",
                why: "Δεν μπορείτε να καταχωρήσετε ζημιά χωρίς ενεργό συμβόλαιο. Το συμβόλαιο που επιλέξατε διαγράφηκε ή δεν ανήκει στο γραφείο σας.",
                fix: "Επιλέξτε άλλο συμβόλαιο από τη λίστα ή δημιουργήστε νέο συμβόλαιο για τον πελάτη.",
                fixLink: "/app/policies");

        var count = await _db.Claims.IgnoreQueryFilters().CountAsync(c => c.TenantId == tenantId, ct);
        var number = $"CL-{(count + 1):D6}";

        var c = new Claim
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ClaimNumber = number,
            PolicyId = policy.Id,
            IncidentDate = r.IncidentDate,
            ReportedDate = r.ReportedDate ?? DateOnly.FromDateTime(_clock.UtcNow),
            Status = ClaimStatus.Reported,
            ClaimedAmount = r.ClaimedAmount,
            Description = r.Description?.Trim()
        };
        _db.Claims.Add(c);
        await _db.SaveChangesAsync(ct);

        var saved = await _db.Claims.IgnoreQueryFilters()
            .Include(x => x.Policy).ThenInclude(p => p.Customer)
            .Include(x => x.Policy).ThenInclude(p => p.InsuranceCompany)
            .FirstAsync(x => x.Id == c.Id, ct);
        return ListClaimsQueryHandler.ToDto(saved);
    }
}

/* ========= Update ========= */

public record UpdateClaimCommand(Guid Id, UpdateClaimBody Body) : IRequest<ClaimDto>;

public class UpdateClaimCommandHandler : IRequestHandler<UpdateClaimCommand, ClaimDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public UpdateClaimCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ClaimDto> Handle(UpdateClaimCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.Claims.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Ζημιά");

        c.IncidentDate = request.Body.IncidentDate;
        c.ReportedDate = request.Body.ReportedDate;
        c.ClaimedAmount = request.Body.ClaimedAmount;
        c.ApprovedAmount = request.Body.ApprovedAmount;
        c.Description = request.Body.Description?.Trim();

        await _db.SaveChangesAsync(ct);

        var saved = await _db.Claims.IgnoreQueryFilters()
            .Include(x => x.Policy).ThenInclude(p => p.Customer)
            .Include(x => x.Policy).ThenInclude(p => p.InsuranceCompany)
            .FirstAsync(x => x.Id == c.Id, ct);
        return ListClaimsQueryHandler.ToDto(saved);
    }
}

/* ========= Status change ========= */

public record UpdateClaimStatusCommand(Guid Id, UpdateClaimStatusBody Body) : IRequest<ClaimDto>;

public class UpdateClaimStatusCommandHandler : IRequestHandler<UpdateClaimStatusCommand, ClaimDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public UpdateClaimStatusCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ClaimDto> Handle(UpdateClaimStatusCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.Claims.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Ζημιά");

        c.Status = request.Body.Status;
        if (request.Body.ApprovedAmount.HasValue) c.ApprovedAmount = request.Body.ApprovedAmount;

        await _db.SaveChangesAsync(ct);

        var saved = await _db.Claims.IgnoreQueryFilters()
            .Include(x => x.Policy).ThenInclude(p => p.Customer)
            .Include(x => x.Policy).ThenInclude(p => p.InsuranceCompany)
            .FirstAsync(x => x.Id == c.Id, ct);
        return ListClaimsQueryHandler.ToDto(saved);
    }
}
