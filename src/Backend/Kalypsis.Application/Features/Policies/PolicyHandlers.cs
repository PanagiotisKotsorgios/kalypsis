using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/* ========= List ========= */

public record ListPoliciesQuery(
    string? Search,
    PolicyStatus? Status,
    PolicyType? Type,
    Guid? CustomerId) : IRequest<IReadOnlyList<PolicyDto>>;

public class ListPoliciesQueryHandler : IRequestHandler<ListPoliciesQuery, IReadOnlyList<PolicyDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListPoliciesQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<PolicyDto>> Handle(ListPoliciesQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var q = _db.Policies
            .IgnoreQueryFilters()
            .Include(p => p.Customer)
            .Include(p => p.InsuranceCompany)
            .Include(p => p.Producer)
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null);

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId is null) return Array.Empty<PolicyDto>();
            q = q.Where(p => p.CustomerId == customerId);
        }
        else if (_current.Role == Role.Producer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var producerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
            if (producerId is null) return Array.Empty<PolicyDto>();
            q = q.Where(p => p.ProducerId == producerId);
        }
        else if (request.CustomerId.HasValue)
        {
            q = q.Where(p => p.CustomerId == request.CustomerId.Value);
        }

        if (request.Status.HasValue) q = q.Where(p => p.Status == request.Status.Value);
        if (request.Type.HasValue) q = q.Where(p => p.PolicyType == request.Type.Value);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = $"%{request.Search.Trim()}%";
            q = q.Where(p => EF.Functions.Like(p.PolicyNumber, s));
        }

        var rows = await q.OrderByDescending(p => p.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    internal static PolicyDto ToDto(Policy p)
    {
        var customerDisplay = p.Customer is null
            ? string.Empty
            : p.Customer.Type == CustomerType.Individual
                ? $"{p.Customer.FirstName} {p.Customer.LastName}".Trim()
                : p.Customer.CompanyName ?? "—";

        return new PolicyDto(
            p.Id,
            p.PolicyNumber,
            p.CustomerId,
            customerDisplay,
            p.InsuranceCompanyId,
            p.InsuranceCompany?.Name ?? string.Empty,
            p.ProducerId,
            p.Producer?.Name,
            p.PolicyType,
            p.Status,
            p.StartDate,
            p.EndDate,
            p.Premium,
            p.Currency,
            p.CreatedAt);
    }
}

/* ========= Get ========= */

public record GetPolicyQuery(Guid Id) : IRequest<PolicyDto>;

public class GetPolicyQueryHandler : IRequestHandler<GetPolicyQuery, PolicyDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetPolicyQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PolicyDto> Handle(GetPolicyQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Policies.IgnoreQueryFilters()
            .Include(x => x.Customer).Include(x => x.InsuranceCompany).Include(x => x.Producer)
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId != p.CustomerId) throw AppException.Forbidden();
        }

        return ListPoliciesQueryHandler.ToDto(p);
    }
}

/* ========= Create ========= */

public record CreatePolicyCommand(CreatePolicyBody Body) : IRequest<PolicyDto>;

public class CreatePolicyCommandValidator : AbstractValidator<CreatePolicyCommand>
{
    public CreatePolicyCommandValidator()
    {
        RuleFor(x => x.Body.CustomerId).NotEqual(Guid.Empty);
        RuleFor(x => x.Body.InsuranceCompanyId).NotEqual(Guid.Empty);
        RuleFor(x => x.Body.Premium).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Body.EndDate).GreaterThan(x => x.Body.StartDate)
            .WithMessage("Η ημερομηνία λήξης πρέπει να είναι μεταγενέστερη της έναρξης.");
    }
}

