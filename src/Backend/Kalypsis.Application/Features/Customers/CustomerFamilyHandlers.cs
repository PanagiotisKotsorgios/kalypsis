using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public static class CustomerNeedCatalog
{
    public static readonly string[] Keys =
    {
        "Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"
    };

    public static string? PolicyTypeFor(string needKind) => needKind switch
    {
        "Home" => nameof(PolicyType.Home),
        "Vehicle" => nameof(PolicyType.Auto),
        "Health" => nameof(PolicyType.Health),
        "Life" => nameof(PolicyType.Life),
        "Business" => nameof(PolicyType.Business),
        "Travel" => nameof(PolicyType.Travel),
        _ => null
    };
}

public record CustomerProfileDto(
    Guid Id, string CustomerNumber, CustomerType Type, string DisplayName,
    string? MaritalStatus, string? Occupation, string? Employer, string? MobilePhone,
    string? Email, string? Phone, string? Notes,
    // ALIS-parity KYC fields (all nullable)
    string? FatherName = null,
    string? MotherName = null,
    string? SpouseName = null,
    string? Nationality = null,
    string? Zone = null,
    string? ActivityCode = null);

public record CustomerProfileBody(
    string? MaritalStatus, string? Occupation, string? Employer, string? MobilePhone, string? Notes,
    // ALIS-parity KYC fields (all nullable — omit or send null to clear)
    string? FatherName = null,
    string? MotherName = null,
    string? SpouseName = null,
    string? Nationality = null,
    string? Zone = null,
    string? ActivityCode = null);

public record CustomerNeedDto(
    Guid Id, string Kind, string Title, bool HasAsset, bool IsInsured,
    int Priority, DateOnly? NextContactAt, string? Notes);

public record CustomerNeedBody(
    string Kind, string Title, bool HasAsset, bool IsInsured,
    int Priority, DateOnly? NextContactAt, string? Notes);

public record FamilyPolicyDto(
    Guid Id, string PolicyNumber, string PolicyType, string Status,
    DateOnly StartDate, DateOnly EndDate, decimal Premium, string Currency);

public record CustomerFamilyMemberDto(
    Guid RelationshipId, Guid CustomerId, string DisplayName, CustomerType CustomerType,
    CustomerRelationshipType RelationshipType, string? Notes,
    IReadOnlyList<FamilyPolicyDto> Policies, IReadOnlyList<CustomerNeedDto> Needs);

public record CustomerOpportunityDto(
    Guid CustomerId, string CustomerName, string? Relationship,
    string NeedKind, string NeedTitle, string Reason, int Priority);

public record CustomerFamilyProfileDto(
    CustomerProfileDto Profile,
    IReadOnlyList<CustomerNeedDto> Needs,
    IReadOnlyList<CustomerFamilyMemberDto> Family,
    IReadOnlyList<CustomerOpportunityDto> Opportunities);

public record CustomerRelationshipBody(Guid RelatedCustomerId, CustomerRelationshipType RelationshipType, string? Notes);
public record UpdateCustomerRelationshipBody(CustomerRelationshipType RelationshipType, string? Notes);

public record GetCustomerFamilyProfileQuery(Guid CustomerId) : IRequest<CustomerFamilyProfileDto>;
public record UpdateCustomerProfileCommand(Guid CustomerId, CustomerProfileBody Body) : IRequest<CustomerProfileDto>;
public record CreateCustomerRelationshipCommand(Guid CustomerId, CustomerRelationshipBody Body) : IRequest<CustomerFamilyMemberDto>;
public record UpdateCustomerRelationshipCommand(Guid CustomerId, Guid RelationshipId, UpdateCustomerRelationshipBody Body) : IRequest<CustomerFamilyMemberDto>;
public record DeleteCustomerRelationshipCommand(Guid CustomerId, Guid RelationshipId) : IRequest<Unit>;
public record CreateCustomerNeedCommand(Guid CustomerId, CustomerNeedBody Body) : IRequest<CustomerNeedDto>;
public record UpdateCustomerNeedCommand(Guid CustomerId, Guid NeedId, CustomerNeedBody Body) : IRequest<CustomerNeedDto>;
public record DeleteCustomerNeedCommand(Guid CustomerId, Guid NeedId) : IRequest<Unit>;

