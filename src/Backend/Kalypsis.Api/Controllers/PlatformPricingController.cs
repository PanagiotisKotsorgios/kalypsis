using Kalypsis.Application.Features.PlatformAdmin;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>Superadmin-editable pricing catalog. GET is publicly readable
/// (used by the plans page + the tenant onboarding flow). PUT is
/// superadmin-only.</summary>
[ApiController]
[Route("api/platform/pricing")]
public class PlatformPricingController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformPricingController(IMediator m) => _m = m;

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<PricingCatalogDto>> Get(CancellationToken ct)
        => Ok(await _m.Send(new GetPricingCatalogQuery(), ct));

    [HttpPut]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<PricingCatalogDto>> Save(
        [FromBody] PricingCatalogDto catalog, CancellationToken ct)
        => Ok(await _m.Send(new SavePricingCatalogCommand(catalog), ct));
}
