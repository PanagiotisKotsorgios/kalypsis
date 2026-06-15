using Kalypsis.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Tenants;

public record ListTenantsQuery() : IRequest<IReadOnlyList<TenantDto>>;

public class ListTenantsQueryHandler : IRequestHandler<ListTenantsQuery, IReadOnlyList<TenantDto>>
{
    private readonly IAppDbContext _db;
    public ListTenantsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<TenantDto>> Handle(ListTenantsQuery request, CancellationToken cancellationToken)
    {
        var tenants = await _db.Tenants
            .IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null)
            .OrderBy(t => t.Name)
            .Select(t => new TenantDto(
                t.Id,
                t.Name,
                t.Code,
                t.IsActive,
                t.SubscriptionPlan,
                t.CreatedAt,
                _db.Users.IgnoreQueryFilters().Count(u => u.TenantId == t.Id && u.DeletedAt == null),
                _db.Customers.IgnoreQueryFilters().Count(c => c.TenantId == t.Id && c.DeletedAt == null)))
            .ToListAsync(cancellationToken);

        return tenants;
    }
}