public class CustomerProfileBodyValidator : AbstractValidator<CustomerProfileBody>
{
    public CustomerProfileBodyValidator()
    {
        RuleFor(x => x.MaritalStatus).MaximumLength(20);
        RuleFor(x => x.Occupation).MaximumLength(120);
        RuleFor(x => x.Employer).MaximumLength(200);
        RuleFor(x => x.MobilePhone).MaximumLength(40);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class CustomerNeedBodyValidator : AbstractValidator<CustomerNeedBody>
{
    public CustomerNeedBodyValidator()
    {
        RuleFor(x => x.Kind).Must(kind => CustomerNeedCatalog.Keys.Contains(kind)).WithMessage("Unknown insurance need.");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(160);
        RuleFor(x => x.Priority).InclusiveBetween(1, 5);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class CustomerRelationshipBodyValidator : AbstractValidator<CustomerRelationshipBody>
{
    public CustomerRelationshipBodyValidator()
    {
        RuleFor(x => x.RelatedCustomerId).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class UpdateCustomerRelationshipBodyValidator : AbstractValidator<UpdateCustomerRelationshipBody>
{
    public UpdateCustomerRelationshipBodyValidator() => RuleFor(x => x.Notes).MaximumLength(2000);
}

public class GetCustomerFamilyProfileHandler : IRequestHandler<GetCustomerFamilyProfileQuery, CustomerFamilyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetCustomerFamilyProfileHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerFamilyProfileDto> Handle(GetCustomerFamilyProfileQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customer = await CustomerFamilyQueries.RequireCustomer(_db, tenantId, request.CustomerId, ct);
        var relationships = await _db.CustomerRelationships.IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && r.CustomerId == customer.Id && r.DeletedAt == null)
            .OrderBy(r => r.RelationshipType)
            .ToListAsync(ct);
        var memberIds = relationships.Select(r => r.RelatedCustomerId).Distinct().ToList();
        var allCustomerIds = memberIds.Append(customer.Id).ToList();
        var people = await _db.Customers.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId && allCustomerIds.Contains(c.Id) && c.DeletedAt == null)
            .ToDictionaryAsync(c => c.Id, ct);
        var needs = await _db.CustomerInsuranceNeeds.IgnoreQueryFilters()
            .Where(n => n.TenantId == tenantId && allCustomerIds.Contains(n.CustomerId) && n.DeletedAt == null)
            .OrderByDescending(n => n.Priority).ThenBy(n => n.Kind).ToListAsync(ct);
        var policies = await _db.Policies.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && allCustomerIds.Contains(p.CustomerId) && p.DeletedAt == null)
            .OrderByDescending(p => p.StartDate).ToListAsync(ct);

        var needsByCustomer = needs.GroupBy(n => n.CustomerId).ToDictionary(g => g.Key, g => g.Select(CustomerFamilyQueries.MapNeed).ToList());
        var policiesByCustomer = policies.GroupBy(p => p.CustomerId).ToDictionary(g => g.Key, g => g.Select(CustomerFamilyQueries.MapPolicy).ToList());
        var profile = CustomerFamilyQueries.MapProfile(customer);
        var family = relationships
            .Where(r => people.ContainsKey(r.RelatedCustomerId))
            .Select(r =>
            {
                var related = people[r.RelatedCustomerId];
                return new CustomerFamilyMemberDto(
                    r.Id, related.Id, CustomerFamilyQueries.DisplayName(related), related.Type,
                    r.RelationshipType, r.Notes,
                    policiesByCustomer.TryGetValue(related.Id, out var memberPolicies) ? memberPolicies : Array.Empty<FamilyPolicyDto>(),
                    needsByCustomer.TryGetValue(related.Id, out var memberNeeds) ? memberNeeds : Array.Empty<CustomerNeedDto>());
            }).ToList();

        var opportunities = CustomerFamilyQueries.BuildOpportunities(
            people, relationships, needs, policies);

        return new CustomerFamilyProfileDto(
            profile,
            needsByCustomer.TryGetValue(customer.Id, out var ownNeeds) ? ownNeeds : Array.Empty<CustomerNeedDto>(),
            family,
            opportunities);
    }
}

public class UpdateCustomerProfileHandler : IRequestHandler<UpdateCustomerProfileCommand, CustomerProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateCustomerProfileHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerProfileDto> Handle(UpdateCustomerProfileCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customer = await CustomerFamilyQueries.RequireCustomer(_db, tenantId, request.CustomerId, ct);
        customer.MaritalStatus = CustomerFamilyQueries.TrimOrNull(request.Body.MaritalStatus);
        customer.Occupation = CustomerFamilyQueries.TrimOrNull(request.Body.Occupation);
        customer.Employer = CustomerFamilyQueries.TrimOrNull(request.Body.Employer);
        customer.MobilePhone = CustomerFamilyQueries.TrimOrNull(request.Body.MobilePhone);
        customer.Notes = CustomerFamilyQueries.TrimOrNull(request.Body.Notes);
        customer.FatherName = CustomerFamilyQueries.TrimOrNull(request.Body.FatherName);
        customer.MotherName = CustomerFamilyQueries.TrimOrNull(request.Body.MotherName);
        customer.SpouseName = CustomerFamilyQueries.TrimOrNull(request.Body.SpouseName);
        customer.Nationality = CustomerFamilyQueries.TrimOrNull(request.Body.Nationality);
        customer.Zone = CustomerFamilyQueries.TrimOrNull(request.Body.Zone);
        customer.ActivityCode = CustomerFamilyQueries.TrimOrNull(request.Body.ActivityCode);
        await _db.SaveChangesAsync(ct);
        return CustomerFamilyQueries.MapProfile(customer);
    }
}

public class CreateCustomerRelationshipHandler : IRequestHandler<CreateCustomerRelationshipCommand, CustomerFamilyMemberDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateCustomerRelationshipHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerFamilyMemberDto> Handle(CreateCustomerRelationshipCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (request.CustomerId == request.Body.RelatedCustomerId)
            throw new AppException("family_self_relation", "A customer cannot be related to themselves.", 400);

        var customer = await CustomerFamilyQueries.RequireCustomer(_db, tenantId, request.CustomerId, ct);
        var related = await CustomerFamilyQueries.RequireCustomer(_db, tenantId, request.Body.RelatedCustomerId, ct);
        var exists = await _db.CustomerRelationships.IgnoreQueryFilters().AnyAsync(r =>
            r.TenantId == tenantId && r.CustomerId == customer.Id && r.RelatedCustomerId == related.Id && r.DeletedAt == null, ct);
        if (exists) throw new AppException("family_relation_exists", "The family relationship already exists.", 409);

        var notes = CustomerFamilyQueries.TrimOrNull(request.Body.Notes);
        var direct = new CustomerRelationship
        {
            Id = Guid.NewGuid(), TenantId = tenantId, CustomerId = customer.Id, RelatedCustomerId = related.Id,
            RelationshipType = request.Body.RelationshipType, Notes = notes
        };
        _db.CustomerRelationships.Add(direct);
        _db.CustomerRelationships.Add(new CustomerRelationship
        {
            Id = Guid.NewGuid(), TenantId = tenantId, CustomerId = related.Id, RelatedCustomerId = customer.Id,
            RelationshipType = CustomerFamilyQueries.Inverse(request.Body.RelationshipType), Notes = notes
        });
        await _db.SaveChangesAsync(ct);
        return new CustomerFamilyMemberDto(direct.Id, related.Id, CustomerFamilyQueries.DisplayName(related), related.Type,
            direct.RelationshipType, direct.Notes, Array.Empty<FamilyPolicyDto>(), Array.Empty<CustomerNeedDto>());
    }
}

