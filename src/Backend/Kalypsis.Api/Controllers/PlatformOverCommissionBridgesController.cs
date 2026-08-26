using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// PlatformAdmin-only surface for toggling over-commission bridge
/// enablement per (tenant, carrier). Reads/writes rows in
/// tenant_over_commission_bridge_enables. UI at
/// /app/platform/oc-bridges renders one row per (tenant × carrier)
/// with a switch.
/// </summary>
[ApiController]
[Route("api/platform/over-commission-bridges")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformOverCommissionBridgesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public PlatformOverCommissionBridgesController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    /// <summary>The set of carrier codes we ship a parser for — kept in
    /// sync with the source-of-truth in the OC handler. Anything else
    /// in the platform is «format_not_supported_yet» and can't be
    /// enabled per-tenant even if the admin tries.</summary>
    private static readonly HashSet<string> SupportedTokens =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "ERGO", "GRAND COVER", "GRANDCOVER",
            "ATLANTIC", "ATLANTIKI", "ΑΤΛΑΝΤΙΚΗ",
            "INTERLIFE", "ΙΝΤΕΡΛΑΪΦ", "ΙΝΤΕΡΛΑΙΦ",
        };

    public record CarrierEnableRow(
        Guid CarrierId, string CarrierName, string CarrierCode,
        bool Enabled, DateTime? EnabledAt, string? Notes);

    public record TenantOcMatrixRow(
        Guid TenantId, string TenantName, string TenantCode,
        IReadOnlyList<CarrierEnableRow> Carriers);

    /// <summary>Returns the full (tenant × supported-carrier) matrix.
    /// Every tenant appears with the same set of parser-supported
    /// carriers; Enabled reflects whether a row exists in
    /// tenant_over_commission_bridge_enables. Ideal for a matrix-style
    /// admin UI where each row is a tenant.</summary>
    [HttpGet("matrix")]
    public async Task<ActionResult<IReadOnlyList<TenantOcMatrixRow>>> Matrix(CancellationToken ct)
    {
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null && t.Code != "PLATFORM")
            .OrderBy(t => t.Name)
            .Select(t => new { t.Id, t.Name, t.Code })
            .ToListAsync(ct);

        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null && c.TenantId == null && c.ParentCompanyId == null)
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Code })
            .ToListAsync(ct);
        // Only supported carriers appear in the matrix — no point offering
        // an enable switch for a carrier we can't parse anyway.
        var supportedCarriers = carriers
            .Where(c => SupportedTokens.Any(s =>
                (c.Code ?? "").ToUpperInvariant().Contains(s) ||
                (c.Name ?? "").ToUpperInvariant().Contains(s)))
            .ToList();

        var enables = await _db.TenantOverCommissionBridgeEnables.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .Select(x => new { x.TenantId, x.InsuranceCompanyId, x.EnabledAt, x.Notes })
            .ToListAsync(ct);
        // Keyed for O(1) lookup while building the matrix.
        var enableMap = enables.ToDictionary(
            e => (e.TenantId, e.InsuranceCompanyId),
            e => (e.EnabledAt, e.Notes));

        return Ok(tenants.Select(t => new TenantOcMatrixRow(
            t.Id, t.Name, t.Code,
            supportedCarriers.Select(c =>
            {
                enableMap.TryGetValue((t.Id, c.Id), out var info);
                var enabled = enableMap.ContainsKey((t.Id, c.Id));
                return new CarrierEnableRow(c.Id, c.Name, c.Code, enabled,
                    enabled ? info.EnabledAt : null,
                    enabled ? info.Notes : null);
            }).ToList()
        )).ToList());
    }

    public record EnableBody(string? Notes);

    /// <summary>Enable OC bridge for (tenant, carrier). Idempotent —
    /// a repeat POST just refreshes the notes + timestamp without
    /// creating duplicate rows.</summary>
    [HttpPost("tenants/{tenantId:guid}/carriers/{carrierId:guid}")]
    public async Task<ActionResult<CarrierEnableRow>> Enable(
        Guid tenantId, Guid carrierId, [FromBody] EnableBody? body, CancellationToken ct)
    {
        // Validate carrier is a global universal (never a tenant-owned one)
        // AND that it has a parser wired. Refusing here prevents rows
        // that would never resolve to an enabled UI toggle downstream.
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == carrierId && c.DeletedAt == null
                && c.TenantId == null && c.ParentCompanyId == null, ct)
            ?? throw AppException.NotFound("Carrier");
        var supported = SupportedTokens.Any(s =>
            (carrier.Code ?? "").ToUpperInvariant().Contains(s) ||
            (carrier.Name ?? "").ToUpperInvariant().Contains(s));
        if (!supported)
            throw AppException.Validation($"Ο πάροχος «{carrier.Name}» δεν έχει parser για OC — δεν μπορεί να ενεργοποιηθεί.");

        var tenantExists = await _db.Tenants.IgnoreQueryFilters()
            .AnyAsync(t => t.Id == tenantId && t.DeletedAt == null, ct);
        if (!tenantExists) throw AppException.NotFound("Tenant");

        var existing = await _db.TenantOverCommissionBridgeEnables.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.InsuranceCompanyId == carrierId, ct);
        if (existing is null)
        {
            _db.TenantOverCommissionBridgeEnables.Add(new TenantOverCommissionBridgeEnable
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InsuranceCompanyId = carrierId,
                EnabledAt = _clock.UtcNow,
                EnabledByUserId = _current.UserId,
                Notes = body?.Notes,
                CreatedAt = _clock.UtcNow,
            });
        }
        else
        {
            existing.DeletedAt = null;
            existing.EnabledAt = _clock.UtcNow;
            existing.EnabledByUserId = _current.UserId;
            existing.Notes = body?.Notes ?? existing.Notes;
            existing.UpdatedAt = _clock.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new CarrierEnableRow(carrierId, carrier.Name, carrier.Code, true, _clock.UtcNow, body?.Notes));
    }

    /// <summary>Disable OC bridge for (tenant, carrier). Soft-deletes so
    /// the row keeps its notes + history — a re-enable via POST re-uses
    /// the same row.</summary>
    [HttpDelete("tenants/{tenantId:guid}/carriers/{carrierId:guid}")]
    public async Task<IActionResult> Disable(Guid tenantId, Guid carrierId, CancellationToken ct)
    {
        var row = await _db.TenantOverCommissionBridgeEnables.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.InsuranceCompanyId == carrierId && x.DeletedAt == null, ct);
        if (row is null) return NoContent();
        row.DeletedAt = _clock.UtcNow;
        row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
