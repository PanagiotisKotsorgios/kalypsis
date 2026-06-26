using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record ListCustomersQuery(
    string? Search,
    string? Occupation = null,
    string? NeedKind = null,
    bool? OnlyUninsuredNeeds = null) : IRequest<IReadOnlyList<CustomerDto>>;

public class ListCustomersQueryHandler : IRequestHandler<ListCustomersQuery, IReadOnlyList<CustomerDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ListCustomersQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<CustomerDto>> Handle(ListCustomersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId
            ?? throw AppException.Forbidden();

        var q = _db.Customers
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (_currentUser.Role == Role.Producer)
        {
            var userId = _currentUser.UserId ?? throw AppException.Unauthorized();
            var producerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(cancellationToken);
            if (producerId is null) return Array.Empty<CustomerDto>();
            var customerIds = _db.Policies.IgnoreQueryFilters()
                .Where(p => p.ProducerId == producerId && p.DeletedAt == null)
                .Select(p => p.CustomerId).Distinct();
            q = q.Where(c => customerIds.Contains(c.Id));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = $"%{request.Search.Trim()}%";
            q = q.Where(c =>
                EF.Functions.Like(c.FirstName ?? "", s) ||
                EF.Functions.Like(c.LastName ?? "", s) ||
                EF.Functions.Like(c.CompanyName ?? "", s) ||
                EF.Functions.Like(c.Email ?? "", s) ||
                EF.Functions.Like(c.Phone ?? "", s) ||
                EF.Functions.Like(c.VatNumber ?? "", s) ||
                EF.Functions.Like(c.CustomerNumber, s));
        }

        if (!string.IsNullOrWhiteSpace(request.Occupation))
        {
            var occupation = $"%{request.Occupation.Trim()}%";
            q = q.Where(c => EF.Functions.Like(c.Occupation ?? "", occupation)
                || EF.Functions.Like(c.Employer ?? "", occupation));
        }

        if (!string.IsNullOrWhiteSpace(request.NeedKind))
        {
            var matchingNeedCustomers = _db.CustomerInsuranceNeeds.IgnoreQueryFilters()
                .Where(n => n.TenantId == tenantId && n.DeletedAt == null && n.Kind == request.NeedKind && n.HasAsset);
            if (request.OnlyUninsuredNeeds == true)
                matchingNeedCustomers = matchingNeedCustomers.Where(n => !n.IsInsured);
            q = q.Where(c => matchingNeedCustomers.Select(n => n.CustomerId).Contains(c.Id));
        }

        return await q
            .OrderByDescending(c => c.CreatedAt)
            .Take(200)
            .Select(c => new CustomerDto(
                c.Id, c.CustomerNumber, c.Type, c.FirstName, c.LastName,
                c.CompanyName, c.VatNumber, c.Email, c.Phone, c.City, c.CreatedAt,
                _db.Users.IgnoreQueryFilters().Any(u => u.CustomerId == c.Id && u.DeletedAt == null)))
            .ToListAsync(cancellationToken);
    }
}
