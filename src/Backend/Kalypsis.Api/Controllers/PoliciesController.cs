using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/policies")]
[Authorize]
public class PoliciesController : ControllerBase
{
    private readonly IMediator _mediator;
    public PoliciesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PolicyDto>>> List(
        [FromQuery] string? search,
        [FromQuery] PolicyStatus? status,
        [FromQuery] PolicyType? type,
        [FromQuery] Guid? customerId,
        [FromQuery] Guid? insuranceCompanyId,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListPoliciesQuery(search, status, type, customerId, insuranceCompanyId), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PolicyDto>> Get(Guid id, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetPolicyQuery(id), cancellationToken));

    [HttpGet("{id:guid}/detail")]
    public async Task<ActionResult<PolicyDetailDto>> Detail(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetPolicyDetailQuery(id), ct));

    [HttpPut("{id:guid}/extended")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDetailDto>> UpdateExtended(
        Guid id, [FromBody] UpdatePolicyExtendedBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdatePolicyExtendedCommand(id, body), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Create(
        [FromBody] CreatePolicyBody body, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreatePolicyCommand(body), cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Update(
        Guid id, [FromBody] UpdatePolicyBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdatePolicyCommand(id, body), cancellationToken));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Cancel(
        Guid id, [FromBody] CancelPolicyBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new CancelPolicyCommand(id, body), cancellationToken));

    [HttpPost("{id:guid}/renew")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Renew(
        Guid id, [FromBody] RenewPolicyBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new RenewPolicyCommand(id, body), cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DeletePolicyResultDto>> Delete(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new DeletePolicyCommand(id), ct));

    /// <summary>
    /// Batch update: apply the same field changes to N selected policies in
    /// one transaction. Null fields on the body are ignored (policies keep
    /// their existing values). Used by the multi-select toolbar on the
    /// Policies list.
    /// </summary>
    [HttpPost("bulk-update")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BulkUpdatePoliciesResult>> BulkUpdate(
        [FromBody] BulkUpdatePoliciesBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new BulkUpdatePoliciesCommand(body), ct));

    [HttpGet("{id:guid}/payment-summary")]
    public async Task<ActionResult<PolicyPaymentSummaryDto>> PaymentSummary(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetPolicyPaymentSummaryQuery(id), ct));
}

