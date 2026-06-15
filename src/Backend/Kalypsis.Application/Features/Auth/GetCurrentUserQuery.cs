using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

public record GetCurrentUserQuery() : IRequest<AuthenticatedUserDto>;

public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, AuthenticatedUserDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetCurrentUserQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<AuthenticatedUserDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.UserId is null)
        {
            throw AppException.Unauthorized();
        }

        var userId = _currentUser.UserId.Value;
        var user = await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id == userId && u.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw AppException.NotFound("Ο χρήστης");

        var tenantName = user.TenantId == Guid.Empty
            ? null
            : await _db.Tenants
                .IgnoreQueryFilters()
                .Where(t => t.Id == user.TenantId)
                .Select(t => t.Name)
                .FirstOrDefaultAsync(cancellationToken);

        return new AuthenticatedUserDto(
            user.Id,
            user.TenantId == Guid.Empty ? null : user.TenantId,
            tenantName,
            user.Email,
            user.FirstName,
            user.LastName,
            user.Role,
            user.PreferredLanguage);
    }
}
