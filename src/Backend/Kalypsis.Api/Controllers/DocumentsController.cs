using Kalypsis.Application.Features.Documents;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly IMediator _mediator;
    public DocumentsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PolicyDocumentDto>>> List(
        [FromQuery] Guid? policyId,
        [FromQuery] Guid? customerId,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListDocumentsQuery(policyId, customerId), cancellationToken));

    [HttpPost("upload")]
    [Authorize(Policy = "AgencyStaff")]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<PolicyDocumentDto>> Upload(
        [FromForm] Guid policyId,
        [FromForm] DocumentType type,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Δεν επιλέξατε αρχείο." });

        await using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadDocumentCommand(
            policyId, type, file.FileName,
            file.ContentType ?? "application/octet-stream",
            file.Length, stream), cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var (stream, fileName, mimeType) = await _mediator.Send(new DownloadDocumentQuery(id), cancellationToken);
        return File(stream, mimeType, fileName);
    }

    /// <summary>Same bytes as /download but with Content-Disposition: inline
    /// so the browser renders the PDF / image / text preview in-frame.</summary>
    [HttpGet("{id:guid}/preview")]
    public async Task<IActionResult> Preview(Guid id, CancellationToken cancellationToken)
    {
        var (stream, fileName, mimeType) = await _mediator.Send(new PreviewDocumentQuery(id), cancellationToken);
        // Set inline disposition explicitly — otherwise ASP.NET picks
        // attachment when the fileName is present.
        var cd = new System.Net.Mime.ContentDisposition
        {
            FileName = fileName,
            Inline = true,
        };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(stream, mimeType);
    }

    /// <summary>Swap the underlying file for an existing document row.
    /// Keeps the same id/policy link so any existing URLs stay valid.</summary>
    [HttpPut("{id:guid}/replace")]
    [Authorize(Policy = "AgencyStaff")]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<PolicyDocumentDto>> Replace(
        Guid id, IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Δεν επιλέξατε αρχείο." });
        await using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new ReplaceDocumentCommand(
            id, file.FileName,
            file.ContentType ?? "application/octet-stream",
            file.Length, stream), cancellationToken);
        return Ok(result);
    }

    /// <summary>Rename / change type without re-uploading.</summary>
    public record PatchDocumentBody(string? FileName, DocumentType? DocumentType);

    [HttpPatch("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDocumentDto>> Patch(
        Guid id, [FromBody] PatchDocumentBody body, CancellationToken cancellationToken)
    {
        var res = await _mediator.Send(new PatchDocumentCommand(id, body.FileName, body.DocumentType), cancellationToken);
        return Ok(res);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteDocumentCommand(id), cancellationToken);
        return NoContent();
    }
}
