using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.EmailTemplates;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/email-templates")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Crm)]
public class EmailTemplatesController : ControllerBase
{
    private readonly IMediator _m;
    public EmailTemplatesController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmailTemplateDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListEmailTemplatesQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<EmailTemplateDto>> Create([FromBody] UpsertEmailTemplateBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateEmailTemplateCommand(body), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EmailTemplateDto>> Update(Guid id, [FromBody] UpsertEmailTemplateBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpdateEmailTemplateCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteEmailTemplateCommand(id), ct);
        return NoContent();
    }
}
