using Kalypsis.Application.Common;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 7 — Chronological activity timeline for a single tenant. Aggregates
/// AuditLog rows + key tenant-lifecycle events (users created, package grants,
/// office additions, contract events) into one ordered feed for the
/// superadmin Tenant detail page.
/// </summary>
[ApiController]
[Route("api/platform/tenants/{tenantId:guid}/activity")]
[Authorize(Policy = "PlatformLevel")]
public class TenantActivityController : ControllerBase
{
    private readonly AppDbContext _db;
    public TenantActivityController(AppDbContext db) => _db = db;

    public record TimelineEntry(
        DateTime At,
        string Kind,                    // audit / user_created / user_login / package_change / office_added / office_removed / contract_signed / contract_terminated
        string Title,
        string? Detail,
        Guid? ActorUserId,
        string? ActorEmail);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TimelineEntry>>> Get(
        Guid tenantId,
        [FromQuery] int take = 200,
        [FromQuery] DateTime? since = null,
        CancellationToken ct = default)
    {
        var tenantExists = await _db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Id == tenantId, ct);
        if (!tenantExists) throw AppException.NotFound("Tenant");

        take = Math.Clamp(take, 1, 1000);
        var sinceUtc = since ?? DateTime.UtcNow.AddMonths(-3);

        // ---- 1. Audit log entries ----
        var audits = await _db.AuditLogs.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId && a.CreatedAt >= sinceUtc)
            .OrderByDescending(a => a.CreatedAt)
            .Take(take)
            .ToListAsync(ct);

        // Resolve actor emails in bulk
        var actorIds = audits.Where(a => a.UserId.HasValue).Select(a => a.UserId!.Value).Distinct().ToList();
        var actorMap = await _db.Users.IgnoreQueryFilters()
            .Where(u => actorIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

        var entries = new List<TimelineEntry>();
        foreach (var a in audits)
        {
            entries.Add(new TimelineEntry(
                a.CreatedAt,
                "audit",
                $"{a.Action} — {a.EntityName}",
                a.NewValues ?? a.OldValues,
                a.UserId,
                a.UserId.HasValue && actorMap.TryGetValue(a.UserId.Value, out var em) ? em : null));
        }

        // ---- 2. Users created ----
        var newUsers = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.CreatedAt >= sinceUtc)
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName, u.Role, u.CreatedAt })
            .ToListAsync(ct);
        foreach (var u in newUsers)
            entries.Add(new TimelineEntry(u.CreatedAt, "user_created",
                $"Νέος χρήστης — {u.FirstName} {u.LastName}",
                $"{u.Email} · {u.Role}", null, null));

        // ---- 3. Package grants/revocations ----
        var grants = await _db.TenantPackageGrants.IgnoreQueryFilters()
            .Where(g => g.TenantId == tenantId)
            .ToListAsync(ct);
        foreach (var g in grants.Where(g => g.EnabledAt >= sinceUtc))
            entries.Add(new TimelineEntry(g.EnabledAt, "package_change",
                $"Ενεργοποίηση πακέτου — {g.Package}", g.Notes, g.EnabledByUserId, null));
        foreach (var g in grants.Where(g => g.DeletedAt != null && g.DeletedAt >= sinceUtc))
            entries.Add(new TimelineEntry(g.DeletedAt!.Value, "package_change",
                $"Απενεργοποίηση πακέτου — {g.Package}", null, null, null));

        // ---- 4. Office additions/deactivations ----
        var offices = await _db.AgencyOffices.IgnoreQueryFilters()
            .Where(o => o.TenantId == tenantId)
            .ToListAsync(ct);
        foreach (var o in offices.Where(o => o.CreatedAt >= sinceUtc))
            entries.Add(new TimelineEntry(o.CreatedAt, "office_added",
                $"Νέο υποκατάστημα — {o.Name}",
                (o.City ?? "—") + (o.IsHeadquarters ? " · ΚΕΝΤΡΙΚΟ" : ""),
                null, null));
        foreach (var o in offices.Where(o => o.DeletedAt != null && o.DeletedAt >= sinceUtc))
            entries.Add(new TimelineEntry(o.DeletedAt!.Value, "office_removed",
                $"Διαγραφή υποκαταστήματος — {o.Name}", o.City, null, null));

        // ---- 5. Contract lifecycle ----
        var contracts = await _db.TenantContracts.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId)
            .ToListAsync(ct);
        foreach (var c in contracts.Where(c => c.CreatedAt >= sinceUtc))
            entries.Add(new TimelineEntry(c.CreatedAt, "contract_signed",
                $"Νέο συμβόλαιο — {c.ContractNumber}",
                $"{c.Plan} · {c.MonthlyBaseAmount:N2} {c.Currency} / μήνα · Ισχύς από {c.EffectiveFrom:yyyy-MM-dd}",
                null, c.SignedByEmail));
        foreach (var c in contracts.Where(c => c.TerminatedAt != null && c.TerminatedAt >= sinceUtc))
            entries.Add(new TimelineEntry(c.TerminatedAt!.Value, "contract_terminated",
                $"Λήξη συμβολαίου — {c.ContractNumber}", c.TerminationReason, null, null));

        return Ok(entries.OrderByDescending(e => e.At).Take(take).ToList());
    }
}
