using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Persistence.Seeders;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/statutory-insurance-branches")]
[Authorize(Policy = "AgencyStaff")]
public sealed class StatutoryInsuranceBranchesController(AppDbContext db, ICurrentUser current) : ControllerBase
{
    public sealed record BranchBody(Guid InsuranceCompanyId, string Code, string Name, string Category);

    private async Task<bool> HasCompanyAsync(Guid tenantId, Guid companyId, CancellationToken ct) =>
        await db.InsuranceCompanies.AnyAsync(x => x.Id == companyId && x.DeletedAt == null
            && (x.TenantId == tenantId || x.TenantId == null), ct);

    private static object Dto(StatutoryInsuranceBranch x) => new
    {
        x.Id, x.Code, x.Name, x.Category, x.DisplayOrder, IsDefault = x.SeedCode != null
    };

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid insuranceCompanyId, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        if (!await HasCompanyAsync(tenantId, insuranceCompanyId, ct)) return NotFound();

        // A company selected by the office gets the same official catalogue.
        // Its bridge and carrier-specific codes remain completely separate.
        await StatutoryInsuranceBranchCatalog.EnsureForCompanyAsync(db, tenantId, insuranceCompanyId, ct);
        var rows = await db.StatutoryInsuranceBranches.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.InsuranceCompanyId == insuranceCompanyId)
            .OrderBy(x => x.DisplayOrder)
            .ToListAsync(ct);
        return Ok(rows.Select(Dto));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BranchBody body, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        if (!await HasCompanyAsync(tenantId, body.InsuranceCompanyId, ct)) return NotFound();
        var code = (body.Code ?? "").Trim().ToUpperInvariant();
        var name = (body.Name ?? "").Trim();
        if (code.Length is < 1 or > 8 || name.Length is < 1 or > 200 || body.Category is not ("Ζημιών" or "Ζωής"))
            return BadRequest("Συμπληρώστε κωδικό, ονομασία και κατηγορία κλάδου.");
        var row = await db.StatutoryInsuranceBranches.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenantId
            && x.InsuranceCompanyId == body.InsuranceCompanyId && x.Code == code, ct);
        if (row is not null && row.DeletedAt is null) return Conflict("Ο κωδικός κλάδου υπάρχει ήδη στην εταιρεία.");
        if (row is null)
        {
            row = new StatutoryInsuranceBranch { TenantId = tenantId, InsuranceCompanyId = body.InsuranceCompanyId,
                Code = code, DisplayOrder = (await db.StatutoryInsuranceBranches.Where(x => x.TenantId == tenantId
                    && x.InsuranceCompanyId == body.InsuranceCompanyId).MaxAsync(x => (int?)x.DisplayOrder, ct) ?? 0) + 1 };
            db.StatutoryInsuranceBranches.Add(row);
        }
        row.DeletedAt = null; row.Name = name; row.Category = body.Category;
        await db.SaveChangesAsync(ct);
        return Ok(Dto(row));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BranchBody body, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var row = await db.StatutoryInsuranceBranches.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (row is null) return NotFound();
        var code = (body.Code ?? "").Trim().ToUpperInvariant();
        var name = (body.Name ?? "").Trim();
        if (body.InsuranceCompanyId != row.InsuranceCompanyId || code.Length is < 1 or > 8
            || name.Length is < 1 or > 200 || body.Category is not ("Ζημιών" or "Ζωής")) return BadRequest();
        if (await db.StatutoryInsuranceBranches.IgnoreQueryFilters().AnyAsync(x => x.Id != id && x.TenantId == tenantId
            && x.InsuranceCompanyId == row.InsuranceCompanyId && x.Code == code, ct)) return Conflict("Ο κωδικός κλάδου υπάρχει ήδη στην εταιρεία.");
        row.Code = code; row.Name = name; row.Category = body.Category;
        await db.SaveChangesAsync(ct);
        return Ok(Dto(row));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var row = await db.StatutoryInsuranceBranches.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (row is null) return NotFound();
        row.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
