using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Claims;

/* ========= List ========= */

public record ListClaimsQuery(ClaimStatus? Status, Guid? PolicyId, Guid? Id = null) : IRequest<IReadOnlyList<ClaimDto>>;

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
            .Include(c => c.Policy).ThenInclude(p => p.Customer)
            .Include(c => c.Policy).ThenInclude(p => p.InsuranceCompany)
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId is null) return Array.Empty<ClaimDto>();
            q = q.Where(c => c.Policy.CustomerId == customerId);
        }

        if (request.Status.HasValue) q = q.Where(c => c.Status == request.Status.Value);
        if (request.PolicyId.HasValue) q = q.Where(c => c.PolicyId == request.PolicyId.Value);
        if (request.Id.HasValue) q = q.Where(c => c.Id == request.Id.Value);

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
            c.CreatedAt,
            c.Policy?.InsuranceCompanyId,
            c.Policy?.VehicleUseCategory,
            ExtractSpecsCode(c.Policy?.SpecsJson, "coverCode", "coverageCode", "coverage", "cover"),
            ExtractSpecsCode(c.Policy?.SpecsJson, "packageCode", "package"),
            c.AffectsBonusMalus,
            c.UsaeCode,
            c.UsaeKind,
            c.UsaeStatus,
            c.LiabilityPercent,
            c.IsInternalDamage,
            c.UsaeSentAt,
            c.UsaeReceiptCode,
            c.IsFriendlySettlement, c.Kind, c.SettledAmount, c.Currency, c.UpdatedAt);
    }

    private static string? ExtractSpecsCode(string? specsJson, params string[] keys)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(specsJson);
            foreach (var k in keys)
                if (doc.RootElement.TryGetProperty(k, out var prop)
                    && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                    return prop.GetString()?.Trim().ToUpperInvariant();
        }
        catch { }
        return null;
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

        var policy = await _db.Policies
            .FirstOrDefaultAsync(p => p.Id == r.PolicyId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw new AppException("policy_not_found",
                "Το συμβόλαιο δεν βρέθηκε.", 400,
                title: "Λείπει το συμβόλαιο",
                why: "Δεν μπορείτε να καταχωρήσετε ζημιά χωρίς ενεργό συμβόλαιο. Το συμβόλαιο που επιλέξατε διαγράφηκε ή δεν ανήκει στο γραφείο σας.",
                fix: "Επιλέξτε άλλο συμβόλαιο από τη λίστα ή δημιουργήστε νέο συμβόλαιο για τον πελάτη.",
                fixLink: "/app/policies");

        var count = await _db.Claims.CountAsync(c => c.TenantId == tenantId, ct);
        var number = $"CL-{(count + 1):D6}";

        var c = new Claim
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ClaimNumber = number,
            PolicyId = policy.Id,
            Currency = policy.Currency,
            IncidentDate = r.IncidentDate,
            ReportedDate = r.ReportedDate ?? DateOnly.FromDateTime(_clock.UtcNow),
            Status = ClaimStatus.Reported,
            ClaimedAmount = r.ClaimedAmount,
            Description = r.Description?.Trim()
        };
        _db.Claims.Add(c);
        await _db.SaveChangesAsync(ct);

        var saved = await _db.Claims
            .Include(x => x.Policy).ThenInclude(p => p.Customer)
            .Include(x => x.Policy).ThenInclude(p => p.InsuranceCompany)
            .FirstAsync(x => x.Id == c.Id, ct);
        return ListClaimsQueryHandler.ToDto(saved);
    }
}

/* ========= Update ========= */

public record UpdateClaimCommand(Guid Id, UpdateClaimBody Body) : IRequest<ClaimDto>;

