using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Commissions;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/commissions/import")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.BackOffice)]
public class CommissionImportController : ControllerBase
{
    private readonly IMediator _m;
    public CommissionImportController(IMediator m) => _m = m;

    /// <summary>
    /// Accepts a CSV file (Greek or English headers; semicolon or comma separated)
    /// from a carrier and reconciles paid commissions against existing transactions.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<CommissionImportResult>> Import(
        IFormFile file,
        [FromQuery] string companyCode,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Δεν επιλέξατε αρχείο." });

        using var reader = new StreamReader(file.OpenReadStream());
        var content = await reader.ReadToEndAsync(ct);
        return Ok(await _m.Send(new ImportCommissionsCommand(content, companyCode ?? "?"), ct));
    }
}
