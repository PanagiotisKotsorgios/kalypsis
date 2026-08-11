using Kalypsis.Application.Features.CollectionFileBridges;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Γέφυρες αρχείων εισπράξεων — αναλυτικά αρχεία εισπράξεων που στέλνει
/// κάθε ασφαλιστική. Προς το παρόν υποστηρίζεται μόνο η Ατλαντική Ένωση
/// (Filcoldt.txt μέσα σε Collect_YYYYMMDDhhmmss.zip).
/// </summary>
[ApiController]
[Route("api/collection-file-bridges")]
[Authorize(Policy = "AgencyStaff")]
public class CollectionFileBridgesController : ControllerBase
{
    private readonly IMediator _mediator;
    public CollectionFileBridgesController(IMediator mediator) { _mediator = mediator; }

    public record PreviewBody(Guid InsuranceCompanyId, string FileName, string FileContentBase64);

    /// <summary>Parse + match, no DB writes.</summary>
    [HttpPost("preview")]
    public async Task<ActionResult<CollectionFilePreviewDto>> Preview([FromBody] PreviewBody body, CancellationToken ct)
    {
        var bytes = Convert.FromBase64String(body.FileContentBase64 ?? "");
        var result = await _mediator.Send(
            new PreviewCollectionFileCommand(body.InsuranceCompanyId, body.FileName ?? "collect.zip", bytes), ct);
        return Ok(result);
    }

    public record CommitBody(Guid InsuranceCompanyId, string FileName, IReadOnlyList<CollectionFileRow> Rows);

    /// <summary>Write Receipt rows for Ready lines the operator confirmed.</summary>
    [HttpPost("commit")]
    public async Task<ActionResult<CollectionFileCommitResult>> Commit([FromBody] CommitBody body, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new CommitCollectionFileCommand(body.InsuranceCompanyId, body.FileName ?? "collect.zip", body.Rows ?? Array.Empty<CollectionFileRow>()), ct);
        return Ok(result);
    }
}
