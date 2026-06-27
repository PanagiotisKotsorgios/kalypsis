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
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListPoliciesQuery(search, status, type, customerId), cancellationToken));

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
        Guid? BridgeId, bool BridgeLinked, int CommissionDefaultCount,
        string? AgentCode, string? ContactName, string? ContactEmail, string? ContactPhone,
        string? AfmVat, string? Notes);

    public record UpsertCompanyBody(
        string Name, string Code, string? Country, string? Website, bool IsActive,
        string? AgentCode, string? ContactName, string? ContactEmail, string? ContactPhone,
        string? AfmVat, string? Notes,
        bool CreateBridge = true, string? BridgeName = null, bool BridgeAutoSync = false,
        string? BridgeConfigJson = null, bool InstallZeroCommissionDefaults = true);

    public record ImportDefaultCompaniesResult(
        int Imported, int AlreadyImported, int BridgesCreated, int CommissionRulesCreated);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InsuranceCompanyExtendedDto>>> List(CancellationToken ct)
    {
        var tenantId = _current.TenantId;
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

        return Ok(rows.Select(c => ToDto(c, tenantByCode, bridges, ruleCounts)).ToList());
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
            c.TenantId, false, c.Id, true, bridge?.Id, bridge != null, ruleCount,
            c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes));
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
            c.TenantId, false, c.Id, true, bridge?.Id, bridge != null, ruleCount,
            c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes));
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

        var tenantCompany = await InstallDefaultCompanyAsync(tenantId, global, ct);
        await _db.SaveChangesAsync(ct);
        var bridge = await _db.CompanyBridges.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.DeletedAt == null && b.InsuranceCompanyId == tenantCompany.Id, ct);
        var ruleCount = await _db.CommissionRules.IgnoreQueryFilters()
            .CountAsync(r => r.TenantId == tenantId && r.DeletedAt == null && r.InsuranceCompanyId == tenantCompany.Id, ct);
        return Ok(new InsuranceCompanyExtendedDto(tenantCompany.Id, tenantCompany.Name, tenantCompany.Code, tenantCompany.Country, tenantCompany.Website, tenantCompany.IsActive,
            tenantCompany.TenantId, false, tenantCompany.Id, true, bridge?.Id, bridge != null, ruleCount,
            tenantCompany.AgentCode, tenantCompany.ContactName, tenantCompany.ContactEmail, tenantCompany.ContactPhone, tenantCompany.AfmVat, tenantCompany.Notes));
    }

    [HttpPost("import-defaults")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ImportDefaultCompaniesResult>> ImportDefaults(CancellationToken ct)
    {
        var tenantId = _current.TenantId
            ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var globals = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.TenantId == null && x.DeletedAt == null && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var imported = 0;
        var already = 0;
        var bridgesCreated = 0;
        var rulesCreated = 0;
        foreach (var global in globals)
        {
            var existingBefore = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null && x.Code == global.Code, ct);
            var beforeCompanyExists = existingBefore is not null;
            var hadBridgeBefore = existingBefore is not null && await _db.CompanyBridges.IgnoreQueryFilters()
                .AnyAsync(b => b.TenantId == tenantId && b.DeletedAt == null && b.InsuranceCompanyId == existingBefore.Id, ct);
            var ruleCountBefore = existingBefore is null ? 0 : await _db.CommissionRules.IgnoreQueryFilters()
                .CountAsync(r => r.TenantId == tenantId && r.DeletedAt == null && r.InsuranceCompanyId == existingBefore.Id, ct);

            var tenantCompany = await InstallDefaultCompanyAsync(tenantId, global, ct);
            await _db.SaveChangesAsync(ct);
            if (beforeCompanyExists) already++; else imported++;

            var hasBridgeAfter = await _db.CompanyBridges.IgnoreQueryFilters()
                .AnyAsync(b => b.TenantId == tenantId && b.DeletedAt == null && b.InsuranceCompanyId == tenantCompany.Id, ct);
            if (!hadBridgeBefore && hasBridgeAfter) bridgesCreated++;

            var ruleCountAfter = await _db.CommissionRules.IgnoreQueryFilters()
                .CountAsync(r => r.TenantId == tenantId && r.DeletedAt == null && r.InsuranceCompanyId == tenantCompany.Id, ct);
            rulesCreated += Math.Max(0, ruleCountAfter - ruleCountBefore);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new ImportDefaultCompaniesResult(imported, already, bridgesCreated, rulesCreated));
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

    private InsuranceCompanyExtendedDto ToDto(
        Kalypsis.Domain.Entities.InsuranceCompany c,
        IReadOnlyDictionary<string, Kalypsis.Domain.Entities.InsuranceCompany> tenantByCode,
        IReadOnlyDictionary<Guid, Kalypsis.Domain.Entities.CompanyBridge> bridges,
        IReadOnlyDictionary<Guid, int> ruleCounts)
    {
        var tenantCopy = c.TenantId == null && tenantByCode.TryGetValue(c.Code, out var copy) ? copy : c.TenantId != null ? c : null;
        var bridgeCompanyId = tenantCopy?.Id ?? c.Id;
        bridges.TryGetValue(bridgeCompanyId, out var bridge);
        ruleCounts.TryGetValue(bridgeCompanyId, out var ruleCount);
        return new InsuranceCompanyExtendedDto(
            c.Id, c.Name, c.Code, c.Country, c.Website, c.IsActive,
            c.TenantId, c.TenantId == null,
            tenantCopy?.Id, tenantCopy != null,
            bridge?.Id, bridge != null, ruleCount,
            c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes);
    }

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
        var existing = await _db.CommissionRules.IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null && r.InsuranceCompanyId == companyId)
            .Select(r => new { r.PolicyType, r.VehicleUseCategory, r.ProducerTier, r.ProducerId, r.CoverCode })
            .ToListAsync(ct);

        var created = 0;
        var tiers = new[]
        {
            ProducerTier.A, ProducerTier.B, ProducerTier.C, ProducerTier.D, ProducerTier.E
        };
        var autoUses = Enum.GetValues<VehicleUseCategory>().Where(x => x != VehicleUseCategory.None).ToList();

        bool Exists(PolicyType policyType, VehicleUseCategory? vehicleUse, ProducerTier tier) =>
            existing.Any(r => r.ProducerId == null
                && r.CoverCode == null
                && r.PolicyType == policyType
                && r.VehicleUseCategory == vehicleUse
                && r.ProducerTier == tier);

        void Add(PolicyType policyType, VehicleUseCategory? vehicleUse, ProducerTier tier)
        {
            if (Exists(policyType, vehicleUse, tier)) return;
            _db.CommissionRules.Add(new Kalypsis.Domain.Entities.CommissionRule
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InsuranceCompanyId = companyId,
                PolicyType = policyType,
                VehicleUseCategory = vehicleUse,
                ProducerTier = tier,
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
            foreach (var use in autoUses) Add(PolicyType.Auto, use, tier);
            foreach (var policyType in Enum.GetValues<PolicyType>().Where(x => x != PolicyType.Auto))
                Add(policyType, null, tier);
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
