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
///
/// Paginated + filterable — earlier the endpoint always dumped 200 rows which
/// made the page unusable for busy tenants and left the SuperAdmin with no way
/// to zoom in on a specific user or event kind. Now returns an envelope
/// { items, totalCount, page, pageSize } with server-side kind/actor/date
/// filtering.
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

    public record TimelinePage(
        IReadOnlyList<TimelineEntry> Items,
        int TotalCount,
        int Page,
        int PageSize,
        IReadOnlyList<string> AvailableKinds);

    [HttpGet]
    public async Task<ActionResult<TimelinePage>> Get(
        Guid tenantId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        // Legacy — earlier callers passed `take`. When present it acts as
        // pageSize so old bookmarks keep working, but we still return the
        // paginated envelope so the frontend can rely on the same shape.
        [FromQuery] int? take = null,
        [FromQuery] string? kind = null,
        [FromQuery] string? actor = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        var tenantExists = await _db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Id == tenantId, ct);
        if (!tenantExists) throw AppException.NotFound("Tenant");

        if (take.HasValue) pageSize = take.Value;
        pageSize = Math.Clamp(pageSize, 1, 500);
        page = Math.Max(1, page);

        // Window: default "last 3 months" if `from` isn't provided, mirrors
        // the earlier behavior so the shape of the default view doesn't drift.
        var fromUtc = from ?? DateTime.UtcNow.AddMonths(-3);
        var toUtc = to ?? DateTime.UtcNow.AddDays(1);

        // Assemble the full aggregated list in memory (audit + lifecycle
        // events), then apply filters + pagination in a single pass. The
        // list is bounded — audit rows Take(1000) upstream, tenant lifecycle
        // events are inherently small — so this is fine for the SuperAdmin
        // page. If a tenant ever grows past 100k audit rows/month we push the
        // aggregation into SQL.
        var entries = new List<TimelineEntry>();

        // ---- 1. Audit log entries ----
        var audits = await _db.AuditLogs.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId && a.CreatedAt >= fromUtc && a.CreatedAt <= toUtc)
            .OrderByDescending(a => a.CreatedAt)
            .Take(1000)   // hard cap on raw audit rows we consider per query
            .ToListAsync(ct);

        var actorIds = audits.Where(a => a.UserId.HasValue).Select(a => a.UserId!.Value).Distinct().ToList();
        var actorMap = await _db.Users.IgnoreQueryFilters()
            .Where(u => actorIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

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
            .Where(u => u.TenantId == tenantId && u.CreatedAt >= fromUtc && u.CreatedAt <= toUtc)
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
        foreach (var g in grants.Where(g => g.EnabledAt >= fromUtc && g.EnabledAt <= toUtc))
            entries.Add(new TimelineEntry(g.EnabledAt, "package_change",
                $"Ενεργοποίηση πακέτου — {g.Package}", g.Notes, g.EnabledByUserId, null));
        foreach (var g in grants.Where(g => g.DeletedAt != null && g.DeletedAt >= fromUtc && g.DeletedAt <= toUtc))
            entries.Add(new TimelineEntry(g.DeletedAt!.Value, "package_change",
                $"Απενεργοποίηση πακέτου — {g.Package}", null, null, null));

        // ---- 4. Office additions/deactivations ----
        var offices = await _db.AgencyOffices.IgnoreQueryFilters()
            .Where(o => o.TenantId == tenantId)
            .ToListAsync(ct);
        foreach (var o in offices.Where(o => o.CreatedAt >= fromUtc && o.CreatedAt <= toUtc))
            entries.Add(new TimelineEntry(o.CreatedAt, "office_added",
                $"Νέο υποκατάστημα — {o.Name}",
                (o.City ?? "—") + (o.IsHeadquarters ? " · ΚΕΝΤΡΙΚΟ" : ""),
                null, null));
        foreach (var o in offices.Where(o => o.DeletedAt != null && o.DeletedAt >= fromUtc && o.DeletedAt <= toUtc))
            entries.Add(new TimelineEntry(o.DeletedAt!.Value, "office_removed",
                $"Διαγραφή υποκαταστήματος — {o.Name}", o.City, null, null));

        // ---- 5. Contract lifecycle ----
        var contracts = await _db.TenantContracts.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId)
            .ToListAsync(ct);
        foreach (var c in contracts.Where(c => c.CreatedAt >= fromUtc && c.CreatedAt <= toUtc))
            entries.Add(new TimelineEntry(c.CreatedAt, "contract_signed",
                $"Νέο συμβόλαιο — {c.ContractNumber}",
                $"{c.Plan} · {c.MonthlyBaseAmount:N2} {c.Currency} / μήνα · Ισχύς από {c.EffectiveFrom:yyyy-MM-dd}",
                null, c.SignedByEmail));
        foreach (var c in contracts.Where(c => c.TerminatedAt != null && c.TerminatedAt >= fromUtc && c.TerminatedAt <= toUtc))
            entries.Add(new TimelineEntry(c.TerminatedAt!.Value, "contract_terminated",
                $"Λήξη συμβολαίου — {c.ContractNumber}", c.TerminationReason, null, null));

        // Apply filters after aggregation — kind/actor/search are all applied
        // in-memory since the audit + lifecycle events come from different
        // tables and can't be joined cleanly in SQL.
        var query = entries.AsEnumerable().OrderByDescending(e => e.At);

        var filtered = query.AsEnumerable();
        if (!string.IsNullOrEmpty(kind))
            filtered = filtered.Where(e => e.Kind == kind);
        if (!string.IsNullOrEmpty(actor))
            filtered = filtered.Where(e => e.ActorEmail != null
                && e.ActorEmail.Contains(actor, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrEmpty(search))
        {
            var s = search;
            filtered = filtered.Where(e =>
                e.Title.Contains(s, StringComparison.OrdinalIgnoreCase)
                || (e.Detail ?? "").Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        var totalCount = filtered.Count();
        var items = filtered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        // Kinds that actually appeared in the (unfiltered) window — powers
        // the dropdown on the client without a separate call.
        var availableKinds = entries.Select(e => e.Kind).Distinct().OrderBy(k => k).ToList();

        return Ok(new TimelinePage(items, totalCount, page, pageSize, availableKinds));
    }
}
