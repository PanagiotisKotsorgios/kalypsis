using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Persistence.Seeders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/statutory-insurance-branches")]
[Authorize(Policy = "AgencyStaff")]
public sealed class StatutoryInsuranceBranchesController(AppDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid insuranceCompanyId, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var company = await db.InsuranceCompanies.AsNoTracking().FirstOrDefaultAsync(
            x => x.Id == insuranceCompanyId && x.DeletedAt == null && (x.TenantId == tenantId || x.TenantId == null), ct);
        if (company is null) return NotFound();

        // A company selected by the office gets the same official catalogue.
        // Its bridge and carrier-specific codes remain completely separate.
        await StatutoryInsuranceBranchCatalog.EnsureForCompanyAsync(db, tenantId, company.Id, ct);
        var rows = await db.StatutoryInsuranceBranches.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.InsuranceCompanyId == company.Id)
            .OrderBy(x => x.DisplayOrder)
            .Select(x => new { x.Id, x.Code, x.Name, x.Category, x.DisplayOrder })
            .ToListAsync(ct);
        return Ok(rows);
    }
}