[ApiController]
[Route("api/insurance-companies")]
[Authorize]
public class InsuranceCompaniesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly Kalypsis.Infrastructure.Persistence.AppDbContext _db;
    private readonly Kalypsis.Application.Abstractions.ICurrentUser _current;
    private readonly Kalypsis.Application.Abstractions.IDateTimeProvider _clock;

    public InsuranceCompaniesController(
        IMediator mediator,
        Kalypsis.Infrastructure.Persistence.AppDbContext db,
        Kalypsis.Application.Abstractions.ICurrentUser current,
        Kalypsis.Application.Abstractions.IDateTimeProvider clock)
    { _mediator = mediator; _db = db; _current = current; _clock = clock; }

    public record InsuranceCompanyExtendedDto(
        Guid Id, string Name, string Code, string? Country, string? Website, bool IsActive,
        Guid? TenantId, bool IsGlobal,
        Guid? TenantCopyId, bool IsImportedToTenant,
        Guid? BridgeId, bool BridgeLinked, int CommissionDefaultCount, int ParameterItemCount,
        string? AgentCode, string? ContactName, string? ContactEmail, string? ContactPhone,
        string? AfmVat, string? Notes,
        bool IsBroker = false,
        Guid? ParentCompanyId = null,
        // IsUsedByTenant = true when the tenant has explicitly ticked "Χρησιμοποιώ"
        // (universal catalog rows) OR the row is the tenant's own carrier
        // (which is implicitly opted-in). Filter surfaces gate on this flag.
        bool IsUsedByTenant = false);

    public record UpsertCompanyBody(
        string Name, string Code, string? Country, string? Website, bool IsActive,
        string? AgentCode, string? ContactName, string? ContactEmail, string? ContactPhone,
        string? AfmVat, string? Notes,
        bool CreateBridge = true, string? BridgeName = null, bool BridgeAutoSync = false,
        string? BridgeConfigJson = null, bool InstallZeroCommissionDefaults = true);

    public record ImportDefaultCompaniesResult(
        int Imported, int AlreadyImported, int BridgesCreated, int CommissionRulesCreated);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InsuranceCompanyExtendedDto>>> List(
        CancellationToken ct,
        [FromQuery] bool onlyUsed = false)
    {
        var tenantId = _current.TenantId;

        // Auto-heal: silently soft-delete any tenant-scoped carrier whose Code
        // duplicates a global carrier. Earlier deploys created these via the
        // (now-disabled) "Εισαγωγή στο γραφείο" button and they show as
        // duplicates everywhere. Runs only when a tenant copy exists, so the
        // hot path stays fast for tenants with clean data.
        if (tenantId.HasValue)
        {
            var globalCodes = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.TenantId == null && c.DeletedAt == null)
                .Select(c => c.Code)
                .ToListAsync(ct);
            var dupes = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.TenantId == tenantId.Value && c.DeletedAt == null && globalCodes.Contains(c.Code))
                .ToListAsync(ct);
            if (dupes.Count > 0)
            {
                foreach (var d in dupes)
                {
                    d.DeletedAt = _clock.UtcNow;
                    d.IsActive = false;
                }
                await _db.SaveChangesAsync(ct);
            }
        }

        var rows = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.DeletedAt == null && (c.TenantId == null || c.TenantId == tenantId))
                .OrderBy(c => c.TenantId == null ? 0 : 1)
                .ThenBy(c => c.Name), ct);

        var tenantRows = tenantId.HasValue
            ? rows.Where(c => c.TenantId == tenantId.Value).ToList()
            : new List<Kalypsis.Domain.Entities.InsuranceCompany>();
        var tenantByCode = tenantRows
            .GroupBy(c => c.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var tenantCompanyIds = tenantRows.Select(c => c.Id).ToList();
        var bridges = tenantId.HasValue && tenantCompanyIds.Count > 0
            ? await _db.CompanyBridges.IgnoreQueryFilters()
                .Where(b => b.TenantId == tenantId.Value && b.DeletedAt == null && tenantCompanyIds.Contains(b.InsuranceCompanyId))
                .GroupBy(b => b.InsuranceCompanyId)
                .ToDictionaryAsync(g => g.Key, g => g.First(), ct)
            : new Dictionary<Guid, Kalypsis.Domain.Entities.CompanyBridge>();
        var ruleCounts = tenantId.HasValue && tenantCompanyIds.Count > 0
            ? await _db.CommissionRules.IgnoreQueryFilters()
                .Where(r => r.TenantId == tenantId.Value && r.DeletedAt == null && r.InsuranceCompanyId.HasValue && tenantCompanyIds.Contains(r.InsuranceCompanyId.Value))
                .GroupBy(r => r.InsuranceCompanyId!.Value)
                .ToDictionaryAsync(g => g.Key, g => g.Count(), ct)
            : new Dictionary<Guid, int>();
        var companyCodes = rows.Select(c => c.Code).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var parameterCounts = companyCodes.Count > 0
            ? (await _db.CompanyParameterItems.IgnoreQueryFilters()
                .Include(p => p.InsuranceCompany)
                .Where(p => p.DeletedAt == null && p.IsActive && companyCodes.Contains(p.InsuranceCompany.Code))
                .Select(p => new { p.InsuranceCompany.Code, p.Id })
                .ToListAsync(ct))
                .GroupBy(p => p.Code, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        // Which universal carriers the tenant has explicitly opted-in to. Empty
        // for platform-level users (no tenant context). Wrapped in a try/catch
        // so a partial deploy where the paired migration hasn't applied yet
        // doesn't wipe out the entire carrier list — the schema safety net
        // will create the table on the next boot anyway.
        var optInSet = new HashSet<Guid>();
        if (tenantId.HasValue)
        {
            try
            {
                var optIns = await _db.TenantCarrierOptIns.IgnoreQueryFilters()
                    .Where(o => o.TenantId == tenantId.Value && o.DeletedAt == null)
                    .Select(o => o.InsuranceCompanyId)
                    .ToListAsync(ct);
                optInSet = new HashSet<Guid>(optIns);
            }
            catch
            {
                // Table not there yet — treat as no opt-ins so every universal
                // carrier still shows in the catalog.
            }
        }

        var dtos = rows.Select(c => ToDto(c, tenantByCode, bridges, ruleCounts, parameterCounts, optInSet)).ToList();
        // Operational surfaces (γέφυρες, policy carrier picker, commission runs...)
        // pass ?onlyUsed=true so the user only picks from carriers their office
        // actually does business with. The catalog page omits it and shows both.
        if (onlyUsed && tenantId.HasValue)
            dtos = dtos.Where(d => d.IsUsedByTenant).ToList();
        return Ok(dtos);
    }

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<InsuranceCompanyExtendedDto>> Create([FromBody] UpsertCompanyBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId
            ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var code = NormalizeCode(body.Code);
        ValidateCompanyBody(body.Name, code);
        if (await _db.InsuranceCompanies.IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == tenantId && x.DeletedAt == null && x.Code == code, ct))
            throw new Kalypsis.Application.Common.AppException("company_code_exists",
                "Υπάρχει ήδη ασφαλιστική εταιρεία με αυτόν τον κωδικό στο γραφείο.", 400,
                title: "Διπλός κωδικός εταιρείας",
                why: "Ο κωδικός εταιρείας χρησιμοποιείται για γέφυρες, παραμετρικά και προμήθειες.",
                fix: "Επιλέξτε την υπάρχουσα εταιρεία ή αλλάξτε τον κωδικό πριν αποθηκεύσετε.");

        // Block agencies from creating a tenant-scoped copy of a carrier that
        // is already global. Global carriers ARE already visible to every
        // agency — creating a tenant copy would just produce a duplicate.
        if (await _db.InsuranceCompanies.IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == null && x.DeletedAt == null && x.Code == code, ct))
            throw new Kalypsis.Application.Common.AppException("global_company_exists",
                "Υπάρχει ήδη καθολική ασφαλιστική με αυτόν τον κωδικό — δεν χρειάζεται να την προσθέσετε ξανά.",
                400,
                title: "Καθολική εταιρεία",
                why: "Καθολικές εταιρείες είναι ήδη ορατές σε όλα τα γραφεία. Αν τη δημιουργούσατε εδώ, θα εμφανιζόταν δύο φορές παντού.",
                fix: "Χρησιμοποιήστε την υπάρχουσα από τη λίστα ή ζητήστε από τον superadmin να δημιουργήσει νέα καθολική.");

        var c = new Kalypsis.Domain.Entities.InsuranceCompany
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = body.Name.Trim(),
            Code = code,
            Country = Clean(body.Country),
            Website = Clean(body.Website),
            IsActive = body.IsActive,
            AgentCode = Clean(body.AgentCode),
            ContactName = Clean(body.ContactName),
            ContactEmail = Clean(body.ContactEmail),
            ContactPhone = Clean(body.ContactPhone),
            AfmVat = Clean(body.AfmVat),
            Notes = Clean(body.Notes),
            CreatedAt = _clock.UtcNow
        };
        _db.InsuranceCompanies.Add(c);
        if (body.CreateBridge) await EnsureBridgeAsync(tenantId, c, body, ct);
        if (body.InstallZeroCommissionDefaults) await SeedZeroCommissionDefaultsAsync(tenantId, c.Id, ct);
        await _db.SaveChangesAsync(ct);
        var bridge = await _db.CompanyBridges.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.DeletedAt == null && b.InsuranceCompanyId == c.Id, ct);
        var ruleCount = await _db.CommissionRules.IgnoreQueryFilters()
            .CountAsync(r => r.TenantId == tenantId && r.DeletedAt == null && r.InsuranceCompanyId == c.Id, ct);
        return Ok(new InsuranceCompanyExtendedDto(c.Id, c.Name, c.Code, c.Country, c.Website, c.IsActive,
            c.TenantId, false, c.Id, true, bridge?.Id, bridge != null, ruleCount, await CountParameterItemsAsync(c.Code, ct),
            c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes,
            IsUsedByTenant: true));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<InsuranceCompanyExtendedDto>> Update(Guid id, [FromBody] UpsertCompanyBody body, CancellationToken ct)
    {
        var c = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_db.InsuranceCompanies.IgnoreQueryFilters().Where(x => x.Id == id), ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Ασφαλιστική");
        // Only tenant-owned rows may be edited via this endpoint. Global carriers
        // are managed by PlatformAdmin via the platform settings.
        if (c.TenantId == null || c.TenantId != _current.TenantId)
            return Forbid();
        var code = NormalizeCode(body.Code);
        ValidateCompanyBody(body.Name, code);
        if (await _db.InsuranceCompanies.IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == c.TenantId && x.DeletedAt == null && x.Id != c.Id && x.Code == code, ct))
            throw new Kalypsis.Application.Common.AppException("company_code_exists",
                "Υπάρχει ήδη ασφαλιστική εταιρεία με αυτόν τον κωδικό στο γραφείο.", 400);
        c.Name = body.Name.Trim();
        c.Code = code;
        c.Country = Clean(body.Country); c.Website = Clean(body.Website); c.IsActive = body.IsActive;
        c.AgentCode = Clean(body.AgentCode); c.ContactName = Clean(body.ContactName);
        c.ContactEmail = Clean(body.ContactEmail); c.ContactPhone = Clean(body.ContactPhone);
        c.AfmVat = Clean(body.AfmVat); c.Notes = Clean(body.Notes);
        c.UpdatedAt = _clock.UtcNow;
        if (body.CreateBridge) await EnsureBridgeAsync(c.TenantId.Value, c, body, ct);
        if (body.InstallZeroCommissionDefaults) await SeedZeroCommissionDefaultsAsync(c.TenantId.Value, c.Id, ct);
        await _db.SaveChangesAsync(ct);
        var bridge = await _db.CompanyBridges.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.TenantId == c.TenantId && b.DeletedAt == null && b.InsuranceCompanyId == c.Id, ct);
        var ruleCount = await _db.CommissionRules.IgnoreQueryFilters()
            .CountAsync(r => r.TenantId == c.TenantId && r.DeletedAt == null && r.InsuranceCompanyId == c.Id, ct);
        return Ok(new InsuranceCompanyExtendedDto(c.Id, c.Name, c.Code, c.Country, c.Website, c.IsActive,
            c.TenantId, false, c.Id, true, bridge?.Id, bridge != null, ruleCount, await CountParameterItemsAsync(c.Code, ct),
            c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes,
            IsUsedByTenant: true));
    }

    [HttpPost("{id:guid}/import-default")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<InsuranceCompanyExtendedDto>> ImportDefault(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId
            ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var global = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == null && x.DeletedAt == null, ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Default insurance company");

        // Global carriers (especially the Grand Cover broker + its 49 subs)
        // are already visible to every tenant via the listing endpoint —
        // creating a tenant-scoped copy here only produced "two Grand Covers"
        // in every dropdown + bridge page. Reject the action and clean up
        // any leftover tenant copy of this exact carrier so the symptom heals.
        var existingTenantCopy = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.Code == global.Code)
            .ToListAsync(ct);
        if (existingTenantCopy.Count > 0)
        {
            foreach (var copy in existingTenantCopy)
            {
                copy.DeletedAt = _clock.UtcNow;
                copy.IsActive = false;
            }
            await _db.SaveChangesAsync(ct);
        }
        throw new Kalypsis.Application.Common.AppException("global_already_visible",
            "Η εταιρία είναι ήδη καθολική — δεν χρειάζεται εισαγωγή. Είναι ορατή σε όλα τα γραφεία αυτόματα.",
            400,
            title: "Καθολική εταιρεία",
            why: "Αν δημιουργούσαμε αντίγραφο στο γραφείο, η εταιρία θα εμφανιζόταν δύο φορές στα dropdowns, γέφυρες και φίλτρα.",
            fix: "Χρησιμοποιήστε την υπάρχουσα καθολική εγγραφή. Τυχόν αντίγραφα διαγράφηκαν αυτόματα.");

        #pragma warning disable CS0162 // unreachable
        var tenantCompany = await InstallDefaultCompanyAsync(tenantId, global, ct);
        await _db.SaveChangesAsync(ct);
        var bridge = await _db.CompanyBridges.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.DeletedAt == null && b.InsuranceCompanyId == tenantCompany.Id, ct);
        var ruleCount = await _db.CommissionRules.IgnoreQueryFilters()
            .CountAsync(r => r.TenantId == tenantId && r.DeletedAt == null && r.InsuranceCompanyId == tenantCompany.Id, ct);
        return Ok(new InsuranceCompanyExtendedDto(tenantCompany.Id, tenantCompany.Name, tenantCompany.Code, tenantCompany.Country, tenantCompany.Website, tenantCompany.IsActive,
            tenantCompany.TenantId, false, tenantCompany.Id, true, bridge?.Id, bridge != null, ruleCount, await CountParameterItemsAsync(tenantCompany.Code, ct),
            tenantCompany.AgentCode, tenantCompany.ContactName, tenantCompany.ContactEmail, tenantCompany.ContactPhone, tenantCompany.AfmVat, tenantCompany.Notes,
            IsUsedByTenant: true));
    }

    [HttpPost("import-defaults")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ImportDefaultCompaniesResult>> ImportDefaults(CancellationToken ct)
    {
        var tenantId = _current.TenantId
            ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        // Sweep any tenant-scoped copies of global carriers — they would
        // otherwise show as duplicates in dropdowns and γέφυρες.
        var globalCodes = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.TenantId == null && x.DeletedAt == null)
            .Select(x => x.Code)
            .ToListAsync(ct);
        var tenantDupes = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && globalCodes.Contains(x.Code))
            .ToListAsync(ct);
        foreach (var d in tenantDupes)
        {
            d.DeletedAt = _clock.UtcNow;
            d.IsActive = false;
        }
        if (tenantDupes.Count > 0) await _db.SaveChangesAsync(ct);
        throw new Kalypsis.Application.Common.AppException("globals_already_visible",
            "Οι καθολικές εταιρείες είναι ήδη ορατές σε όλα τα γραφεία — δεν χρειάζεται εισαγωγή.",
            400,
            title: "Καθολικός κατάλογος",
            why: "Η εισαγωγή θα δημιουργούσε αντίγραφα στο γραφείο που θα εμφανίζονταν δύο φορές παντού (dropdowns, γέφυρες, φίλτρα).",
            fix: "Δουλέψτε απευθείας με τις καθολικές εγγραφές. Τυχόν αντίγραφα έχουν διαγραφεί αυτόματα.");
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var c = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_db.InsuranceCompanies.IgnoreQueryFilters().Where(x => x.Id == id), ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Ασφαλιστική");
        if (c.TenantId == null) return BadRequest(new { code = "global_company", message = "Δεν διαγράφεται καθολική ασφαλιστική." });
        if (c.TenantId != _current.TenantId) return Forbid();
        c.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record OptInToggleResult(Guid InsuranceCompanyId, bool IsUsedByTenant);

    /// Flips the "Χρησιμοποιώ" mark on a universal (Kalypsis-managed) carrier
    /// for the current tenant. Idempotent — reactivates a soft-deleted opt-in
    /// row instead of inserting a duplicate.
    [HttpPost("{id:guid}/opt-in")]
    public async Task<ActionResult<OptInToggleResult>> OptInCarrier(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var c = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Ασφαλιστική");
        if (c.TenantId != null)
            // Tenant-owned rows are implicitly used — no opt-in row needed.
            return Ok(new OptInToggleResult(id, true));

        var existing = await _db.TenantCarrierOptIns.IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.InsuranceCompanyId == id, ct);
        if (existing is null)
        {
            _db.TenantCarrierOptIns.Add(new Kalypsis.Domain.Entities.TenantCarrierOptIn
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InsuranceCompanyId = id,
                EnabledAt = _clock.UtcNow,
                CreatedAt = _clock.UtcNow
            });
        }
        else if (existing.DeletedAt != null)
        {
            existing.DeletedAt = null;
            existing.EnabledAt = _clock.UtcNow;
            existing.UpdatedAt = _clock.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new OptInToggleResult(id, true));
    }

    [HttpDelete("{id:guid}/opt-in")]
    public async Task<ActionResult<OptInToggleResult>> OptOutCarrier(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var existing = await _db.TenantCarrierOptIns.IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.InsuranceCompanyId == id && o.DeletedAt == null, ct);
        if (existing != null)
        {
            existing.DeletedAt = _clock.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new OptInToggleResult(id, false));
    }

    // ============== PLATFORM ADMIN: global carrier management ==============

    public record PlatformCarrierBody(
        string Name, string Code, string? Country, string? Website, bool IsActive,
        string? Notes, bool IsBroker = false, Guid? ParentCompanyId = null,
        IReadOnlyList<string>? ExcludedBranchCodes = null);

    /// <summary>Lists every global carrier (TenantId IS NULL) for the platform admin UI.</summary>
    [HttpGet("/api/platform/insurance-companies")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<object>>> PlatformList(CancellationToken ct)
    {
        var rows = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.TenantId == null && c.DeletedAt == null)
            .OrderBy(c => c.ParentCompanyId == null ? 0 : 1)
            .ThenBy(c => c.Name)
            .ToListAsync(ct);
        var paramCounts = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null)
            .GroupBy(p => p.InsuranceCompanyId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);
        return Ok(rows.Select(c => new {
            id = c.Id,
            name = c.Name,
            code = c.Code,
            country = c.Country,
            website = c.Website,
            isActive = c.IsActive,
            isBroker = c.IsBroker,
            parentCompanyId = c.ParentCompanyId,
            notes = c.Notes,
            excludedBranchCodesJson = c.ExcludedBranchCodesJson,
            parameterItemCount = paramCounts.GetValueOrDefault(c.Id, 0)
        }).ToList());
    }

    [HttpPost("/api/platform/insurance-companies")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<object>> PlatformCreate([FromBody] PlatformCarrierBody body, CancellationToken ct)
    {
        var code = NormalizeCode(body.Code);
        ValidateCompanyBody(body.Name, code);
        if (await _db.InsuranceCompanies.IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == null && x.DeletedAt == null && x.Code == code, ct))
            throw new Kalypsis.Application.Common.AppException("global_company_code_exists",
                "Υπάρχει ήδη καθολική ασφαλιστική με αυτόν τον κωδικό.", 400);
        var c = new Kalypsis.Domain.Entities.InsuranceCompany
        {
            Id = Guid.NewGuid(),
            TenantId = null,
            Name = body.Name.Trim(),
            Code = code,
            Country = Clean(body.Country),
            Website = Clean(body.Website),
            IsActive = body.IsActive,
            Notes = Clean(body.Notes),
            IsBroker = body.IsBroker,
            ParentCompanyId = body.ParentCompanyId,
            ExcludedBranchCodesJson = body.ExcludedBranchCodes is { Count: > 0 }
                ? System.Text.Json.JsonSerializer.Serialize(body.ExcludedBranchCodes)
                : null,
            CreatedAt = _clock.UtcNow
        };
        _db.InsuranceCompanies.Add(c);
        await _db.SaveChangesAsync(ct);
        return Ok(new { id = c.Id, name = c.Name, code = c.Code, isBroker = c.IsBroker, parentCompanyId = c.ParentCompanyId });
    }

    [HttpPut("/api/platform/insurance-companies/{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<object>> PlatformUpdate(Guid id, [FromBody] PlatformCarrierBody body, CancellationToken ct)
    {
        var c = await _db.InsuranceCompanies.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Ασφαλιστική");
        if (c.TenantId != null)
            return BadRequest(new { code = "not_global", message = "Αυτό το endpoint διαχειρίζεται μόνο καθολικές ασφαλιστικές." });
        var code = NormalizeCode(body.Code);
        ValidateCompanyBody(body.Name, code);
        if (await _db.InsuranceCompanies.IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == null && x.DeletedAt == null && x.Id != id && x.Code == code, ct))
            throw new Kalypsis.Application.Common.AppException("global_company_code_exists",
                "Υπάρχει ήδη καθολική ασφαλιστική με αυτόν τον κωδικό.", 400);
        c.Name = body.Name.Trim();
        c.Code = code;
        c.Country = Clean(body.Country);
        c.Website = Clean(body.Website);
        c.IsActive = body.IsActive;
        c.Notes = Clean(body.Notes);
        c.IsBroker = body.IsBroker;
        c.ParentCompanyId = body.ParentCompanyId;
        c.ExcludedBranchCodesJson = body.ExcludedBranchCodes is { Count: > 0 }
            ? System.Text.Json.JsonSerializer.Serialize(body.ExcludedBranchCodes)
            : null;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { id = c.Id, name = c.Name, code = c.Code });
    }

    [HttpDelete("/api/platform/insurance-companies/{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult> PlatformDelete(Guid id, CancellationToken ct)
    {
        var c = await _db.InsuranceCompanies.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Ασφαλιστική");
        if (c.TenantId != null)
            return BadRequest(new { code = "not_global", message = "Αυτό το endpoint διαχειρίζεται μόνο καθολικές ασφαλιστικές." });
        c.DeletedAt = _clock.UtcNow;
        c.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private InsuranceCompanyExtendedDto ToDto(
        Kalypsis.Domain.Entities.InsuranceCompany c,
        IReadOnlyDictionary<string, Kalypsis.Domain.Entities.InsuranceCompany> tenantByCode,
        IReadOnlyDictionary<Guid, Kalypsis.Domain.Entities.CompanyBridge> bridges,
        IReadOnlyDictionary<Guid, int> ruleCounts,
        IReadOnlyDictionary<string, int> parameterCounts,
        HashSet<Guid> optInSet)
    {
        var tenantCopy = c.TenantId == null && tenantByCode.TryGetValue(c.Code, out var copy) ? copy : c.TenantId != null ? c : null;
        var bridgeCompanyId = tenantCopy?.Id ?? c.Id;
        bridges.TryGetValue(bridgeCompanyId, out var bridge);
        ruleCounts.TryGetValue(bridgeCompanyId, out var ruleCount);
        parameterCounts.TryGetValue(c.Code, out var parameterCount);
        // Universal rows opt-in through TenantCarrierOptIn; tenant-scoped rows
        // are implicitly used (the tenant created them).
        var isUsedByTenant = c.TenantId != null || optInSet.Contains(c.Id);
        return new InsuranceCompanyExtendedDto(
            c.Id, c.Name, c.Code, c.Country, c.Website, c.IsActive,
            c.TenantId, c.TenantId == null,
            tenantCopy?.Id, tenantCopy != null,
            bridge?.Id, bridge != null, ruleCount, parameterCount,
            c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes,
            c.IsBroker, c.ParentCompanyId,
            isUsedByTenant);
    }

    private async Task<int> CountParameterItemsAsync(string companyCode, CancellationToken ct) =>
        await _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(p => p.InsuranceCompany)
            .CountAsync(p => p.DeletedAt == null && p.IsActive && p.InsuranceCompany.Code == companyCode, ct);

    private async Task<Kalypsis.Domain.Entities.InsuranceCompany> InstallDefaultCompanyAsync(
        Guid tenantId,
        Kalypsis.Domain.Entities.InsuranceCompany global,
        CancellationToken ct)
    {
        var existing = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null && x.Code == global.Code, ct);
        if (existing is not null)
        {
            await EnsureBridgeAsync(tenantId, existing, null, ct);
            await SeedZeroCommissionDefaultsAsync(tenantId, existing.Id, ct);
            return existing;
        }

        var c = new Kalypsis.Domain.Entities.InsuranceCompany
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = global.Name,
            Code = global.Code,
            Country = global.Country,
            Website = global.Website,
            IsActive = true,
            Notes = "Imported from Kalypsis default catalogue.",
            CreatedAt = _clock.UtcNow
        };
        _db.InsuranceCompanies.Add(c);
        await EnsureBridgeAsync(tenantId, c, null, ct);
        await SeedZeroCommissionDefaultsAsync(tenantId, c.Id, ct);
        return c;
    }

    private async Task<bool> EnsureBridgeAsync(
        Guid tenantId,
        Kalypsis.Domain.Entities.InsuranceCompany company,
        UpsertCompanyBody? body,
        CancellationToken ct)
    {
        var existing = await _db.CompanyBridges.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.DeletedAt == null && b.InsuranceCompanyId == company.Id, ct);
        if (existing is not null)
        {
            if (body is not null)
            {
                existing.Name = string.IsNullOrWhiteSpace(body.BridgeName) ? $"{company.Name} bridge" : body.BridgeName.Trim();
                existing.AutoSync = body.BridgeAutoSync;
                existing.ConfigJson = Clean(body.BridgeConfigJson);
                existing.UpdatedAt = _clock.UtcNow;
            }
            return false;
        }

        _db.CompanyBridges.Add(new Kalypsis.Domain.Entities.CompanyBridge
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = string.IsNullOrWhiteSpace(body?.BridgeName) ? $"{company.Name} bridge" : body!.BridgeName!.Trim(),
            InsuranceCompanyId = company.Id,
            Kind = Kalypsis.Domain.Entities.CompanyBridgeKind.Manual,
            ConfigJson = Clean(body?.BridgeConfigJson) ?? "{\"mode\":\"manual\",\"status\":\"pending-configuration\"}",
            IsActive = true,
            AutoSync = body?.BridgeAutoSync ?? false,
            Notes = "Created by company setup to prevent missing bridge linkage.",
            CreatedAt = _clock.UtcNow
        });
        return true;
    }

    private async Task<int> SeedZeroCommissionDefaultsAsync(Guid tenantId, Guid companyId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(_clock.UtcNow);
        var companyCode = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.Id == companyId && c.DeletedAt == null)
            .Select(c => c.Code)
            .FirstOrDefaultAsync(ct);
        var companyParams = string.IsNullOrWhiteSpace(companyCode)
            ? new List<Kalypsis.Domain.Entities.CompanyParameterItem>()
            : await _db.CompanyParameterItems.IgnoreQueryFilters()
                .Include(p => p.InsuranceCompany)
                .Where(p => p.DeletedAt == null && p.IsActive && p.InsuranceCompany.Code == companyCode)
                .ToListAsync(ct);
        var existing = await _db.CommissionRules.IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null && r.InsuranceCompanyId == companyId)
            .Select(r => new { r.PolicyType, r.VehicleUseCategory, r.ProducerTier, r.ProducerId, r.CoverCode })
            .ToListAsync(ct);

        var created = 0;
        var tiers = new[]
        {
            ProducerTier.A, ProducerTier.B, ProducerTier.C, ProducerTier.D, ProducerTier.E
        };
        var branchTypes = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.Branch && p.PolicyType.HasValue)
            .Select(p => p.PolicyType!.Value)
            .Distinct()
            .ToList();
        if (branchTypes.Count == 0)
            branchTypes = Enum.GetValues<PolicyType>().ToList();
        var autoUses = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.Use && p.VehicleUseCategory.HasValue && p.VehicleUseCategory != VehicleUseCategory.None)
            .Select(p => p.VehicleUseCategory!.Value)
            .Distinct()
            .ToList();
        if (autoUses.Count == 0)
            autoUses = Enum.GetValues<VehicleUseCategory>().Where(x => x != VehicleUseCategory.None).ToList();
        var coverages = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.Coverage && p.PolicyType.HasValue && !string.IsNullOrWhiteSpace(p.Code))
            .Select(p => new { PolicyType = p.PolicyType!.Value, CoverCode = p.Code })
            .Distinct()
            .ToList();

        bool Exists(PolicyType policyType, VehicleUseCategory? vehicleUse, ProducerTier tier, string? coverCode) =>
            existing.Any(r => r.ProducerId == null
                && r.CoverCode == coverCode
                && r.PolicyType == policyType
                && r.VehicleUseCategory == vehicleUse
                && r.ProducerTier == tier);

        void Add(PolicyType policyType, VehicleUseCategory? vehicleUse, ProducerTier tier, string? coverCode = null)
        {
            if (Exists(policyType, vehicleUse, tier, coverCode)) return;
            _db.CommissionRules.Add(new Kalypsis.Domain.Entities.CommissionRule
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InsuranceCompanyId = companyId,
                PolicyType = policyType,
                VehicleUseCategory = vehicleUse,
                ProducerTier = tier,
                CoverCode = coverCode,
                AgencyPercent = 0m,
                ProducerPercent = 0m,
                Value = 0m,
                CommissionType = CommissionType.Percentage,
                EffectiveFrom = today,
                CreatedAt = _clock.UtcNow
            });
            created++;
        }

        foreach (var tier in tiers)
        {
            if (branchTypes.Contains(PolicyType.Auto))
                foreach (var use in autoUses) Add(PolicyType.Auto, use, tier);
            foreach (var policyType in branchTypes.Where(x => x != PolicyType.Auto))
                Add(policyType, null, tier);
            foreach (var coverage in coverages)
                Add(coverage.PolicyType, null, tier, coverage.CoverCode);
        }

        return created;
    }

    private static string NormalizeCode(string? code)
    {
        var cleaned = new string((code ?? "").Trim().ToUpperInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '_')
            .ToArray());
        while (cleaned.Contains("__", StringComparison.Ordinal)) cleaned = cleaned.Replace("__", "_", StringComparison.Ordinal);
        return cleaned.Trim('_');
    }

    private static string? Clean(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static void ValidateCompanyBody(string? name, string code)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(code))
            throw new Kalypsis.Application.Common.AppException("company_required",
                "Συμπληρώστε όνομα και κωδικό ασφαλιστικής εταιρείας.", 400,
                title: "Λείπουν βασικά στοιχεία",
                why: "Η εταιρεία δεν μπορεί να συνδεθεί σωστά με γέφυρες και παραμετρικά χωρίς σταθερό όνομα και κωδικό.",
                fix: "Συμπληρώστε τα δύο υποχρεωτικά πεδία και ξαναδοκιμάστε.");
    }
}
