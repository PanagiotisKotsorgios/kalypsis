using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Exports;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

// Universal CSV / XLSX / PDF exports for every backoffice list.
// Lives under /api/data-exports/{entity} to avoid colliding with the legacy
// CSV-only ExportsController in CommissionRunsController.cs (/api/exports/<name>.csv).
[ApiController]
[Route("api/data-exports")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("exports.run")]
public class DataExportsController : ControllerBase
{
    private readonly IMediator _mediator;
    public DataExportsController(IMediator mediator) => _mediator = mediator;

    // GET /api/data-exports/{entity}?format=xlsx&search=...
    // Known entities: customers, policies, claims, producers, insurance-companies,
    // commission-rules, branches, tariffs, tasks, receipts, payments,
    // appointments, cover-notes, email-templates, notifications.
    [HttpGet("{entity}")]
    public async Task<IActionResult> Export(
        string entity,
        [FromQuery] string format = "xlsx",
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new UniversalExportQuery(entity, format, search), ct);
        return File(result.Content, result.MimeType, result.FileName);
    }
}