public class CreatePolicyCommandHandler : IRequestHandler<CreatePolicyCommand, PolicyDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public CreatePolicyCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PolicyDto> Handle(CreatePolicyCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var r = request.Body;

        // Validate customer + carrier belong to scope.
        var customer = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == r.CustomerId && c.TenantId == tenantId && c.DeletedAt == null, ct)
            ?? throw new AppException("customer_not_found",
                "Ο πελάτης δεν βρέθηκε.", 400,
                title: "Λείπει ο πελάτης",
                why: "Επιλέξατε πελάτη που έχει διαγραφεί ή δεν ανήκει στο γραφείο σας. Πιθανώς ο πελάτης ήταν προσωρινός και διαγράφηκε από άλλο χρήστη.",
                fix: "Πατήστε «Νέος πελάτης» για να τον δημιουργήσετε, ή επιλέξτε άλλον από τη λίστα.",
                fixLink: "/app/customers");

        var carrierExists = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .AnyAsync(c => c.Id == r.InsuranceCompanyId && c.DeletedAt == null, ct);
        if (!carrierExists)
            throw new AppException("carrier_not_found",
                "Η ασφαλιστική εταιρεία δεν βρέθηκε.", 400,
                title: "Λείπει η ασφαλιστική",
                why: "Η ασφαλιστική που επιλέξατε δεν υπάρχει στον κατάλογό σας. Πιθανώς δεν την έχετε προσθέσει ακόμη ή διαγράφηκε.",
                fix: "Μεταβείτε στις «Ασφαλιστικές Εταιρείες» και προσθέστε την, μετά ξαναπροσπαθήστε.",
                fixLink: "/app/insurance-companies");

        var count = await _db.Policies.IgnoreQueryFilters().CountAsync(p => p.TenantId == tenantId, ct);
        var number = $"P-{(count + 1):D6}";

        var p = new Policy
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PolicyNumber = number,
            CustomerId = customer.Id,
            InsuranceCompanyId = r.InsuranceCompanyId,
            ProducerId = r.ProducerId,
            PolicyType = r.PolicyType,
            VehicleUseCategory = r.VehicleUseCategory,
            Status = r.Status,
            StartDate = r.StartDate,
            EndDate = r.EndDate,
            Premium = r.Premium,
            Currency = string.IsNullOrWhiteSpace(r.Currency) ? "EUR" : r.Currency.Trim().ToUpperInvariant(),
            SpecsJson = PolicySpecsJsonHelper.MergeCodes(null, r.CoverCode, r.PackageCode),
            CreatedByUserId = _current.UserId
        };
        _db.Policies.Add(p);
        await _db.SaveChangesAsync(ct);

        // Re-fetch with includes for display fields.
        var saved = await _db.Policies.IgnoreQueryFilters()
            .Include(x => x.Customer).Include(x => x.InsuranceCompany).Include(x => x.Producer)
            .FirstAsync(x => x.Id == p.Id, ct);
        return ListPoliciesQueryHandler.ToDto(saved);
    }
}

/* ========= Update ========= */

public record UpdatePolicyCommand(Guid Id, UpdatePolicyBody Body) : IRequest<PolicyDto>;

public class UpdatePolicyCommandValidator : AbstractValidator<UpdatePolicyCommand>
{
    public UpdatePolicyCommandValidator()
    {
        RuleFor(x => x.Body.Premium).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Body.EndDate).GreaterThan(x => x.Body.StartDate);
    }
}

public class UpdatePolicyCommandHandler : IRequestHandler<UpdatePolicyCommand, PolicyDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public UpdatePolicyCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PolicyDto> Handle(UpdatePolicyCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var b = request.Body;
        p.InsuranceCompanyId = b.InsuranceCompanyId;
        p.ProducerId = b.ProducerId;
        p.PolicyType = b.PolicyType;
        p.VehicleUseCategory = b.VehicleUseCategory;
        p.StartDate = b.StartDate;
        p.EndDate = b.EndDate;
        p.Premium = b.Premium;
        p.Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency.Trim().ToUpperInvariant();
        p.Status = b.Status;
        p.SpecsJson = PolicySpecsJsonHelper.MergeCodes(p.SpecsJson, b.CoverCode, b.PackageCode);

        await _db.SaveChangesAsync(ct);

        var saved = await _db.Policies.IgnoreQueryFilters()
            .Include(x => x.Customer).Include(x => x.InsuranceCompany).Include(x => x.Producer)
            .FirstAsync(x => x.Id == p.Id, ct);
        return ListPoliciesQueryHandler.ToDto(saved);
    }
}

/* ========= Cancel (soft-delete via status) ========= */

public record CancelPolicyCommand(Guid Id, CancelPolicyBody Body) : IRequest<PolicyDto>;

public class CancelPolicyCommandHandler : IRequestHandler<CancelPolicyCommand, PolicyDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public CancelPolicyCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PolicyDto> Handle(CancelPolicyCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        p.Status = PolicyStatus.Cancelled;
        await _db.SaveChangesAsync(ct);

        var saved = await _db.Policies.IgnoreQueryFilters()
            .Include(x => x.Customer).Include(x => x.InsuranceCompany).Include(x => x.Producer)
            .FirstAsync(x => x.Id == p.Id, ct);
        return ListPoliciesQueryHandler.ToDto(saved);
    }
}