public class UpdateClaimCommandValidator : AbstractValidator<UpdateClaimCommand>
{
    public UpdateClaimCommandValidator()
    {
        RuleFor(x=>x.Body.ClaimNumber).MaximumLength(64);
        RuleFor(x=>x.Body.ClaimNumber).NotEmpty().When(x=>x.Body.ClaimNumber != null);
        RuleFor(x=>x.Body.Status).IsInEnum();
        RuleFor(x=>x.Body.ClaimedAmount).GreaterThanOrEqualTo(0);
        RuleFor(x=>x.Body.ApprovedAmount).GreaterThanOrEqualTo(0);
        RuleFor(x=>x.Body.SettledAmount).GreaterThanOrEqualTo(0);
        RuleFor(x=>x.Body.LiabilityPercent).InclusiveBetween(0,100);
        RuleFor(x=>x.Body.Description).MaximumLength(2000);
        RuleFor(x=>x.Body.Kind).Must(x=>new[]{"VehicleDamage","ThirdPartyLiability","Theft","WaterDamage","Fire","Other"}.Contains(x)).When(x=>x.Body.Kind!=null);
        RuleFor(x=>x.Body.Currency).Matches("^[A-Z]{3}$").When(x=>x.Body.Currency!=null);
        RuleFor(x=>x.Body.UsaeCode).MaximumLength(100);
        RuleFor(x=>x.Body.UsaeKind).MaximumLength(100);
        RuleFor(x=>x.Body.UsaeReceiptCode).MaximumLength(100);
        RuleFor(x=>x.Body.UsaeStatus).Must(x=>new[]{"NotSent","Pending","Accepted","Rejected"}.Contains(x)).When(x=>x.Body.UsaeStatus!=null);
    }
}

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
        var c = await _db.Claims
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Ζημιά");

        var body = request.Body;
        if(body.ClaimNumber != null)
        {
            var number=body.ClaimNumber.Trim();
            if(await _db.Claims.IgnoreQueryFilters().AnyAsync(x=>x.TenantId==tenantId && x.Id!=c.Id && x.ClaimNumber==number,ct))
                throw new AppException("claim_number_exists","Ο αριθμός ζημιάς χρησιμοποιείται ήδη.",409);
            c.ClaimNumber=number;
        }
        if(body.Status.HasValue)c.Status=body.Status.Value;
        if(body.Kind != null)c.Kind=body.Kind;
        if(body.Currency != null)c.Currency=body.Currency;
        if(body.AffectsBonusMalus.HasValue)c.AffectsBonusMalus=body.AffectsBonusMalus.Value;
        if(body.IsInternalDamage.HasValue)c.IsInternalDamage=body.IsInternalDamage.Value;
        if(body.IsFriendlySettlement.HasValue)c.IsFriendlySettlement=body.IsFriendlySettlement.Value;
        if(body.ReplaceAdditional)
        {
            c.SettledAmount=body.SettledAmount;c.UsaeCode=body.UsaeCode?.Trim();c.UsaeKind=body.UsaeKind?.Trim();
            c.UsaeStatus=body.UsaeStatus??c.UsaeStatus;c.LiabilityPercent=body.LiabilityPercent;
            c.UsaeSentAt=body.UsaeSentAt;c.UsaeReceiptCode=body.UsaeReceiptCode?.Trim();
        }
        c.IncidentDate = request.Body.IncidentDate;
        c.ReportedDate = request.Body.ReportedDate;
        c.ClaimedAmount = request.Body.ClaimedAmount;
        c.ApprovedAmount = request.Body.ApprovedAmount;
        c.Description = request.Body.Description?.Trim();

        await _db.SaveChangesAsync(ct);

        var saved = await _db.Claims
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
        var c = await _db.Claims
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Ζημιά");

        c.Status = request.Body.Status;
        if (request.Body.ApprovedAmount.HasValue) c.ApprovedAmount = request.Body.ApprovedAmount;

        await _db.SaveChangesAsync(ct);

        var saved = await _db.Claims
            .Include(x => x.Policy).ThenInclude(p => p.Customer)
            .Include(x => x.Policy).ThenInclude(p => p.InsuranceCompany)
            .FirstAsync(x => x.Id == c.Id, ct);
        return ListClaimsQueryHandler.ToDto(saved);
    }
}
