using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Per-tenant bridge → parametric link table. Solves the "user in the office
/// doesn't understand the carrier's internal coding" problem: agencies register
/// their own parametric codes (INTERLIFE / ΑΥΤΟΚΙΝΗΤΟ / ΑΣΤ ΕΥΘΥΝΗ / ...) and
/// then map each raw carrier code arriving via a bridge (e.g. "1003") to the
/// corresponding agency parametric. Subsequent imports of the same code auto-
/// route without prompting.
/// </summary>
[ApiController]
[Route("api/bridge-code-mappings")]
[Authorize(Policy = "AgencyStaff")]
public class BridgeCodeMappingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public BridgeCodeMappingsController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record BridgeCodeMappingDto(
        Guid Id,
        BridgeMappingKind Kind,
        string? SourceCarrier,
        string RawCode,
        string? RawLabel,
        Guid? TargetInsuranceCompanyId,
        string? TargetInsuranceCompanyName,
        Guid? TargetParameterItemId,
        string? TargetParameterItemCode,
        string? TargetParameterItemName,
        Guid? TargetProducerId,
        string? TargetProducerCode,
        string? TargetProducerName,
        string? Notes,
        Guid? ConfirmedByUserId,
        DateTime? ConfirmedAt,
        DateTime CreatedAt);

    public record UpsertBody(
        BridgeMappingKind Kind,
        string? SourceCarrier,
        string RawCode,
        string? RawLabel,
        Guid? TargetInsuranceCompanyId,
        Guid? TargetParameterItemId,
        Guid? TargetProducerId,
        string? Notes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BridgeCodeMappingDto>>> List(
        [FromQuery] BridgeMappingKind? kind,
        [FromQuery] string? sourceCarrier,
        [FromQuery] string? search,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var q = _db.BridgeCodeMappings.IgnoreQueryFilters()
            .Include(x => x.TargetInsuranceCompany)
            .Include(x => x.TargetParameterItem)
            .Include(x => x.TargetProducer)
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null);

        if (kind.HasValue) q = q.Where(x => x.Kind == kind.Value);
        if (!string.IsNullOrWhiteSpace(sourceCarrier))
        {
            var s = sourceCarrier.Trim();
            q = q.Where(x => x.SourceCarrier == s);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pat = $"%{search.Trim()}%";
            q = q.Where(x =>
                EF.Functions.Like(x.RawCode, pat) ||
                (x.RawLabel != null && EF.Functions.Like(x.RawLabel, pat)) ||
                (x.SourceCarrier != null && EF.Functions.Like(x.SourceCarrier, pat)));
        }

        var rows = await q.OrderBy(x => x.SourceCarrier).ThenBy(x => x.Kind).ThenBy(x => x.RawCode)
            .Take(5000)
            .ToListAsync(ct);
        return Ok(rows.Select(Map).ToList());
    }

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BridgeCodeMappingDto>> Create([FromBody] UpsertBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        Validate(body);
        await EnsureTargetsAsync(tenantId, body, ct);

        var carrier = string.IsNullOrWhiteSpace(body.SourceCarrier) ? null : body.SourceCarrier.Trim();
        var raw = body.RawCode.Trim();

        // Look up ANY row (live OR soft-deleted) with the same (tenant, kind,
        // carrier, raw code) tuple. Live one blocks with a friendly 400 —
        // soft-deleted one gets resurrected and overwritten in place. MySQL's
        // unique index on (TenantId, Kind, SourceCarrier, RawCode) doesn't
        // respect DeletedAt so a plain INSERT with a soft-deleted twin would
        // throw a raw duplicate-key exception and the operator would just see
        // "Παρουσιάστηκε εσωτερικό σφάλμα".
        var existing = await _db.BridgeCodeMappings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId
                && x.Kind == body.Kind
                && x.SourceCarrier == carrier
                && x.RawCode == raw, ct);
        if (existing is not null && existing.DeletedAt is null)
            throw new AppException("bridge_mapping_duplicate",
                "Υπάρχει ήδη αντιστοίχιση για αυτόν τον κωδικό γέφυρας.", 400,
                title: "Διπλή αντιστοίχιση",
                why: "Ο ίδιος τύπος + πάροχος + raw κωδικός θα δημιουργούσε αμφισημία κατά την εισαγωγή.",
                fix: "Επεξεργαστείτε την υπάρχουσα εγγραφή ή δηλώστε διαφορετικό raw κωδικό.");

        BridgeCodeMapping item;
        if (existing is not null)
        {
            existing.DeletedAt = null;
            existing.RawLabel = Clean(body.RawLabel);
            existing.TargetInsuranceCompanyId = body.TargetInsuranceCompanyId;
            existing.TargetParameterItemId = body.TargetParameterItemId;
            existing.TargetProducerId = body.TargetProducerId;
            existing.Notes = Clean(body.Notes);
            existing.ConfirmedByUserId = _current.UserId;
            existing.ConfirmedAt = _clock.UtcNow;
            existing.UpdatedAt = _clock.UtcNow;
            item = existing;
        }
        else
        {
            item = new BridgeCodeMapping
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Kind = body.Kind,
                SourceCarrier = carrier,
                RawCode = raw,
                RawLabel = Clean(body.RawLabel),
                TargetInsuranceCompanyId = body.TargetInsuranceCompanyId,
                TargetParameterItemId = body.TargetParameterItemId,
                TargetProducerId = body.TargetProducerId,
                Notes = Clean(body.Notes),
                ConfirmedByUserId = _current.UserId,
                ConfirmedAt = _clock.UtcNow,
                CreatedAt = _clock.UtcNow,
            };
            _db.BridgeCodeMappings.Add(item);
        }
        await _db.SaveChangesAsync(ct);

        var saved = await _db.BridgeCodeMappings.IgnoreQueryFilters()
            .Include(x => x.TargetInsuranceCompany)
            .Include(x => x.TargetParameterItem)
            .Include(x => x.TargetProducer)
            .FirstAsync(x => x.Id ==item.Id, ct);
        return Ok(Map(saved));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BridgeCodeMappingDto>> Update(Guid id, [FromBody] UpsertBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        Validate(body);
        await EnsureTargetsAsync(tenantId, body, ct);

        var item = await _db.BridgeCodeMappings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αντιστοίχιση γέφυρας");

        item.Kind = body.Kind;
        item.SourceCarrier = string.IsNullOrWhiteSpace(body.SourceCarrier) ? null : body.SourceCarrier.Trim();
        item.RawCode = body.RawCode.Trim();
        item.RawLabel = Clean(body.RawLabel);
        item.TargetInsuranceCompanyId = body.TargetInsuranceCompanyId;
        item.TargetParameterItemId = body.TargetParameterItemId;
        item.TargetProducerId = body.TargetProducerId;
        item.Notes = Clean(body.Notes);
        item.ConfirmedByUserId = _current.UserId;
        item.ConfirmedAt = _clock.UtcNow;
        item.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);

        var saved = await _db.BridgeCodeMappings.IgnoreQueryFilters()
            .Include(x => x.TargetInsuranceCompany)
            .Include(x => x.TargetParameterItem)
            .Include(x => x.TargetProducer)
            .FirstAsync(x => x.Id ==id, ct);
        return Ok(Map(saved));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var item = await _db.BridgeCodeMappings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αντιστοίχιση γέφυρας");
        item.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static void Validate(UpsertBody body)
    {
        if (string.IsNullOrWhiteSpace(body.RawCode))
            throw new AppException("bridge_mapping_required",
                "Το πεδίο RawCode είναι υποχρεωτικό.", 400);

        if (body.Kind == BridgeMappingKind.Company)
        {
            if (!body.TargetInsuranceCompanyId.HasValue)
                throw new AppException("target_company_required",
                    "Επιλέξτε την ασφαλιστική στην οποία θα αντιστοιχηθεί ο κωδικός.", 400);
        }
        else if (body.Kind == BridgeMappingKind.Producer)
        {
            if (!body.TargetProducerId.HasValue)
                throw new AppException("target_producer_required",
                    "Επιλέξτε τον συνεργάτη στον οποίο θα αντιστοιχηθεί ο κωδικός.", 400);
        }
        else
        {
            if (!body.TargetParameterItemId.HasValue)
                throw new AppException("target_parameter_required",
                    "Επιλέξτε το παραμετρικό (κλάδος / κάλυψη / χρήση / πακέτο) στο οποίο θα αντιστοιχηθεί ο κωδικός.", 400);
        }
    }

    private async Task EnsureTargetsAsync(Guid tenantId, UpsertBody body, CancellationToken ct)
    {
        if (body.TargetInsuranceCompanyId.HasValue)
        {
            var exists = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .AnyAsync(x => x.Id == body.TargetInsuranceCompanyId.Value
                    && x.DeletedAt == null
                    && (x.TenantId == null || x.TenantId == tenantId), ct);
            if (!exists) throw AppException.NotFound("Ασφαλιστική εταιρεία");
        }
        if (body.TargetParameterItemId.HasValue)
        {
            var exists = await _db.CompanyParameterItems.IgnoreQueryFilters()
                .AnyAsync(x => x.Id == body.TargetParameterItemId.Value
                    && x.DeletedAt == null, ct);
            if (!exists) throw AppException.NotFound("Παραμετρικό");
        }
        if (body.TargetProducerId.HasValue)
        {
            var exists = await _db.Producers.IgnoreQueryFilters()
                .AnyAsync(x => x.Id == body.TargetProducerId.Value
                    && x.DeletedAt == null
                    && x.TenantId == tenantId, ct);
            if (!exists) throw AppException.NotFound("Συνεργάτης");
        }
    }

    private static BridgeCodeMappingDto Map(BridgeCodeMapping x) => new(
        x.Id, x.Kind, x.SourceCarrier, x.RawCode, x.RawLabel,
        x.TargetInsuranceCompanyId,
        x.TargetInsuranceCompany?.Name,
        x.TargetParameterItemId,
        x.TargetParameterItem?.Code,
        x.TargetParameterItem?.Name,
        x.TargetProducerId,
        x.TargetProducer?.Code,
        x.TargetProducer?.Name,
        x.Notes, x.ConfirmedByUserId, x.ConfirmedAt, x.CreatedAt);

    private static string? Clean(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }
}
