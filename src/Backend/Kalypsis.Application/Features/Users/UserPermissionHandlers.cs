using System.Text.Json;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Users;

/// <summary>
/// Catalogue of permission codes the agency admin can grant or revoke per
/// employee. Keep this list aligned with the frontend feature gates.
/// </summary>
public static class PermissionCatalog
{
    public static readonly string[] All =
    {
        "customers.read", "customers.write", "customers.delete",
        "policies.read", "policies.write", "policies.delete",
        "documents.read", "documents.write",
        "claims.read", "claims.write",
        "appointments.read", "appointments.write",
        "tariffs.read", "tariffs.write",
        "covernotes.read", "covernotes.write",
        "receipts.read", "receipts.write",
        "payments.read", "payments.write",
        "securities.read", "securities.write",
        "financials.read",
        "commissions.read", "commissions.run",
        "overcommissions.read", "overcommissions.write",
        "marketing.read", "marketing.write", "marketing.send",
        "delivery.read", "delivery.write",
        "production.read",
        "goals.read", "goals.write",
        "bridges.read", "bridges.sync",
        "exports.run",
        // ΠΑΡΑΜΕΤΡΟΠΟΙΗΣΗ — read is broad (one switch enables all view pages);
        // writes are per-area so the admin can grant them selectively. No
        // .delete entries here on purpose: deleting an insurance company or
        // a commission rule is catastrophic — that stays AgencyAdmin-only.
        "params.read",
        "lookups.write",
        "insuranceCompanies.write",
        "commissionRules.write",
        "bulkCommissions.run",
        "defaultValueRules.write",
        "parametricFiles.write",
        "documentDesigner.write",
        "configHub.write"
    };

    public static readonly IReadOnlyDictionary<Role, string[]> RoleDefaults = new Dictionary<Role, string[]>
    {
        [Role.AgencyAdmin] = All,
        [Role.AgencyUser] = new[]
        {
            "customers.read","customers.write",
            "policies.read","policies.write",
            "documents.read","documents.write",
            "appointments.read","appointments.write",
            "covernotes.read","covernotes.write",
            "receipts.read","receipts.write",
            "tariffs.read",
            "delivery.read","delivery.write",
            "marketing.read",
            "exports.run",
            // Employees see παραμετροποίηση pages by default but can't change
            // anything until the admin explicitly grants a *.write flag.
            "params.read"
        },
        [Role.Producer] = new[] { "customers.read","policies.read","commissions.read","production.read" },
        [Role.Customer] = new[] { "documents.read" }
    };

    public static string[] ResolveEffective(Role role, string? json)
    {
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                var arr = JsonSerializer.Deserialize<string[]>(json);
                if (arr is { Length: > 0 }) return arr;
            }
            catch { /* fall through to defaults */ }
        }
        return RoleDefaults.TryGetValue(role, out var def) ? def : Array.Empty<string>();
    }
}

public record UserPermissionsDto(Guid UserId, string Email, string Name, Role Role, string[] Effective, string[]? Custom);

public record GetUserPermissionsQuery(Guid UserId) : IRequest<UserPermissionsDto>;
public class GetUserPermissionsQueryHandler : IRequestHandler<GetUserPermissionsQuery, UserPermissionsDto>
{
    private readonly IAppDbContext _db;
    public GetUserPermissionsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<UserPermissionsDto> Handle(GetUserPermissionsQuery r, CancellationToken ct)
    {
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == r.UserId, ct) ?? throw AppException.NotFound("User");
        string[]? custom = null;
        if (!string.IsNullOrWhiteSpace(u.PermissionsJson))
        {
            try { custom = JsonSerializer.Deserialize<string[]>(u.PermissionsJson); } catch { }
        }
        var effective = PermissionCatalog.ResolveEffective(u.Role, u.PermissionsJson);
        return new UserPermissionsDto(u.Id, u.Email, $"{u.FirstName} {u.LastName}".Trim(), u.Role, effective, custom);
    }
}

public record SetUserPermissionsCommand(Guid UserId, string[]? Permissions) : IRequest<UserPermissionsDto>;
public class SetUserPermissionsCommandValidator : AbstractValidator<SetUserPermissionsCommand>
{
    public SetUserPermissionsCommandValidator()
    {
        RuleFor(x => x.Permissions).Must(p => p == null || p.All(c => PermissionCatalog.All.Contains(c)))
            .WithMessage("Άγνωστο permission code.");
    }
}

public class SetUserPermissionsCommandHandler : IRequestHandler<SetUserPermissionsCommand, UserPermissionsDto>
{
    private readonly IAppDbContext _db;
    public SetUserPermissionsCommandHandler(IAppDbContext db) => _db = db;
    public async Task<UserPermissionsDto> Handle(SetUserPermissionsCommand r, CancellationToken ct)
    {
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == r.UserId, ct) ?? throw AppException.NotFound("User");
        if (r.Permissions == null || r.Permissions.Length == 0)
            u.PermissionsJson = null; // null = role defaults
        else
            u.PermissionsJson = JsonSerializer.Serialize(r.Permissions.Distinct().ToArray());
        await _db.SaveChangesAsync(ct);

        string[]? custom = null;
        if (!string.IsNullOrWhiteSpace(u.PermissionsJson))
        {
            try { custom = JsonSerializer.Deserialize<string[]>(u.PermissionsJson); } catch { }
        }
        var effective = PermissionCatalog.ResolveEffective(u.Role, u.PermissionsJson);
        return new UserPermissionsDto(u.Id, u.Email, $"{u.FirstName} {u.LastName}".Trim(), u.Role, effective, custom);
    }
}

public record GetPermissionCatalogQuery() : IRequest<string[]>;
public class GetPermissionCatalogQueryHandler : IRequestHandler<GetPermissionCatalogQuery, string[]>
{
    public Task<string[]> Handle(GetPermissionCatalogQuery _, CancellationToken ct) => Task.FromResult(PermissionCatalog.All);
}
