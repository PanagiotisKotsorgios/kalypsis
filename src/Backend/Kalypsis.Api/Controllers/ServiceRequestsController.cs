using Kalypsis.Application.Features.Requests;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/service-requests")]
[Authorize]
public class ServiceRequestsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ServiceRequestsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ServiceRequestDto>>> List(
        [FromQuery] ServiceRequestStatus? status,
        [FromQuery] ServiceRequestType? type,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListServiceRequestsQuery(status, type), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ServiceRequestDto>> Create(
        [FromBody] CreateServiceRequestBody body,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateServiceRequestCommand(body), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ServiceRequestDto>> UpdateStatus(
        Guid id,
        [FromBody] UpdateServiceRequestStatusBody body,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateServiceRequestStatusCommand(id, body), cancellationToken));

    [HttpPost("{id:guid}/attachments")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<ServiceRequestAttachmentDto>> Upload(
        Guid id,
        [FromForm] AttachmentCategory category,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Δεν επιλέξατε αρχείο." });

        await using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadAttachmentCommand(
            id, category, file.FileName, file.ContentType ?? "application/octet-stream", file.Length, stream),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("attachments/{attachmentId:guid}")]
    public async Task<IActionResult> Download(Guid attachmentId, CancellationToken cancellationToken)
    {
        var (stream, fileName, mimeType) = await _mediator.Send(
            new DownloadAttachmentQuery(attachmentId), cancellationToken);
        return File(stream, mimeType, fileName);
    }
}
