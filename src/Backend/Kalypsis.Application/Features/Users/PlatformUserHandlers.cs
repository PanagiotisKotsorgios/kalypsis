using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Auth;
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
    private readonly ICurrentUser _current;
    public UpdatePlatformUserCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PlatformUserDto> Handle(UpdatePlatformUserCommand request, CancellationToken ct)
    {
        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        var isSelf = u.Id == _current.UserId;
        // PlatformAdmin can't downgrade themselves or deactivate self — same
        // self-lockout guard as the agency flow. They'd lock the system out of
        // its own platform admin.
        if (isSelf && request.Body.Role != u.Role)
            throw new AppException("self_role_change_forbidden",
                "Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο.", 400);
        if (isSelf && !request.Body.IsActive)
            throw new AppException("self_deactivate_forbidden",
                "Δεν μπορείτε να απενεργοποιήσετε τον λογαριασμό σας.", 400);

        // If we're moving the LAST PlatformAdmin out of that role, refuse.
        if (u.Role == Role.PlatformAdmin && request.Body.Role != Role.PlatformAdmin)
        {
            var otherAdmins = await _db.Users.IgnoreQueryFilters()
                .CountAsync(x => x.DeletedAt == null && x.IsActive
                              && x.Role == Role.PlatformAdmin && x.Id != u.Id, ct);
            if (otherAdmins == 0)
                throw new AppException("last_platform_admin_forbidden",
                    "Δεν μπορείτε να αφαιρέσετε τον μοναδικό PlatformAdmin.", 400);
        }

        var roleOrStatusChanged = u.Role != request.Body.Role || u.IsActive != request.Body.IsActive;

        u.FirstName = request.Body.FirstName.Trim();
        u.LastName = request.Body.LastName.Trim();
        u.Phone = request.Body.Phone?.Trim();
        u.Role = request.Body.Role;
        u.IsActive = request.Body.IsActive;

        // Role / activation change → invalidate the user's sessions so the
        // change takes effect immediately (without waiting for access token expiry).
        if (roleOrStatusChanged && !isSelf)
        {
            await RefreshTokenRevoker.RevokeAllForUserAsync(
                _db, u.Id, DateTime.UtcNow, "platform_user_role_or_status_changed", ct);
        }

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

        var now = DateTime.UtcNow;
        u.DeletedAt = now;
        u.IsActive = false;
        await RefreshTokenRevoker.RevokeAllForUserAsync(_db, u.Id, now, "platform_user_deleted", ct);
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Bulk actions on users (PlatformAdmin) ========= */

public enum BulkUserAction { Activate, Deactivate, Delete }

public record BulkUserActionCommand(IReadOnlyList<Guid> UserIds, BulkUserAction Action) : IRequest<int>;

public class BulkUserActionCommandHandler : IRequestHandler<BulkUserActionCommand, int>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public BulkUserActionCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<int> Handle(BulkUserActionCommand request, CancellationToken ct)
    {
        if (request.UserIds.Count == 0) return 0;
        if (request.UserIds.Count > 500) throw new AppException("bulk_too_many",
            "Πολλοί χρήστες ανά μαζική ενέργεια (μέγιστο 500).", 400,
            title: "Πολύ μεγάλη επιλογή",
            why: $"Επιλέξατε {request.UserIds.Count} χρήστες. Το όριο των 500 ανά παρτίδα προστατεύει τη βάση από timeout και επιτρέπει undo σε περίπτωση λάθους.",
            fix: "Σπάστε τη μαζική ενέργεια σε μικρότερα κομμάτια — π.χ. φιλτράρετε ανά γραφείο ή ρόλο και επεξεργαστείτε τους 500-500.");

        var users = await _db.Users.IgnoreQueryFilters()
            .Where(u => request.UserIds.Contains(u.Id) && u.DeletedAt == null)
            .ToListAsync(ct);

        var affected = 0;
        var now = DateTime.UtcNow;
        foreach (var u in users)
        {
            if (u.Id == _current.UserId) continue;
            switch (request.Action)
            {
                case BulkUserAction.Activate:
                    u.IsActive = true; affected++; break;
                case BulkUserAction.Deactivate:
                    u.IsActive = false; affected++;
                    await RefreshTokenRevoker.RevokeAllForUserAsync(_db, u.Id, now, "bulk_deactivate", ct);
                    break;
                case BulkUserAction.Delete:
                    u.DeletedAt = now; u.IsActive = false; affected++;
                    await RefreshTokenRevoker.RevokeAllForUserAsync(_db, u.Id, now, "bulk_delete", ct);
                    break;
            }
        }
        await _db.SaveChangesAsync(ct);
        return affected;
    }
}

/* ========= Tenant overview (PlatformAdmin) ========= */

public record TenantOverviewDto(
    Guid TenantId,
    string Name,
    string Code,
    bool IsActive,
    string SubscriptionPlan,
    DateTime CreatedAt,
    int UserCount,
    int CustomerCount,
    int PolicyCount,
    int ActivePolicyCount,
    int DocumentCount,
    int ClaimCount,
    int ProducerCount,
    decimal TotalPremium,
    DateTime? LastUserLoginAt,
    IReadOnlyList<PlatformUserDto> RecentUsers);

public record GetTenantOverviewQuery(Guid TenantId) : IRequest<TenantOverviewDto>;

public class GetTenantOverviewQueryHandler : IRequestHandler<GetTenantOverviewQuery, TenantOverviewDto>
{
    private readonly IAppDbContext _db;
    public GetTenantOverviewQueryHandler(IAppDbContext db) => _db = db;

    public async Task<TenantOverviewDto> Handle(GetTenantOverviewQuery request, CancellationToken ct)
    {
        var t = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.TenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        var users = _db.Users.IgnoreQueryFilters().Where(u => u.TenantId == t.Id && u.DeletedAt == null);
        var policies = _db.Policies.IgnoreQueryFilters().Where(p => p.TenantId == t.Id && p.DeletedAt == null);

        var userCount = await users.CountAsync(ct);
        var customerCount = await _db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == t.Id && c.DeletedAt == null, ct);
        var policyCount = await policies.CountAsync(ct);
        var activePolicyCount = await policies.CountAsync(p => p.Status == Domain.Enums.PolicyStatus.Active, ct);
        var documentCount = await _db.PolicyDocuments.IgnoreQueryFilters().CountAsync(d => d.TenantId == t.Id && d.DeletedAt == null, ct);
        var claimCount = await _db.Claims.IgnoreQueryFilters().CountAsync(c => c.TenantId == t.Id && c.DeletedAt == null, ct);
        var producerCount = await _db.Producers.IgnoreQueryFilters().CountAsync(p => p.TenantId == t.Id && p.DeletedAt == null, ct);
        var totalPremium = await policies.SumAsync(p => (decimal?)p.Premium, ct) ?? 0;
        var lastLogin = await users.MaxAsync(u => (DateTime?)u.LastLoginAt, ct);

        var recent = await users.OrderByDescending(u => u.CreatedAt).Take(10)
            .Select(u => new PlatformUserDto(
                u.Id, u.Email, u.FirstName, u.LastName, u.Phone, u.Role, u.IsActive,
                u.TenantId, t.Name, u.CreatedAt, u.LastLoginAt))
            .ToListAsync(ct);

        return new TenantOverviewDto(
            t.Id, t.Name, t.Code, t.IsActive, t.SubscriptionPlan.ToString(), t.CreatedAt,
            userCount, customerCount, policyCount, activePolicyCount, documentCount, claimCount, producerCount,
            totalPremium, lastLogin, recent);
    }
}
