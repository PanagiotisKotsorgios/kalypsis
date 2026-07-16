using Kalypsis.Application.Features.PlatformStorage;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/storage")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformStorageController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformStorageController(IMediator m) => _m = m;

    [HttpGet("breakdown")]
    public async Task<ActionResult<StorageBreakdownDto>> Breakdown(CancellationToken ct)
        => Ok(await _m.Send(new GetStorageBreakdownQuery(), ct));
}