/* ========= Renew (creates a new policy linked back to original) ========= */

public record RenewPolicyCommand(Guid Id, RenewPolicyBody Body) : IRequest<PolicyDto>;

public class RenewPolicyCommandValidator : AbstractValidator<RenewPolicyCommand>
{
    public RenewPolicyCommandValidator()
    {
        RuleFor(x => x.Body.Premium).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Body.EndDate).GreaterThan(x => x.Body.StartDate);
    }
}

public class RenewPolicyCommandHandler : IRequestHandler<RenewPolicyCommand, PolicyDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public RenewPolicyCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PolicyDto> Handle(RenewPolicyCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var src = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var count = await _db.Policies.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenantId, ct);
        var number = $"P-{(count + 1):D6}";

        var newPolicy = new Policy
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PolicyNumber = number,
            CustomerId = src.CustomerId,
            InsuranceCompanyId = src.InsuranceCompanyId,
            ProducerId = src.ProducerId,
            PolicyType = src.PolicyType,
            Status = PolicyStatus.Active,
            StartDate = request.Body.StartDate,
            EndDate = request.Body.EndDate,
            Premium = request.Body.Premium,
            Currency = src.Currency,
            CreatedByUserId = _current.UserId,
            RenewedFromPolicyId = src.Id
        };
        _db.Policies.Add(newPolicy);

        src.Status = PolicyStatus.Renewed;
        await _db.SaveChangesAsync(ct);

        var saved = await _db.Policies.IgnoreQueryFilters()
            .Include(x => x.Customer).Include(x => x.InsuranceCompany).Include(x => x.Producer)
            .FirstAsync(x => x.Id == newPolicy.Id, ct);
        return ListPoliciesQueryHandler.ToDto(saved);
    }
}

/* ========= Insurance carriers ========= */

public record ListInsuranceCompaniesQuery() : IRequest<IReadOnlyList<InsuranceCompanyDto>>;

public class ListInsuranceCompaniesQueryHandler : IRequestHandler<ListInsuranceCompaniesQuery, IReadOnlyList<InsuranceCompanyDto>>
{
    private readonly IAppDbContext _db;
    public ListInsuranceCompaniesQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<InsuranceCompanyDto>> Handle(ListInsuranceCompaniesQuery request, CancellationToken ct)
    {
        return await _db.InsuranceCompanies
            .IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null)
            .OrderBy(c => c.Name)
            .Select(c => new InsuranceCompanyDto(c.Id, c.Name, c.Code, c.Country, c.IsActive, c.IsBroker, c.ParentCompanyId))
            .ToListAsync(ct);
    }
}


/// <summary>
/// Merges optional CoverCode / PackageCode into Policy.SpecsJson without
/// disturbing other fields the bridge import or other code may have written
/// into the same blob. If both codes are null/blank the original JSON is
/// returned unchanged.
/// </summary>
internal static class PolicySpecsJsonHelper
{
    public static string? MergeCodes(string? existingJson, string? coverCode, string? packageCode)
    {
        var hasCover = !string.IsNullOrWhiteSpace(coverCode);
        var hasPkg = !string.IsNullOrWhiteSpace(packageCode);
        if (!hasCover && !hasPkg) return existingJson;

        var map = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(existingJson))
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(existingJson);
                foreach (var prop in doc.RootElement.EnumerateObject())
                    map[prop.Name] = prop.Value.ValueKind switch
                    {
                        System.Text.Json.JsonValueKind.String => prop.Value.GetString(),
                        System.Text.Json.JsonValueKind.Number => prop.Value.TryGetInt64(out var n) ? (object?)n : prop.Value.GetDouble(),
                        System.Text.Json.JsonValueKind.True => true,
                        System.Text.Json.JsonValueKind.False => false,
                        System.Text.Json.JsonValueKind.Null => null,
                        _ => prop.Value.GetRawText()
                    };
            }
            catch
            {
                // Malformed existing SpecsJson — start fresh rather than throw.
                map.Clear();
            }
        }
        if (hasCover) map["coverCode"] = coverCode!.Trim().ToUpperInvariant();
        if (hasPkg)   map["packageCode"] = packageCode!.Trim().ToUpperInvariant();
        return System.Text.Json.JsonSerializer.Serialize(map);
    }
}