public class UpdateCustomerRelationshipHandler : IRequestHandler<UpdateCustomerRelationshipCommand, CustomerFamilyMemberDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateCustomerRelationshipHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerFamilyMemberDto> Handle(UpdateCustomerRelationshipCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var direct = await _db.CustomerRelationships.IgnoreQueryFilters().FirstOrDefaultAsync(r =>
            r.TenantId == tenantId && r.CustomerId == request.CustomerId && r.Id == request.RelationshipId && r.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Family relationship");
        var related = await CustomerFamilyQueries.RequireCustomer(_db, tenantId, direct.RelatedCustomerId, ct);
        var notes = CustomerFamilyQueries.TrimOrNull(request.Body.Notes);
        direct.RelationshipType = request.Body.RelationshipType;
        direct.Notes = notes;
        var reverse = await _db.CustomerRelationships.IgnoreQueryFilters().FirstOrDefaultAsync(r =>
            r.TenantId == tenantId && r.CustomerId == direct.RelatedCustomerId && r.RelatedCustomerId == direct.CustomerId && r.DeletedAt == null, ct);
        if (reverse is not null)
        {
            reverse.RelationshipType = CustomerFamilyQueries.Inverse(request.Body.RelationshipType);
            reverse.Notes = notes;
        }
        await _db.SaveChangesAsync(ct);
        return new CustomerFamilyMemberDto(direct.Id, related.Id, CustomerFamilyQueries.DisplayName(related), related.Type,
            direct.RelationshipType, direct.Notes, Array.Empty<FamilyPolicyDto>(), Array.Empty<CustomerNeedDto>());
    }
}

