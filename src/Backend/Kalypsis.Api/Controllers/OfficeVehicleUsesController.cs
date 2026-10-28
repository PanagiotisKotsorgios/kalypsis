using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Persistence.Seeders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/office-vehicle-uses")]
[Authorize(Policy = "AgencyStaff")]
public sealed class OfficeVehicleUsesController(AppDbContext db, ICurrentUser current) : ControllerBase
{
    public sealed record UseBody(Guid InsuranceCompanyId, string Code, string Name);
    private async Task<bool> HasCompanyAsync(Guid tenantId, Guid companyId, CancellationToken ct) =>
        await db.InsuranceCompanies.AnyAsync(x => x.Id == companyId && x.DeletedAt == null
            && (x.TenantId == tenantId || x.TenantId == null), ct);
    private static object Dto(OfficeVehicleUse x) => new { x.Id, x.Code, x.Name, x.DisplayOrder, IsDefault = x.SeedCode != null };

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid insuranceCompanyId, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        if (!await HasCompanyAsync(tenantId, insuranceCompanyId, ct)) return NotFound();
        await StatutoryInsuranceBranchCatalog.EnsureForCompanyAsync(db, tenantId, insuranceCompanyId, ct);
        var rows = await db.OfficeVehicleUses.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.InsuranceCompanyId == insuranceCompanyId)
            .OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        return Ok(rows.Select(Dto));
    }

    [HttpGet("available")]
    public async Task<IActionResult> Available(CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        await StatutoryInsuranceBranchCatalog.EnsureForTenantAsync(db, tenantId, ct);
        var rows = await db.OfficeVehicleUses.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        return Ok(rows.GroupBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g => new { g.First().Code, g.First().Name }).ToList());
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UseBody body, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        if (!await HasCompanyAsync(tenantId, body.InsuranceCompanyId, ct)) return NotFound();
        var code = (body.Code ?? "").Trim().ToUpperInvariant();
        var name = (body.Name ?? "").Trim();
        if (code.Length is < 1 or > 20 || name.Length is < 1 or > 80) return BadRequest("Συμπληρώστε κωδικό και χρήση οχήματος έως 80 χαρακτήρες.");
        var row = await db.OfficeVehicleUses.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenantId
            && x.InsuranceCompanyId == body.InsuranceCompanyId && x.Code == code, ct);
        if (row is not null && row.DeletedAt is null) return Conflict("Ο κωδικός χρήσης υπάρχει ήδη στην εταιρεία.");
        if (row is null)
        {
            row = new OfficeVehicleUse { TenantId = tenantId, InsuranceCompanyId = body.InsuranceCompanyId,
                Code = code, DisplayOrder = (await db.OfficeVehicleUses.Where(x => x.TenantId == tenantId
                    && x.InsuranceCompanyId == body.InsuranceCompanyId).MaxAsync(x => (int?)x.DisplayOrder, ct) ?? 0) + 1 };
            db.OfficeVehicleUses.Add(row);
        }
        row.DeletedAt = null; row.Name = name;
        await db.SaveChangesAsync(ct);
        return Ok(Dto(row));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UseBody body, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var row = await db.OfficeVehicleUses.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (row is null) return NotFound();
        var code = (body.Code ?? "").Trim().ToUpperInvariant();
        var name = (body.Name ?? "").Trim();
        if (body.InsuranceCompanyId != row.InsuranceCompanyId || code.Length is < 1 or > 20 || name.Length is < 1 or > 80) return BadRequest();
        if (await db.OfficeVehicleUses.IgnoreQueryFilters().AnyAsync(x => x.Id != id && x.TenantId == tenantId
            && x.InsuranceCompanyId == row.InsuranceCompanyId && x.Code == code, ct)) return Conflict("Ο κωδικός χρήσης υπάρχει ήδη στην εταιρεία.");
        row.Code = code; row.Name = name;
        await db.SaveChangesAsync(ct);
        return Ok(Dto(row));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var row = await db.OfficeVehicleUses.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (row is null) return NotFound();
        row.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
