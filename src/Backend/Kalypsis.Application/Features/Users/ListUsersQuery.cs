using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Users;

public record ListUsersQuery() : IRequest<IReadOnlyList<UserDto>>;

public class ListUsersQueryHandler : IRequestHandler<ListUsersQuery, IReadOnlyList<UserDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ListUsersQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<UserDto>> Handle(ListUsersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId
            ?? throw AppException.Forbidden();

        return await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                && (u.Role == Role.AgencyAdmin || u.Role == Role.AgencyUser))
            .OrderBy(u => u.LastName)
            .Select(u => new UserDto(
                u.Id, u.Email, u.FirstName, u.LastName, u.Phone,
                u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt))
            .ToListAsync(cancellationToken);
    }
}