public class DeleteCustomerRelationshipHandler : IRequestHandler<DeleteCustomerRelationshipCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public DeleteCustomerRelationshipHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<Unit> Handle(DeleteCustomerRelationshipCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var direct = await _db.CustomerRelationships.IgnoreQueryFilters().FirstOrDefaultAsync(r =>
            r.TenantId == tenantId && r.CustomerId == request.CustomerId && r.Id == request.RelationshipId && r.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Family relationship");
        var pair = await _db.CustomerRelationships.IgnoreQueryFilters().Where(r => r.TenantId == tenantId && r.DeletedAt == null
            && ((r.CustomerId == direct.CustomerId && r.RelatedCustomerId == direct.RelatedCustomerId)
                || (r.CustomerId == direct.RelatedCustomerId && r.RelatedCustomerId == direct.CustomerId)))
            .ToListAsync(ct);
        foreach (var relationship in pair) relationship.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public class CreateCustomerNeedHandler : IRequestHandler<CreateCustomerNeedCommand, CustomerNeedDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateCustomerNeedHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerNeedDto> Handle(CreateCustomerNeedCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        await CustomerFamilyQueries.RequireCustomer(_db, tenantId, request.CustomerId, ct);
        var need = CustomerFamilyQueries.NewNeed(tenantId, request.CustomerId, request.Body);
        _db.CustomerInsuranceNeeds.Add(need);
        await _db.SaveChangesAsync(ct);
        return CustomerFamilyQueries.MapNeed(need);
    }
}

public class UpdateCustomerNeedHandler : IRequestHandler<UpdateCustomerNeedCommand, CustomerNeedDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateCustomerNeedHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerNeedDto> Handle(UpdateCustomerNeedCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var need = await _db.CustomerInsuranceNeeds.IgnoreQueryFilters().FirstOrDefaultAsync(n =>
            n.TenantId == tenantId && n.CustomerId == request.CustomerId && n.Id == request.NeedId && n.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Insurance need");
        CustomerFamilyQueries.ApplyNeed(need, request.Body);
        await _db.SaveChangesAsync(ct);
        return CustomerFamilyQueries.MapNeed(need);
    }
}

public class DeleteCustomerNeedHandler : IRequestHandler<DeleteCustomerNeedCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public DeleteCustomerNeedHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<Unit> Handle(DeleteCustomerNeedCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var need = await _db.CustomerInsuranceNeeds.IgnoreQueryFilters().FirstOrDefaultAsync(n =>
            n.TenantId == tenantId && n.CustomerId == request.CustomerId && n.Id == request.NeedId && n.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Insurance need");
        need.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

internal static class CustomerFamilyQueries
{
    public static async Task<Customer> RequireCustomer(IAppDbContext db, Guid tenantId, Guid customerId, CancellationToken ct) =>
        await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == customerId && c.DeletedAt == null, ct)
        ?? throw AppException.NotFound("Customer");

    public static string DisplayName(Customer customer) => customer.Type == CustomerType.Company
        ? customer.CompanyName ?? customer.CustomerNumber
        : $"{customer.FirstName} {customer.LastName}".Trim();

    public static CustomerProfileDto MapProfile(Customer customer) => new(
        customer.Id, customer.CustomerNumber, customer.Type, DisplayName(customer),
        customer.MaritalStatus, customer.Occupation, customer.Employer, customer.MobilePhone,
        customer.Email, customer.Phone, customer.Notes,
        customer.FatherName, customer.MotherName, customer.SpouseName,
        customer.Nationality, customer.Zone, customer.ActivityCode);

    public static CustomerNeedDto MapNeed(CustomerInsuranceNeed need) => new(
        need.Id, need.Kind, need.Title, need.HasAsset, need.IsInsured,
        need.Priority, need.NextContactAt, need.Notes);

    public static FamilyPolicyDto MapPolicy(Policy policy) => new(
        policy.Id, policy.PolicyNumber, policy.PolicyType.ToString(), policy.Status.ToString(),
        policy.StartDate, policy.EndDate, policy.Premium, policy.Currency);

    public static CustomerInsuranceNeed NewNeed(Guid tenantId, Guid customerId, CustomerNeedBody body)
    {
        var need = new CustomerInsuranceNeed { Id = Guid.NewGuid(), TenantId = tenantId, CustomerId = customerId };
        ApplyNeed(need, body);
        return need;
    }

    public static void ApplyNeed(CustomerInsuranceNeed need, CustomerNeedBody body)
    {
        need.Kind = body.Kind.Trim();
        need.Title = body.Title.Trim();
        need.HasAsset = body.HasAsset;
        need.IsInsured = body.IsInsured;
        need.Priority = body.Priority;
        need.NextContactAt = body.NextContactAt;
        need.Notes = TrimOrNull(body.Notes);
    }

    public static string? TrimOrNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static CustomerRelationshipType Inverse(CustomerRelationshipType relationship) => relationship switch
    {
        CustomerRelationshipType.Child => CustomerRelationshipType.Parent,
        CustomerRelationshipType.Parent => CustomerRelationshipType.Child,
        CustomerRelationshipType.Grandparent => CustomerRelationshipType.Grandchild,
        CustomerRelationshipType.Grandchild => CustomerRelationshipType.Grandparent,
        CustomerRelationshipType.Spouse => CustomerRelationshipType.Spouse,
        CustomerRelationshipType.Partner => CustomerRelationshipType.Partner,
        CustomerRelationshipType.Sibling => CustomerRelationshipType.Sibling,
        CustomerRelationshipType.Dependent => CustomerRelationshipType.Other,
        _ => CustomerRelationshipType.Other
    };

    public static IReadOnlyList<CustomerOpportunityDto> BuildOpportunities(
        IReadOnlyDictionary<Guid, Customer> people,
        IReadOnlyList<CustomerRelationship> relationships,
        IReadOnlyList<CustomerInsuranceNeed> needs,
        IReadOnlyList<Policy> policies)
    {
        var relationByCustomer = relationships.ToDictionary(r => r.RelatedCustomerId, r => r.RelationshipType.ToString());
        var activePolicies = policies.Where(p => p.Status == PolicyStatus.Active)
            .GroupBy(p => p.CustomerId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.PolicyType.ToString()).ToHashSet());
        return needs.Where(n => n.HasAsset && !n.IsInsured && people.ContainsKey(n.CustomerId))
            .Where(n =>
            {
                var policyType = CustomerNeedCatalog.PolicyTypeFor(n.Kind);
                return policyType is null || !activePolicies.GetValueOrDefault(n.CustomerId, new HashSet<string>()).Contains(policyType);
            })
            .OrderByDescending(n => n.Priority)
            .Select(n =>
            {
                var person = people[n.CustomerId];
                return new CustomerOpportunityDto(
                    person.Id, DisplayName(person), relationByCustomer.GetValueOrDefault(person.Id),
                    n.Kind, n.Title,
                    $"Υπάρχει καταχωρημένο {n.Kind} χωρίς ενεργή κάλυψη.", n.Priority);
            }).ToList();
    }
}
