using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Users;

/* ========= Platform-wide user DTOs ========= */

public record PlatformUserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string? Phone,
    Role Role,
    bool IsActive,
    Guid? TenantId,
    string? TenantName,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record UpdatePlatformUserBody(
    string FirstName,
    string LastName,
    string? Phone,
    Role Role,
    bool IsActive);

/* ========= List all users (PlatformAdmin) ========= */

public record ListAllUsersQuery(string? Search, Guid? TenantId, Role? Role) : IRequest<IReadOnlyList<PlatformUserDto>>;

public class ListAllUsersQueryHandler : IRequestHandler<ListAllUsersQuery, IReadOnlyList<PlatformUserDto>>
{
    private readonly IAppDbContext _db;
    public ListAllUsersQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<PlatformUserDto>> Handle(ListAllUsersQuery request, CancellationToken ct)
    {
        var q = _db.Users.IgnoreQueryFilters().Where(u => u.DeletedAt == null);
        if (request.TenantId.HasValue) q = q.Where(u => u.TenantId == request.TenantId.Value);
        if (request.Role.HasValue) q = q.Where(u => u.Role == request.Role.Value);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = $"%{request.Search.Trim()}%";
            q = q.Where(u =>
                EF.Functions.Like(u.Email, s) ||
                EF.Functions.Like(u.FirstName, s) ||
                EF.Functions.Like(u.LastName, s));
        }

        var rows = await q
            .OrderByDescending(u => u.CreatedAt)
            .Take(500)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Phone,
                u.Role,
                u.IsActive,
                u.TenantId,
                TenantName = _db.Tenants.IgnoreQueryFilters().Where(t => t.Id == u.TenantId).Select(t => t.Name).FirstOrDefault(),
                u.CreatedAt,
                u.LastLoginAt
            })
            .ToListAsync(ct);

        return rows.Select(r => new PlatformUserDto(
            r.Id, r.Email, r.FirstName, r.LastName, r.Phone, r.Role, r.IsActive,
            r.TenantId == Guid.Empty ? null : r.TenantId, r.TenantName, r.CreatedAt, r.LastLoginAt
        )).ToList();
    }
}

/* ========= Update user (PlatformAdmin) ========= */

public record UpdatePlatformUserCommand(Guid Id, UpdatePlatformUserBody Body) : IRequest<PlatformUserDto>;

public class UpdatePlatformUserCommandValidator : AbstractValidator<UpdatePlatformUserCommand>
{
    public UpdatePlatformUserCommandValidator()
    {
        RuleFor(x => x.Body.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Body.LastName).NotEmpty().MaximumLength(100);
    }
}

public class UpdatePlatformUserCommandHandler : IRequestHandler<UpdatePlatformUserCommand, PlatformUserDto>
{
    private readonly IAppDbContext _db;
    public UpdatePlatformUserCommandHandler(IAppDbContext db) => _db = db;

    public async Task<PlatformUserDto> Handle(UpdatePlatformUserCommand request, CancellationToken ct)
    {
        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        u.FirstName = request.Body.FirstName.Trim();
        u.LastName = request.Body.LastName.Trim();
        u.Phone = request.Body.Phone?.Trim();
        u.Role = request.Body.Role;
        u.IsActive = request.Body.IsActive;
        await _db.SaveChangesAsync(ct);

        var tenantName = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Id == u.TenantId).Select(t => t.Name).FirstOrDefaultAsync(ct);
        return new PlatformUserDto(u.Id, u.Email, u.FirstName, u.LastName, u.Phone, u.Role, u.IsActive,
            u.TenantId == Guid.Empty ? null : u.TenantId, tenantName, u.CreatedAt, u.LastLoginAt);
    }
}

/* ========= Delete user (PlatformAdmin) ========= */

public record DeletePlatformUserCommand(Guid Id) : IRequest<Unit>;

public class DeletePlatformUserCommandHandler : IRequestHandler<DeletePlatformUserCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public DeletePlatformUserCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<Unit> Handle(DeletePlatformUserCommand request, CancellationToken ct)
    {
        if (request.Id == _current.UserId)
            throw AppException.Forbidden("Δεν μπορείτε να διαγράψετε τον εαυτό σας.");

        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        u.DeletedAt = DateTime.UtcNow;
        u.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
