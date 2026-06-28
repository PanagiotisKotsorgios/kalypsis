using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Premium;

// ============================================================================
// Premium feature codes a tenant has unlocked WITHIN its packages. Stored as a
// JSON array in TenantPackageGrant.PremiumFeaturesJson — we read it once on
// load and merge across all the tenant's package grants.
// ============================================================================

public record GetMyPremiumFeaturesQuery() : IRequest<MyPremiumFeaturesDto>;
public record MyPremiumFeaturesDto(IReadOnlyList<string> Codes);

public class GetMyPremiumFeaturesHandler : IRequestHandler<GetMyPremiumFeaturesQuery, MyPremiumFeaturesDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetMyPremiumFeaturesHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<MyPremiumFeaturesDto> Handle(GetMyPremiumFeaturesQuery _, CancellationToken ct)
    {
        var tenantId = _current.TenantId;
        if (tenantId is null) return new MyPremiumFeaturesDto(Array.Empty<string>());

        var rows = await _db.TenantPackageGrants
            .Where(g => g.TenantId == tenantId && g.DeletedAt == null && g.PremiumFeaturesJson != null)
            .Select(g => g.PremiumFeaturesJson!)
            .ToListAsync(ct);

        var codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var json in rows)
        {
            var parsed = TryParseCodes(json);
            foreach (var c in parsed) codes.Add(c);
        }
        return new MyPremiumFeaturesDto(codes.OrderBy(c => c, StringComparer.Ordinal).ToList());
    }

    internal static IReadOnlyList<string> TryParseCodes(string? json) => PremiumFeatureJson.TryParseCodes(json);
}

public static class PremiumFeatureJson
{
    public static IReadOnlyList<string> TryParseCodes(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try
        {
            var arr = JsonSerializer.Deserialize<string[]>(json);
            if (arr is null) return Array.Empty<string>();
            return arr.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToList();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }
}

// ===== Superadmin: set premium codes for a tenant ============================

public record SetTenantPremiumFeaturesCommand(Guid TenantId, IReadOnlyList<string> Codes) : IRequest<MyPremiumFeaturesDto>;

public class SetTenantPremiumFeaturesHandler : IRequestHandler<SetTenantPremiumFeaturesCommand, MyPremiumFeaturesDto>
{
    private readonly IAppDbContext _db;

    public SetTenantPremiumFeaturesHandler(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<MyPremiumFeaturesDto> Handle(SetTenantPremiumFeaturesCommand cmd, CancellationToken ct)
    {
        var valid = new HashSet<string>(PremiumFeatureCodes.All, StringComparer.OrdinalIgnoreCase);
        var keep = cmd.Codes
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim())
            .Where(valid.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var grants = await _db.TenantPackageGrants
            .Where(g => g.TenantId == cmd.TenantId && g.DeletedAt == null)
            .ToListAsync(ct);

        if (grants.Count == 0)
            throw new AppException("premium_no_grant",
                "Ο tenant δεν έχει ενεργό package — προσθέστε ένα package πρώτα.", 400);

        // Park all premium codes on the FIRST grant so we have a single source of
        // truth; clear the rest. Premium codes aren't strictly tied to a single
        // package, and the GetMy query merges across grants anyway.
        var json = JsonSerializer.Serialize(keep);
        var now = DateTime.UtcNow;
        for (int i = 0; i < grants.Count; i++)
        {
            grants[i].PremiumFeaturesJson = i == 0 ? json : null;
            grants[i].UpdatedAt = now;
        }
        await _db.SaveChangesAsync(ct);

        return new MyPremiumFeaturesDto(keep);
    }
}
